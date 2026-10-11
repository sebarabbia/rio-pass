-- =============================================================================
-- Rio Pass · 01 · Base: roles, perfiles y alta automática de usuarios
-- =============================================================================
-- Convenciones de todo el esquema:
--   * Tablas de negocio en `public` (expuestas por la API, siempre con RLS).
--   * Funciones auxiliares SECURITY DEFINER en `private` (NO expuesto por la API),
--     así no se pueden llamar por REST pero sí usar dentro de las políticas RLS.
--   * En las políticas se usa `(select auth.uid())` y `(select private.has_role(..))`
--     para que Postgres los evalúe una sola vez por consulta (rendimiento).
-- =============================================================================

create schema if not exists private;
grant usage on schema private to anon, authenticated;

-- Roles del sistema. Un usuario puede tener varios (p. ej. RRPP que también es cliente).
create type public.app_role as enum ('cliente', 'rrpp', 'organizador', 'acreditador', 'barra');

-- -----------------------------------------------------------------------------
-- Perfiles: 1 a 1 con auth.users
-- -----------------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text not null default '' check (char_length(full_name) <= 80),
  phone       text check (phone is null or char_length(phone) <= 30),
  email       text,
  avatar_path text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
comment on table public.profiles is 'Datos de cada usuario. Se crea solo al registrarse (trigger en auth.users).';
comment on column public.profiles.email is 'Copia de auth.users.email, sincronizada por trigger. No editable desde la app.';

create table public.user_roles (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  role       public.app_role not null,
  granted_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);
comment on table public.user_roles is 'Roles de cada usuario. Todo usuario nace con "cliente". Solo un organizador puede asignar otros.';
create index user_roles_granted_by_idx on public.user_roles (granted_by);

-- -----------------------------------------------------------------------------
-- Funciones auxiliares
-- -----------------------------------------------------------------------------
create function private.has_role(_role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = (select auth.uid()) and role = _role
  );
$$;
comment on function private.has_role is '¿El usuario logueado tiene este rol? Para usar en políticas RLS.';

create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Token aleatorio URL-safe (para códigos QR, códigos de retiro, etc.).
create function private.random_token(_bytes integer default 16)
returns text
language sql
volatile
set search_path = ''
as $$
  select rtrim(translate(encode(extensions.gen_random_bytes(_bytes), 'base64'), '+/', '-_'), '=');
$$;

revoke all on all functions in schema private from public;
grant execute on function private.has_role(public.app_role) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- Alta automática: perfil + rol "cliente" al registrarse
-- -----------------------------------------------------------------------------
create function private.handle_new_user()
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
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

create function private.sync_user_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles set email = new.email where id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row when (old.email is distinct from new.email)
  execute function private.sync_user_email();

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;

-- Perfiles: cada uno ve y edita el suyo; el organizador ve y edita todos.
create policy "profiles: ver propio u organizador"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select private.has_role('organizador')));

create policy "profiles: editar propio u organizador"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()) or (select private.has_role('organizador')))
  with check (id = (select auth.uid()) or (select private.has_role('organizador')));

-- Desde la app solo se pueden editar estas columnas (el email lo maneja Auth).
revoke insert, update, delete on public.profiles from anon, authenticated;
grant update (full_name, phone, avatar_path) on public.profiles to authenticated;

-- Roles: cada uno ve los suyos; solo el organizador asigna o quita.
create policy "user_roles: ver propios u organizador"
  on public.user_roles for select to authenticated
  using (user_id = (select auth.uid()) or (select private.has_role('organizador')));

create policy "user_roles: organizador asigna"
  on public.user_roles for insert to authenticated
  with check ((select private.has_role('organizador')));

create policy "user_roles: organizador quita"
  on public.user_roles for delete to authenticated
  using ((select private.has_role('organizador')));

revoke update on public.user_roles from anon, authenticated;
