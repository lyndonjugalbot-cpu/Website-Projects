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

-- ===============================================================
-- Paid access: 12 months per Etsy code
-- ---------------------------------------------------------------
-- 1. A buyer claims codes with their Etsy order number. The `claim`
--    edge function checks the order with Etsy, then calls
--    issue_access_codes() with the service key: one code per item.
-- 2. The buyer signs in and redeems a code: redeem_access_code() adds
--    365 days to their row in `entitlements`.
--
-- Only the SECURITY DEFINER functions below write these tables. A
-- signed-in user can read their own entitlement row and nothing else;
-- codes, claims and Etsy tokens are invisible to every client.
--
-- Admin, from the SQL editor:
--   select public.issue_access_codes(3);                        -- 3 codes for gifts / support
--   update public.access_codes set revoked = true where code = 'PY12-XXXX-XXXX';
-- ===============================================================
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.entitlements (
  user_id           uuid primary key references auth.users(id) on delete cascade,
  access_expires_at timestamptz not null,
  plan              text not null,
  updated_at        timestamptz not null default now()
);
alter table public.entitlements enable row level security;
drop policy if exists "read own entitlement" on public.entitlements;
create policy "read own entitlement" on public.entitlements
  for select using (auth.uid() = user_id);

create table if not exists public.access_codes (
  code            text primary key,                 -- PY12-XXXX-XXXX
  plan            text not null default '12m',
  duration_days   integer not null,
  source          text not null check (source in ('etsy', 'admin')),
  etsy_receipt_id text,
  created_at      timestamptz not null default now(),
  redeem_by       timestamptz not null,
  redeemed_by     uuid references auth.users(id) on delete set null,
  redeemed_at     timestamptz,
  revoked         boolean not null default false
);
alter table public.access_codes enable row level security;
create index if not exists access_codes_receipt_idx on public.access_codes (etsy_receipt_id);

create table if not exists public.etsy_claims (
  receipt_id text primary key,
  claimed_at timestamptz not null default now(),
  codes      text[] not null default '{}'
);
alter table public.etsy_claims enable row level security;

create table if not exists public.rate_limits (
  key          text primary key,
  window_start timestamptz not null,
  count        integer not null
);
alter table public.rate_limits enable row level security;

-- The shop's Etsy OAuth tokens (one row), and PKCE state for the one-time connect.
create table if not exists public.etsy_auth (
  id            integer primary key default 1 check (id = 1),
  access_token  text not null,
  refresh_token text not null,
  expires_at    timestamptz not null,
  updated_at    timestamptz not null default now()
);
alter table public.etsy_auth enable row level security;

create table if not exists public.etsy_oauth_states (
  state         text primary key,
  code_verifier text not null,
  created_at    timestamptz not null default now()
);
alter table public.etsy_oauth_states enable row level security;

-- Fixed-window counter: true while `p_key` has been used at most `p_limit`
-- times in the current `p_window_seconds` window. Callers that want a failed
-- attempt to count must return normally afterwards (raising rolls it back).
create or replace function public.consume_rate_limit(p_key text, p_limit integer, p_window_seconds integer)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  used integer;
begin
  insert into public.rate_limits as rl (key, window_start, count) values (p_key, now(), 1)
  on conflict (key) do update set
    window_start = case when rl.window_start <= now() - make_interval(secs => p_window_seconds) then now() else rl.window_start end,
    count        = case when rl.window_start <= now() - make_interval(secs => p_window_seconds) then 1 else rl.count + 1 end
  returning rl.count into used;
  return used <= p_limit;
end $$;

-- 'PY12' + 8 characters from a 31-letter alphabet with no 0/O/1/I/L, so a code
-- survives being read aloud or handwritten. Case, spaces and dashes are ignored.
-- Returns NULL for anything that can't be a code.
create or replace function public.normalize_access_code(p_input text)
returns text language plpgsql immutable as $$
declare
  compact text := regexp_replace(upper(coalesce(p_input, '')), '[^A-Z0-9]', '', 'g');
  body    text;
begin
  if left(compact, 4) <> 'PY12' then return null; end if;
  body := substr(compact, 5);
  if body !~ '^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$' then return null; end if;
  return 'PY12-' || substr(body, 1, 4) || '-' || substr(body, 5, 4);
end $$;

-- A fresh code from pgcrypto's secure RNG. Rejection sampling (bytes >= 248
-- are dropped, 248 = 8 x 31) keeps every letter equally likely.
create or replace function public.generate_access_code()
returns text language plpgsql volatile set search_path = public, extensions as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  body  text := '';
  bytes bytea;
  b     integer;
