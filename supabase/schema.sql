-- ============================================================================
-- Paramount Logistics — Database Schema (Postgres / Supabase)
-- Run this in the Supabase SQL Editor (or via `supabase db push`)
-- ============================================================================

create extension if not exists "uuid-ossp";
create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- ENUM TYPES
-- ----------------------------------------------------------------------------
create type shipment_status as enum (
  'quote_requested','booked','picked_up','in_transit','customs_clearance',
  'out_for_delivery','delivered','delayed','cancelled'
);
create type freight_mode as enum ('sea', 'air', 'road', 'multimodal');
create type quote_status as enum ('pending', 'reviewed', 'quoted', 'accepted', 'declined', 'expired');
create type user_role as enum ('client', 'staff', 'admin');
create type payment_status as enum ('unpaid', 'pending', 'paid', 'failed', 'skipped');

-- ----------------------------------------------------------------------------
-- PROFILES  (extends Supabase auth.users)
-- ----------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  company_name text,
  phone text,
  role user_role not null default 'client',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, role)
  values (new.id, new.raw_user_meta_data ->> 'full_name', 'client');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ----------------------------------------------------------------------------
-- QUOTES
-- ----------------------------------------------------------------------------
create table public.quotes (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.profiles(id) on delete set null,
  full_name text not null,
  email text not null,
  phone text,
  company_name text,
  mode freight_mode not null,
  origin text not null,
  destination text not null,
  cargo_description text,
  weight_kg numeric,
  volume_cbm numeric,
  container_type text,
  incoterm text,
  preferred_ship_date date,
  status quote_status not null default 'pending',
  quoted_amount numeric,
  quoted_currency text default 'USD',
  admin_notes text,
  payment_status payment_status not null default 'unpaid',
  payment_method text,           -- e.g. 'mpesa'
  payment_reference text,        -- M-Pesa CheckoutRequestID / receipt number
  payment_amount numeric,
  receipt_url text,              -- public URL of the generated PDF receipt
  receipt_generated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- SHIPMENTS
-- ----------------------------------------------------------------------------
create table public.shipments (
  id uuid primary key default uuid_generate_v4(),
  tracking_number text not null unique,
  quote_id uuid references public.quotes(id) on delete set null,
  user_id uuid references public.profiles(id) on delete set null,
  mode freight_mode not null,
  status shipment_status not null default 'booked',
  origin text not null,
  destination text not null,
  carrier text,
  vessel_or_flight text,
  container_number text,
  bill_of_lading text,
  cargo_description text,
  weight_kg numeric,
  volume_cbm numeric,
  estimated_departure timestamptz,
  estimated_arrival timestamptz,
  actual_departure timestamptz,
  actual_arrival timestamptz,
  current_location text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_shipments_tracking_number on public.shipments (tracking_number);
create index idx_shipments_user_id on public.shipments (user_id);
create index idx_quotes_payment_reference on public.quotes (payment_reference);

-- ----------------------------------------------------------------------------
-- TRACKING EVENTS
-- ----------------------------------------------------------------------------
create table public.tracking_events (
  id uuid primary key default uuid_generate_v4(),
  shipment_id uuid not null references public.shipments(id) on delete cascade,
  status shipment_status not null,
  location text,
  note text,
  event_time timestamptz not null default now(),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create index idx_tracking_events_shipment_id on public.tracking_events (shipment_id);

-- ----------------------------------------------------------------------------
-- CONTACT MESSAGES
-- ----------------------------------------------------------------------------
create table public.contact_messages (
  id uuid primary key default uuid_generate_v4(),
  full_name text not null,
  email text not null,
  phone text,
  subject text,
  message text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- updated_at trigger helper
-- ----------------------------------------------------------------------------
create function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_profiles_updated_at before update on public.profiles
  for each row execute procedure public.set_updated_at();
create trigger trg_quotes_updated_at before update on public.quotes
  for each row execute procedure public.set_updated_at();
create trigger trg_shipments_updated_at before update on public.shipments
  for each row execute procedure public.set_updated_at();

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
alter table public.profiles enable row level security;
alter table public.quotes enable row level security;
alter table public.shipments enable row level security;
alter table public.tracking_events enable row level security;
alter table public.contact_messages enable row level security;

create function public.is_staff()
returns boolean language sql security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('staff', 'admin')
  );
$$;

create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id or public.is_staff());
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

create policy "quotes_insert_public" on public.quotes
  for insert with check (true);
create policy "quotes_select_own_or_staff" on public.quotes
  for select using (auth.uid() = user_id or public.is_staff());
create policy "quotes_update_staff_only" on public.quotes
  for update using (public.is_staff());

create policy "shipments_select_own_or_staff" on public.shipments
  for select using (auth.uid() = user_id or public.is_staff());
create policy "shipments_insert_staff_only" on public.shipments
  for insert with check (public.is_staff());
create policy "shipments_update_staff_only" on public.shipments
  for update using (public.is_staff());

create policy "tracking_events_select_via_shipment" on public.tracking_events
  for select using (
    exists (
      select 1 from public.shipments s
      where s.id = shipment_id and (s.user_id = auth.uid() or public.is_staff())
    )
  );
create policy "tracking_events_insert_staff_only" on public.tracking_events
  for insert with check (public.is_staff());

create policy "contact_insert_public" on public.contact_messages
  for insert with check (true);
create policy "contact_select_staff_only" on public.contact_messages
  for select using (public.is_staff());

-- ----------------------------------------------------------------------------
-- PUBLIC TRACKING LOOKUP (safe, anonymous — used by track.html)
-- ----------------------------------------------------------------------------
create function public.track_shipment(p_tracking_number text)
returns table (
  tracking_number text, mode freight_mode, status shipment_status,
  origin text, destination text, current_location text,
  estimated_departure timestamptz, estimated_arrival timestamptz,
  actual_departure timestamptz, actual_arrival timestamptz
)
language sql security definer set search_path = public as $$
  select tracking_number, mode, status, origin, destination, current_location,
         estimated_departure, estimated_arrival, actual_departure, actual_arrival
  from public.shipments
  where tracking_number = p_tracking_number;
$$;

create function public.track_shipment_events(p_tracking_number text)
returns table (status shipment_status, location text, note text, event_time timestamptz)
language sql security definer set search_path = public as $$
  select te.status, te.location, te.note, te.event_time
  from public.tracking_events te
  join public.shipments s on s.id = te.shipment_id
  where s.tracking_number = p_tracking_number
  order by te.event_time asc;
$$;

grant execute on function public.track_shipment(text) to anon, authenticated;
grant execute on function public.track_shipment_events(text) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- DEMO DATA — optional, powers the "Try PLX-2026-000123" hint on /track.html.
-- Safe to delete this block once you have real shipments.
-- ----------------------------------------------------------------------------
insert into public.shipments (
  tracking_number, mode, status, origin, destination, current_location,
  estimated_departure, estimated_arrival
) values (
  'PLX-2026-000123', 'sea', 'in_transit', 'Mombasa, KE', 'Rotterdam, NL', 'Red Sea, en route to Suez Canal',
  now() - interval '9 days', now() + interval '12 days'
);

insert into public.tracking_events (shipment_id, status, location, note, event_time)
select id, 'booked', 'Mombasa, KE', 'Booking confirmed, container allocated.', now() - interval '9 days'
from public.shipments where tracking_number = 'PLX-2026-000123';

insert into public.tracking_events (shipment_id, status, location, note, event_time)
select id, 'picked_up', 'Mombasa Port', 'Container loaded onto vessel.', now() - interval '8 days'
from public.shipments where tracking_number = 'PLX-2026-000123';

insert into public.tracking_events (shipment_id, status, location, note, event_time)
select id, 'in_transit', 'Red Sea', 'Vessel en route to Suez Canal.', now() - interval '2 days'
from public.shipments where tracking_number = 'PLX-2026-000123';

-- ----------------------------------------------------------------------------
-- STORAGE: "receipts" bucket for generated PDF payment receipts.
-- Public so a receipt_url can be opened/downloaded directly by the client
-- or admin without a signed-URL round trip. Only the Edge Functions
-- (service role) write to it, so nothing sensitive beyond the receipt
-- itself is exposed.
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', true)
on conflict (id) do nothing;
