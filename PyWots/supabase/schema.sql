-- PyWots — Supabase schema
-- Run in the Supabase dashboard: Database -> SQL Editor -> New query -> Run.
-- Safe to re-run (idempotent).

-- ===============================================================
-- profiles
-- ---------------------------------------------------------------
-- The whole save lives in `state` as JSONB — cheap writes, no migration
-- when the app adds a field. The columns beside it are denormalised
-- mirrors of the handful of values worth querying (retention, level
-- spread, funnel). src/lib/persistence.js keeps them in sync on write.
-- ===============================================================
create table if not exists public.profiles (
  id                  uuid primary key references auth.users(id) on delete cascade,
  state               jsonb   not null default '{}'::jsonb,

  -- queryable mirrors
  xp                  integer not null default 0,
  level               integer not null default 1,
  day                 integer not null default 1,
  streak              integer not null default 0,
  best_streak         integer not null default 0,
  bosses_cleared      integer not null default 0,
  rank                text    not null default 'E',
  achievements_count  integer not null default 0,
  onboarded           boolean not null default false,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  last_active_at      timestamptz not null default now()
);

-- ===============================================================
-- Row Level Security — a user can only ever touch their own row
-- ===============================================================
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

-- ===============================================================
-- keep updated_at honest
-- ===============================================================
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

-- ===============================================================
-- create the row automatically on signup (including anonymous)
-- ===============================================================
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

-- ===============================================================
-- in-app account deletion (App Store requirement)
-- ---------------------------------------------------------------
-- Lets a signed-in user delete THEIR OWN auth account. The cascade on
-- profiles.id removes their data too. Runs as definer so the client
-- never needs the service_role key.
-- ===============================================================
create or replace function public.delete_user()
returns void language plpgsql security definer set search_path = public, auth as $$
begin
  delete from auth.users where id = auth.uid();
end $$;

revoke all on function public.delete_user() from public, anon;
grant execute on function public.delete_user() to authenticated;

-- ===============================================================
-- indexes for the queries you'll actually run
-- ===============================================================
create index if not exists profiles_last_active_idx on public.profiles (last_active_at desc);
create index if not exists profiles_level_idx       on public.profiles (level);
create index if not exists profiles_day_idx         on public.profiles (day);
