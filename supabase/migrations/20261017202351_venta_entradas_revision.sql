-- =============================================================================
-- Rio Pass · 13 · Venta de entradas: arreglos de la revisión adversarial
-- =============================================================================
-- - La barra solo ve y entrega pedidos de BEBIDAS (antes podía marcar como
--   "entregado" un pedido de entradas y así un reembolso no anulaba los QR).
-- - No se puede borrar un evento con pedidos (se perdían las entradas compradas).
-- - create_ticket_order: tope de 3 intentos por hora por persona y fecha (que nadie
--   retenga el cupo renovando reservas) y devuelve las preferencias reemplazadas
--   para vencerlas en Mercado Pago.
-- - apply_mp_payment: toma el mismo candado que las reservas (la sobreventa por
--   pagos tardíos queda bien marcada), ignora fotos viejas del pago (avisos fuera
--   de orden), no baja un pago aprobado a pendiente, distingue disputa, contracargo,
--   reembolso parcial y pagos duplicados, y no marca pagado un pedido sin sector.
-- - transfer_ticket: serializa la regla "una persona, un QR por fecha".
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Barra: solo pedidos de bebidas
-- -----------------------------------------------------------------------------
drop policy "orders: propios, organizador o barra" on public.orders;
create policy "orders: propios, organizador o barra (bebidas)"
  on public.orders for select to authenticated
  using (
    user_id = (select auth.uid())
    or (select private.has_role('organizador'))
    or ((select private.has_role('barra')) and kind = 'bebidas' and status in ('pagado', 'entregado'))
  );

drop policy "orders: barra marca entregado" on public.orders;
create policy "orders: barra marca entregado (bebidas)"
  on public.orders for update to authenticated
  using ((select private.has_role('barra')) and kind = 'bebidas' and status = 'pagado')
  with check ((select private.has_role('barra')) and kind = 'bebidas' and status = 'entregado');

-- -----------------------------------------------------------------------------
-- Un evento con pedidos no se puede borrar (se cancela o se despublica).
-- -----------------------------------------------------------------------------
alter table public.orders drop constraint orders_event_id_fkey;
alter table public.orders
  add constraint orders_event_id_fkey foreign key (event_id) references public.events (id) on delete restrict;

