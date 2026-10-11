-- =============================================================================
-- Rio Pass · 05 · Comercio y pagos (preparado; SIN lógica en la Etapa 1)
-- =============================================================================
-- Un mismo modelo sirve para vender entradas y bebidas:
--   orders (pedido) -> order_items (qué se compró) -> payments (Mercado Pago)
-- Al aprobarse el pago (webhook de Mercado Pago, del lado del servidor):
--   * pedido de entradas -> se emiten tickets con order_id
--   * pedido de bebidas  -> queda "pagado" con un pickup_code (QR de retiro)
--     y la barra exprés lo marca "entregado"; suma puntos con reason 'compra'.
-- Los pagos solo los escribe el servidor (service role), nunca el navegador.
-- =============================================================================

create type public.order_kind as enum ('entradas', 'bebidas');
create type public.order_status as enum ('pendiente', 'pagado', 'entregado', 'cancelado', 'reembolsado');
create type public.payment_status as enum ('pendiente', 'aprobado', 'rechazado', 'reembolsado', 'cancelado');

-- -----------------------------------------------------------------------------
-- Productos (tragos y bebidas de la barra exprés)
-- -----------------------------------------------------------------------------
create table public.products (
  id            uuid primary key default gen_random_uuid(),
  name          text not null check (char_length(name) between 1 and 80),
  description   text,
  category      text,
  image_path    text,
  price         numeric(12, 2) not null check (price >= 0),
  currency      text not null default 'ARS',
  points_reward integer not null default 0 check (points_reward >= 0),
  is_active     boolean not null default true,
  sort_order    integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
comment on table public.products is 'Carta de la barra exprés. points_reward = puntos que suma cada unidad comprada.';

create trigger products_set_updated_at
  before update on public.products
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- Pedidos
-- -----------------------------------------------------------------------------
create table public.orders (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles (id) on delete restrict,
  event_id     uuid references public.events (id) on delete set null,
  kind         public.order_kind not null,
  status       public.order_status not null default 'pendiente',
  total        numeric(12, 2) not null default 0 check (total >= 0),
  currency     text not null default 'ARS',
  pickup_code  text unique,
  paid_at      timestamptz,
  delivered_at timestamptz,
  delivered_by uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
comment on table public.orders is 'Pedido de entradas o bebidas. pickup_code = QR que muestra el cliente en la barra exprés.';

create index orders_user_id_idx on public.orders (user_id);
create index orders_event_id_idx on public.orders (event_id);
create index orders_delivered_by_idx on public.orders (delivered_by);
create index orders_status_idx on public.orders (status);

create trigger orders_set_updated_at
  before update on public.orders
  for each row execute function private.set_updated_at();

create table public.order_items (
  id             bigint generated always as identity primary key,
  order_id       uuid not null references public.orders (id) on delete cascade,
  product_id     uuid references public.products (id) on delete set null,
  ticket_type_id uuid references public.ticket_types (id) on delete set null,
  name           text not null,
  quantity       integer not null check (quantity > 0),
  unit_price     numeric(12, 2) not null check (unit_price >= 0),
  check (num_nonnulls(product_id, ticket_type_id) <= 1)
);
comment on column public.order_items.name is 'Copia del nombre al momento de la compra (por si el producto cambia).';

create index order_items_order_id_idx on public.order_items (order_id);
create index order_items_product_id_idx on public.order_items (product_id);
create index order_items_ticket_type_id_idx on public.order_items (ticket_type_id);

-- -----------------------------------------------------------------------------
-- Pagos (Mercado Pago)
-- -----------------------------------------------------------------------------
create table public.payments (
  id                     uuid primary key default gen_random_uuid(),
  order_id               uuid not null references public.orders (id) on delete restrict,
  user_id                uuid references public.profiles (id) on delete set null,
  provider               text not null default 'mercadopago',
  provider_preference_id text,
  provider_payment_id    text unique,
  status                 public.payment_status not null default 'pendiente',
  amount                 numeric(12, 2) not null check (amount >= 0),
  currency               text not null default 'ARS',
  raw                    jsonb,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);
comment on table public.payments is 'Intentos de pago. Solo los escribe el servidor (webhook de Mercado Pago con service role).';
comment on column public.payments.raw is 'Último payload recibido del proveedor, para auditoría.';

create index payments_order_id_idx on public.payments (order_id);
create index payments_user_id_idx on public.payments (user_id);

create trigger payments_set_updated_at
  before update on public.payments
  for each row execute function private.set_updated_at();

-- Claves foráneas que quedaron pendientes en migraciones anteriores.
alter table public.tickets
  add constraint tickets_order_id_fkey foreign key (order_id) references public.orders (id) on delete set null;
alter table public.points_ledger
  add constraint points_ledger_order_id_fkey foreign key (order_id) references public.orders (id) on delete set null;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payments enable row level security;

create policy "products: activos públicos u organizador"
  on public.products for select to anon, authenticated
  using (is_active or (select private.has_role('organizador')));
create policy "products: organizador crea"
  on public.products for insert to authenticated
  with check ((select private.has_role('organizador')));
create policy "products: organizador edita"
  on public.products for update to authenticated
  using ((select private.has_role('organizador')));
create policy "products: organizador borra"
  on public.products for delete to authenticated
  using ((select private.has_role('organizador')));

-- Pedidos: el cliente ve los suyos; organizador todos; la barra los pagados/entregados.
-- Se crean y se pagan del lado del servidor (sin políticas de insert para el navegador).
create policy "orders: propios, organizador o barra"
  on public.orders for select to authenticated
  using (
    user_id = (select auth.uid())
    or (select private.has_role('organizador'))
    or ((select private.has_role('barra')) and status in ('pagado', 'entregado'))
  );
create policy "orders: barra marca entregado"
  on public.orders for update to authenticated
  using ((select private.has_role('barra')) and status = 'pagado')
  with check ((select private.has_role('barra')) and status = 'entregado');

create policy "order_items: del pedido visible"
  on public.order_items for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id));

create policy "payments: propios u organizador"
  on public.payments for select to authenticated
  using (user_id = (select auth.uid()) or (select private.has_role('organizador')));

revoke insert, update, delete on public.orders from anon, authenticated;
grant update (status, delivered_at, delivered_by) on public.orders to authenticated;
revoke insert, update, delete on public.order_items from anon, authenticated;
revoke insert, update, delete on public.payments from anon, authenticated;
