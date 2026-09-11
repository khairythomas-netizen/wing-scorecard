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


-- ----------------------------------------------------------- notifications

-- Per-person switches. Kept as columns rather than a settings blob so a
-- trigger can check one cheaply while deciding whether to write a row at all.
create table if not exists notification_prefs (
  user_id          uuid primary key references profiles on delete cascade,
  likes            boolean not null default true,
  comments         boolean not null default true,
  follows          boolean not null default true,
  follow_requests  boolean not null default true
);

create table if not exists notifications (
  id           uuid primary key default gen_random_uuid(),
  -- Who sees it.
  user_id      uuid not null references profiles on delete cascade,
  -- Who caused it. Null once that account is gone; the notification survives
  -- rather than vanishing from someone's history.
  actor_id     uuid references profiles on delete set null,
  kind         text not null
                 check (kind in ('like','comment','follow','follow_request','follow_accepted')),
  review_id    uuid references reviews on delete cascade,
  comment_id   uuid references comments on delete cascade,
  read_at      timestamptz,
  created_at   timestamptz not null default now()
);
create index if not exists notifications_user_idx
  on notifications (user_id, created_at desc);
create index if not exists notifications_unread_idx
  on notifications (user_id) where read_at is null;

alter table notifications      enable row level security;
alter table notification_prefs enable row level security;

-- Yours and nobody else's. There is no insert policy on purpose: rows are
-- written by triggers running as definer, so nobody can forge a notification.
drop policy if exists notifications_read on notifications;
create policy notifications_read on notifications for select using (user_id = auth.uid());
drop policy if exists notifications_update on notifications;
create policy notifications_update on notifications for update using (user_id = auth.uid());
drop policy if exists notifications_delete on notifications;
create policy notifications_delete on notifications for delete using (user_id = auth.uid());

drop policy if exists nprefs_all on notification_prefs;
create policy nprefs_all on notification_prefs for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- One helper so every trigger asks the question the same way. A missing prefs
-- row means the person has never touched the settings, which is "on".
create or replace function wants_notification(p_user uuid, p_kind text)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    (select case p_kind
       when 'like' then likes
       when 'comment' then comments
       when 'follow' then follows
       when 'follow_accepted' then follows
       when 'follow_request' then follow_requests
       else true
     end
     from notification_prefs where user_id = p_user),
    true
  );
$$;

create or replace function notify(
  p_user uuid, p_actor uuid, p_kind text, p_review uuid, p_comment uuid
) returns void language plpgsql security definer set search_path = public as $$
begin
  -- Nobody needs telling about their own actions.
  if p_user is null or p_user = p_actor then return; end if;
  if not wants_notification(p_user, p_kind) then return; end if;
  insert into notifications (user_id, actor_id, kind, review_id, comment_id)
  values (p_user, p_actor, p_kind, p_review, p_comment);
end $$;

create or replace function on_like_added() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform notify(
    (select author_id from reviews where id = new.review_id),
    new.user_id, 'like', new.review_id, null
  );
  return new;
end $$;

create or replace function on_comment_added() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform notify(
    (select author_id from reviews where id = new.review_id),
    new.author_id, 'comment', new.review_id, new.id
  );
  return new;
end $$;

create or replace function on_follow_added() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- Approving a request inserts here too, so tell the requester they are in.
  perform notify(new.followee_id, new.follower_id, 'follow', null, null);
  perform notify(new.follower_id, new.followee_id, 'follow_accepted', null, null);
  return new;
end $$;

create or replace function on_follow_requested() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform notify(new.target_id, new.requester_id, 'follow_request', null, null);
  return new;
end $$;

drop trigger if exists likes_notify on likes;
create trigger likes_notify after insert on likes
  for each row execute function on_like_added();

drop trigger if exists comments_notify on comments;
create trigger comments_notify after insert on comments
  for each row execute function on_comment_added();

drop trigger if exists follows_notify on follows;
create trigger follows_notify after insert on follows
  for each row execute function on_follow_added();

drop trigger if exists follow_requests_notify on follow_requests;
create trigger follow_requests_notify after insert on follow_requests
  for each row execute function on_follow_requested();

grant execute on function wants_notification(uuid, text) to authenticated;
