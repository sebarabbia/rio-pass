-- =============================================================================
-- Rio Pass · 11 · RRPP a escala y perfiles únicos
-- =============================================================================
-- - Un solo perfil por persona: cliente, rrpp, acreditador u organizador (+ barra,
--   a futuro). Todos conservan "cliente" (sus QR y puntos); el perfil suma lo suyo.
-- - Cada RRPP tiene un organizador responsable (profiles.manager_id).
-- - Por fecha, el organizador habilita a cada RRPP cuando hizo la primera
--   difusión (rrpp_event_access). Al habilitarlo se le crea su QR propio
--   (tickets.kind = 'rrpp', intransferible) y puede regalar el resto de su cupo.
-- - Cupo por RRPP = events.rrpp_invite_quota (incluye el propio) + extra.
-- - Tope total por fecha de QR de RRPP (events.rrpp_total_cap, 1000 por defecto):
--   al llegar, nadie puede regalar más. El QR propio siempre se crea.
-- - Los QR del organizador no tienen límite ni cuentan para el tope.
-- - Todo QR regalado lleva email (queda asociado a una cuenta).
-- - Contador público de QR entregados por fecha (para mostrar en la web).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Perfil único
-- -----------------------------------------------------------------------------
-- Si alguien tenía más de un perfil de staff, se queda con uno
-- (organizador > rrpp > acreditador > barra).
delete from public.user_roles r
using (
  select user_id, role,
         row_number() over (
           partition by user_id
           order by case role when 'organizador' then 1 when 'rrpp' then 2 when 'acreditador' then 3 else 4 end
         ) as rn
  from public.user_roles
  where role <> 'cliente'
) x
where r.user_id = x.user_id and r.role = x.role and x.rn > 1;

insert into public.user_roles (user_id, role)
select id, 'cliente' from public.profiles
on conflict do nothing;

create unique index user_roles_one_profile on public.user_roles (user_id) where role <> 'cliente';

-- Organizador responsable de cada RRPP.
alter table public.profiles add column manager_id uuid references public.profiles (id) on delete set null;
create index profiles_manager_id_idx on public.profiles (manager_id);
comment on column public.profiles.manager_id is 'Organizador responsable (solo para RRPP).';

-- Cambia el perfil de una persona (solo organizador).
create function public.set_user_profile(_user_id uuid, _profile public.app_role)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.has_role('organizador') then
    raise exception 'sin_permiso' using errcode = '42501';
  end if;
  if _user_id = auth.uid() and _profile <> 'organizador' then
    raise exception 'no_podes_quitarte';
  end if;
  if not exists (select 1 from public.profiles where id = _user_id) then
    raise exception 'usuario_inexistente';
  end if;

  delete from public.user_roles where user_id = _user_id and role <> 'cliente';
  insert into public.user_roles (user_id, role) values (_user_id, 'cliente') on conflict do nothing;
  if _profile <> 'cliente' then
    insert into public.user_roles (user_id, role) values (_user_id, _profile);
  end if;

  -- Un RRPP nuevo queda a cargo de quien lo dio de alta; los demás perfiles no tienen responsable.
  update public.profiles
  set manager_id = case when _profile = 'rrpp' then coalesce(manager_id, auth.uid()) else null end
  where id = _user_id;
end;
$$;

