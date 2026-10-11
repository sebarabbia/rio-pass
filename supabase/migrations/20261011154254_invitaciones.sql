-- =============================================================================
-- Rio Pass · 06 · Etapa 2: invitaciones QR (organizador y RRPP con cupo),
-- vista pública del QR por código, lugar/cupo por evento y vinculación de
-- invitaciones a la cuenta del invitado.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Eventos: lugar y cupo de invitaciones sin cargo por RRPP
-- -----------------------------------------------------------------------------
alter table public.events
  add column venue text not null default 'Complejo Arenas · Playas del Thompson'
    check (char_length(venue) between 2 and 120),
  add column rrpp_invite_quota integer not null default 20
    check (rrpp_invite_quota between 0 and 1000);
comment on column public.events.rrpp_invite_quota is 'Cantidad de QR sin cargo que puede emitir cada RRPP para este evento.';

-- -----------------------------------------------------------------------------
-- QR: teléfono del invitado (para mandarle el QR por WhatsApp)
-- -----------------------------------------------------------------------------
alter table public.tickets
  add column holder_phone text check (holder_phone is null or char_length(holder_phone) <= 30);

create index tickets_holder_email_unclaimed_idx on public.tickets (lower(holder_email)) where user_id is null;
create index tickets_event_issuer_idx on public.tickets (event_id, issued_by);
create index profiles_email_lower_idx on public.profiles (lower(email));

alter table public.user_roles alter column granted_by set default auth.uid();

-- El RRPP también ve los QR que emitió (para compartirlos y seguir su cupo).
drop policy "tickets: propios u organizador" on public.tickets;
create policy "tickets: propios, emitidos por mí (RRPP) u organizador"
  on public.tickets for select to authenticated
  using (
    user_id = (select auth.uid())
    or (select private.has_role('organizador'))
    or (issued_by = (select auth.uid()) and (select private.has_role('rrpp')))
  );

-- -----------------------------------------------------------------------------
-- Emitir una invitación. Organizador: sin límite. RRPP: solo eventos publicados
-- y dentro de su cupo. Se valida todo acá (no en el navegador) y de forma atómica.
-- Errores: devuelve mensajes-código que la app traduce.
-- -----------------------------------------------------------------------------
create function public.issue_invitation(
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
  _used integer;
  _user_id uuid;
  _ticket public.tickets;
begin
  if _uid is null or not (_is_orga or _is_rrpp) then
    raise exception 'sin_permiso' using errcode = '42501';
  end if;
  if _name is null or char_length(_name) > 80 then
    raise exception 'nombre_invalido';
  end if;
  if _email is not null and _email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' then
    raise exception 'email_invalido';
  end if;
  if _phone is not null and _phone !~ '^[+\d][\d\s()-]{5,29}$' then
    raise exception 'telefono_invalido';
  end if;

  select * into _event from public.events where id = _event_id;
  if not found then
    raise exception 'evento_inexistente';
  end if;

  if not _is_orga then
    if _event.status <> 'publicado' or _event.starts_at < now() - interval '12 hours' then
      raise exception 'evento_no_disponible';
    end if;
    -- Serializa las emisiones de un mismo RRPP para un evento: el cupo no se puede pasar
    -- aunque toque "emitir" dos veces seguidas.
    perform pg_advisory_xact_lock(hashtextextended(_uid::text || ':' || _event_id::text, 0));
    select count(*) into _used
    from public.tickets
    where event_id = _event_id and issued_by = _uid and kind = 'invitacion' and status <> 'anulado';
    if _used >= _event.rrpp_invite_quota then
      raise exception 'cupo_agotado';
    end if;
  end if;

  if _ticket_type_id is not null and not exists (
    select 1 from public.ticket_types where id = _ticket_type_id and event_id = _event_id and is_active
  ) then
    raise exception 'sector_invalido';
  end if;

  -- Si el email ya tiene cuenta, la invitación aparece directo en su "Mis QR".
  if _email is not null then
    select id into _user_id from public.profiles where lower(email) = _email limit 1;
  end if;

  insert into public.tickets (event_id, user_id, holder_name, holder_email, holder_phone, kind, ticket_type_id, issued_by)
  values (_event_id, _user_id, _name, _email, _phone, 'invitacion', _ticket_type_id, _uid)
  returning * into _ticket;

  return _ticket;
end;
$$;
comment on function public.issue_invitation is 'Emite una invitación QR. Organizador sin límite; RRPP con cupo por evento (events.rrpp_invite_quota).';

-- Anular un QR todavía válido. El RRPP solo puede anular los que emitió.
create function public.void_ticket(_ticket_id uuid)
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
    or (private.has_role('rrpp') and _ticket.issued_by = auth.uid())
  ) then
    raise exception 'sin_permiso' using errcode = '42501';
  end if;
  if _ticket.status <> 'valido' then
    raise exception 'qr_no_anulable';
  end if;
  update public.tickets set status = 'anulado' where id = _ticket_id;
end;
$$;

-- Vista pública de un QR a partir de su código (el link que se manda por WhatsApp).
-- El código tiene 128 bits aleatorios: quien lo tiene es el titular. No expone
-- email ni teléfono del invitado.
create function public.get_ticket_by_code(_code text)
returns table (
  kind public.ticket_kind,
  status public.ticket_status,
  holder_name text,
  sector text,
  used_at timestamptz,
  event_name text,
  event_slug text,
  event_starts_at timestamptz,
  event_venue text,
  event_flyer_path text
)
language sql
stable
security definer
set search_path = ''
as $$
  select t.kind, t.status, coalesce(t.holder_name, p.full_name), tt.name, t.used_at,
         e.name, e.slug, e.starts_at, e.venue, e.flyer_path
  from public.tickets t
  join public.events e on e.id = t.event_id
  left join public.ticket_types tt on tt.id = t.ticket_type_id
  left join public.profiles p on p.id = t.user_id
  where t.code = _code
  limit 1;
$$;

revoke execute on function public.issue_invitation(uuid, text, text, text, uuid) from public, anon;
revoke execute on function public.void_ticket(uuid) from public, anon;
revoke execute on function public.get_ticket_by_code(text) from public;
grant execute on function public.issue_invitation(uuid, text, text, text, uuid) to authenticated;
grant execute on function public.void_ticket(uuid) to authenticated;
grant execute on function public.get_ticket_by_code(text) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- Al registrarse, las invitaciones enviadas a ese email pasan a su cuenta.
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
  end if;
  return new;
end;
$$;
