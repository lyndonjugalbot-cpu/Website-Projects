-- ============================================================
--  AV Toys — customer reviews: database schema
--  Run ONCE: Supabase dashboard → SQL Editor → New query → paste all → Run.
--  Safe to re-run (uses "if not exists" / "on conflict").
-- ============================================================

-- 1. Table -----------------------------------------------------
create table if not exists public.reviews (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  name          text not null check (char_length(name) between 1 and 80),
  order_number  text not null check (char_length(order_number) between 1 and 40),
  rating        int  not null check (rating between 1 and 5),
  title         text check (char_length(title) <= 120),
  body          text check (char_length(body) <= 4000),
  photo_path    text not null,
  status        text not null default 'pending'
                check (status in ('pending', 'approved', 'rejected'))
);

create index if not exists reviews_status_created_idx
  on public.reviews (status, created_at desc);

-- 2. Row Level Security --------------------------------------
alter table public.reviews enable row level security;

drop policy if exists "public submits pending reviews" on public.reviews;
create policy "public submits pending reviews"
  on public.reviews for insert to anon
  with check (status = 'pending');

drop policy if exists "public reads approved reviews" on public.reviews;
create policy "public reads approved reviews"
  on public.reviews for select to anon
  using (status = 'approved');

drop policy if exists "admin reads all reviews" on public.reviews;
create policy "admin reads all reviews"
  on public.reviews for select to authenticated
  using (true);

drop policy if exists "admin updates reviews" on public.reviews;
create policy "admin updates reviews"
  on public.reviews for update to authenticated
  using (true) with check (true);

drop policy if exists "admin deletes reviews" on public.reviews;
create policy "admin deletes reviews"
  on public.reviews for delete to authenticated
  using (true);

-- 3. Storage bucket for the customer photos -----------------
insert into storage.buckets (id, name, public)
values ('review-photos', 'review-photos', true)
on conflict (id) do nothing;

drop policy if exists "public uploads review photos" on storage.objects;
create policy "public uploads review photos"
  on storage.objects for insert to anon
  with check (bucket_id = 'review-photos');

drop policy if exists "anyone views review photos" on storage.objects;
create policy "anyone views review photos"
  on storage.objects for select to public
  using (bucket_id = 'review-photos');

drop policy if exists "admin deletes review photos" on storage.objects;
create policy "admin deletes review photos"
  on storage.objects for delete to authenticated
  using (bucket_id = 'review-photos');
