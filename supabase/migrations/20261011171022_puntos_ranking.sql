-- =============================================================================
-- Rio Pass · 08 · Etapa 4: puntos por asistencia y ranking por temporada
-- =============================================================================
-- - Cada asistencia nueva (attendances) suma events.attendance_points en el
--   libro de puntos, en la temporada del evento. Una sola vez por evento.
-- - Ranking por temporada en dos ligas separadas: clientes (público) y RRPP
--   (interno). Los RRPP vienen todas las noches con su tarjeta: si compitieran
--   con los clientes se quedarían con el premio del top 10.
-- - El ranking público expone solo un nombre corto ("Sofía M.") y el total.
-- - Un invitado que entró con QR sin tener cuenta recibe los puntos de esa
--   noche cuando se registra con el mismo email.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Temporada de un evento: la suya; si no tiene, la que incluye la fecha del
-- evento; si tampoco hay, la actual.
-- -----------------------------------------------------------------------------
create function private.event_season(_event_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    e.season_id,
    (select s.id from public.seasons s
      where (e.starts_at at time zone 'America/Argentina/Buenos_Aires')::date between s.starts_on and s.ends_on
      order by s.starts_on desc
      limit 1),
    (select s.id from public.seasons s where s.is_current limit 1)
  )
  from public.events e
  where e.id = _event_id
$$;

-- -----------------------------------------------------------------------------
-- Puntos por asistencia: al crearse la asistencia (validate_access o el alta
-- de cuenta de un invitado) se suma una vez por evento.
-- -----------------------------------------------------------------------------
create function private.award_attendance_points()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  _season uuid := private.event_season(new.event_id);
  _points integer;
begin
  select attendance_points into _points from public.events where id = new.event_id;
  if _season is not null and coalesce(_points, 0) > 0 then
    insert into public.points_ledger (user_id, season_id, points, reason, event_id)
    values (new.user_id, _season, _points, 'asistencia', new.event_id)
    on conflict (user_id, event_id) where reason = 'asistencia' do nothing;
  end if;
  return new;
end;
$$;

create trigger attendances_award_points
  after insert on public.attendances
  for each row execute function private.award_attendance_points();

-- Asistencias que ya existían antes de esta etapa.
insert into public.points_ledger (user_id, season_id, points, reason, event_id, created_by, created_at)
select a.user_id, private.event_season(a.event_id), e.attendance_points, 'asistencia', a.event_id, null, a.created_at
from public.attendances a
join public.events e on e.id = a.event_id
where e.attendance_points > 0 and private.event_season(a.event_id) is not null
on conflict (user_id, event_id) where reason = 'asistencia' do nothing;

-- -----------------------------------------------------------------------------
-- Ranking
-- -----------------------------------------------------------------------------

