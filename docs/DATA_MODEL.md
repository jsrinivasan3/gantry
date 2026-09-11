# Data model

Full schema: [`apps/web/prisma/schema.prisma`](../apps/web/prisma/schema.prisma).
This is a plain-language walkthrough of it, grouped the same way the schema
file is. `AuditEvent`/`ForecastRun`/`Scenario` etc. below are Prisma model
names — Postgres table names are the `snake_case` `@@map()` values in the
schema (e.g. `Job` → `jobs`).

## Users, teams, capacity

- **User** — `role` is `VIEWER | PLANNER | ADMIN` (spec §5). Auth.js stores
  the session; `passwordHash` is bcrypt.
- **Team** — a crew (in-house or contracted), synthetic, with an
  `hourlyRate`.
- **CapacityEntry** — headcount × hours/day for a team, effective from a
  date. `scenarioId = null` means it applies to the Main Schedule; a
  scenario can override it for planning purposes.

## Assets — real, from NYC Open Data

**Asset** is one elevator or boiler device. `externalSource` +
`externalId` is how sync stays idempotent — `(externalSource, externalId)`
is unique, so re-syncing never creates a duplicate device.

The raw API row for the device is kept verbatim in `metadata` (JSONB) —
this is deliberate: the schedule-derivation engine reads real fields like
`cat1_latest_report_filed` straight out of `metadata` rather than them being
copied into typed columns, so there's exactly one place the real value
lives. See [NYC_DATA_INGESTION.md](NYC_DATA_INGESTION.md) for exactly which
fields land here per dataset.

## Parts and inventory — synthetic

**Part** is a synthetic catalog item (seeded from `sample-data/parts.csv`).
**PartStockMovement** is the ledger of receipts/consumption/adjustments
against a part, optionally tied to the job that consumed it.

## Main Schedule and Scenarios

- **Job.scenarioId = null** *is* the Main Schedule — there's no separate
  "Main Schedule" table. A **Scenario** is a named sandbox; copying the
  schedule into one means duplicating the relevant `Job` rows with
  `scenarioId` set to the new scenario's id and `copiedFromJobId` pointing
  back to the original. Editing those copies never touches the
  `scenarioId = null` rows.
- **ScheduleRevision** is a stamped snapshot marker — a scenario records
  which revision it was copied from (`copiedFromScheduleRevisionId`), so a
  promotion can be reviewed as a diff against what the scenario actually
  started from, not just "the Main Schedule as of right now."

## Jobs — the core entity

A **Job** is one scheduled or completed unit of work against an asset:
a compliance test, an inspection, a violation repair, or ad-hoc work.

Provenance is explicit via `source`:

| `source` | Meaning |
|---|---|
| `NYC_OPEN_DATA` | Came directly from a synced dataset row (`externalId` = the dataset's own id — `tracking_number`, `violation_number`, etc.) |
| `DERIVED_RULE` | Computed by the schedule-derivation engine from a real date + a rule (never fabricated from nothing — see [MILESTONES.md](MILESTONES.md) M3) |
| `MANUAL` | Created by a user |

`(source, externalId)` is unique (nullable `externalId`, so `MANUAL` jobs
don't collide) — this is what makes every sync and every derivation pass
idempotent: re-running either one is always safe.

`linkedJobId` connects a derived follow-up job back to the job that caused
it — e.g. a boiler defect's "Subsequent Inspection" job links back to the
inspection report that found the defect.

`status = UNSCHEDULED` is a deliberate state (not in the original spec's
literal status list, added because §4 explicitly requires it): it means
"this compliance requirement is real, but Gantry has no real date to derive
it from" — shown to the user as "needs manual entry," never given a guessed
date.

**JobPart** is the bill-of-materials line: which parts (and how many) a job
is expected to consume, and later how many it actually did.

**JobTypeRule** is the configurable cadence table §10.1 asks for — e.g.
`CAT1_TEST` → 365-day interval off `cat1_latest_report_filed`. The
derivation engine reads this table rather than hard-coding cadences, so a
regulatory change is a data edit, not a code change.

## Forecasting

Implemented in M5 (`apps/web/src/server/forecasting/`):

- **ForecastRun** — one computed snapshot from a scenario over a date range,
  hashed (`inputHash`, a digest of every job's id+updatedAt) so an identical
  re-run is identifiable. Default window is today−180 days to today+365
  days — spans past and future so real historical filing-fee spend and
  synthetic future cost projections sit on one connected timeline.
- **WorkloadForecastDaily** — demand vs. capacity hours per team per day,
  split `demandKind: scheduled | reactive` so compliance-driven work and
  violation-repair "noise" show as separate series (spec §12). One row per
  `(date, team, demandKind)`; a `scheduled`-kind row is always emitted (even
  at zero demand) so the capacity line has no gaps.
- **PartsForecastDaily** — walks each part's `onHandCount` forward day by
  day, decrementing by that day's planned consumption across open jobs;
  `suggestedReorderDate` is the day on-hand would cross `reorderPoint`,
  backed off by the part's `leadTimeDays`.
- **CostForecastDaily** — `laborCost`/`partsCost` (synthetic) kept as
  separate columns from `realFilingFeeCost` (real $, only populated for
  jobs that were actually completed with a real filed fee — never
  estimated for a not-yet-filed future report) — spec §12 is explicit
  these must never blend into one unlabeled number.

## Sync log

- **SyncConfig** — singleton row holding the current borough/BIN scope an
  Admin can edit from `/admin` (spec §13 `sync.config.update`).
- **SyncRun** — one row per fetcher invocation: started/completed,
  fetched/upserted counts, and the error if it failed. This is what powers
  the Admin "Data Sync" panel's history table.

## Audit log

**AuditEvent** is a generic `(entityType, entityId, operation, changes)`
log. Not yet wired up to any mutation (planned for M6 polish alongside the
remaining warnings).
