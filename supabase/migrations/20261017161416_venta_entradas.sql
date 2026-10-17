-- =============================================================================
-- Rio Pass · 12 · Venta de entradas con Mercado Pago (Checkout Pro)
-- =============================================================================
-- Flujo:
--   1. El cliente (con cuenta) elige sectores y cantidades en la página de la fecha.
--   2. La Edge Function "pagos" llama a create_ticket_order: valida precio, ventana
--      de venta y cupo, y RESERVA el cupo 15 minutos (pedido "pendiente").
--   3. Se crea la preferencia de Mercado Pago (external_reference = id del pedido)
--      y el cliente paga en Mercado Pago.
--   4. La notificación de Mercado Pago (o la vuelta del cliente) hace que la
--      función consulte el pago en la API de Mercado Pago (fuente de verdad) y
--      llame a apply_mp_payment: si está aprobado y el monto coincide, se emiten
--      los QR (tickets "entrada") en la cuenta del comprador.
--   5. Reembolsos y contracargos anulan los QR sin usar.
-- Las funciones que escriben pedidos y pagos solo las puede ejecutar el servidor
-- (service_role), nunca el navegador.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Columnas nuevas
-- -----------------------------------------------------------------------------
alter table public.orders
  add column expires_at timestamptz,
  add column mp_preference_id text,
  add column attention text check (attention is null or char_length(attention) <= 40);
comment on column public.orders.expires_at is 'Hasta cuándo se reserva el cupo de un pedido pendiente.';
comment on column public.orders.attention is 'Algo que el organizador tiene que revisar: sin_cupo, monto_distinto, reembolso_con_uso.';
create index orders_event_status_idx on public.orders (event_id, status);

alter table public.payments add column status_detail text;

-- Una persona puede pasarle una entrada comprada a otra; el código del QR cambia.
alter table public.tickets add column transferred_at timestamptz;