-- Asigna un organizador responsable a uno o varios RRPP.
create function public.set_rrpp_manager(_rrpp_ids uuid[], _manager_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  _count integer;
begin
  if not private.has_role('organizador') then
    raise exception 'sin_permiso' using errcode = '42501';
  end if;
  if _manager_id is not null and not exists (
    select 1 from public.user_roles where user_id = _manager_id and role = 'organizador'
  ) then
    raise exception 'responsable_invalido';
  end if;
  update public.profiles p
  set manager_id = _manager_id
  where p.id = any(_rrpp_ids)
    and exists (select 1 from public.user_roles r where r.user_id = p.id and r.role = 'rrpp');
  get diagnostics _count = row_count;
  return _count;
end;
$$;

-- -----------------------------------------------------------------------------
-- Cupos por fecha
-- -----------------------------------------------------------------------------
alter table public.events
  add column rrpp_total_cap integer default 1000 check (rrpp_total_cap is null or rrpp_total_cap >= 0);
alter table public.events alter column rrpp_invite_quota set default 5;
comment on column public.events.rrpp_invite_quota is 'QR sin cargo por RRPP habilitado (incluye su QR propio).';
comment on column public.events.rrpp_total_cap is 'Tope de QR de RRPP para la fecha (propios + regalados). Null = sin tope.';

create table public.rrpp_event_access (
  event_id   uuid not null references public.events (id) on delete cascade,
  rrpp_id    uuid not null references public.profiles (id) on delete cascade,
  enabled    boolean not null default true,
  extra      integer not null default 0 check (extra between 0 and 50),
  updated_by uuid references public.profiles (id) on delete set null default auth.uid(),
  updated_at timestamptz not null default now(),
  primary key (event_id, rrpp_id)
);
comment on table public.rrpp_event_access is 'RRPP habilitados por fecha (después de la primera difusión) y QR extra.';
create index rrpp_event_access_rrpp_id_idx on public.rrpp_event_access (rrpp_id);
create index rrpp_event_access_updated_by_idx on public.rrpp_event_access (updated_by);

alter table public.rrpp_event_access enable row level security;
create policy "rrpp_event_access: propio u organizador"
  on public.rrpp_event_access for select to authenticated
  using (rrpp_id = (select auth.uid()) or (select private.has_role('organizador')));
revoke insert, update, delete on public.rrpp_event_access from anon, authenticated;

-- A qué RRPP le cuenta cada QR (su propio QR y los que regaló). Null = del organizador.
alter table public.tickets add column rrpp_id uuid references public.profiles (id) on delete set null;
create index tickets_event_rrpp_idx on public.tickets (event_id, rrpp_id);
create index tickets_rrpp_id_idx on public.tickets (rrpp_id);
create unique index tickets_one_rrpp_pass on public.tickets (event_id, user_id)
  where kind = 'rrpp' and status <> 'anulado';

update public.tickets t
set rrpp_id = t.issued_by
where t.kind = 'invitacion'
  and exists (select 1 from public.user_roles r where r.user_id = t.issued_by and r.role = 'rrpp');

-- Habilita (o deshabilita) RRPP para una fecha y opcionalmente fija sus QR extra.
-- Al habilitar se crea su QR propio; al deshabilitar se anula si no lo usó.
create function public.set_rrpp_access(_event_id uuid, _rrpp_ids uuid[], _enabled boolean, _extra integer default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  _count integer := 0;
  _id uuid;
begin
  if not private.has_role('organizador') then
    raise exception 'sin_permiso' using errcode = '42501';
  end if;
  if not exists (select 1 from public.events where id = _event_id) then
    raise exception 'evento_inexistente';
  end if;
  if _extra is not null and (_extra < 0 or _extra > 50) then
    raise exception 'extra_invalido';
  end if;

  for _id in
    select r.user_id from public.user_roles r where r.user_id = any(_rrpp_ids) and r.role = 'rrpp'
  loop
    insert into public.rrpp_event_access (event_id, rrpp_id, enabled, extra, updated_by, updated_at)
    values (_event_id, _id, _enabled, coalesce(_extra, 0), auth.uid(), now())
    on conflict (event_id, rrpp_id) do update
      set enabled = excluded.enabled,
          extra = coalesce(_extra, public.rrpp_event_access.extra),
          updated_by = excluded.updated_by,
          updated_at = excluded.updated_at;

    if _enabled then
      insert into public.tickets (event_id, user_id, holder_name, holder_email, kind, rrpp_id, issued_by)
      select _event_id, p.id, nullif(p.full_name, ''), p.email, 'rrpp', p.id, auth.uid()
      from public.profiles p
      where p.id = _id
        and not exists (
          select 1 from public.tickets t
          where t.event_id = _event_id and t.user_id = _id and t.kind = 'rrpp' and t.status <> 'anulado'
        );
    else
      update public.tickets
      set status = 'anulado'
      where event_id = _event_id and user_id = _id and kind = 'rrpp' and status = 'valido';
    end if;
    _count := _count + 1;
  end loop;
  return _count;
end;
$$;

-- -----------------------------------------------------------------------------
-- Emitir invitaciones (reemplaza la versión de la migración 06)
-- -----------------------------------------------------------------------------
create or replace function public.issue_invitation(
  _event_id uuid,
  _holder_name text,
  _holder_email text default null,
  _holder_phone text default null,
  _ticket_type_id uuid default null
)
returns public.tickets
language plpgsql
security definer
set search_path = ''
as $$
declare
  _uid uuid := auth.uid();
  _is_orga boolean := private.has_role('organizador');
  _is_rrpp boolean := private.has_role('rrpp');
  _name text := nullif(trim(regexp_replace(coalesce(_holder_name, ''), '\s+', ' ', 'g')), '');
  _email text := nullif(lower(trim(coalesce(_holder_email, ''))), '');
  _phone text := nullif(trim(coalesce(_holder_phone, '')), '');
  _event public.events;
  _access public.rrpp_event_access;
  _used integer;
  _total integer;
  _user_id uuid;
  _ticket public.tickets;
begin
  if _uid is null or not (_is_orga or _is_rrpp) then
    raise exception 'sin_permiso' using errcode = '42501';
  end if;
  if _name is null or char_length(_name) > 80 then
    raise exception 'nombre_invalido';
  end if;
  -- Cada QR queda asociado a una cuenta: el email es obligatorio.
  if _email is null then
    raise exception 'email_requerido';
  end if;
  if _email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' then
    raise exception 'email_invalido';
  end if;
  if _phone is not null and _phone !~ '^[+\d][\d\s()-]{5,29}$' then
    raise exception 'telefono_invalido';
  end if;

  select * into _event from public.events where id = _event_id;
  if not found then
    raise exception 'evento_inexistente';
  end if;
  if _ticket_type_id is not null and not exists (
    select 1 from public.ticket_types where id = _ticket_type_id and event_id = _event_id and is_active
  ) then
    raise exception 'sector_invalido';
  end if;

  select id into _user_id from public.profiles where lower(email) = _email limit 1;

  -- Serializa las emisiones de la fecha: ni el cupo ni el tope se pueden pasar
  -- aunque muchos RRPP toquen "Generar" a la vez.
  perform pg_advisory_xact_lock(hashtextextended('emitir:' || _event_id::text, 0));

  -- Una persona, un QR por fecha.
  if exists (
    select 1 from public.tickets t
    where t.event_id = _event_id and t.status <> 'anulado'
      and (lower(t.holder_email) = _email or (_user_id is not null and t.user_id = _user_id))
  ) then
    raise exception 'ya_tiene_qr';
  end if;

  if not _is_orga then
    if _event.status <> 'publicado' or _event.starts_at < now() - interval '12 hours' then
      raise exception 'evento_no_disponible';
    end if;
    select * into _access from public.rrpp_event_access where event_id = _event_id and rrpp_id = _uid;
    if not found or not _access.enabled then
      raise exception 'rrpp_no_habilitado';
    end if;
    select count(*) into _used
    from public.tickets where event_id = _event_id and rrpp_id = _uid and status <> 'anulado';
    if _used >= _event.rrpp_invite_quota + _access.extra then
      raise exception 'cupo_agotado';
    end if;
    if _event.rrpp_total_cap is not null then
      select count(*) into _total
      from public.tickets where event_id = _event_id and rrpp_id is not null and status <> 'anulado';
      if _total >= _event.rrpp_total_cap then
        raise exception 'tope_alcanzado';
      end if;
    end if;
  end if;

  insert into public.tickets (event_id, user_id, holder_name, holder_email, holder_phone, kind, ticket_type_id, issued_by, rrpp_id)
  values (_event_id, _user_id, _name, _email, _phone, 'invitacion', _ticket_type_id, _uid, case when _is_orga then null else _uid end)
  returning * into _ticket;

  return _ticket;
end;
$$;
comment on function public.issue_invitation is 'Emite una invitación QR con email obligatorio. Organizador sin límite; RRPP habilitado, con cupo y tope por fecha.';

-- Anular: el organizador cualquiera; el RRPP solo las que regaló (su QR propio no).
create or replace function public.void_ticket(_ticket_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  _ticket public.tickets;
begin
  select * into _ticket from public.tickets where id = _ticket_id for update;
  if not found then
    raise exception 'qr_inexistente';
  end if;
  if not (
    private.has_role('organizador')
    or (private.has_role('rrpp') and _ticket.issued_by = auth.uid() and _ticket.kind = 'invitacion')
  ) then
    raise exception 'sin_permiso' using errcode = '42501';
  end if;
  if _ticket.status <> 'valido' then
    raise exception 'qr_no_anulable';
  end if;
  update public.tickets set status = 'anulado' where id = _ticket_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Tableros
-- -----------------------------------------------------------------------------
-- Para el organizador: cada RRPP con su estado en una fecha.
create function public.event_rrpp_board(_event_id uuid)
returns table (
  rrpp_id uuid, full_name text, email text, phone text, manager_id uuid, manager_name text,
  enabled boolean, extra integer, issued integer, used integer
)
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
    select p.id, p.full_name, p.email, p.phone, p.manager_id, m.full_name,
           coalesce(a.enabled, false), coalesce(a.extra, 0),
           coalesce(c.issued, 0)::integer, coalesce(c.used, 0)::integer
    from public.profiles p
    join public.user_roles r on r.user_id = p.id and r.role = 'rrpp'
    left join public.profiles m on m.id = p.manager_id
    left join public.rrpp_event_access a on a.event_id = _event_id and a.rrpp_id = p.id
    left join (
      select t.rrpp_id,
             count(*) filter (where t.status <> 'anulado') as issued,
             count(*) filter (where t.status = 'usado') as used
      from public.tickets t
      where t.event_id = _event_id and t.rrpp_id is not null
      group by t.rrpp_id
    ) c on c.rrpp_id = p.id
    order by lower(p.full_name);
end;
$$;

-- Para el RRPP: su estado en cada fecha próxima (habilitado, cupo, tope, su QR).
create function public.rrpp_event_status()
returns table (
  event_id uuid, enabled boolean, quota integer, used integer, cap integer, cap_used integer,
  pass_code text, manager_name text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  _uid uuid := auth.uid();
begin
  if not private.has_role('rrpp') then
    raise exception 'sin_permiso' using errcode = '42501';
  end if;
  return query
    select e.id,
           coalesce(a.enabled, false),
           case when coalesce(a.enabled, false) then e.rrpp_invite_quota + a.extra else 0 end,
           (select count(*) from public.tickets t where t.event_id = e.id and t.rrpp_id = _uid and t.status <> 'anulado')::integer,
           e.rrpp_total_cap,
           (select count(*) from public.tickets t where t.event_id = e.id and t.rrpp_id is not null and t.status <> 'anulado')::integer,
           (select t.code from public.tickets t
             where t.event_id = e.id and t.user_id = _uid and t.kind = 'rrpp' and t.status <> 'anulado' limit 1),
           (select m.full_name from public.profiles me join public.profiles m on m.id = me.manager_id where me.id = _uid)
    from public.events e
    left join public.rrpp_event_access a on a.event_id = e.id and a.rrpp_id = _uid
    where e.status = 'publicado' and e.starts_at >= now() - interval '12 hours'
    order by e.starts_at;
end;
$$;

-- Contador público: cuántos QR se entregaron por fecha (para la web, sin datos personales).
create function public.event_going_counts(_event_ids uuid[])
returns table (event_id uuid, going integer)
language sql
stable
security definer
set search_path = ''
as $$
  select t.event_id, count(*)::integer
  from public.tickets t
  join public.events e on e.id = t.event_id and e.status = 'publicado'
  where t.event_id = any(_event_ids) and t.status <> 'anulado'
  group by t.event_id
$$;

-- -----------------------------------------------------------------------------
-- Puerta: avisa si quien entra es RRPP (la pantalla se pone azul)
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
  _is_rrpp boolean := false;
begin
  if _uid is null or not (private.has_role('acreditador') or private.has_role('organizador')) then
    raise exception 'sin_permiso' using errcode = '42501';
  end if;
  if not exists (select 1 from public.events where id = _event_id) then
    raise exception 'evento_inexistente';
  end if;

  if _method in ('qr', 'manual') then
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

  _is_rrpp := coalesce(_kind = 'rrpp', false)
    or (_person is not null and exists (select 1 from public.user_roles where user_id = _person and role = 'rrpp'));

  insert into public.access_scans (event_id, method, result, reason, ticket_id, card_id, user_id, raw_value, scanned_by)
  values (_event_id, _method, _result, _reason, _ticket.id, _card.id, _person, _raw, _uid)
  returning id into _scan_id;

  if _result = 'permitido' and _person is not null then
    insert into public.attendances (event_id, user_id, method, first_scan_id)
    values (_event_id, _person, _method, _scan_id)
    on conflict do nothing
    returning true into _new_attendance;
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
    'points', _points,
    'rrpp', _is_rrpp
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- Permisos
-- -----------------------------------------------------------------------------
revoke execute on function public.set_user_profile(uuid, public.app_role) from public, anon;
revoke execute on function public.set_rrpp_manager(uuid[], uuid) from public, anon;
revoke execute on function public.set_rrpp_access(uuid, uuid[], boolean, integer) from public, anon;
revoke execute on function public.event_rrpp_board(uuid) from public, anon;
revoke execute on function public.rrpp_event_status() from public, anon;
revoke execute on function public.event_going_counts(uuid[]) from public;
grant execute on function public.set_user_profile(uuid, public.app_role) to authenticated;
grant execute on function public.set_rrpp_manager(uuid[], uuid) to authenticated;
grant execute on function public.set_rrpp_access(uuid, uuid[], boolean, integer) to authenticated;
grant execute on function public.event_rrpp_board(uuid) to authenticated;
grant execute on function public.rrpp_event_status() to authenticated;
grant execute on function public.event_going_counts(uuid[]) to anon, authenticated;
