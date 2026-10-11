-- =============================================================================
-- Rio Pass · 03 · Acceso: QR (entradas/invitaciones), tarjetas NFC, lecturas en
-- la puerta y asistencias. Solo el modelo: la lógica de validación es de una
-- etapa posterior y se hará con funciones SECURITY DEFINER atómicas.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- QR: entradas compradas o invitaciones regaladas
-- -----------------------------------------------------------------------------
create type public.ticket_kind as enum ('entrada', 'invitacion');
create type public.ticket_status as enum ('valido', 'usado', 'anulado');

grant execute on function private.random_token(integer) to authenticated;

create table public.tickets (
  id             uuid primary key default gen_random_uuid(),
  event_id       uuid not null references public.events (id) on delete cascade,
  user_id        uuid references public.profiles (id) on delete set null,
  holder_name    text check (holder_name is null or char_length(holder_name) <= 80),
  holder_email   text,
  kind           public.ticket_kind not null,
  ticket_type_id uuid references public.ticket_types (id) on delete set null,
  order_id       uuid,  -- FK a orders en la migración 05 (comercio)
  code           text not null unique default private.random_token(16),
  status         public.ticket_status not null default 'valido',
  issued_by      uuid references public.profiles (id) on delete set null default auth.uid(),
  used_at        timestamptz,
  used_by        uuid references public.profiles (id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  check (user_id is not null or holder_name is not null or holder_email is not null),
  check (status <> 'usado' or used_at is not null)
);
comment on table public.tickets is 'Cada QR: entrada comprada o invitación. `code` es el contenido del QR (128 bits aleatorios).';
comment on column public.tickets.user_id is 'Titular con cuenta. Puede ser null si se emitió a alguien sin cuenta (holder_name/holder_email).';

create index tickets_event_id_idx on public.tickets (event_id);
create index tickets_user_id_idx on public.tickets (user_id);
create index tickets_ticket_type_id_idx on public.tickets (ticket_type_id);
create index tickets_order_id_idx on public.tickets (order_id);
create index tickets_issued_by_idx on public.tickets (issued_by);
create index tickets_used_by_idx on public.tickets (used_by);

create trigger tickets_set_updated_at
  before update on public.tickets
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- Tarjetas NFC
-- -----------------------------------------------------------------------------
-- Producción: NTAG 424 DNA con SUN/SDM. Al apoyarla, el celular abre una URL con
-- datos cifrados (UID + contador) y un CMAC. El servidor los verifica con claves
-- diversificadas por tarjeta a partir de una clave maestra que vive como secreto
-- del servidor (nunca en la base). `last_counter` evita que se reuse una URL vieja.
-- 'generica' = tarjetas de prueba validadas solo por UID (como la demo).
create type public.nfc_card_type as enum ('ntag424_dna', 'generica');
create type public.nfc_card_status as enum ('activa', 'bloqueada');

create table public.nfc_cards (
  id             uuid primary key default gen_random_uuid(),
  uid            text not null unique check (uid ~ '^([0-9A-F]{2}:){3,9}[0-9A-F]{2}$'),
  card_type      public.nfc_card_type not null default 'ntag424_dna',
  label          text check (label is null or char_length(label) <= 40),
  user_id        uuid references public.profiles (id) on delete set null,
  status         public.nfc_card_status not null default 'activa',
  key_version    smallint not null default 1,
  last_counter   integer not null default 0 check (last_counter >= 0),
  last_tap_at    timestamptz,
  assigned_at    timestamptz,
  assigned_by    uuid references public.profiles (id) on delete set null,
  blocked_at     timestamptz,
  blocked_reason text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
comment on table public.nfc_cards is 'Tarjetas NFC de RRPP. uid en formato "04:91:58:0A:8C:19:90".';
comment on column public.nfc_cards.last_counter is 'Último contador SUN aceptado (NTAG 424 DNA). Uno menor o igual se rechaza (anti-replay).';
comment on column public.nfc_cards.key_version is 'Versión de la clave maestra con que se programó la tarjeta (permite rotar claves).';

create index nfc_cards_user_id_idx on public.nfc_cards (user_id);
create index nfc_cards_assigned_by_idx on public.nfc_cards (assigned_by);

create trigger nfc_cards_set_updated_at
  before update on public.nfc_cards
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- Lecturas en la puerta (log de auditoría de cada validación)
-- -----------------------------------------------------------------------------
create type public.scan_method as enum ('qr', 'nfc', 'manual');
create type public.scan_result as enum ('permitido', 'rechazado');

create table public.access_scans (
  id         bigint generated always as identity primary key,
  event_id   uuid not null references public.events (id) on delete cascade,
  method     public.scan_method not null,
  result     public.scan_result not null,
  reason     text,
  ticket_id  uuid references public.tickets (id) on delete set null,
  card_id    uuid references public.nfc_cards (id) on delete set null,
  user_id    uuid references public.profiles (id) on delete set null,
  raw_value  text,
  scanned_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
comment on table public.access_scans is 'Cada lectura del acreditador. reason: no_registrada, bloqueada, ya_usado, anulado, otro_evento, firma_invalida, contador_repetido.';
comment on column public.access_scans.raw_value is 'Lo leído (UID o código QR), para auditoría.';

create index access_scans_event_created_idx on public.access_scans (event_id, created_at desc);
create index access_scans_ticket_id_idx on public.access_scans (ticket_id);
create index access_scans_card_id_idx on public.access_scans (card_id);
create index access_scans_user_id_idx on public.access_scans (user_id);
create index access_scans_scanned_by_idx on public.access_scans (scanned_by);

-- -----------------------------------------------------------------------------
-- Asistencias: una por usuario y evento (base de los puntos)
-- -----------------------------------------------------------------------------
create table public.attendances (
  event_id      uuid not null references public.events (id) on delete cascade,
  user_id       uuid not null references public.profiles (id) on delete cascade,
  method        public.scan_method not null,
  first_scan_id bigint references public.access_scans (id) on delete set null,
  created_at    timestamptz not null default now(),
  primary key (event_id, user_id)
);
comment on table public.attendances is 'Quién asistió a cada evento. Se crea al validar el primer ingreso.';
create index attendances_user_id_idx on public.attendances (user_id);
create index attendances_first_scan_id_idx on public.attendances (first_scan_id);

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.tickets enable row level security;
alter table public.nfc_cards enable row level security;
alter table public.access_scans enable row level security;
alter table public.attendances enable row level security;

-- QR: el titular ve los suyos; el organizador gestiona todos.
-- (El acreditador validará vía función, sin acceso directo a la tabla.)
create policy "tickets: propios u organizador"
  on public.tickets for select to authenticated
  using (user_id = (select auth.uid()) or (select private.has_role('organizador')));
create policy "tickets: organizador emite"
  on public.tickets for insert to authenticated
  with check ((select private.has_role('organizador')));
create policy "tickets: organizador edita"
  on public.tickets for update to authenticated
  using ((select private.has_role('organizador')));
create policy "tickets: organizador borra"
  on public.tickets for delete to authenticated
  using ((select private.has_role('organizador')));

-- Tarjetas: el dueño ve la suya; el organizador da de alta, asigna y bloquea.
create policy "nfc_cards: propia u organizador"
  on public.nfc_cards for select to authenticated
  using (user_id = (select auth.uid()) or (select private.has_role('organizador')));
create policy "nfc_cards: organizador da de alta"
  on public.nfc_cards for insert to authenticated
  with check ((select private.has_role('organizador')));
create policy "nfc_cards: organizador edita"
  on public.nfc_cards for update to authenticated
  using ((select private.has_role('organizador')));
create policy "nfc_cards: organizador borra"
  on public.nfc_cards for delete to authenticated
  using ((select private.has_role('organizador')));

-- Lecturas: el organizador ve todo; el acreditador ve las que hizo.
-- Se insertan solo desde la función de validación (sin política de insert).
create policy "access_scans: organizador o acreditador propio"
  on public.access_scans for select to authenticated
  using (
    (select private.has_role('organizador'))
    or (scanned_by = (select auth.uid()) and (select private.has_role('acreditador')))
  );

create policy "attendances: propias u organizador"
  on public.attendances for select to authenticated
  using (user_id = (select auth.uid()) or (select private.has_role('organizador')));
