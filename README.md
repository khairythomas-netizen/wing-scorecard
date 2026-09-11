# WingZ

A mobile-first social platform for chicken wings. Photograph them, score them
properly, rank every one you have eaten, and find the next ones on a map.

**Live:** https://khairythomas-netizen.github.io/wing-scorecard/

## The scoring system

The base score totals exactly **10.0**, and a miscellaneous bonus can add up to
**+0.5** on top. A final score can therefore reach 10.5, and it is still shown
over 10 — extraordinary wings are allowed to beat a perfect 10, and normalising
that back down would erase the thing the bonus exists to record.

| Core — 9.0 | | Experience — 1.0 | |
|---|---|---|---|
| Cook | 3.0 | Moist towelette | 0.2 |
| Flavour | 2.0 | Napkins | 0.2 |
| Sauce consistency | 1.0 | Sauce options | 0.2 |
| Value | 1.0 | Atmosphere | 0.4 |
| Size & meatiness | 0.5 | | |
| Eye test | 0.5 | | |
| Sides & dips | 0.5 | | |
| Flats : drums | 0.2 | | |
| Drink | 0.3 | | |

**Cook** is the one special control. It is a symmetric slider scoring
`0 → 3 → 0`: raw at the left, perfect in the middle, burnt at the right.
Doneness, crispiness, juiciness and tenderness are all folded into that single
judgement rather than split into separate categories. The raw slider position is
stored alongside the score, because 2.0 undercooked and 2.0 overcooked are very
different wings.

**Spiciness** is a required 1–5 pepper rating that deliberately contributes
**nothing** to the score. It is descriptive, filterable metadata, and it
aggregates per restaurant *and* flavour — one shop's Buffalo, Hot Honey and
Suicide are three different heat levels, not one average.

**Bonus** supports up to 5 separate reasons, each in 0.1 steps, combined never
above +0.5. Each row only offers amounts that still fit under the cap.

All of this lives in [`src/lib/scoring.ts`](src/lib/scoring.ts) and is locked
down by tests in `src/lib/scoring.test.ts`.

## Running it

```bash
npm install
npm run dev      # http://localhost:5173/wing-scorecard/
npm test         # scoring + store tests
npm run build
```

## Architecture

```
src/
  lib/scoring.ts      the scoring engine, with tests
  lib/places/         PlacesProvider: mock today, Google Places behind a flag
  lib/map/            MapProvider: mock surface today, Mapbox behind a flag
  lib/db/             WingzStore interface + local implementation
  lib/types.ts        the domain model
  features/           rate, feed, discover, rankings, profile
  components/         shared UI
supabase/schema.sql   Postgres schema, RLS policies and aggregate views
```

### Providers

Restaurants are never free text. Picking one resolves to a full `Place` with an
external id, address, latitude, longitude, city, region and country, so reviews
can appear on a map and roll up by city with no later backfill.

Two independent abstractions handle this, and both fall back to mock adapters
with seeded real coordinates:

| | Interface | Mock | Live (set the env var) |
|---|---|---|---|
| Restaurant identity | `PlacesProvider` | seeded restaurants | `VITE_GOOGLE_PLACES_KEY` |
| Map rendering | `MapProvider` | Web Mercator surface | `VITE_MAPBOX_TOKEN` |

Going live is a change in `src/lib/places/index.ts` / `src/lib/map/index.ts`
only. No screen imports a vendor. See `.env.example`.

### Restaurant photos

Swipe shows wing places nobody has reviewed yet, and those have no WingZ photo
by definition. A photo from the places provider fills the gap, cached for a
day in `src/lib/places/photos.ts` so the same restaurant is never billed twice.

A WingZ photo always wins over a provider one. A real review of the wings
beats a publicity shot of the dining room.

These photos are **licensed from the provider, never scraped**. A restaurant's
own site and Instagram are copyrighted, Instagram's terms prohibit automated
collection, and from a static site it is not even possible: the browser blocks
reading another origin. A provider with no photo licence returns an empty list
and the card keeps its placeholder, which is the honest outcome.

To turn it on, set `VITE_GOOGLE_PLACES_KEY`:

1. In the Google Cloud console, same project as sign-in, enable **Places API
   (New)**.
2. Create an API key under APIs & Services → Credentials.
3. Restrict it by HTTP referrer to `khairythomas-netizen.github.io/*` and
   `localhost:5273/*`. The key travels in the bundle and in photo URLs, which
   is normal for Places on the web and safe only with referrer restrictions.
4. Add the key to `.env` locally and as a repository secret for the deploy.

**This needs a card on file.** Google requires billing details before issuing
a Places key, even to stay inside the free monthly allowance, and Foursquare
puts photos behind a premium endpoint with no free tier at all. There is no
no-card source of licensed restaurant photography, so with no key the swipe
cards keep their placeholder and invite the first photo from a real review,
which for a wings app is arguably the better answer anyway.

The day-long cache and the WingZ-photo-first rule exist to stay inside the
free allowance if a key is ever added.

### Data and auth

`WingzStore` is the whole persistence surface, and it is async throughout so
the local and hosted implementations are genuinely interchangeable.

| | No credentials | With Supabase |
|---|---|---|
| Data | seeded `localStore`, persisted to `localStorage` | Postgres behind row-level security |
| Auth | demo user, no sign-in wall | email + password, then a claimed `@username` |
| Photos | object URLs, local to the browser | `wing-photos` storage bucket |

Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to switch. With them
unset, Vite tree-shakes the Supabase client out of the bundle entirely, so the
demo build pays nothing for it.

**See [`supabase/SETUP.md`](supabase/SETUP.md)** for the full setup.

Schema notes: every sub-score is its own column on `review_scores`; bonuses are
rows with a database-level trigger enforcing the +0.5 cap and 5-row limit;
`publish_review()` writes a review and all its children in one transaction; and
`can_view_review()` enforces private accounts in the database rather than the
UI, so a crafted API request cannot read around it.

## PWA

Installable, standalone, with the official WingZ mark as the app icon.

The document is **network-first**, so a new deploy is picked up on the next
launch — no more getting wedged on a stale build. Only content-hashed assets are
cached indefinitely. Bump `CACHE_VERSION` in `public/sw.js` on each release; old
caches are deleted on activate. The header Refresh control shows a dot when a
newer build is waiting and loads it on tap.

## Brand

The mark is a chicken wing shaped like a Z, supplied by the project owner. The
icon set in `public/icons/` is generated from that exact artwork — background
removed by a border flood fill, never redrawn or substituted.
