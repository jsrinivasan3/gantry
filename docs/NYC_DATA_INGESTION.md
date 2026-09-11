# NYC Open Data Ingestion

Three Socrata (SODA) datasets, no auth required for demo volumes. Set
`NYC_OPEN_DATA_APP_TOKEN` (free, from
https://data.cityofnewyork.us/profile/app_tokens) to raise the rate limit —
not required to run this locally.

| Dataset | Endpoint | Fetcher |
|---|---|---|
| DOB NOW: Elevator Safety Compliance | `e5aq-a4j2` | [`elevatorCompliance.ts`](../apps/web/src/server/sync/nycOpenData/elevatorCompliance.ts) |
| Elevator Inspections / Violations by date | `dedp-nh8d` | [`elevatorViolations.ts`](../apps/web/src/server/sync/nycOpenData/elevatorViolations.ts) |
| DOB NOW: Safety Boiler | `52dp-yji6` | [`boilerSafety.ts`](../apps/web/src/server/sync/nycOpenData/boilerSafety.ts) |

## Sync scope

Kept deliberately small (spec §2.4) — the citywide elevator compliance
dataset alone is 65k+ rows for Manhattan. The default scope
(`src/config/syncScope.ts`, persisted in the `sync_config` table so an Admin
can edit it) is **41 Manhattan BINs**: the 40 buildings with 2-8 active
elevator devices each (skips single-elevator walk-ups and 100+ elevator
supertall towers), plus BIN `1090764` added specifically because it carries
a real open DOB elevator violation as of 2026-09 — needed so the demo has at
least one `violation_repair` job without waiting for one to appear
organically. This yields ~463 elevator assets, ~72 boiler assets, ~640
completed boiler-inspection jobs, and 1 violation-repair job.

## Field mapping

**Elevator compliance → `assets`** (keyed on `externalId = device_number`):
`device_type`+`device_number` → `displayName`; `bin`/`borough`/address
fields map directly; `device_status` → `status`. The full raw row — crucially
`cat1_latest_report_filed`, `cat5_latest_report_filed`,
`periodic_latest_inspection` — is kept verbatim in `metadata`, since those
are exactly the real fields the M3 schedule-derivation rules read from. They
are never copied into typed columns because the derivation engine (not the
sync module) owns turning them into due dates.

**Elevator violations → `jobs`** (keyed on `externalId = violation_number`):
only rows where `violation_category` contains `ACTIVE` are synced (spec
§10.2). Each becomes a `VIOLATION_REPAIR` job, `status = PLANNED`,
`priority = high`, `scheduledStart = scheduledEnd = today`. If the
violation's `device_number` isn't present in the compliance dataset (this
happens — some violations reference older devices no longer tracked there),
a minimal fallback asset is created from the violation row itself
(`bin`/`boro`/address) rather than silently dropping a real violation.

**Boiler safety → `assets` + `jobs`** (asset keyed on `externalId =
boiler_id`; job keyed on `externalId = tracking_number`): one job per filed
report, `status = COMPLETED` (these are historical filings, not future
work), `scheduledStart = scheduledEnd = completedAt = inspection_date`.
`job_type` is derived from `pressure_type`/`report_type`
(`jobTypeForReport()` in `boilerSafety.ts`): Low Pressure → `boiler_periodic`;
High Pressure + "External"/"Internal" report → `boiler_external`/
`boiler_internal`; anything else (e.g. a High Pressure "Initial" filing,
which is common in this data slice and isn't itself a recurring external/
internal inspection) → `other`. `defects_exist` → `defectsFound`;
`filing_fee` → `realFilingFee` (real $, kept separate from any synthetic
labor/parts cost added in later milestones).

## Idempotency

Every upsert is keyed on `(externalSource, externalId)` for assets or
`(source, externalId)` for jobs — both are `@@unique` in the Prisma schema —
so re-running the sync never creates duplicates. A job's re-sync `update`
only touches identity fields (title, defect/fee flags), never
`status`/`scheduledStart`/`teamId`, so an Admin's manual edits to a job
survive a re-sync.

## Fallback snapshot

`sample-data/nyc-open-data-snapshot/*.csv` is a one-time pull of the same
scope, regenerated with `npx tsx scripts/snapshotNycOpenData.ts` (run from
`apps/web`). It's a safety net for offline development, not consulted by the
live sync path.
