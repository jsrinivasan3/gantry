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

## M2 — Live NYC Open Data ingestion ✅
- `server/sync/nycOpenData/`: fetchers for elevator compliance (`e5aq-a4j2`),
  elevator violations (`dedp-nh8d`), boiler safety (`52dp-yji6`), scoped to a
  configurable borough/BIN list (default: 41 curated Manhattan BINs — see
  `docs/NYC_DATA_INGESTION.md`).
- Upsert logic keyed by external ID (`sync_config`-driven scope, admin
  editable via `sync.configUpdate`), idempotent re-sync verified live.
- `sync_runs` log + Admin "Data Sync" panel (`/admin`) — last synced, record
  counts, manual "Sync now" button.
- One-time committed snapshot CSV fallback under `sample-data/nyc-open-data-snapshot/`.
- `/api/cron/sync` route for a scheduled trigger (Vercel Cron + `CRON_SECRET`).
- **Exit check** ✅: live-verified in the browser — 463 elevator assets, 72
  boiler assets, 640 completed boiler-inspection jobs (16 with real
  `defectsFound`), 1 real `violation_repair` job, all idempotent on re-sync.
  Confirmed real overdue CAT1 compliance data exists in scope for M3's
  warning to surface (e.g. device `1E20876`, last CAT1 filed 2023-12-14).

## M3 — Schedule derivation ✅
- `job_type_rules`-driven engine (`server/scheduling/`) implementing §10.1:
  elevator CAT1/CAT5/periodic and low/high-pressure boiler cadences, one
  forward job per (asset, job_type), re-derived idempotently after every
  sync. Never fabricates a date when the source field is null — creates an
  `UNSCHEDULED` job instead (§4).
- Violation → `violation_repair` auto-creation was folded into the M2 sync
  module itself (one violation row maps directly to one job — no
  intermediate derivation needed), not duplicated here.
- Boiler defect → follow-up job (§10.3), linked via `linkedJobId`, due at
  +90 days with a +104-day affirmation deadline computed at read time.
- `computeWarnings()` — `compliance_overdue` and
  `defect_correction_deadline_approaching`, computed live rather than
  stored (pure function of the current schedule). The other three §11
  warnings need teams/parts and are deferred to M4/M6.
- Read-only Main Schedule Gantt at `/schedule` — rows = devices grouped by
  building (BIN/address, borrowed onto boiler assets from a sibling
  elevator at sync time), bars = jobs color-coded by job_type, red/amber
  outline for overdue/deadline-approaching, "needs manual date" jobs listed
  separately rather than plotted.
- **Exit check** ✅: live-verified — 1762 jobs across 41 buildings, 259
  overdue warnings, 16 approaching-deadline warnings, 139 needing a manual
  date, all rendered correctly in the browser with real addresses.

## M4 — Parts, teams, scenarios ✅
- Synthetic parts catalog + teams seeded (M1); `job_parts` BOM now
  auto-attached to every job at creation time via a `jobType -> parts`
  synthetic catalog (`src/config/jobPartsCatalog.ts`) applied in both the
  sync module and the derivation engine.
- Scenario copy (`scenario.create`): deep-copies every Main Schedule job
  (new id, `copiedFromJobId` back-reference, job-parts copied line-for-line)
  into an isolated scenario, stamping a `ScheduleRevision`.
- Scenario editing: click a Gantt bar to open a popover (`JobEditPopover`)
  to reschedule, reassign team, or change status — mutates only the
  scenario's copy via `scenario.updateJob`, server-verified to belong to
  that scenario and owned by the caller (or Admin).
- Ad-hoc job creation within a scenario (`scenario.addJob`) and scenario
  deletion (`scenario.delete`).
- The Gantt component was generalized (`src/components/gantt/Gantt.tsx`)
  to serve both the read-only Main Schedule and editable scenarios via an
  `editable` prop, rather than duplicating it.
- **Scoped-down from the spec's "drag/resize"**: editing is click-to-open-a-
  form rather than pointer-drag — functionally equivalent (reschedule +
  reassign a job) and far more reliable to get right than freehand drag
  physics in the time available. dnd-kit is still installed if real drag
  interaction is wanted later.
- **Exit check** ✅: live-verified — created a scenario ("Q1 batch CAT1
  tests") that deep-copied all 1762 Main Schedule jobs, rescheduled an
  overdue CAT5 job and assigned it to a team (confirmed only the scenario's
  row changed in Postgres, Main Schedule row untouched), and added an
  ad-hoc job (1762 → 1763 jobs in the scenario only).

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