begin
  while length(body) < 8 loop
    bytes := gen_random_bytes(16);
    for i in 0 .. 15 loop
      b := get_byte(bytes, i);
      if b < 248 and length(body) < 8 then
        body := body || substr(alphabet, (b % 31) + 1, 1);
      end if;
    end loop;
  end loop;
  return 'PY12-' || substr(body, 1, 4) || '-' || substr(body, 5, 4);
end $$;

-- Issues `p_count` 12-month codes, each redeemable for a year. With a receipt
-- id it also records the Etsy claim in the same transaction and returns NULL
-- if that order was already claimed, including by a concurrent request.
create or replace function public.issue_access_codes(p_count integer, p_source text default 'admin', p_receipt_id text default null)
returns text[] language plpgsql security definer set search_path = public, extensions as $$
declare
  issued text[] := '{}';
  c      text;
begin
  if p_count is null or p_count < 1 or p_count > 50 then
    raise exception 'p_count must be between 1 and 50';
  end if;
  if p_receipt_id is not null then
    insert into public.etsy_claims (receipt_id) values (p_receipt_id) on conflict (receipt_id) do nothing;
    if not found then return null; end if;
  end if;
  for i in 1 .. p_count loop
    loop
      c := public.generate_access_code();
      exit when not exists (select 1 from public.access_codes where code = c);
    end loop;
    insert into public.access_codes (code, plan, duration_days, source, etsy_receipt_id, redeem_by)
    values (c, '12m', 365, p_source, p_receipt_id, now() + interval '365 days');
    issued := issued || c;
  end loop;
  if p_receipt_id is not null then
    update public.etsy_claims set codes = issued where receipt_id = p_receipt_id;
  end if;
  return issued;
end $$;

-- Redeems a code for the signed-in user. Time stacks: redeeming while access
-- is still running adds 365 days to the current end date, never to today.
-- Failures come back as { ok: false, error } instead of raising, so the
-- attempt still counts toward the 10-per-hour limit.
create or replace function public.redeem_access_code(p_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid        uuid := auth.uid();
  norm       text := public.normalize_access_code(p_code);
  c          public.access_codes;
  new_expiry timestamptz;
begin
  if uid is null then
    return jsonb_build_object('ok', false, 'error', 'Sign in first, then redeem your code.');
  end if;
  if coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    return jsonb_build_object('ok', false, 'error', 'Create an account first, then redeem your code.');
  end if;
  if not public.consume_rate_limit('redeem:' || uid, 10, 3600) then
    return jsonb_build_object('ok', false, 'error', 'Too many attempts. Please wait an hour and try again.');
  end if;

  if norm is not null then
    select * into c from public.access_codes where code = norm for update;
  end if;
  if norm is null or c.code is null then
    return jsonb_build_object('ok', false, 'error', 'That code doesn''t exist. Check it and try again.');
  end if;
  if c.revoked then
    return jsonb_build_object('ok', false, 'error', 'That code has been cancelled. Message us on Etsy if you think this is a mistake.');
  end if;
  if c.redeemed_at is not null then
    return jsonb_build_object('ok', false, 'error', 'That code has already been redeemed.');
  end if;
  if c.redeem_by < now() then
    return jsonb_build_object('ok', false, 'error', 'That code has expired. Codes must be redeemed within a year of claiming.');
  end if;

  insert into public.entitlements as e (user_id, access_expires_at, plan)
  values (uid, now() + make_interval(days => c.duration_days), c.plan)
  on conflict (user_id) do update set
    access_expires_at = greatest(now(), e.access_expires_at) + make_interval(days => c.duration_days),
    plan              = excluded.plan,
    updated_at        = now()
  returning access_expires_at into new_expiry;

  update public.access_codes set redeemed_by = uid, redeemed_at = now() where code = c.code;

  return jsonb_build_object('ok', true, 'access_expires_at', new_expiry, 'plan', c.plan, 'duration_days', c.duration_days);
end $$;

-- Supabase grants EXECUTE on new public functions to anon and authenticated by
-- default, so each one is locked down explicitly.
revoke all on function public.consume_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_rate_limit(text, integer, integer) to service_role;
revoke all on function public.generate_access_code() from public, anon, authenticated;
revoke all on function public.issue_access_codes(integer, text, text) from public, anon, authenticated;
grant execute on function public.issue_access_codes(integer, text, text) to service_role;
revoke all on function public.redeem_access_code(text) from public, anon;
grant execute on function public.redeem_access_code(text) to authenticated;
