# Connecting a Supabase project

The app runs without any of this — it falls back to a seeded local store and a
demo user. These steps switch it to real accounts and real data.

## 1. Create the project

At [supabase.com/dashboard](https://supabase.com/dashboard), create a project.
The free tier is enough. Note the region closest to your users.

## 2. Run the SQL

Open **SQL Editor**, **clear it completely** (Cmd+A, Delete), then paste
`supabase/setup.sql` and run it.

Clearing first matters. The editor keeps whatever was pasted before, and a
failed earlier attempt still sitting in the buffer will error out before your
new paste is ever reached — usually as `relation "profiles" already exists`,
which looks like the new file failing when it is actually the old one.

`setup.sql` is `schema.sql` and `auth.sql` concatenated in dependency order.
Every statement is guarded, so it is safe to run repeatedly: it creates what is
missing and leaves existing objects and data alone. Run the two files
separately only if you want to apply them piecemeal.

## 3. Configure auth

**Authentication → Providers → Email**: leave Email enabled.

**Authentication → URL Configuration**, add to *Redirect URLs*:

```
https://khairythomas-netizen.github.io/wing-scorecard/
http://localhost:5273/wing-scorecard/
```

*Confirm email* is on by default. That is the safer setting, and the app
handles it — signup shows a "check your email" screen. To skip the inbox
round-trip while testing, turn it off and signup will sign you straight in.
This project currently has it off, so new accounts are usable immediately.

Google and Apple sign-in are optional and configured entirely in their own
dashboards. See [SOCIAL_SIGNIN.md](SOCIAL_SIGNIN.md). The app shows only the
providers that are actually switched on, so there is nothing to deploy: finish
the setup and the button appears.

## 4. Point the app at it

Copy `.env.example` to `.env` and fill in the two values from
**Project Settings → API**:

```
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<the anon / public key>
```

The anon key is designed to ship in the browser. It grants nothing on its own —
every table is behind row-level security, and the policies in `schema.sql`
decide what each signed-in user can see. **Never** put the `service_role` key
in this file; it bypasses RLS entirely.

Restart the dev server. The app should now show a sign-in screen.

## 5. Deploy with it

Add the same two values as GitHub Actions secrets so the deployed build uses
them — **Settings → Secrets and variables → Actions**:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

The workflow already passes them through. Until they exist, the deployed site
keeps running in demo mode.

## What you get

- **Signup** creates an `auth.users` row; a trigger creates the matching
  `profiles` row immediately, so there is never a signed-in user without a
  profile. The username starts null and the app routes to the claim screen.
- **Usernames** are claimed through `claim_username()`, which checks
  availability across all profiles while RLS still hides other people's rows.
- **Photos** upload to the `wing-photos` bucket under a folder named for the
  uploader's user id — the storage policy enforces that, so nobody can write
  into someone else's folder.
- **Publishing** goes through `publish_review()`, which writes the review, its
  scores, its bonuses and its photos in one transaction. A dropped connection
  mid-publish cannot leave a review with no scores.
- **Privacy** is enforced in the database, not the UI. `can_view_review()`
  decides visibility, so a private account's posts are unreachable over the
  API even with a crafted request.

## Aggregate views

`place_stats`, `place_flavour_stats` and `city_stats` are materialised, so they
need refreshing to pick up new reviews:

```sql
refresh materialized view concurrently place_flavour_stats;
```

The app does not read them yet — restaurant averages are computed live so they
are never stale right after you post. They are there for when the review count
makes live aggregation too slow, at which point a cron job should refresh them.
