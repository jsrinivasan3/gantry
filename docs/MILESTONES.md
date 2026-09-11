# Gantry — Build Plan & Milestones

**Status: all 6 milestones complete** — spec §16's full definition of done
has been live-verified end to end (see M6's exit check below). A post-M6
design pass (below) then rebuilt the UI on shadcn/ui.

## Post-M6 — UI/UX design pass ✅

The original UI was functional but plain (raw HTML form elements, no
component system, a bare-bones Gantt). Rebuilt on `shadcn/ui`:

- **App shell**: a real sidebar (`src/components/app-shell/`) with
  collapsible nav, active-route highlighting, a user menu (avatar, role
  badge, sign out), and a breadcrumb header — replacing the old plain-link
  nav repeated on every page. Routes moved into an `(app)` route group so
  the shell is one shared layout instead of copy-pasted per page.
- **Gantt, rebuilt** (`src/components/gantt/`): sticky header + sticky
  device column (both axes scroll independently and correctly), zoom
  levels, live search, per-job-type filter chips, collapsible building
  groups with an expand/collapse-all toggle, a "jump to today" button with
  auto-scroll on load, rich hover tooltips (job type/status/dates/team/
  warnings), and device-type icons. Editing moved from a hand-rolled
  overlay to a proper shadcn `Dialog`.
- Every page restyled with `Card`/`Table`/`Badge`/`Tabs`/`Select`/`Dialog`;
  toast notifications (`sonner`) replaced silent failures and raw inline
  error text; loading states use `Skeleton` instead of "Loading…" text;
  empty states get an icon + explanation instead of a blank list.
- **Real bugs found and fixed during this pass** (this shadcn install
  resolved to a **Base UI**-based major version, not the Radix-based one
  from training data — a second "not the library you know" surprise on top
  of Next 16/Prisma 8/Zod 4 — so several API-shape bugs surfaced only at
  runtime, not typecheck):
  - `asChild` doesn't exist in this version — polymorphism is a `render={<El/>}`
    prop. Every `Button`/`SidebarMenuButton`/`DropdownMenuTrigger` wrapping a
    `<Link>` needed converting.
  - `Select.Value` doesn't auto-derive a label from the matching `SelectItem`
    like Radix did — it shows the raw value unless given a `children` render
    function. Fixed on the two selects that had this (team/status pickers).
  - `Button` warns (and `DropdownMenuLabel` throws outright — `MenuGroupContext
    is missing`) when composed in ways this version doesn't support: a
    `render`-based non-button target needs `nativeButton={false}`, and
    `DropdownMenuLabel` requires being inside a `DropdownMenuGroup` — the
    static user-info block in the account menu wasn't, so it crashed
    on open. Replaced with a plain styled `div` instead of forcing group
    semantics onto content that isn't actually a group label.
  - A `session!.user` non-null assertion on the dashboard crashed
    intermittently (a request without a valid session reached the page
    despite the layout's own redirect); made the page redirect defensively
    itself rather than trusting the layout ran first.
  - All caught via actually loading every page in the browser and reading
    console/server errors after each change — not from typecheck, which
    passed the whole time.

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

## M5 — Forecasting ✅
- `server/forecasting/{workloadForecast,partsForecast,costForecast,engine}.ts`:
  workload splits scheduled-compliance vs. reactive-repair demand per team
  per day against resolved capacity (scenario-specific `CapacityEntry` if
  present, else the Main Schedule's); parts walks each part's on-hand
  forward day by day, decrementing by planned consumption, flagging
  stockout risk and a lead-time-backed-off reorder date; cost keeps
  `realFilingFeeCost` (real $, only ever appears on actually-filed
  historical reports — never estimated for a future one) as a column
  separate from synthetic `laborCost`/`partsCost`.
- Added a synthetic `jobType -> laborHours` catalog
  (`src/config/jobLaborHours.ts`), applied the same way as the parts BOM,
  so jobs have real `estimatedLaborHours` for the engine to use.
- `forecast.run`/`latest`/`results` tRPC procedures; a scenario's default
  forecast window is **today − 180 days to today + 365 days** (deliberately
  spans past + future, not purely forward) — so a chart can show real
  historical filing-fee spend and synthetic future-projected cost on one
  connected timeline, which a purely-forward window couldn't.
- Forecast tab on the scenario page (`forecast-panel.tsx`): monthly-bucketed
  Recharts — workload (stacked scheduled/reactive bars + capacity line),
  cost (stacked labor/parts/real-filing-fee bars), and a per-part
  projected-on-hand line with a reorder-point reference line.
- **Bug found and fixed during testing**: `deriveDefectFollowups` wasn't
  scenario-scoped, so after a scenario existed it would (re-)derive a
  second, spurious Main-Schedule-scoped follow-up from the scenario's own
  *copy* of a defective job — doubled the defect-followup count (16 → 32).
  Fixed by scoping the query to `scenarioId: null`; verified back to 16.
- **Exit check** ✅: live-verified on a full 1762-job scenario copy — cost
  chart visibly separates real filing-fee dollars (small orange bars, only
  in months with an actual historical filing) from synthetic parts/labor
  cost (larger teal/purple bars); workload chart shows the expected
  seasonal CAT1/CAT5/periodic cadence shape; parts chart shows "Brake Shoe
  Set" correctly stepping down from 18 to below its reorder point of 6
  by ~April 2026 given its consumption by every CAT1 test.

## M6 — Comparison, promotion, polish ✅
- Scenario diff + promotion (spec §4's "explicit reviewed diff" requirement):
  `scenario.diff` compares every scenario job against the Main Schedule job
  it was copied from field-by-field; `scenario.submitForPromotion`
  (Planner/owner, DRAFT → SUBMITTED) and `scenario.promote` (Admin-only,
  SUBMITTED → PROMOTED) apply only the changed jobs onto the real Main
  Schedule and create the scenario's ad-hoc jobs there, logging an
  `AuditEvent` per change.
- All five remaining §11 warnings implemented in `computeWarnings()`:
  `same_asset_overlap` (two open jobs on one device with overlapping
  dates), `team_over_capacity` (a team's daily demand vs. resolved
  capacity), `unassigned_team` (bounded to jobs due within 30 days — see
  bug note below), `part_stockout_before_job` and `missing_part_cost`
  (bounded to a 90-day horizon).
- CSV/manual-entry fallback: Admins can now click any Main Schedule job
  directly (`schedule.updateMainJob`) — including an `UNSCHEDULED` one — to
  fill in a real date once it's known, rather than Gantry ever guessing one.
  The Gantt component is shared between this and scenario editing.
- Accessibility: Gantt bars are keyboard-operable (`Enter`/`Space`
  activates, matching their `role="button"`/`tabIndex`), the edit popover
  is a labeled `role="dialog"` closable with `Escape`.
- **Bug found and fixed while testing**: the first version of
  `part_stockout_before_job` had no time horizon, so once a part's stock
  legitimately depleted (correctly, per the M5 parts *forecast*), every
  later job needing it for the rest of the year got flagged — 1153
  warnings on one scenario. A warning should mean "act now," so it's now
  bounded to a 90-day horizon (matching the `unassigned_team` pattern);
  verified down to 72 on the same data.
- **Not done** (explicitly cut for time, not silently dropped): Gantt row
  virtualization for very large portfolios — at the current ~1700
  jobs/535 assets it renders and interacts smoothly, so this wasn't yet a
  real problem to solve.
- **Exit check** ✅: live end-to-end walkthrough of the full spec §16
  definition of done — synced real data, viewed the Main Schedule Gantt
  with a real overdue warning and a real defect job, created a scenario,
  rescheduled a job in it, confirmed the diff showed exactly that change,
  submitted it, and promoted it as Admin — confirmed via Postgres that the
  Main Schedule job's date changed and an audit event was recorded.

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
