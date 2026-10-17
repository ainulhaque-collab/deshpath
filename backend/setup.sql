-- INITIAL SETUP ONLY: this script has not been applied to a live database.
-- Run on a dedicated, empty Deshpath Supabase project after owner approval.
-- Intentionally fails on existing object names; this is not a repeatable migration.
begin;

create table public.deshpath_journals (
  user_id uuid primary key references auth.users(id) on delete cascade,
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object' and octet_length(snapshot::text) <= 300000),
  updated_at timestamptz not null default now()
);

create table public.deshpath_contributions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  district_id text not null check (district_id in (
    'dhaka','faridpur','gazipur','gopalganj','kishoreganj','madaripur','manikganj','munshiganj','narayanganj','narsingdi','rajbari','shariatpur','tangail',
    'bandarban','brahmanbaria','chandpur','chattogram','cumilla','coxsbazar','feni','khagrachhari','lakshmipur','noakhali','rangamati',
    'bogura','joypurhat','naogaon','natore','chapainawabganj','pabna','rajshahi','sirajganj','dinajpur','gaibandha','kurigram','lalmonirhat','nilphamari','panchagarh','rangpur','thakurgaon',
    'bagerhat','chuadanga','jashore','jhenaidah','khulna','kushtia','magura','meherpur','narail','satkhira','barguna','barishal','bhola','jhalokathi','patuakhali','pirojpur',
    'habiganj','moulvibazar','sunamganj','sylhet','jamalpur','mymensingh','netrokona','sherpur'
  )),
  title text not null check (char_length(btrim(title)) between 3 and 120),
  body text not null check (char_length(btrim(body)) between 20 and 4000),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now(),
  published_at timestamptz,
  check ((status = 'approved' and published_at is not null) or (status <> 'approved' and published_at is null))
);

create table public.deshpath_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  place_id text not null check (place_id in ('sajek','coxsbazar-beach','sundarbans','sreemangal','nilgiri','ratargul','kuakata','paharpur','shatgombuj','panam-city','lalbagh-fort','mahasthangarh','tanguar-haor','birishiri','kaptai-lake','patenga')),
  rating smallint not null check (rating between 1 and 5),
  body text not null check (char_length(btrim(body)) between 10 and 2000),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now(),
  published_at timestamptz,
  unique (user_id, place_id),
  check ((status = 'approved' and published_at is not null) or (status <> 'approved' and published_at is null))
);

create index deshpath_contributions_owner_idx on public.deshpath_contributions (user_id, created_at desc);
create index deshpath_contributions_published_idx on public.deshpath_contributions (published_at desc) where status = 'approved';
create index deshpath_reviews_published_idx on public.deshpath_reviews (place_id, published_at desc) where status = 'approved';

create function public.deshpath_touch_journal() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  new.updated_at := pg_catalog.now();
  return new;
end;
$$;
revoke all on function public.deshpath_touch_journal() from public, anon, authenticated;
create trigger deshpath_journal_updated before update on public.deshpath_journals
for each row execute function public.deshpath_touch_journal();

alter table public.deshpath_journals enable row level security;
alter table public.deshpath_contributions enable row level security;
alter table public.deshpath_reviews enable row level security;

-- Do not depend on a project's historical default grants.
revoke all on public.deshpath_journals, public.deshpath_contributions, public.deshpath_reviews from public, anon, authenticated;
grant usage on schema public to anon, authenticated;
grant select on public.deshpath_journals to authenticated;
grant insert (user_id, snapshot), update (user_id, snapshot) on public.deshpath_journals to authenticated;
grant select on public.deshpath_contributions, public.deshpath_reviews to authenticated;
grant select (id, district_id, title, body, status, published_at) on public.deshpath_contributions to anon;
grant select (id, place_id, rating, body, status, published_at) on public.deshpath_reviews to anon;
grant insert (user_id, district_id, title, body) on public.deshpath_contributions to authenticated;
grant insert (user_id, place_id, rating, body) on public.deshpath_reviews to authenticated;

create policy journals_owner_select on public.deshpath_journals for select to authenticated
using ((select auth.uid()) = user_id and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false));
create policy journals_owner_insert on public.deshpath_journals for insert to authenticated
with check ((select auth.uid()) = user_id and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false));
create policy journals_owner_update on public.deshpath_journals for update to authenticated
using ((select auth.uid()) = user_id and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false))
with check ((select auth.uid()) = user_id and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false));

create policy contributions_public_approved on public.deshpath_contributions for select to anon, authenticated
using (status = 'approved');
create policy contributions_owner_select on public.deshpath_contributions for select to authenticated
using ((select auth.uid()) = user_id and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false));
create policy contributions_owner_pending_insert on public.deshpath_contributions for insert to authenticated
with check ((select auth.uid()) = user_id and status = 'pending' and published_at is null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false));

create policy reviews_public_approved on public.deshpath_reviews for select to anon, authenticated
using (status = 'approved');
create policy reviews_owner_select on public.deshpath_reviews for select to authenticated
using ((select auth.uid()) = user_id and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false));
create policy reviews_owner_pending_insert on public.deshpath_reviews for insert to authenticated
with check ((select auth.uid()) = user_id and status = 'pending' and published_at is null and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false));

-- No client UPDATE/DELETE grants on community content, no moderation RPC,
-- no user-editable metadata authorization and no public game leaderboard.
commit;
