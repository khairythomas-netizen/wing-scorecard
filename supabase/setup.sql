-- =====================================================================
-- WingZ — complete database setup
--
-- Paste this ENTIRE file into the Supabase SQL Editor and run it.
-- IMPORTANT: clear the editor first, or leftovers from a previous paste
-- will fail before this file is reached.
-- Safe to run repeatedly: every statement is guarded.
-- =====================================================================


-- WingZ schema
--
-- Design notes that matter:
--  * Every sub-score is its own column on review_scores. The final score is
--    stored too, but only as a derived convenience for sorting -- it is never
--    the only record of how a review was scored.
--  * Heat and score aggregates key on (place_id, flavour_id). One shop's
--    Buffalo, Hot Honey and Suicide are three different things, and the whole
--    heat-filter feature depends on keeping them apart.
--  * A cook score is stored alongside its raw slider position, because 2.0 on
--    the raw side and 2.0 on the burnt side are different wings.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- identity

create table if not exists profiles (
  id             uuid primary key references auth.users on delete cascade,
  username       text unique not null check (username ~ '^[a-z0-9_.]{3,30}$'),
  display_name   text not null default '',
  bio            text not null default '',
  avatar_url     text not null default '',
  is_private     boolean not null default false,
  created_at     timestamptz not null default now()
);

create table if not exists follows (
  follower_id  uuid not null references profiles on delete cascade,
  followee_id  uuid not null references profiles on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);
create index if not exists follows_followee_idx on follows (followee_id);

-- New accounts start private, so nobody's first post is public by accident.
-- Set as a default rather than a backfill: existing accounts keep whatever
-- their owner already chose.
alter table profiles alter column is_private set default true;

create table if not exists follow_requests (
  id            uuid primary key default gen_random_uuid(),
  requester_id  uuid not null references profiles on delete cascade,
  target_id     uuid not null references profiles on delete cascade,
  status        text not null default 'pending'
                  check (status in ('pending','approved','rejected')),
  created_at    timestamptz not null default now(),
  unique (requester_id, target_id)
);

-- ------------------------------------------------------------------ places

-- A place is provider-owned identity (Google today, anything tomorrow).
create table if not exists places (
  id                 uuid primary key default gen_random_uuid(),
  -- Keep in sync with Place['provider'] in src/lib/types.ts; a test asserts it.
  provider           text not null check (provider in ('mock','osm','google','mapbox','manual')),
  external_id        text not null,
  display_name       text not null,
  normalized_name    text not null,
  formatted_address  text not null default '',
  lat                double precision not null,
  lng                double precision not null,
  city               text not null default '',
  region             text not null default '',
  country            text not null default '',
  created_at         timestamptz not null default now(),
  unique (provider, external_id)
);
create index if not exists places_normalized_idx on places (normalized_name);
create index if not exists places_city_idx on places (city);
-- Bounding-box queries for the Discover map.
create index if not exists places_latlng_idx on places (lat, lng);

-- A restaurant is the WingZ-side record; places is the geographic identity.
create table if not exists restaurants (
  id          uuid primary key default gen_random_uuid(),
  place_id    uuid not null unique references places on delete restrict,
  created_at  timestamptz not null default now()
);

create table if not exists wing_flavours (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  normalized_name  text not null unique,
  created_at       timestamptz not null default now()
);

-- ----------------------------------------------------------------- reviews

create table if not exists reviews (
  id           uuid primary key default gen_random_uuid(),
  author_id    uuid not null references profiles on delete cascade,
  place_id     uuid not null references places on delete restrict,
  flavour_id   uuid not null references wing_flavours on delete restrict,
  order_text   text not null,
  -- Nullable: people often do not remember what they paid.
  price_cents  integer check (price_cents >= 0),
  currency     text not null default 'CAD',
  -- Descriptive metadata only. Never contributes to the score.
  heat         smallint not null check (heat between 1 and 5),
  style        text not null default 'bone_in' check (style in ('bone_in','boneless')),
  breading     text not null default 'non_breaded' check (breading in ('non_breaded','breaded')),
  caption      text not null default '',
  visibility   text not null default 'public' check (visibility in ('public','followers')),
  base_score   numeric(3,1) not null check (base_score between 0 and 10),
  bonus_score  numeric(2,1) not null default 0 check (bonus_score between 0 and 0.5),
  -- Reaches 10.5. Deliberately not normalised back down to 10.
  final_score  numeric(3,1) not null check (final_score between 0 and 10.5),
  created_at   timestamptz not null default now()
);
create index if not exists reviews_author_created_idx on reviews (author_id, created_at desc);
create index if not exists reviews_place_flavour_idx on reviews (place_id, flavour_id);
create index if not exists reviews_final_score_idx on reviews (final_score desc);
create index if not exists reviews_heat_idx on reviews (heat);