-- "Sofía Martínez" -> "Sofía M." (el ranking público no muestra apellidos).
create function private.short_name(_full_name text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  _parts text[] := regexp_split_to_array(btrim(coalesce(_full_name, '')), '\s+');
begin
  if _parts[1] = '' then
    return 'Anónimo';
  elsif cardinality(_parts) = 1 then
    return _parts[1];
  end if;
  return _parts[1] || ' ' || upper(left(_parts[cardinality(_parts)], 1)) || '.';
end;
$$;

-- Posiciones de una temporada en una liga. A igual puntaje va primero quien
-- llegó antes a ese total (así el top 10 nunca queda empatado).
create function private.season_standings(_season_id uuid, _rrpp boolean)
returns table (user_id uuid, points bigint, attendances bigint, pos bigint)
language sql
stable
security definer
set search_path = ''
as $$
  with totals as (
    select l.user_id,
           sum(l.points) as points,
           count(*) filter (where l.reason = 'asistencia') as attendances,
           max(l.created_at) as reached_at
    from public.points_ledger l
    where l.season_id = _season_id
    group by l.user_id
    having sum(l.points) > 0
  )
  select t.user_id, t.points, t.attendances,
         row_number() over (order by t.points desc, t.reached_at, t.user_id) as pos
  from totals t
  where exists (select 1 from public.user_roles r where r.user_id = t.user_id and r.role = 'rrpp') = _rrpp
$$;

-- Ranking para mostrar (público). La liga de RRPP solo la ven RRPP y organizadores.
create function public.season_ranking(_league text default 'clientes', _season_id uuid default null, _limit integer default 50)
returns table (pos integer, name text, points integer, attendances integer, is_me boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  _season uuid := coalesce(_season_id, (select s.id from public.seasons s where s.is_current limit 1));
begin
  if _league not in ('clientes', 'rrpp') then
    raise exception 'liga_invalida';
  end if;
  if _league = 'rrpp' and not (private.has_role('rrpp') or private.has_role('organizador')) then
    raise exception 'sin_permiso' using errcode = '42501';
  end if;
  return query
    select s.pos::integer, private.short_name(p.full_name), s.points::integer, s.attendances::integer,
           coalesce(s.user_id = auth.uid(), false)
    from private.season_standings(_season, _league = 'rrpp') s
    join public.profiles p on p.id = s.user_id
    order by s.pos
    limit least(greatest(coalesce(_limit, 50), 1), 200);
end;
$$;
comment on function public.season_ranking is 'Ranking de una temporada (por defecto la actual): solo nombre corto y total.';

-- Posición del usuario logueado en su liga.
create function public.my_ranking(_season_id uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  _uid uuid := auth.uid();
  _season public.seasons;
  _rrpp boolean := private.has_role('rrpp');
  _points integer;
  _attendances integer;
  _pos integer;
  _players integer;
  _cutoff integer;
begin
  if _uid is null then
    return null;
  end if;
  select * into _season from public.seasons s
  where s.id = coalesce(_season_id, (select c.id from public.seasons c where c.is_current limit 1));
  if not found then
    return null;
  end if;

  select coalesce(sum(l.points), 0), count(*) filter (where l.reason = 'asistencia')
  into _points, _attendances
  from public.points_ledger l
  where l.user_id = _uid and l.season_id = _season.id;

  with st as (select * from private.season_standings(_season.id, _rrpp))
  select (select st.pos from st where st.user_id = _uid),
         (select count(*) from st),
         (select st.points from st where st.pos = 10)
  into _pos, _players, _cutoff;

  return jsonb_build_object(
    'season_id', _season.id,
    'season_name', _season.name,
    'season_ends_on', _season.ends_on,
    'league', case when _rrpp then 'rrpp' else 'clientes' end,
    'points', _points,
    'attendances', _attendances,
    'position', _pos,
    'players', _players,
    -- Puntos que le faltan para entrar al top 10 (0 si ya está adentro).
    'gap_to_top10', case
      when _pos is not null and _pos <= 10 then 0
      when _cutoff is null then greatest(1 - _points, 0)
      else greatest(_cutoff - _points + 1, 0)
    end
  );
end;
$$;
comment on function public.my_ranking is 'Puntos, posición y distancia al top 10 del usuario logueado.';

-- Ranking completo para el organizador (con nombre completo y contacto).
create function public.admin_season_ranking(_season_id uuid, _league text default 'clientes')
returns table (pos integer, user_id uuid, full_name text, email text, phone text, points integer, attendances integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.has_role('organizador') then
    raise exception 'sin_permiso' using errcode = '42501';
  end if;
  if _league not in ('clientes', 'rrpp') then
    raise exception 'liga_invalida';
  end if;
  return query
    select s.pos::integer, s.user_id, p.full_name, p.email, p.phone, s.points::integer, s.attendances::integer
    from private.season_standings(_season_id, _league = 'rrpp') s
    join public.profiles p on p.id = s.user_id
    order by s.pos
    limit 500;
end;
$$;

-- -----------------------------------------------------------------------------
-- Puerta: validate_access ahora devuelve los puntos que sumó el ingreso.
-- (Mismo cuerpo que la migración 07 + _new_attendance/_points.)
-- -----------------------------------------------------------------------------
create or replace function public.validate_access(_event_id uuid, _method public.scan_method, _value text)
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
  _new_attendance boolean;
  _points integer;
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
    on conflict do nothing
    returning true into _new_attendance;
    -- El trigger de attendances ya sumó los puntos: se informan a la puerta.
    if _new_attendance then
      select points into _points from public.points_ledger
      where user_id = _person and event_id = _event_id and reason = 'asistencia';
    end if;
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
    'count', _count,
    'points', _points
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- Alta de cuenta: además de pasarle las invitaciones de su email, si alguna ya
-- se usó en la puerta se registra la asistencia (y el trigger suma los puntos).
-- -----------------------------------------------------------------------------
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, phone, email)
  values (
    new.id,
    left(coalesce(trim(new.raw_user_meta_data ->> 'full_name'), ''), 80),
    nullif(left(coalesce(trim(new.raw_user_meta_data ->> 'phone'), new.phone, ''), 30), ''),
    new.email
  );
  insert into public.user_roles (user_id, role) values (new.id, 'cliente');

  if new.email is not null then
    update public.tickets
    set user_id = new.id
    where user_id is null and lower(holder_email) = lower(new.email);

    insert into public.attendances (event_id, user_id, method, first_scan_id, created_at)
    select t.event_id, new.id, 'qr',
           (select a.id from public.access_scans a where a.ticket_id = t.id and a.result = 'permitido' order by a.id limit 1),
           coalesce(t.used_at, now())
    from public.tickets t
    where t.user_id = new.id and t.status = 'usado'
    on conflict do nothing;
  end if;
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Permisos
-- -----------------------------------------------------------------------------
revoke execute on function private.event_season(uuid) from public;
revoke execute on function private.award_attendance_points() from public;
revoke execute on function private.short_name(text) from public;
revoke execute on function private.season_standings(uuid, boolean) from public;

revoke execute on function public.season_ranking(text, uuid, integer) from public;
revoke execute on function public.my_ranking(uuid) from public, anon;
revoke execute on function public.admin_season_ranking(uuid, text) from public, anon;
grant execute on function public.season_ranking(text, uuid, integer) to anon, authenticated;
grant execute on function public.my_ranking(uuid) to authenticated;
grant execute on function public.admin_season_ranking(uuid, text) to authenticated;
