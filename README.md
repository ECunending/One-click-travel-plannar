# One-click Travel Plannar

A responsive travel planner built with Vite, vanilla JavaScript, and Supabase Postgres/Auth. Select a destination, date, trip length, and pace to generate a sample itinerary. Sign in with an email link to save private itineraries across devices.

## Development

Requires Node.js 22 or newer (Node 24 is specified in `.nvmrc`).

```sh
npm ci
cp .env.example .env.local
npm run dev
```

## Checks and build

```sh
npm test
npm run build
npm run preview
```

`npm test` also runs the actual migration and RLS test script in embedded Postgres (PGlite). No Docker or hosted credentials are needed for this test. The Auth roles and `auth.uid()` contract are reproduced locally; repeat the SQL test on the hosted project before release.

## Working features

- Choose Kyoto, Lisbon, Bali, or Paris.
- Generate a 1–7 day itinerary with three travel pace options.
- Surprise me selects another destination.
- Save, reopen, and remove trips in Postgres, protected by each user's authenticated identity.
- Email-link sign-in and sign-out, with automatic session refresh.
- Paginated saved trips and a retry button if a read fails.
- Import existing browser-saved trips explicitly into the signed-in account. Imports can be retried without duplicates; the browser copy stays until all writes succeed.
- Download an itinerary as a text file.
- Responsive keyboard-accessible controls and status messages.

These are sample itineraries. There are no AI calls, live prices, reservations, or availability checks. The itinerary snapshot itself is saved, so future planner changes do not rewrite saved trips. Planning and downloading work without signing in; cloud saving requires a configured database and an account.

## Database setup

1. Create a Supabase project and apply `supabase/migrations/20261007224237_create_private_trips.sql` using the SQL Editor or your migration workflow.
2. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in `.env.local` and in the Vercel project's Production environment. These are browser-safe configuration values. Never set a service-role or secret key in a `VITE_` variable.
3. In Supabase Auth URL Configuration, set Site URL to `https://one-click-travel-plannar.vercel.app` and allow that URL plus `http://127.0.0.1:5173` for local sign-in redirects. Add individual preview URLs only when needed.
4. Keep email authentication enabled. For public signups, configure a custom SMTP provider: Supabase's built-in sender restricts delivery to organization members and is not a production email service. The UI reports email delivery failures rather than claiming sign-in succeeded.
5. Run `supabase/tests/trips_rls.sql` as postgres. It inserts two temporary users inside a transaction, exercises owner CRUD and cross-user/anonymous denial, and rolls everything back. Any failed assertion raises an exception.

### RLS and indexes

`public.trips` has RLS enabled with separate SELECT, INSERT, UPDATE, and DELETE policies scoped to `(select auth.uid()) = user_id`. Signed-out clients have no table privileges. Authenticated clients cannot update the owner, primary key, or creation timestamp. No privileged functions or service-role bypasses are used.

- Primary key index on `id` for individual trip access.
- Composite `trips_owner_created_idx (user_id, created_at DESC, id DESC)` for owner-scoped newest-first listing and the user foreign key.
- Unique `trips_owner_plan_unique (user_id, destination, start_date, days, pace)` index prevents duplicate saves, including concurrent requests and retried imports.

Constraints validate destinations, pace, trip length, date range, and itinerary JSON size/length. Remote itinerary text is validated and HTML-escaped before rendering. UI requests are invalidated on account changes so an old response cannot reveal the previous account's collection.

## Deployment

The repository is connected to Vercel with `main` as the production branch. Set the two Supabase variables before deploying this update. The build command is `npm run build` and output directory is `dist`; both are included in `vercel.json`. A missing database configuration disables cloud saving instead of silently falling back to browser storage.