-- One row per review. Every component of the 10.0 base is preserved.
create table if not exists review_scores (
  review_id      uuid primary key references reviews on delete cascade,
  -- Core: 9.0
  cook           numeric(2,1) not null check (cook between 0 and 3),
  -- 0-60 slider position. 30 is perfect; below is raw, above is burnt.
  cook_position  smallint not null check (cook_position between 0 and 60),
  flavour        numeric(2,1) not null check (flavour between 0 and 2),
  sauce          numeric(2,1) not null check (sauce between 0 and 1),
  value          numeric(2,1) not null check (value between 0 and 1),
  size           numeric(2,1) not null check (size between 0 and 0.5),
  eye            numeric(2,1) not null check (eye between 0 and 0.5),
  sides          numeric(2,1) not null check (sides between 0 and 0.5),
  ratio          numeric(2,1) not null check (ratio between 0 and 0.2),
  drink          numeric(2,1) not null check (drink between 0 and 0.3),
  -- Experience: 1.0
  towelette      numeric(2,1) not null default 0 check (towelette in (0, 0.2)),
  napkins        numeric(2,1) not null default 0 check (napkins in (0, 0.2)),
  sauce_options  numeric(2,1) not null check (sauce_options between 0 and 0.2),
  atmosphere     numeric(2,1) not null check (atmosphere between 0 and 0.4)
);

-- Up to 5 separate reasons, each 0.1-0.5, combined never above 0.5.
create table if not exists review_bonuses (
  id         uuid primary key default gen_random_uuid(),
  review_id  uuid not null references reviews on delete cascade,
  reason     text not null default '',
  amount     numeric(2,1) not null check (amount between 0 and 0.5),
  position   smallint not null check (position between 0 and 4),
  unique (review_id, position)
);
create index if not exists review_bonuses_review_idx on review_bonuses (review_id);

create or replace function enforce_bonus_cap() returns trigger
language plpgsql as $$
declare total numeric(3,1);
begin
  select coalesce(sum(amount), 0) into total
    from review_bonuses
   where review_id = new.review_id
     and id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid);
  if total + new.amount > 0.5 then
    raise exception 'Combined bonus for review % would exceed +0.5', new.review_id;
  end if;
  if (select count(*) from review_bonuses where review_id = new.review_id) >= 5
     and tg_op = 'INSERT' then
    raise exception 'A review may hold at most 5 bonus rows';
  end if;
  return new;
end $$;

drop trigger if exists review_bonuses_cap on review_bonuses;
create trigger review_bonuses_cap
  before insert or update on review_bonuses
  for each row execute function enforce_bonus_cap();

create table if not exists review_photos (
  id         uuid primary key default gen_random_uuid(),
  review_id  uuid not null references reviews on delete cascade,
  url        text not null,
  -- Position 0 is the required main wing photo.
  position   smallint not null check (position >= 0),
  kind       text not null default 'wing'
               check (kind in ('wing','menu','bill','sauce','sides','interior','other')),
  unique (review_id, position)
);

-- ------------------------------------------------------------ interactions

create table if not exists likes (
  user_id    uuid not null references profiles on delete cascade,
  review_id  uuid not null references reviews on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, review_id)
);

