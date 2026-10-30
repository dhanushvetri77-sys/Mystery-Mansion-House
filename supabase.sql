-- Run in Supabase Dashboard → SQL Editor. Safe for the earlier booking demo schema.
create extension if not exists pgcrypto;

create table if not exists public.staff_members (
  email text primary key check (email = lower(email)),
  created_at timestamptz not null default now()
);

create table if not exists public.rooms (
  id text primary key,
  name text not null,
  price_cents integer not null default 0 check (price_cents >= 0),
  currency text not null default 'usd' check (currency = lower(currency)),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.rooms (id,name) values
  ('room-1','Room 1'),('room-2','Room 2'),('room-3','Room 3'),('room-4','Room 4')
on conflict (id) do nothing;

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(name) between 1 and 80),
  email text not null,
  phone text not null default '',
  booking_date date not null,
  booking_time time not null,
  status text not null default 'pending',
  room_id text references public.rooms(id),
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid','paid','refunded')),
  amount_cents integer check (amount_cents is null or amount_cents >= 0),
  currency text,
  stripe_checkout_session_id text,
  stripe_payment_intent_id text,
  created_at timestamptz not null default now()
);

-- Migrate an existing demo bookings table and its old status constraint.
alter table public.bookings add column if not exists room_id text references public.rooms(id);
alter table public.bookings add column if not exists payment_status text not null default 'unpaid';
alter table public.bookings add column if not exists amount_cents integer;
alter table public.bookings add column if not exists currency text;
alter table public.bookings add column if not exists stripe_checkout_session_id text;
alter table public.bookings add column if not exists stripe_payment_intent_id text;
alter table public.bookings alter column status set default 'pending';
alter table public.bookings drop constraint if exists bookings_status_check;
update public.bookings set status='confirmed', payment_status='paid' where status='active';
alter table public.bookings add constraint bookings_status_check check (status in ('pending','confirmed','cancelled'));

-- A room can have only one pending or confirmed reservation for a date/time.
-- Expired checkout sessions are released by the Stripe webhook.
create unique index if not exists bookings_room_slot_reserved
  on public.bookings(room_id,booking_date,booking_time)
  where room_id is not null and status in ('pending','confirmed');

alter table public.staff_members enable row level security;
alter table public.rooms enable row level security;
alter table public.bookings enable row level security;

drop policy if exists "staff can verify own membership" on public.staff_members;
create policy "staff can verify own membership" on public.staff_members
  for select to authenticated
  using (email = lower(coalesce(auth.jwt()->>'email','')));

drop policy if exists "customers and staff can read bookings" on public.bookings;
create policy "customers and staff can read bookings" on public.bookings
  for select to authenticated
  using (
    user_id = auth.uid()
    or exists (select 1 from public.staff_members s where s.email = lower(coalesce(auth.jwt()->>'email','')))
  );

drop policy if exists "customers can create own bookings" on public.bookings;

drop policy if exists "staff can update bookings" on public.bookings;
create policy "staff can update bookings" on public.bookings
  for update to authenticated
  using (exists (select 1 from public.staff_members s where s.email = lower(coalesce(auth.jwt()->>'email',''))))
  with check (exists (select 1 from public.staff_members s where s.email = lower(coalesce(auth.jwt()->>'email',''))));

drop policy if exists "anyone can view active rooms" on public.rooms;
create policy "anyone can view active rooms" on public.rooms
  for select to anon, authenticated using (is_active = true);

grant select on public.staff_members to authenticated;
grant select on public.rooms to anon, authenticated;
revoke insert on public.bookings from authenticated;
grant select, update on public.bookings to authenticated;

-- Set the room's amount in cents and ISO currency after choosing your prices:
-- update public.rooms set price_cents = 2500, currency = 'usd' where id = 'room-1';
-- Repeat for room-2, room-3, and room-4. Example above means USD 25.00.
-- Add staff by exact email (lowercase):
-- insert into public.staff_members (email) values ('employee@yourcompany.com');