-- -----------------------------------------------------------------------------
-- Reservas
-- -----------------------------------------------------------------------------
create or replace function public.create_ticket_order(_buyer uuid, _event_id uuid, _items jsonb)
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
  _superseded text[];
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

  perform pg_advisory_xact_lock(hashtextextended('venta:' || _event_id::text, 0));

  -- Que nadie retenga el cupo renovando reservas sin pagar.
  if (
    select count(*) from public.orders
    where user_id = _buyer and event_id = _event_id and kind = 'entradas' and created_at > now() - interval '1 hour'
  ) >= 3 then
    raise exception 'demasiados_intentos';
  end if;

  -- Una reserva vigente por persona y fecha: la anterior se libera (y su pago se vence en Mercado Pago).
  with cancelled as (
    update public.orders
    set status = 'cancelado'
    where user_id = _buyer and event_id = _event_id and kind = 'entradas' and status = 'pendiente'
    returning mp_preference_id
  )
  select coalesce(array_agg(mp_preference_id) filter (where mp_preference_id is not null), '{}') into _superseded from cancelled;

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
    'items', _lines,
    'superseded_preferences', to_jsonb(_superseded)
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- Pagos
-- -----------------------------------------------------------------------------
create or replace function public.apply_mp_payment(_payment jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  _ref text := _payment->>'external_reference';
  _mp_status text := _payment->>'status';
  _detail text := _payment->>'status_detail';
  _status public.payment_status;
  _order public.orders;
  _event_id uuid;
  _buyer public.profiles;
  _amount numeric(12, 2) := coalesce((_payment->>'transaction_amount')::numeric, 0);
  _refunded numeric(12, 2) := coalesce((_payment->>'transaction_amount_refunded')::numeric, 0);
  _currency text := coalesce(_payment->>'currency_id', 'ARS');
  _updated timestamptz := coalesce((_payment->>'date_last_updated')::timestamptz, now());
  _pid uuid;
  _item record;
  _issued integer := 0;
  _oversold boolean := false;
  _tt public.ticket_types;
  _other_approved boolean;
begin
  if _ref is null or _ref !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return jsonb_build_object('ignored', 'sin_pedido');
  end if;
  if (_payment->>'id') is null then
    return jsonb_build_object('ignored', 'sin_id');
  end if;

  -- Mismo candado que las reservas, tomado antes que la fila del pedido (mismo orden
  -- que create_ticket_order): el control de cupo de un pago tardío es exacto.
  select event_id into _event_id from public.orders where id = _ref::uuid;
  if _event_id is not null then
    perform pg_advisory_xact_lock(hashtextextended('venta:' || _event_id::text, 0));
  end if;

  select * into _order from public.orders where id = _ref::uuid for update;
  if not found or _order.kind <> 'entradas' then
    return jsonb_build_object('ignored', 'pedido_inexistente');
  end if;

  _status := case
    when _mp_status = 'approved' then 'aprobado'
    -- En disputa: la plata sigue cobrada; se marca para revisar.
    when _mp_status = 'in_mediation' then 'aprobado'
    -- Contracargo resuelto a favor del vendedor: el pago vuelve a valer.
    when _mp_status = 'charged_back' and _detail = 'reimbursed' then 'aprobado'
    when _mp_status in ('refunded', 'charged_back') then 'reembolsado'
    when _mp_status = 'rejected' then 'rechazado'
    when _mp_status = 'cancelled' then 'cancelado'
    else 'pendiente'
  end::public.payment_status;

  -- Avisos fuera de orden: una foto más vieja del pago no pisa una más nueva,
  -- y un pago aprobado no vuelve a "pendiente".
  insert into public.payments (order_id, user_id, provider, provider_payment_id, status, status_detail, amount, currency, raw)
  values (_order.id, _order.user_id, 'mercadopago', _payment->>'id', _status, _detail, _amount, _currency, _payment)
  on conflict (provider_payment_id) do update
    set status = case when public.payments.status = 'aprobado' and excluded.status = 'pendiente' then public.payments.status else excluded.status end,
        status_detail = excluded.status_detail,
        amount = excluded.amount,
        currency = excluded.currency,
        raw = excluded.raw
    where _updated >= coalesce((public.payments.raw->>'date_last_updated')::timestamptz, '-infinity'::timestamptz)
  returning id into _pid;
  if _pid is null then
    return jsonb_build_object('ignored', 'aviso_viejo', 'order_id', _order.id);
  end if;

  select exists (
    select 1 from public.payments p
    where p.order_id = _order.id and p.status = 'aprobado' and p.provider_payment_id <> _payment->>'id'
  ) into _other_approved;

  -- Aprobado ---------------------------------------------------------------
  if _status = 'aprobado' then
    if _mp_status = 'in_mediation' then
      update public.orders set attention = 'en_disputa' where id = _order.id;
    end if;

    -- Segundo pago aprobado de un pedido ya pagado: hay que devolver uno.
    if _order.status in ('pagado', 'entregado', 'reembolsado') then
      if _other_approved then
        update public.orders set attention = 'pago_duplicado' where id = _order.id;
      end if;
      return jsonb_build_object('order_id', _order.id, 'order_status', _order.status);
    end if;

    -- Pendiente o reemplazado: se emiten los QR (una sola vez).
    if _currency <> _order.currency or (_amount - _refunded) < _order.total then
      update public.orders
      set attention = case when _refunded > 0 then 'reembolso_parcial' else 'monto_distinto' end
      where id = _order.id;
      return jsonb_build_object('order_id', _order.id, 'order_status', _order.status, 'attention', 'monto_distinto');
    end if;
    if exists (select 1 from public.order_items where order_id = _order.id and ticket_type_id is null) then
      update public.orders set attention = 'sin_sector' where id = _order.id;
      return jsonb_build_object('order_id', _order.id, 'order_status', _order.status, 'attention', 'sin_sector');
    end if;

    select * into _buyer from public.profiles where id = _order.user_id;
    for _item in select * from public.order_items where order_id = _order.id loop
      select * into _tt from public.ticket_types where id = _item.ticket_type_id;
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
        attention = case
          when _oversold then 'sin_cupo'
          when _mp_status = 'in_mediation' then 'en_disputa'
          when _refunded > 0 then 'reembolso_parcial'
          else attention end
    where id = _order.id;
    return jsonb_build_object('order_id', _order.id, 'order_status', 'pagado', 'issued', _issued, 'oversold', _oversold);
  end if;

  -- Reembolso o contracargo ---------------------------------------------------
  if _status = 'reembolsado' and _order.status in ('pagado', 'entregado') then
    -- Si queda otro pago aprobado del mismo pedido, las entradas siguen pagas.
    if _other_approved then
      update public.orders set attention = 'pago_duplicado' where id = _order.id;
      return jsonb_build_object('order_id', _order.id, 'order_status', _order.status);
    end if;
    update public.tickets set status = 'anulado' where order_id = _order.id and status = 'valido';
    update public.orders
    set status = 'reembolsado',
        attention = case
          when exists (select 1 from public.tickets where order_id = _order.id and status = 'usado') then 'reembolso_con_uso'
          when _mp_status = 'charged_back' then 'contracargo'
          else attention end
    where id = _order.id;
    return jsonb_build_object('order_id', _order.id, 'order_status', 'reembolsado');
  end if;

  return jsonb_build_object('order_id', _order.id, 'order_status', _order.status, 'payment_status', _status);
end;
$$;

-- -----------------------------------------------------------------------------
-- Transferencias: la regla "una persona, un QR por fecha" serializada.
-- -----------------------------------------------------------------------------
create or replace function public.transfer_ticket(_ticket_id uuid, _from uuid, _to_email text, _to_name text default null)
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

  -- Mismo candado que las invitaciones de la fecha (issue_invitation).
  perform pg_advisory_xact_lock(hashtextextended('emitir:' || _ticket.event_id::text, 0));
  if exists (
    select 1 from public.tickets t
    where t.event_id = _ticket.event_id and t.status <> 'anulado'
      and (t.user_id = _to.id or lower(t.holder_email) = _email)
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

revoke execute on function public.create_ticket_order(uuid, uuid, jsonb) from public, anon, authenticated;
revoke execute on function public.apply_mp_payment(jsonb) from public, anon, authenticated;
revoke execute on function public.transfer_ticket(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.create_ticket_order(uuid, uuid, jsonb) to service_role;
grant execute on function public.apply_mp_payment(jsonb) to service_role;
grant execute on function public.transfer_ticket(uuid, uuid, text, text) to service_role;
