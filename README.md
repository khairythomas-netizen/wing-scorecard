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

### Data

`WingzStore` is the whole persistence surface. Today it is backed by
`localStore.ts` (seeded, `localStorage`-persisted) so the app runs with no
backend. `supabase/schema.sql` holds the production schema: every sub-score is
its own column on `review_scores`, bonuses are rows with a database-level cap
trigger, and materialised views roll heat and scores up by restaurant,
restaurant + flavour, and city.

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
