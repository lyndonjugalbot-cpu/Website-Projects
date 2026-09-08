-- SelfLeveling — Supabase schema
-- Run this in the Supabase SQL editor (Database → SQL Editor → New query).

-- ---------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------
-- The full save lives in `state` as JSONB, which keeps writes cheap and means
-- adding a field to the app needs no migration. The columns alongside it are
-- denormalised copies of the handful of values you'll actually want to query
-- (retention, level distribution, conversion) without cracking open JSON.
-- persistence.js keeps them in sync on every write.

create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  state         jsonb not null default '{}'::jsonb,

  -- queryable mirrors
  xp            integer not null default 0,
  level         integer not null default 1,
  streak        integer not null default 0,
  day_index     integer not null default 0,
  start_date    date,
  is_pro        boolean not null default false,
  onboarded     boolean not null default false,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  last_active_at timestamptz not null default now()
);

-- ---------------------------------------------------------------
-- row level security — a user can only ever touch their own row
-- ---------------------------------------------------------------
alter table public.profiles enable row level security;

drop policy if exists "read own profile" on public.profiles;
create policy "read own profile" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "insert own profile" on public.profiles;
create policy "insert own profile" on public.profiles
  for insert with check (auth.uid() = id);

drop policy if exists "update own profile" on public.profiles;
create policy "update own profile" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- ---------------------------------------------------------------
-- keep updated_at honest
-- ---------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------
-- create the row automatically when a user signs up (incl. anonymous)
-- ---------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id) values (new.id)
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------
-- indexes for the queries you'll actually run
-- ---------------------------------------------------------------
create index if not exists profiles_last_active_idx on public.profiles (last_active_at desc);
create index if not exists profiles_pro_idx on public.profiles (is_pro) where is_pro;

-- Handy later: days cleared per user, straight out of the JSONB.
-- select id, jsonb_object_keys(state->'log') as day from public.profiles;
