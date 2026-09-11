# Gantry — Build Plan & Milestones

Status legend: ⬜ not started · 🔶 in progress · ✅ done

This mirrors the implementation sequence in `docs/PRODUCT_SPEC.md` §15, broken
into concrete, independently-shippable milestones. Each milestone ends with
the project runnable end-to-end (`npm run dev` works, no half-finished slices
left uncommitted).

## M1 — Foundation ✅
- Monorepo scaffold (`apps/web`), config module for display name / API base /
  branding (single source of truth so "Gantry" isn't hardcoded 40 places).
- Prisma schema for the full data model (§8 of the spec): users, teams,
  capacity, assets, parts, scenarios, jobs, job_parts, forecast_runs +
  daily forecast tables, sync_runs, audit_events.
- Local Postgres (Homebrew, not Docker — no Docker on this machine) with
  `gantry` (dev) and `gantry_test` databases.
- Next.js App Router shell, Tailwind + shadcn/ui, NextAuth (email/password),
  tRPC wired end-to-end with a health-check procedure.

## M2 — Live NYC Open Data ingestion ⬜
- `server/sync/nycOpenData/`: fetchers for elevator compliance (`e5aq-a4j2`),
  elevator violations (`dedp-nh8d`), boiler safety (`52dp-yji6`), scoped to a
  configurable borough/BIN list (default: Manhattan, capped to keep the demo
  in the hundreds of devices).
- Upsert logic keyed by external ID, idempotent re-sync.
- `sync_runs` log + Admin "Data Sync" panel (last synced, record counts,
  manual "Sync now", scope config).
- One-time committed snapshot CSV fallback under `sample-data/`.
- Scheduled sync route (cron-triggerable) for incremental syncs.
- **Exit check**: real elevator + boiler assets sitting in Postgres, sourced
  from the live API, re-syncable without duplication.

## M3 — Schedule derivation ⬜
- `job_type_rules` table + engine implementing §10.1 (CAT1/CAT5/periodic
  elevator cadences, low/high-pressure boiler cadences) — never fabricates a
  date when the source field is null.
- Violation → `violation_repair` job auto-creation (§10.2).
- Boiler defect → follow-up job + 90/104-day deadline warnings (§10.3).
- Read-only Main Schedule Gantt (rows = devices grouped by building/borough,
  bars = jobs, color-coded by job_type/status).
- **Exit check**: Main Schedule Gantt shows real + derived jobs; at least one
  overdue compliance warning and one boiler defect job are visible.

## M4 — Parts, teams, scenarios ⬜
- Synthetic parts catalog + `job_parts` BOM seeding (`sample-data/parts.csv`,
  `teams.csv`), clearly labeled synthetic in the UI.
- Teams + capacity entries.
- Scenario copy (deep copy, new IDs, isolated from Main Schedule and other
  scenarios) + scenario Gantt with drag/resize/reassign, batch job edits.
- **Exit check**: a Planner can copy the Main Schedule into a scenario,
  drag a job to a new date/team, and the Main Schedule is untouched.

## M5 — Forecasting ⬜
- `workloadForecast.ts` / `partsForecast.ts` / `costForecast.ts` + shared
  `engine.ts`; workload splits scheduled-compliance vs. reactive-repair
  series; cost keeps `real_filing_fee_cost` visually separate from synthetic
  labor/parts cost.
- Forecast results screen with linked Recharts time series.
- **Exit check**: running a forecast from a scenario produces workload/parts/
  cost charts that visibly distinguish real vs. synthetic inputs.

## M6 — Comparison, promotion, polish ⬜
- Scenario-vs-Main diff view + promotion (reviewed diff required).
- Remaining warnings (`same_asset_overlap`, `team_over_capacity`,
  `unassigned_team`, `part_stockout_before_job`, `missing_part_cost`).
- CSV/manual-entry fallback for assets with incomplete compliance history.
- Accessibility + performance pass (large Gantt virtualization, keyboard nav).
- **Exit check**: full definition-of-done in spec §16 is satisfied.

## Assumptions / decisions log

Decisions made without asking, per the spec's own instruction to infer
routine choices — recorded here so they're visible, not silent:

- **No Docker on this machine** → local Postgres via Homebrew
  (`postgresql@16`, already running) instead of `docker-compose`; a
  `infrastructure/docker-compose.yml` is still included for anyone who does
  have Docker.
- **Single repo, single app** — spec's `apps/web` layout is kept (in case a
  worker/cron service is split out later) but there's no separate `apps/`
  package split beyond that yet; no need for a monorepo tool (Turborepo/Nx)
  at this size.
- **Auth**: NextAuth email/password (Credentials provider) with bcrypt —
  simplest option that satisfies "one company," no magic-link email service
  wired up yet.
- **Default sync scope**: Manhattan (`borough='MANHATTAN'`), matching the
  spec's own suggestion, configurable by an Admin afterward.
- **Queue**: skipped for now (BullMQ/Inngest) — sync and forecast runs are
  invoked directly from API routes; revisit only if a run measurably exceeds
  a few seconds.
- **Framework versions**: this machine resolved bleeding-edge majors by
  default (Next.js 16.3, Prisma 8.0.0-rc, Zod 4, Auth.js v5 beta). Pinned to
  stable Next 16.3.5 (already current-major, fine) and **Prisma 6.19.3**
  (rolled back from the 8.0.0-rc that `npm install` picked, since a
  release-candidate major is too unstable to build a demo on) — see
  `node_modules/next/dist/docs/` via `AGENTS.md` for Next 16 API changes
  (async `params`/`searchParams`, `middleware.ts` → `proxy.ts`, etc.) before
  writing new routes.

## Dev credentials (seeded, local only)

| Role | Email | Password |
|---|---|---|
| Admin | admin@gantry.local | admin1234 |
| Planner | planner@gantry.local | planner1234 |
| Viewer | viewer@gantry.local | viewer1234 |