create table if not exists comments (
  id         uuid primary key default gen_random_uuid(),
  review_id  uuid not null references reviews on delete cascade,
  author_id  uuid not null references profiles on delete cascade,
  body       text not null check (length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists comments_review_created_idx on comments (review_id, created_at);

create table if not exists saved_posts (
  user_id    uuid not null references profiles on delete cascade,
  review_id  uuid not null references reviews on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, review_id)
);

create table if not exists want_to_try (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references profiles on delete cascade,
  place_id          uuid not null references places on delete cascade,
  flavour_id        uuid references wing_flavours on delete set null,
  source_review_id  uuid references reviews on delete set null,
  created_at        timestamptz not null default now(),
  unique (user_id, place_id, flavour_id)
);

-- ----------------------------------------------------------- aggregation

-- Restaurant + flavour rollup. This is the view the heat filters read.
create materialized view if not exists place_flavour_stats as
select
  r.place_id,
  r.flavour_id,
  count(*)                as review_count,
  round(avg(r.final_score), 2) as avg_final,
  round(avg(r.heat), 2)        as avg_heat,
  round(avg(s.cook), 2)        as avg_cook,
  round(avg(s.flavour), 2)     as avg_flavour,
  round(avg(s.sauce), 2)       as avg_sauce,
  round(avg(s.value), 2)       as avg_value,
  round(avg(s.size), 2)        as avg_size,
  round(avg(s.eye), 2)         as avg_eye,
  round(avg(s.sides), 2)       as avg_sides,
  round(avg(s.drink), 2)       as avg_drink
from reviews r
join review_scores s on s.review_id = r.id
where r.visibility = 'public'
group by r.place_id, r.flavour_id;

create unique index if not exists place_flavour_stats_pk on place_flavour_stats (place_id, flavour_id);

-- Whole-restaurant rollup.
create materialized view if not exists place_stats as
select
  r.place_id,
  count(*)                     as review_count,
  round(avg(r.final_score), 2) as avg_final,
  round(avg(r.heat), 2)        as avg_heat,
  round(avg(s.cook), 2)        as avg_cook
from reviews r
join review_scores s on s.review_id = r.id
where r.visibility = 'public'
group by r.place_id;

create unique index if not exists place_stats_pk on place_stats (place_id);

-- City rollup, for "best wings in a city".
create materialized view if not exists city_stats as
select
  p.city, p.region, p.country,
  count(*)                     as review_count,
  round(avg(r.final_score), 2) as avg_final,
  round(avg(r.heat), 2)        as avg_heat
from reviews r
join places p on p.id = r.place_id
where r.visibility = 'public'
group by p.city, p.region, p.country;

create unique index if not exists city_stats_pk on city_stats (city, region, country);

-- ---------------------------------------------------------- row level security

alter table profiles        enable row level security;
alter table follows         enable row level security;
alter table follow_requests enable row level security;
alter table reviews         enable row level security;
alter table review_scores   enable row level security;
alter table review_bonuses  enable row level security;
alter table review_photos   enable row level security;
alter table likes           enable row level security;
alter table comments        enable row level security;
alter table saved_posts     enable row level security;
alter table want_to_try     enable row level security;
alter table places          enable row level security;
alter table wing_flavours   enable row level security;
alter table restaurants     enable row level security;

-- Places and flavours are shared public vocabulary.
drop policy if exists places_read on places;
create policy places_read on places        for select using (true);
drop policy if exists places_write on places;
create policy places_write on places        for insert with check (auth.uid() is not null);
drop policy if exists flavours_read on wing_flavours;
create policy flavours_read on wing_flavours for select using (true);
drop policy if exists flavours_write on wing_flavours;
create policy flavours_write on wing_flavours for insert with check (auth.uid() is not null);
drop policy if exists restaurants_read on restaurants;
create policy restaurants_read on restaurants for select using (true);

-- Profile metadata stays visible even for private accounts; the detailed
-- content behind it does not.
drop policy if exists profiles_read on profiles;
create policy profiles_read on profiles for select using (true);
drop policy if exists profiles_update on profiles;
create policy profiles_update on profiles for update using (id = auth.uid());

drop policy if exists follows_read on follows;
create policy follows_read on follows for select using (true);
drop policy if exists follows_insert on follows;
-- Following a private account has to go through a request the owner approves.
-- Checking that only in the client would be theatre: anyone can POST to the
-- REST endpoint directly, and a follows row is what unlocks their posts.
-- approve_follow_request runs as definer, so approvals still insert fine.
create policy follows_insert on follows for insert with check (
  follower_id = auth.uid()
  and not coalesce((select is_private from profiles where id = followee_id), true)
);
drop policy if exists follows_delete on follows;
create policy follows_delete on follows for delete using (follower_id = auth.uid());

drop policy if exists freq_read on follow_requests;
create policy freq_read on follow_requests for select
  using (requester_id = auth.uid() or target_id = auth.uid());
drop policy if exists freq_insert on follow_requests;
create policy freq_insert on follow_requests for insert with check (requester_id = auth.uid());
drop policy if exists freq_update on follow_requests;
create policy freq_update on follow_requests for update using (target_id = auth.uid());

-- The single rule that decides who can see a review.
create or replace function can_view_review(review_author uuid, vis text)
returns boolean language sql stable as $$
  select
    review_author = auth.uid()
    or (
      vis = 'public'
      and (
        not (select is_private from profiles where id = review_author)
        or exists (
          select 1 from follows
           where follower_id = auth.uid() and followee_id = review_author
        )
      )
    )
    or (
      vis = 'followers'
      and exists (
        select 1 from follows
         where follower_id = auth.uid() and followee_id = review_author
      )
    );
$$;

drop policy if exists reviews_read on reviews;
create policy reviews_read on reviews for select
  using (can_view_review(author_id, visibility));
drop policy if exists reviews_write on reviews;
create policy reviews_write on reviews for insert with check (author_id = auth.uid());
drop policy if exists reviews_update on reviews;
create policy reviews_update on reviews for update using (author_id = auth.uid());
drop policy if exists reviews_delete on reviews;
create policy reviews_delete on reviews for delete using (author_id = auth.uid());

-- Child rows inherit their parent review's visibility.
drop policy if exists scores_read on review_scores;
create policy scores_read on review_scores for select using (
  exists (select 1 from reviews r
           where r.id = review_id and can_view_review(r.author_id, r.visibility)));
-- FOR ALL, not FOR INSERT. With insert-only, an author could edit their own
-- caption, bonuses and photos but not their own scores, which silently makes
-- a review uneditable. Postgres applies this expression as both USING and
-- WITH CHECK, matching how review_bonuses and review_photos are written.
drop policy if exists scores_write on review_scores;
create policy scores_write on review_scores for all using (
  exists (select 1 from reviews r where r.id = review_id and r.author_id = auth.uid()));

drop policy if exists bonuses_read on review_bonuses;
create policy bonuses_read on review_bonuses for select using (
  exists (select 1 from reviews r
           where r.id = review_id and can_view_review(r.author_id, r.visibility)));
drop policy if exists bonuses_write on review_bonuses;
create policy bonuses_write on review_bonuses for all using (
  exists (select 1 from reviews r where r.id = review_id and r.author_id = auth.uid()));

drop policy if exists photos_read on review_photos;
create policy photos_read on review_photos for select using (
  exists (select 1 from reviews r
           where r.id = review_id and can_view_review(r.author_id, r.visibility)));
drop policy if exists photos_write on review_photos;
create policy photos_write on review_photos for all using (
  exists (select 1 from reviews r where r.id = review_id and r.author_id = auth.uid()));

drop policy if exists likes_read on likes;
create policy likes_read on likes for select using (true);
drop policy if exists likes_write on likes;
create policy likes_write on likes for all    using (user_id = auth.uid());

drop policy if exists comments_read on comments;
create policy comments_read on comments for select using (
  exists (select 1 from reviews r
           where r.id = review_id and can_view_review(r.author_id, r.visibility)));
drop policy if exists comments_write on comments;
create policy comments_write on comments for insert with check (author_id = auth.uid());
drop policy if exists comments_delete on comments;
create policy comments_delete on comments for delete using (author_id = auth.uid());

-- Saves and Want to Try are private to their owner.
drop policy if exists saved_own on saved_posts;
create policy saved_own on saved_posts for all using (user_id = auth.uid());
drop policy if exists wtt_own on want_to_try;
create policy wtt_own on want_to_try for all using (user_id = auth.uid());


-- =====================================================================
-- PART 2: auth, storage and write-side RPCs
-- =====================================================================

-- WingZ auth wiring. Run after schema.sql.
--
-- Signup is two steps by design: Supabase Auth creates the user, and the
-- person then claims a @username. A profile row is created immediately by a
-- trigger so the app never has to cope with a signed-in user who has no
-- profile; the username starts empty and the app routes to the claim screen
-- until it is set.

-- The username check in schema.sql requires 3-30 chars, so '' is a valid
-- "not yet chosen" sentinel that can never collide with a real username.
alter table profiles
  alter column username drop not null,
  alter column username set default null;

-- Unique but nullable: many profiles may sit at NULL, only one can hold a name.
--
-- The original UNIQUE came from a column constraint, and Postgres refuses to
-- DROP INDEX an index that backs a constraint -- it has to be dropped as the
-- constraint. A partial unique index on lower(username) replaces it, which
-- also makes the uniqueness case-insensitive.
alter table profiles drop constraint if exists profiles_username_key;
drop index if exists profiles_username_unique;
create unique index profiles_username_unique
  on profiles (lower(username)) where username is not null;

-- Social sign-in hands us a name and a picture; email sign-up does not.
-- Each provider spells those keys differently, so try every spelling rather
-- than dropping the data and making the person retype what Google already
-- told us. Username stays null: it is always claimed deliberately.
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
begin
  insert into public.profiles (id, username, display_name, avatar_url)
  values (
    new.id,
    null,
    coalesce(
      nullif(meta->>'display_name', ''),
      nullif(meta->>'full_name', ''),   -- Google, Apple
      nullif(meta->>'name', ''),        -- Google
      ''
    ),
    coalesce(
      nullif(meta->>'avatar_url', ''),
      nullif(meta->>'picture', ''),     -- Google
      ''
    )
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Claiming a username. Runs as definer so it can check availability across
-- every profile while RLS still hides other people's rows from the caller.
create or replace function claim_username(desired text)
returns void language plpgsql security definer set search_path = public as $$
declare normalized text := lower(trim(desired));
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  if normalized !~ '^[a-z0-9_.]{3,30}$' then
    raise exception 'Usernames are 3-30 characters, using letters, numbers, dot or underscore';
  end if;
  if exists (
    select 1 from profiles
     where lower(username) = normalized and id <> auth.uid()
  ) then
    raise exception 'That username is taken';
  end if;
  update profiles set username = normalized where id = auth.uid();
end $$;

-- Availability check for the signup form, without leaking profile rows.
create or replace function username_available(desired text)
returns boolean language sql security definer set search_path = public stable as $$
  select not exists (
    select 1 from profiles where lower(username) = lower(trim(desired))
  );
$$;

grant execute on function claim_username(text) to authenticated;
grant execute on function username_available(text) to anon, authenticated;

-- ------------------------------------------------------------------ storage

-- Wing photos. Public read so feeds and shared posts load without signed URLs;
-- writes are confined to a folder named for the uploader's own user id.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'wing-photos', 'wing-photos', true, 10485760,
  array['image/jpeg','image/png','image/webp','image/heic','image/avif']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists wing_photos_read on storage.objects;
create policy wing_photos_read on storage.objects
  for select using (bucket_id = 'wing-photos');

drop policy if exists wing_photos_insert on storage.objects;
create policy wing_photos_insert on storage.objects
  for insert to authenticated with check (
    bucket_id = 'wing-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists wing_photos_delete on storage.objects;
create policy wing_photos_delete on storage.objects
  for delete to authenticated using (
    bucket_id = 'wing-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- --------------------------------------------------------- write-side RPCs

-- Publishing a review touches reviews, review_scores, review_bonuses and
-- review_photos. Doing that as one transaction avoids orphaned rows when a
-- client drops mid-publish.
create or replace function publish_review(
  p_place_id uuid,
  p_flavour_id uuid,
  p_order_text text,
  p_price_cents integer,
  p_currency text,
  p_heat smallint,
  p_caption text,
  p_visibility text,
  p_base numeric,
  p_bonus numeric,
  p_final numeric,
  p_scores jsonb,
  p_bonuses jsonb,
  p_photos jsonb
) returns uuid language plpgsql security invoker as $$
declare new_id uuid;
begin
  insert into reviews (
    author_id, place_id, flavour_id, order_text, price_cents, currency,
    heat, caption, visibility, base_score, bonus_score, final_score
  ) values (
    auth.uid(), p_place_id, p_flavour_id, p_order_text, p_price_cents, p_currency,
    p_heat, p_caption, p_visibility, p_base, p_bonus, p_final
  ) returning id into new_id;

  insert into review_scores (
    review_id, cook, cook_position, flavour, sauce, value, size, eye, sides,
    ratio, drink, towelette, napkins, sauce_options, atmosphere
  ) values (
    new_id,
    (p_scores->>'cook')::numeric, (p_scores->>'cookPosition')::smallint,
    (p_scores->>'flavour')::numeric, (p_scores->>'sauce')::numeric,
    (p_scores->>'value')::numeric, (p_scores->>'size')::numeric,
    (p_scores->>'eye')::numeric, (p_scores->>'sides')::numeric,
    (p_scores->>'ratio')::numeric, (p_scores->>'drink')::numeric,
    (p_scores->>'towelette')::numeric, (p_scores->>'napkins')::numeric,
    (p_scores->>'sauceOptions')::numeric, (p_scores->>'atmosphere')::numeric
  );

  insert into review_bonuses (review_id, reason, amount, position)
  select new_id, b->>'reason', (b->>'amount')::numeric,
         (row_number() over () - 1)::smallint
    from jsonb_array_elements(p_bonuses) b;

  insert into review_photos (review_id, url, position, kind)
  select new_id, p->>'url', (row_number() over () - 1)::smallint, p->>'kind'
    from jsonb_array_elements(p_photos) p;

  return new_id;
end $$;

grant execute on function publish_review(
  uuid, uuid, text, integer, text, smallint, text, text,
  numeric, numeric, numeric, jsonb, jsonb, jsonb
) to authenticated;

-- Find-or-create for shared vocabulary, so two people naming the same sauce
-- converge on one row instead of racing to insert duplicates.
create or replace function resolve_flavour(p_name text, p_normalized text)
returns uuid language plpgsql security invoker as $$
declare found uuid;
begin
  select id into found from wing_flavours where normalized_name = p_normalized;
  if found is not null then return found; end if;

  -- DO NOTHING rather than DO UPDATE: an upsert that updates would require an
  -- UPDATE policy on this table, and there deliberately is not one. On a
  -- concurrent insert this returns no row, so re-read the winner.
  insert into wing_flavours (name, normalized_name)
  values (trim(p_name), p_normalized)
  on conflict (normalized_name) do nothing
  returning id into found;

  if found is null then
    select id into found from wing_flavours where normalized_name = p_normalized;
  end if;

  return found;
end $$;

create or replace function resolve_place(
  p_provider text, p_external_id text, p_display_name text, p_normalized_name text,
  p_address text, p_lat double precision, p_lng double precision,
  p_city text, p_region text, p_country text
) returns uuid language plpgsql security invoker as $$
declare found uuid;
begin
  select id into found from places
   where provider = p_provider and external_id = p_external_id;
  if found is not null then return found; end if;

  -- Same reasoning as resolve_flavour: no UPDATE policy exists on places.
  insert into places (
    provider, external_id, display_name, normalized_name, formatted_address,
    lat, lng, city, region, country
  ) values (
    p_provider, p_external_id, p_display_name, p_normalized_name, p_address,
    p_lat, p_lng, p_city, p_region, p_country
  )
  on conflict (provider, external_id) do nothing
  returning id into found;

  if found is null then
    select id into found from places
     where provider = p_provider and external_id = p_external_id;
  end if;

  return found;
end $$;

grant execute on function resolve_flavour(text, text) to authenticated;
grant execute on function resolve_place(
  text, text, text, text, text, double precision, double precision, text, text, text
) to authenticated;

-- ------------------------------------------------- follow request handling

-- Approving a request inserts a follows row whose follower_id is the
-- REQUESTER, not the person approving. The follows_insert policy requires
-- follower_id = auth.uid(), so the approver cannot write that row directly.
-- Hence security definer, with an explicit check that the caller really is
-- the target of the request.
create or replace function approve_follow_request(p_request_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare req record;
begin
  select * into req from follow_requests where id = p_request_id;
  if req is null then
    raise exception 'Request not found';
  end if;
  if req.target_id <> auth.uid() then
    raise exception 'Not your request to approve';
  end if;
  if req.status <> 'pending' then
    raise exception 'Request is already %', req.status;
  end if;

  insert into follows (follower_id, followee_id)
  values (req.requester_id, req.target_id)
  on conflict (follower_id, followee_id) do nothing;

  -- Delete rather than mark approved: the follows row is now the record, and
  -- keeping a stale row would block the person re-requesting after unfollowing.
  delete from follow_requests where id = p_request_id;
end $$;

create or replace function reject_follow_request(p_request_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare req record;
begin
  select * into req from follow_requests where id = p_request_id;
  if req is null then
    raise exception 'Request not found';
  end if;
  if req.target_id <> auth.uid() then
    raise exception 'Not your request to decline';
  end if;
  delete from follow_requests where id = p_request_id;
end $$;

grant execute on function approve_follow_request(uuid) to authenticated;
grant execute on function reject_follow_request(uuid) to authenticated;

-- A requester withdrawing their own pending request.
drop policy if exists freq_delete on follow_requests;
create policy freq_delete on follow_requests for delete
  using (requester_id = auth.uid() or target_id = auth.uid());


-- ------------------------------------------------- price becomes optional

-- People often cannot remember what they paid, and forcing a number would
-- mean inventing one. Existing rows keep their prices; new ones may omit it.
alter table reviews alter column price_cents drop not null;


-- --------------------------------------------- OpenStreetMap as a provider

-- Places search moved to OpenStreetMap, but the provider allowlist predated
-- it, so every review against an OSM-sourced restaurant was rejected by this
-- constraint. Widened rather than dropped: an allowlist still catches typos.
alter table places drop constraint if exists places_provider_check;
alter table places add constraint places_provider_check
  check (provider in ('mock','osm','google','mapbox','manual'));


-- ------------------------------------------- wing style and breading

-- Descriptive only, like heat: they never affect the score. Defaults match
-- the form's, so every existing review reads as bone-in and non-breaded
-- rather than needing a backfill.
alter table reviews add column if not exists style text not null default 'bone_in';
alter table reviews add column if not exists breading text not null default 'non_breaded';

alter table reviews drop constraint if exists reviews_style_check;
alter table reviews add constraint reviews_style_check
  check (style in ('bone_in','boneless'));

alter table reviews drop constraint if exists reviews_breading_check;
alter table reviews add constraint reviews_breading_check
  check (breading in ('non_breaded','breaded'));

-- publish_review gains the two descriptors.
create or replace function publish_review(
  p_place_id uuid,
  p_flavour_id uuid,
  p_order_text text,
  p_price_cents integer,
  p_currency text,
  p_heat smallint,
  p_caption text,
  p_visibility text,
  p_base numeric,
  p_bonus numeric,
  p_final numeric,
  p_scores jsonb,
  p_bonuses jsonb,
  p_photos jsonb,
  p_style text default 'bone_in',
  p_breading text default 'non_breaded'
) returns uuid language plpgsql security invoker as $$
declare new_id uuid;
begin
  insert into reviews (
    author_id, place_id, flavour_id, order_text, price_cents, currency,
    heat, caption, visibility, base_score, bonus_score, final_score,
    style, breading
  ) values (
    auth.uid(), p_place_id, p_flavour_id, p_order_text, p_price_cents, p_currency,
    p_heat, p_caption, p_visibility, p_base, p_bonus, p_final,
    coalesce(p_style, 'bone_in'), coalesce(p_breading, 'non_breaded')
  ) returning id into new_id;

  insert into review_scores (
    review_id, cook, cook_position, flavour, sauce, value, size, eye, sides,
    ratio, drink, towelette, napkins, sauce_options, atmosphere
  ) values (
    new_id,
    (p_scores->>'cook')::numeric, (p_scores->>'cookPosition')::smallint,
    (p_scores->>'flavour')::numeric, (p_scores->>'sauce')::numeric,
    (p_scores->>'value')::numeric, (p_scores->>'size')::numeric,
    (p_scores->>'eye')::numeric, (p_scores->>'sides')::numeric,
    (p_scores->>'ratio')::numeric, (p_scores->>'drink')::numeric,
    (p_scores->>'towelette')::numeric, (p_scores->>'napkins')::numeric,
    (p_scores->>'sauceOptions')::numeric, (p_scores->>'atmosphere')::numeric
  );

  insert into review_bonuses (review_id, reason, amount, position)
  select new_id, b->>'reason', (b->>'amount')::numeric,
         (row_number() over () - 1)::smallint
    from jsonb_array_elements(p_bonuses) b;

  insert into review_photos (review_id, url, position, kind)
  select new_id, p->>'url', (row_number() over () - 1)::smallint, p->>'kind'
    from jsonb_array_elements(p_photos) p;

  return new_id;
end $$;

grant execute on function publish_review(
  uuid, uuid, text, integer, text, smallint, text, text,
  numeric, numeric, numeric, jsonb, jsonb, jsonb, text, text
) to authenticated;

-- ------------------------------------------------------- editing a review

-- Editing touches reviews, review_scores and review_bonuses. Doing it as one
-- transaction stops a dropped connection leaving a review whose stored total
-- disagrees with its own components. security invoker, so the existing
-- author-only policies decide who may edit — this grants nothing extra.
create or replace function update_review(
  p_review_id uuid,
  p_place_id uuid,
  p_order_text text,
  p_price_cents integer,
  p_currency text,
  p_heat smallint,
  p_caption text,
  p_flavour_id uuid,
  p_style text,
  p_breading text,
  p_base numeric,
  p_bonus numeric,
  p_final numeric,
  p_scores jsonb,
  p_bonuses jsonb
) returns void language plpgsql security invoker as $$
begin
  update reviews set
    -- Null means "leave the restaurant as it is".
    place_id    = coalesce(p_place_id, place_id),
    order_text  = p_order_text,
    price_cents = p_price_cents,
    currency    = p_currency,
    heat        = p_heat,
    caption     = p_caption,
    flavour_id  = p_flavour_id,
    style       = coalesce(p_style, 'bone_in'),
    breading    = coalesce(p_breading, 'non_breaded'),
    base_score  = p_base,
    bonus_score = p_bonus,
    final_score = p_final
  where id = p_review_id;

  -- RLS filters rather than errors, so zero rows means "not yours".
  if not found then
    raise exception 'That review is not yours to edit';
  end if;

  update review_scores set
    cook = (p_scores->>'cook')::numeric,
    cook_position = (p_scores->>'cookPosition')::smallint,
    flavour = (p_scores->>'flavour')::numeric,
    sauce = (p_scores->>'sauce')::numeric,
    value = (p_scores->>'value')::numeric,
    size = (p_scores->>'size')::numeric,
    eye = (p_scores->>'eye')::numeric,
    sides = (p_scores->>'sides')::numeric,
    ratio = (p_scores->>'ratio')::numeric,
    drink = (p_scores->>'drink')::numeric,
    towelette = (p_scores->>'towelette')::numeric,
    napkins = (p_scores->>'napkins')::numeric,
    sauce_options = (p_scores->>'sauceOptions')::numeric,
    atmosphere = (p_scores->>'atmosphere')::numeric
  where review_id = p_review_id;

  -- Bonus rows are positional and few; replacing them is simpler and safer
  -- than diffing, and the cap trigger still applies to each insert.
  delete from review_bonuses where review_id = p_review_id;
  insert into review_bonuses (review_id, reason, amount, position)
  select p_review_id, b->>'reason', (b->>'amount')::numeric,
         (row_number() over () - 1)::smallint
    from jsonb_array_elements(p_bonuses) b;
end $$;

grant execute on function update_review(
  uuid, uuid, text, integer, text, smallint, text, uuid, text, text,
  numeric, numeric, numeric, jsonb, jsonb
) to authenticated;
