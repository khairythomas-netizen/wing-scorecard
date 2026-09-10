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
