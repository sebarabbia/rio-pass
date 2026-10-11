-- =============================================================================
-- Rio Pass · 04 · Puntos (libro de movimientos) para el ranking por temporada
-- =============================================================================
-- Los puntos se guardan como movimientos (+/-), nunca como un total editable:
-- el total y el ranking se calculan sumando. Así queda auditado de dónde salió
-- cada punto (asistencia, compra de bebidas, ajuste manual, premio).
-- La lógica que los suma al validar un ingreso es de una etapa posterior.
-- =============================================================================

create type public.points_reason as enum ('asistencia', 'compra', 'ajuste', 'premio');

create table public.points_ledger (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  season_id  uuid not null references public.seasons (id) on delete restrict,
  points     integer not null check (points <> 0),
  reason     public.points_reason not null,
  event_id   uuid references public.events (id) on delete set null,
  order_id   uuid,  -- FK a orders en la migración 05 (comercio)
  note       text check (note is null or char_length(note) <= 200),
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
comment on table public.points_ledger is 'Movimientos de puntos. Total del usuario = suma por temporada.';

-- Una sola suma por asistencia a cada evento.
create unique index points_ledger_one_attendance_per_event
  on public.points_ledger (user_id, event_id) where reason = 'asistencia';
create index points_ledger_season_user_idx on public.points_ledger (season_id, user_id);
create index points_ledger_user_id_idx on public.points_ledger (user_id);
create index points_ledger_event_id_idx on public.points_ledger (event_id);
create index points_ledger_order_id_idx on public.points_ledger (order_id);
create index points_ledger_created_by_idx on public.points_ledger (created_by);

alter table public.points_ledger enable row level security;

-- Cada uno ve sus puntos; el organizador ve todos y puede cargar ajustes/premios.
-- El ranking público (solo nombre + total) se expondrá con una función dedicada.
create policy "points_ledger: propios u organizador"
  on public.points_ledger for select to authenticated
  using (user_id = (select auth.uid()) or (select private.has_role('organizador')));
create policy "points_ledger: organizador carga ajustes"
  on public.points_ledger for insert to authenticated
  with check ((select private.has_role('organizador')) and reason in ('ajuste', 'premio'));

revoke update, delete on public.points_ledger from anon, authenticated;
