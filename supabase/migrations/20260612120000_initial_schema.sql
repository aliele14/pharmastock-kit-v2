-- PharmaStock — initial schema (SPEC.md §3)
-- All access is server-side via the service role key, which bypasses RLS.
-- RLS is enabled with NO policies on every table => deny-all for the anon and
-- authenticated roles (defense in depth: the browser never talks to the DB).

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- suppliers
-- ---------------------------------------------------------------------------
create table if not exists public.suppliers (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  country         text not null,
  lead_time_days  integer not null check (lead_time_days between 1 and 365)
);

-- ---------------------------------------------------------------------------
-- products
-- ---------------------------------------------------------------------------
create table if not exists public.products (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  category     text not null,
  unit_cost    numeric(10, 2) not null check (unit_cost >= 0),
  pack_size    integer not null default 10 check (pack_size > 0),
  cold_chain   boolean not null default false,
  supplier_id  uuid not null references public.suppliers (id) on delete restrict,
  created_at   timestamptz not null default now()
);

create index if not exists products_supplier_id_idx on public.products (supplier_id);
create index if not exists products_category_idx on public.products (category);

-- ---------------------------------------------------------------------------
-- batches (lots)
-- ---------------------------------------------------------------------------
create table if not exists public.batches (
  id            uuid primary key default gen_random_uuid(),
  product_id    uuid not null references public.products (id) on delete cascade,
  batch_number  text not null unique,
  quantity      integer not null check (quantity >= 0),
  expiry_date   date not null,
  received_at   date not null
);

create index if not exists batches_product_id_idx on public.batches (product_id);
create index if not exists batches_expiry_date_idx on public.batches (expiry_date);

-- ---------------------------------------------------------------------------
-- demand_history (one row per product per day)
-- ---------------------------------------------------------------------------
create table if not exists public.demand_history (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references public.products (id) on delete cascade,
  date        date not null,
  qty         integer not null check (qty >= 0),
  unique (product_id, date)
);

create index if not exists demand_history_product_id_date_idx
  on public.demand_history (product_id, date);

-- ---------------------------------------------------------------------------
-- Row Level Security: enable + deny-all (no policies defined)
-- ---------------------------------------------------------------------------
alter table public.suppliers enable row level security;
alter table public.products enable row level security;
alter table public.batches enable row level security;
alter table public.demand_history enable row level security;
