-- =============================================================================
-- Rio Pass · 07 · Etapa 3: validación en la puerta (acreditador)
-- =============================================================================
-- validate_access: valida un QR (o código tipeado) o una tarjeta NFC para un
-- evento, en una sola transacción: bloquea la fila, decide, marca el QR como
-- usado, registra la lectura (access_scans) y la asistencia (attendances).
-- door_stats: contador de la noche para la pantalla de la puerta.
-- =============================================================================

create function public.validate_access(_event_id uuid, _method public.scan_method, _value text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  _uid uuid := auth.uid();
  _raw text := left(trim(coalesce(_value, '')), 300);
  _code text;
  _ticket public.tickets;
  _card public.nfc_cards;
  _result public.scan_result := 'rechazado';
  _reason text;
  _person uuid;
  _holder text;
  _sector text;
  _kind text;
  _previous_at timestamptz;
  _other_event text;
  _scan_id bigint;
  _count integer;
begin
  if _uid is null or not (private.has_role('acreditador') or private.has_role('organizador')) then
    raise exception 'sin_permiso' using errcode = '42501';
  end if;
  if not exists (select 1 from public.events where id = _event_id) then
    raise exception 'evento_inexistente';
  end if;

  if _method in ('qr', 'manual') then
    -- Acepta el link completo que codifica el QR (https://…/qr/CODIGO) o solo el código.
    _code := regexp_replace(regexp_replace(_raw, '^.*/qr/', ''), '[?#/].*$', '');
    select * into _ticket from public.tickets where code = _code for update;

    if not found then
      _reason := 'no_registrado';
    else
      _person := _ticket.user_id;
      _kind := _ticket.kind::text;
      select coalesce(_ticket.holder_name, p.full_name) into _holder from public.profiles p where p.id = _ticket.user_id;
      _holder := coalesce(_holder, _ticket.holder_name);
      select name into _sector from public.ticket_types where id = _ticket.ticket_type_id;

      if _ticket.event_id <> _event_id then
        _reason := 'otro_evento';
        select name into _other_event from public.events where id = _ticket.event_id;
      elsif _ticket.status = 'anulado' then
        _reason := 'anulado';
      elsif _ticket.status = 'usado' then
        _reason := 'ya_usado';
        _previous_at := _ticket.used_at;
      else
        update public.tickets set status = 'usado', used_at = now(), used_by = _uid where id = _ticket.id;
        _result := 'permitido';
      end if;
    end if;

  else
    -- NFC: el número de serie (UID) en formato "04:91:58:0A:8C:19:90".
    _code := upper(regexp_replace(_raw, '[^0-9A-Fa-f]', '', 'g'));
    if length(_code) < 8 or length(_code) % 2 = 1 then
      _reason := 'ilegible';
    else
      _code := rtrim(regexp_replace(_code, '(..)', '\1:', 'g'), ':');
      select * into _card from public.nfc_cards where uid = _code for update;
      _kind := 'tarjeta';

      if not found then
        _reason := 'no_registrada';
      elsif _card.status = 'bloqueada' then
        _reason := 'bloqueada';
        _person := _card.user_id;
      elsif _card.user_id is null then
        _reason := 'sin_asignar';
      else
        _person := _card.user_id;
        -- Anti-passback: una tarjeta entra una sola vez por noche (que no se la pasen a otro).
        select created_at into _previous_at from public.attendances where event_id = _event_id and user_id = _person;
        if found then
          _reason := 'ya_ingreso';
        else
          _result := 'permitido';
        end if;
      end if;

      if _card.id is not null then
        update public.nfc_cards set last_tap_at = now() where id = _card.id;
        select full_name into _holder from public.profiles where id = _card.user_id;
        _sector := _card.label;
      end if;
    end if;
  end if;

  insert into public.access_scans (event_id, method, result, reason, ticket_id, card_id, user_id, raw_value, scanned_by)
  values (_event_id, _method, _result, _reason, _ticket.id, _card.id, _person, _raw, _uid)
  returning id into _scan_id;

  if _result = 'permitido' and _person is not null then
    insert into public.attendances (event_id, user_id, method, first_scan_id)
    values (_event_id, _person, _method, _scan_id)
    on conflict do nothing;
  end if;

  select count(*) into _count from public.access_scans where event_id = _event_id and result = 'permitido';

  return jsonb_build_object(
    'result', _result,
    'reason', _reason,
    'kind', _kind,
    'holder', _holder,
    'sector', _sector,
    'previous_at', _previous_at,
    'other_event', _other_event,
    'count', _count
  );
end;
$$;
comment on function public.validate_access is 'Valida un ingreso (QR, código o tarjeta NFC) de forma atómica. Solo acreditador u organizador.';

create function public.door_stats(_event_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (private.has_role('acreditador') or private.has_role('organizador')) then
    raise exception 'sin_permiso' using errcode = '42501';
  end if;
  return (
    select jsonb_build_object(
      'permitidos', count(*) filter (where result = 'permitido'),
      'rechazados', count(*) filter (where result = 'rechazado'),
      'qr', count(*) filter (where result = 'permitido' and method in ('qr', 'manual')),
      'nfc', count(*) filter (where result = 'permitido' and method = 'nfc')
    )
    from public.access_scans
    where event_id = _event_id
  );
end;
$$;

revoke execute on function public.validate_access(uuid, public.scan_method, text) from public, anon;
revoke execute on function public.door_stats(uuid) from public, anon;
grant execute on function public.validate_access(uuid, public.scan_method, text) to authenticated;
grant execute on function public.door_stats(uuid) to authenticated;
