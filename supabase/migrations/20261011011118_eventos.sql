-- =============================================================================
-- Rio Pass · 02 · Temporadas, eventos, tipos de entrada y flyers
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Temporadas (el ranking de puntos se calcula por temporada)
-- -----------------------------------------------------------------------------
create table public.seasons (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique check (char_length(name) between 2 and 60),
  starts_on  date not null,
  ends_on    date not null,
  is_current boolean not null default false,
  created_at timestamptz not null default now(),
  check (ends_on >= starts_on)
);
comment on table public.seasons is 'Temporadas de Rio (p. ej. "Verano 2027"). Solo una puede estar marcada como actual.';
create unique index seasons_only_one_current on public.seasons (is_current) where is_current;

-- -----------------------------------------------------------------------------
-- Eventos
-- -----------------------------------------------------------------------------
create type public.event_status as enum ('borrador', 'publicado', 'cancelado');

create table public.events (
  id                    uuid primary key default gen_random_uuid(),
  slug                  text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name                  text not null check (char_length(name) between 2 and 120),
  description           text not null default '' check (char_length(description) <= 4000),
  starts_at             timestamptz not null,
  ends_at               timestamptz check (ends_at is null or ends_at > starts_at),
  flyer_path            text,
  status                public.event_status not null default 'borrador',
  published_at          timestamptz,
  season_id             uuid references public.seasons (id) on delete set null,
  capacity              integer check (capacity is null or capacity > 0),
  attendance_points     integer not null default 10 check (attendance_points >= 0),
  created_by            uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
comment on table public.events is 'Fechas de Rio. Solo las publicadas son visibles para el público.';
comment on column public.events.flyer_path is 'Ruta del flyer dentro del bucket público event-flyers.';
comment on column public.events.attendance_points is 'Puntos que suma cada asistente al validar su ingreso (etapa de puntos).';

create index events_status_starts_at_idx on public.events (status, starts_at);
create index events_season_id_idx on public.events (season_id);
create index events_created_by_idx on public.events (created_by);

create function private.events_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'publicado' and (tg_op = 'INSERT' or old.status is distinct from 'publicado') then
    new.published_at := now();
  end if;
  if tg_op = 'UPDATE' then
    new.updated_at := now();
  end if;
  return new;
end;
$$;

create trigger events_before_write
  before insert or update on public.events
  for each row execute function private.events_before_write();

-- -----------------------------------------------------------------------------
-- Tipos de entrada (para la venta con Mercado Pago; etapa futura)
-- -----------------------------------------------------------------------------
create table public.ticket_types (
  id             uuid primary key default gen_random_uuid(),
  event_id       uuid not null references public.events (id) on delete cascade,
  name           text not null check (char_length(name) between 1 and 60),
  description    text,
  price          numeric(12, 2) not null default 0 check (price >= 0),
  currency       text not null default 'ARS',
  quantity       integer check (quantity is null or quantity >= 0),
  sales_start_at timestamptz,
  sales_end_at   timestamptz,
  is_active      boolean not null default true,
  sort_order     integer not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
comment on table public.ticket_types is 'Tipos de entrada a la venta por evento (General, VIP...). Sin lógica en la Etapa 1.';
create index ticket_types_event_id_idx on public.ticket_types (event_id);

create trigger ticket_types_set_updated_at
  before update on public.ticket_types
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.seasons enable row level security;
alter table public.events enable row level security;
alter table public.ticket_types enable row level security;

create policy "seasons: lectura pública"
  on public.seasons for select to anon, authenticated
  using (true);
create policy "seasons: organizador crea"
  on public.seasons for insert to authenticated
  with check ((select private.has_role('organizador')));
create policy "seasons: organizador edita"
  on public.seasons for update to authenticated
  using ((select private.has_role('organizador')));
create policy "seasons: organizador borra"
  on public.seasons for delete to authenticated
  using ((select private.has_role('organizador')));

-- Público: eventos publicados. Organizador: todos (incluye borradores).
create policy "events: publicados o organizador"
  on public.events for select to anon, authenticated
  using (status = 'publicado' or (select private.has_role('organizador')));
create policy "events: organizador crea"
  on public.events for insert to authenticated
  with check ((select private.has_role('organizador')));
create policy "events: organizador edita"
  on public.events for update to authenticated
  using ((select private.has_role('organizador')));
create policy "events: organizador borra"
  on public.events for delete to authenticated
  using ((select private.has_role('organizador')));

create policy "ticket_types: activos de eventos publicados u organizador"
  on public.ticket_types for select to anon, authenticated
  using (
    (is_active and exists (
      select 1 from public.events e where e.id = event_id and e.status = 'publicado'
    ))
    or (select private.has_role('organizador'))
  );
create policy "ticket_types: organizador crea"
  on public.ticket_types for insert to authenticated
  with check ((select private.has_role('organizador')));
create policy "ticket_types: organizador edita"
  on public.ticket_types for update to authenticated
  using ((select private.has_role('organizador')));
create policy "ticket_types: organizador borra"
  on public.ticket_types for delete to authenticated
  using ((select private.has_role('organizador')));

-- -----------------------------------------------------------------------------
-- Storage: flyers de eventos (bucket público de lectura; escritura solo organizador)
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('event-flyers', 'event-flyers', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "event-flyers: organizador lee"
  on storage.objects for select to authenticated
  using (bucket_id = 'event-flyers' and (select private.has_role('organizador')));
create policy "event-flyers: organizador sube"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'event-flyers' and (select private.has_role('organizador')));
create policy "event-flyers: organizador reemplaza"
  on storage.objects for update to authenticated
  using (bucket_id = 'event-flyers' and (select private.has_role('organizador')));
create policy "event-flyers: organizador borra"
  on storage.objects for delete to authenticated
  using (bucket_id = 'event-flyers' and (select private.has_role('organizador')));
