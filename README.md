# Gantry

Facilities compliance & maintenance planning for a portfolio of NYC buildings —
elevators and boilers — built on **live NYC Open Data**.

Gantry ingests real elevator compliance records, elevator violations, and
boiler inspection filings from NYC Open Data (Socrata/SODA), derives a
forward maintenance/compliance schedule from the real regulatory cadences
(CAT1/CAT5 elevator tests, periodic inspections, annual boiler inspections),
and lets a facilities team plan changes in isolated **scenarios**, track a
synthetic parts catalog, and forecast workload/parts/cost — all rendered as
an interactive Gantt chart.

Build plan and current status: [docs/MILESTONES.md](docs/MILESTONES.md).
Full product spec: [docs/PRODUCT_SPEC.md](docs/PRODUCT_SPEC.md).

## What's real vs. synthetic

Gantry mixes real public data with clearly-labeled synthetic data — see it
called out explicitly in the UI, not just here:

- **Real**: assets (devices + buildings), compliance history, open
  violations, boiler inspection reports, boiler filing fees — all pulled
  live from NYC Open Data.
- **Rule-derived from real data**: forward due dates for CAT1/CAT5/periodic
  elevator tests and boiler inspections — a documented rule (§10.1 of the
  spec) applied to a real filed date. If the real filing is missing, Gantry
  shows "needs manual entry" rather than inventing a date.
- **Synthetic**: the parts catalog + unit costs, crew/team definitions +
  hourly rates, and which parts a job type consumes.

## Stack

Next.js 16 (App Router) + TypeScript, Tailwind, tRPC, Prisma + PostgreSQL,
Auth.js (NextAuth v5), TanStack Query, Recharts, date-fns.

## Prerequisites

- Node.js 20.9+ and npm
- A PostgreSQL 14+ server running locally (two options below — pick one)

## Getting it running locally

### 1. Start Postgres

**Option A — Homebrew (what this project was built against):**

```bash
brew install postgresql@16
brew services start postgresql@16
createdb gantry
```

**Option B — Docker:**

```bash
docker run --name gantry-postgres -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=gantry -p 5432:5432 -d postgres:16
```

If you use Docker, update `DATABASE_URL` in your `.env` (step 2) to match,
e.g. `postgresql://postgres:postgres@localhost:5432/gantry?schema=public`.

### 2. Configure environment variables

```bash
cd apps/web
cp .env.example .env
```

Open `.env` and adjust if needed — defaults assume Option A above with no
password (your local macOS username as the Postgres role, which is the
Homebrew default). Nothing else is required to run the app:

| Variable | Required? | Notes |
|---|---|---|
| `DATABASE_URL` | Yes | Postgres connection string |
| `AUTH_SECRET` | Yes | Any random string locally; generate one with `openssl rand -base64 32` |
| `NEXTAUTH_URL` | Yes | `http://localhost:3000` for local dev |
| `NYC_OPEN_DATA_APP_TOKEN` | No | Free token from [data.cityofnewyork.us/profile/app_tokens](https://data.cityofnewyork.us/profile/app_tokens) — raises the API rate limit, not required for demo volumes |
| `CRON_SECRET` | No | Only needed if you wire up a real scheduled sync (e.g. Vercel Cron) |
| `GANTRY_SYNC_DEFAULT_BOROUGH` | No | Defaults to `MANHATTAN` |

### 3. Install dependencies and set up the database

```bash
npm install
npx prisma migrate dev
npx prisma db seed
```

This creates all tables and seeds:
- 3 dev users (Admin/Planner/Viewer — credentials below)
- The synthetic parts catalog and teams (`sample-data/parts.csv`, `teams.csv`)
- The `job_type_rules` table that drives schedule derivation

### 4. Run the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 5. Pull in real data

Sign in as the Admin user (below) and go to **/admin** → click **"Sync now"**.
This pulls real elevator + boiler records from NYC Open Data for the default
scope (~41 Manhattan buildings) and derives the forward compliance schedule.
It takes roughly 10-15 seconds. Once it finishes, go to **/schedule** to see
the Gantt populated with real assets and rule-derived due dates.

If the live API is unreachable, a one-time snapshot pull is committed at
`sample-data/nyc-open-data-snapshot/*.csv` as an offline fallback — see
[docs/NYC_DATA_INGESTION.md](docs/NYC_DATA_INGESTION.md).

## Dev login credentials (seeded, local only — not for production)

| Role | Email | Password |
|---|---|---|
| Admin | `admin@gantry.local` | `admin1234` |
| Planner | `planner@gantry.local` | `planner1234` |
| Viewer | `viewer@gantry.local` | `viewer1234` |

## Project structure

```
gantry/
  README.md
  docs/                        # everything about how/why the app is built — see docs/README.md
  sample-data/                 # synthetic parts/teams CSVs + NYC Open Data snapshot fallback
  apps/
    web/                       # the Next.js app (frontend + backend, one codebase)
      prisma/schema.prisma     # full data model
      prisma/seed.ts           # dev users + synthetic catalog + job_type_rules
      src/app/                 # pages (App Router)
      src/server/
        trpc/routers/          # API procedures
        sync/nycOpenData/      # the three live-data fetchers + upsert logic
        scheduling/            # forward-schedule derivation engine + warnings
```

## Useful commands (run from `apps/web`)

```bash
npm run dev            # start the dev server
npx tsc --noEmit        # type-check
npx eslint src          # lint
npx prisma studio       # browse the database in a GUI
npx prisma migrate dev  # apply schema changes
npx prisma db seed      # re-run the seed script
```