-- -----------------------------------------------------------------------------
-- Cupo: vendidas (QR emitidos sin anular) + reservadas (pedidos pendientes vigentes)
-- -----------------------------------------------------------------------------
create function private.ticket_type_taken(_ticket_type_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select (
    (select count(*) from public.tickets t
      where t.ticket_type_id = _ticket_type_id and t.order_id is not null and t.status <> 'anulado')
    +
    (select coalesce(sum(i.quantity), 0) from public.order_items i
      join public.orders o on o.id = i.order_id
      where i.ticket_type_id = _ticket_type_id and o.status = 'pendiente' and o.expires_at > now())
  )::integer
$$;

-- Hasta cuándo se vende un sector: su fin de venta o 4 h después de que empieza la fecha.
create function private.ticket_type_on_sale(_tt public.ticket_types, _event public.events)
returns boolean
language sql
stable
set search_path = ''
as $$
  select _event.status = 'publicado'
     and _tt.is_active
     and _tt.price > 0
     and now() >= coalesce(_tt.sales_start_at, '-infinity'::timestamptz)
     and now() < coalesce(_tt.sales_end_at, _event.starts_at + interval '4 hours')
$$;

-- Oferta pública de una fecha (sin datos personales).
create function public.event_ticket_offer(_event_id uuid)
returns table (ticket_type_id uuid, name text, price numeric, available integer, on_sale boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select tt.id, tt.name, tt.price,
         case when tt.quantity is null then null
              else greatest(tt.quantity - private.ticket_type_taken(tt.id), 0) end,
         private.ticket_type_on_sale(tt, e)
  from public.ticket_types tt
  join public.events e on e.id = tt.event_id
  where tt.event_id = _event_id and e.status = 'publicado' and tt.is_active and tt.price > 0
  order by tt.sort_order, tt.name
$$;

-- -----------------------------------------------------------------------------
-- Crear el pedido y reservar el cupo (solo servidor)
-- _items: [{"ticket_type_id": "...", "quantity": 2}, ...]
-- -----------------------------------------------------------------------------
create function public.create_ticket_order(_buyer uuid, _event_id uuid, _items jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  _event public.events;
  _buyer_profile public.profiles;
  _order_id uuid;
  _total numeric(12, 2) := 0;
  _count integer := 0;
  _item record;
  _tt public.ticket_types;
  _lines jsonb := '[]'::jsonb;
  _taken integer;
  _expires timestamptz := now() + interval '15 minutes';
begin
  select * into _buyer_profile from public.profiles where id = _buyer;
  if not found then
    raise exception 'comprador_inexistente';
  end if;
  select * into _event from public.events where id = _event_id;
  if not found or _event.status <> 'publicado' then
    raise exception 'evento_no_disponible';
  end if;
  if jsonb_typeof(_items) <> 'array' or jsonb_array_length(_items) = 0 then
    raise exception 'pedido_vacio';
  end if;

  -- Serializa las reservas de la fecha: dos personas no se llevan el último lugar.
  perform pg_advisory_xact_lock(hashtextextended('venta:' || _event_id::text, 0));

  -- Una reserva vigente por persona y fecha: la anterior se libera.
  update public.orders
  set status = 'cancelado'
  where user_id = _buyer and event_id = _event_id and kind = 'entradas' and status = 'pendiente';

  for _item in
    select (x->>'ticket_type_id')::uuid as ticket_type_id, sum((x->>'quantity')::integer) as quantity
    from jsonb_array_elements(_items) x
    group by 1
  loop
    if _item.quantity is null or _item.quantity < 1 then
      raise exception 'cantidad_invalida';
    end if;
    select * into _tt from public.ticket_types where id = _item.ticket_type_id and event_id = _event_id;
    if not found or not private.ticket_type_on_sale(_tt, _event) then
      raise exception 'sector_no_disponible';
    end if;
    if _tt.quantity is not null then
      _taken := private.ticket_type_taken(_tt.id);
      if _taken + _item.quantity > _tt.quantity then
        raise exception 'sin_cupo';
      end if;
    end if;
    _count := _count + _item.quantity;
    _total := _total + _tt.price * _item.quantity;
    _lines := _lines || jsonb_build_object(
      'ticket_type_id', _tt.id,
      'name', _tt.name,
      'quantity', _item.quantity,
      'unit_price', _tt.price
    );
  end loop;

  if _count > 6 then
    raise exception 'maximo_por_compra';
  end if;

  insert into public.orders (user_id, event_id, kind, status, total, currency, expires_at)
  values (_buyer, _event_id, 'entradas', 'pendiente', _total, 'ARS', _expires)
  returning id into _order_id;

  insert into public.order_items (order_id, ticket_type_id, name, quantity, unit_price)
  select _order_id, (l->>'ticket_type_id')::uuid, l->>'name', (l->>'quantity')::integer, (l->>'unit_price')::numeric
  from jsonb_array_elements(_lines) l;

  return jsonb_build_object(
    'order_id', _order_id,
    'total', _total,
    'expires_at', _expires,
    'event_name', _event.name,
    'event_slug', _event.slug,
    'buyer_email', _buyer_profile.email,
    'buyer_name', _buyer_profile.full_name,
    'items', _lines
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- Aplicar un pago de Mercado Pago (el JSON que devuelve GET /v1/payments/{id})
-- Idempotente: se puede llamar muchas veces con el mismo pago.
-- -----------------------------------------------------------------------------
create function public.apply_mp_payment(_payment jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  _ref text := _payment->>'external_reference';
  _mp_status text := _payment->>'status';
  _status public.payment_status;
  _order public.orders;
  _buyer public.profiles;
  _amount numeric(12, 2) := coalesce((_payment->>'transaction_amount')::numeric, 0);
  _currency text := coalesce(_payment->>'currency_id', 'ARS');
  _item record;
  _issued integer := 0;
  _oversold boolean := false;
  _tt public.ticket_types;
begin
  if _ref is null or _ref !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return jsonb_build_object('ignored', 'sin_pedido');
  end if;
  if (_payment->>'id') is null then
    return jsonb_build_object('ignored', 'sin_id');
  end if;

  select * into _order from public.orders where id = _ref::uuid for update;
  if not found or _order.kind <> 'entradas' then
    return jsonb_build_object('ignored', 'pedido_inexistente');
  end if;

  _status := case _mp_status
    when 'approved' then 'aprobado'
    when 'rejected' then 'rechazado'
    when 'cancelled' then 'cancelado'
    when 'refunded' then 'reembolsado'
    when 'charged_back' then 'reembolsado'
    else 'pendiente'
  end::public.payment_status;

  insert into public.payments (order_id, user_id, provider, provider_payment_id, status, status_detail, amount, currency, raw)
  values (_order.id, _order.user_id, 'mercadopago', _payment->>'id', _status, _payment->>'status_detail', _amount, _currency, _payment)
  on conflict (provider_payment_id) do update
    set status = excluded.status,
        status_detail = excluded.status_detail,
        amount = excluded.amount,
        currency = excluded.currency,
        raw = excluded.raw;

  -- Aprobado: se emiten los QR (una sola vez). Se respeta aunque la reserva haya
  -- vencido; si ya no había cupo, queda marcado para que lo revise el organizador.
  if _status = 'aprobado' and _order.status in ('pendiente', 'cancelado') then
    if _currency <> _order.currency or _amount < _order.total then
      update public.orders set attention = 'monto_distinto' where id = _order.id;
      return jsonb_build_object('order_id', _order.id, 'order_status', _order.status, 'attention', 'monto_distinto');
    end if;

    select * into _buyer from public.profiles where id = _order.user_id;
    for _item in select * from public.order_items where order_id = _order.id and ticket_type_id is not null loop
      select * into _tt from public.ticket_types where id = _item.ticket_type_id;
      -- Si la reserva ya no cuenta (venció o se reemplazó por otra), se revisa si el cupo alcanza igual.
      if _tt.quantity is not null
         and (_order.status = 'cancelado' or _order.expires_at is null or _order.expires_at <= now())
         and private.ticket_type_taken(_tt.id) + _item.quantity > _tt.quantity then
        _oversold := true;
      end if;
      insert into public.tickets (event_id, user_id, holder_name, holder_email, kind, ticket_type_id, order_id, issued_by)
      select _order.event_id, _order.user_id, nullif(_buyer.full_name, ''), _buyer.email, 'entrada', _item.ticket_type_id, _order.id, null
      from generate_series(1, _item.quantity);
      _issued := _issued + _item.quantity;
    end loop;

    update public.orders
    set status = 'pagado',
        paid_at = coalesce((_payment->>'date_approved')::timestamptz, now()),
        attention = case when _oversold then 'sin_cupo' else attention end
    where id = _order.id;
    return jsonb_build_object('order_id', _order.id, 'order_status', 'pagado', 'issued', _issued, 'oversold', _oversold);
  end if;

  -- Reembolso o contracargo de un pedido pagado: se anulan los QR sin usar.
  if _status = 'reembolsado' and _order.status = 'pagado' then
    update public.tickets set status = 'anulado' where order_id = _order.id and status = 'valido';
    update public.orders
    set status = 'reembolsado',
        attention = case
          when exists (select 1 from public.tickets where order_id = _order.id and status = 'usado') then 'reembolso_con_uso'
          else attention end
    where id = _order.id;
    return jsonb_build_object('order_id', _order.id, 'order_status', 'reembolsado');
  end if;

  return jsonb_build_object('order_id', _order.id, 'order_status', _order.status, 'payment_status', _status);
end;
$$;

-- -----------------------------------------------------------------------------
-- Pasar una entrada comprada a otra persona (solo servidor: antes se asegura
-- que exista su cuenta). El código del QR cambia: el anterior deja de servir.
-- -----------------------------------------------------------------------------
create function public.transfer_ticket(_ticket_id uuid, _from uuid, _to_email text, _to_name text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  _ticket public.tickets;
  _event public.events;
  _to public.profiles;
  _email text := lower(trim(coalesce(_to_email, '')));
begin
  select * into _ticket from public.tickets where id = _ticket_id for update;
  if not found or _ticket.user_id is distinct from _from or _ticket.kind <> 'entrada' or _ticket.order_id is null then
    raise exception 'entrada_no_transferible';
  end if;
  if _ticket.status <> 'valido' then
    raise exception 'entrada_no_valida';
  end if;
  select * into _event from public.events where id = _ticket.event_id;
  if _event.starts_at < now() - interval '6 hours' then
    raise exception 'evento_pasado';
  end if;
  select * into _to from public.profiles where lower(email) = _email limit 1;
  if not found then
    raise exception 'destinatario_sin_cuenta';
  end if;
  if _to.id = _from then
    raise exception 'mismo_destinatario';
  end if;
  -- Una persona, un QR por fecha.
  if exists (
    select 1 from public.tickets t
    where t.event_id = _ticket.event_id and t.status <> 'anulado' and t.user_id = _to.id
  ) then
    raise exception 'ya_tiene_qr';
  end if;

  update public.tickets
  set user_id = _to.id,
      holder_name = coalesce(nullif(trim(_to_name), ''), nullif(_to.full_name, ''), holder_name),
      holder_email = _to.email,
      code = private.random_token(16),
      transferred_at = now()
  where id = _ticket.id;
  return jsonb_build_object('ticket_id', _ticket.id, 'to', _to.id);
end;
$$;

-- -----------------------------------------------------------------------------
-- Resumen de ventas por sector para el organizador
-- -----------------------------------------------------------------------------
create function public.event_sales_summary(_event_id uuid)
returns table (ticket_type_id uuid, name text, price numeric, quantity integer, sold integer, reserved integer, revenue numeric, on_sale boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.has_role('organizador') then
    raise exception 'sin_permiso' using errcode = '42501';
  end if;
  return query
    select tt.id, tt.name, tt.price, tt.quantity,
           (select count(*) from public.tickets t where t.ticket_type_id = tt.id and t.order_id is not null and t.status <> 'anulado')::integer,
           (select coalesce(sum(i.quantity), 0) from public.order_items i join public.orders o on o.id = i.order_id
             where i.ticket_type_id = tt.id and o.status = 'pendiente' and o.expires_at > now())::integer,
           (select coalesce(sum(i.quantity * i.unit_price), 0) from public.order_items i join public.orders o on o.id = i.order_id
             where i.ticket_type_id = tt.id and o.status = 'pagado'),
           private.ticket_type_on_sale(tt, e)
    from public.ticket_types tt
    join public.events e on e.id = tt.event_id
    where tt.event_id = _event_id and tt.is_active
    order by tt.sort_order, tt.name;
end;
$$;

-- -----------------------------------------------------------------------------
-- Permisos: lo que mueve plata o emite QR, solo el servidor.
-- -----------------------------------------------------------------------------
revoke execute on function private.ticket_type_taken(uuid) from public;
revoke execute on function private.ticket_type_on_sale(public.ticket_types, public.events) from public;
revoke execute on function public.event_ticket_offer(uuid) from public;
revoke execute on function public.create_ticket_order(uuid, uuid, jsonb) from public, anon, authenticated;
revoke execute on function public.apply_mp_payment(jsonb) from public, anon, authenticated;
revoke execute on function public.transfer_ticket(uuid, uuid, text, text) from public, anon, authenticated;
revoke execute on function public.event_sales_summary(uuid) from public, anon;
grant execute on function public.event_ticket_offer(uuid) to anon, authenticated;
grant execute on function public.create_ticket_order(uuid, uuid, jsonb) to service_role;
grant execute on function public.apply_mp_payment(jsonb) to service_role;
grant execute on function public.transfer_ticket(uuid, uuid, text, text) to service_role;
grant execute on function public.event_sales_summary(uuid) to authenticated;
