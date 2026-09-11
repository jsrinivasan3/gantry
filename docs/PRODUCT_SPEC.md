# Coding-Agent Prompt: Facilities Compliance & Maintenance Planning App (NYC Elevator + Boiler Data)

This pins the general maintenance-planning template down to a specific, buildable vertical: a facilities team managing **elevators and boilers across a portfolio of NYC buildings**, using **real, continuously-refreshing NYC Open Data** as the asset and job backbone. Parts, crew capacity, and most costs are still synthetic (documented clearly below), but the assets, their compliance history, and a meaningful slice of the schedule are real public records — which is what makes this demoable without you having to invent a fake company's maintenance history.

Placeholder product name: **Gantry**. Centralize the display name, API base URL, and branding in one config file.

---

## BEGIN CODING-AGENT PROMPT

You are a senior full-stack engineer, database designer, and forecasting engineer. Build a production-quality **web application** for facilities maintenance planning and forecasting, seeded and continuously refreshed from live NYC Open Data on elevators and boilers.

Do not ask for routine implementation decisions that can be reasonably inferred. Make safe assumptions, document them in the repo, keep the project running at every step, and implement in vertical slices.

### 1. Primary objective

Build a web app that lets one company plan and forecast maintenance/compliance work across elevators and boilers in a set of NYC buildings it manages. The app must:

- Ingest real device/asset and inspection data from NYC Open Data and turn it into a **Main Schedule** of maintenance and compliance jobs (inspections, tests, and defect repairs).
- Let a user copy the Main Schedule into an isolated **Scenario** sandbox to plan changes — reassign a job to a different date or crew, batch several devices' tests together, add ad-hoc repair jobs — without touching the real schedule.
- Track **parts** consumed by each job (a synthetic-but-realistic parts catalog for elevator/boiler components), current stock, and reorder economics.
- Forecast **workload** (crew demand vs. capacity), **parts** (projected stock, stockout risk, reorder suggestions), and **cost** (labor + parts + any real regulatory filing fees) together from a scenario.
- Visualize the schedule as an interactive **Gantt chart** (rows = devices, bars = jobs) and forecasts as linked time-series charts.

Single company, single site (one portfolio of buildings, not a multi-tenant SaaS). Do not build multi-organization data models.

### 2. Live data source and ingestion

This is the part that makes the demo real. NYC Open Data (Socrata / SODA API) publishes three relevant datasets, all free, requiring no authentication for normal read volumes (register a free app token at `https://data.cityofnewyork.us/profile/app_tokens` and send it as an `X-App-Token` header to raise your rate limit — still free, just higher throughput). All three are updated on a rolling basis as real filings happen, so re-syncing periodically will show new records over time.

**2.1 DOB NOW: Elevator Safety Compliance** — one row per elevator device, giving its current compliance status.
Endpoint: `https://data.cityofnewyork.us/resource/e5aq-a4j2.json`
Key real fields: `device_number` (external ID, e.g. `1P14518`), `device_type`, `device_status` (Active/Inactive), `status_date`, `bin` (building identifier), `borough`, `house_number`, `street_name`, `zip_code`, `latitude`, `longitude`, `periodic_report_year`, `periodic_latest_inspection`, `cat1_report_year`, `cat1_latest_report_filed`, `cat5_latest_report_filed`.
→ Use this as the primary source for **elevator assets** and their **most recent compliance dates**, from which you derive the next-due dates for each required test (rules in §10.1).

**2.2 Elevator Inspections / Violations by date** — one row per elevator-related DOB violation.
Endpoint: `https://data.cityofnewyork.us/resource/dedp-nh8d.json`
Key real fields: `device_number`, `bin`, `issue_date`, `violation_type_code`, `violation_type` (e.g. "E-ELEVATOR ELEVATOR REQUIRED"), `violation_category` (e.g. "V-DOB VIOLATION - ACTIVE"), `violation_number`.
→ Use this to auto-generate **corrective jobs**: an open violation against a device becomes a job that must be resolved, tied to the same asset.

**2.3 DOB NOW: Safety Boiler** — one row per boiler inspection report filed.
Endpoint: `https://data.cityofnewyork.us/resource/52dp-yji6.json`
Key real fields: `tracking_number` (external ID), `boiler_id`, `report_type` (Initial, Periodic, Subsequent, External, Internal), `boiler_make`, `boiler_model`, `pressure_type` (Low Pressure / High Pressure), `inspection_date`, `defects_exist` (Yes/No), `report_status` (Accepted/etc.), `filing_fee`, `total_amount_paid`, `bin_number`.
→ Use this as the primary source for **boiler assets** (derive one asset per distinct `boiler_id`) and their **inspection history as completed jobs**. `filing_fee`/`total_amount_paid` are real dollar figures — feed them into the cost forecast as a real administrative-cost line, distinct from the synthetic labor/parts costs.

**2.4 Sync design**
- Build a `server/sync/nycOpenData/` module with one fetcher per dataset. Query with SoQL (`$limit`, `$offset`, `$where`, `$order`) scoped to a manageable, chosen slice — e.g. one borough (`$where=borough='MANHATTAN'`) or a curated list of BINs — so the demo dataset stays in the hundreds of devices, not the citywide total.
- Run it as a scheduled job (a Vercel Cron hitting an API route, or a small worker) on a sensible cadence (e.g., nightly). For incremental syncs, filter with `$where=status_date > 'last_sync_timestamp'` (elevator compliance) or `inspection_date > 'last_sync_timestamp'` (boiler) so you're not re-pulling the whole dataset every run.
- Upsert into `assets` and `jobs` keyed by the external ID (`device_number`, `boiler_id`/`tracking_number`, `violation_number`) so re-syncing is idempotent — never create duplicate assets or jobs for the same external record.
- Keep a `sync_runs` log (started_at, completed_at, records_fetched, records_upserted, source, status) so the Admin screen can show "last synced" and a history of syncs, and so failures are visible rather than silent.
- Ship a one-time committed **snapshot CSV** (pulled from the same endpoints at build time) as a fallback for offline development or if the live API is briefly down — the live sync is the primary path, the CSV is a safety net, not the default.

**2.5 What's real vs. synthetic — be explicit about this in the UI and docs**
- **Real**: assets (devices and their building/location), each device's compliance history and current status, open violations, boiler inspection reports and their `defects_exist`/`report_status`, boiler filing fees.
- **Rule-derived from real data**: future due dates for CAT1/CAT5/periodic elevator tests and annual/semiannual boiler inspections, computed from the real last-filed dates using the regulatory cadences in §10.1 — real inputs, a documented rule, not an invented date.
- **Synthetic (clearly labeled as demo data)**: the parts catalog and their unit costs (aside from real boiler filing fees), crew/team definitions and hourly rates, and which parts a given job type typically consumes. Never present a synthetic number as if it were a real filed cost or a real regulatory deadline.

### 3. Core concepts and terminology

| Concept | Meaning here |
|---|---|
| Asset | An elevator or boiler device in a specific NYC building (`device_number` or `boiler_id`, with its `bin`/address). |
| Job | A scheduled or completed maintenance/compliance event against an asset: a CAT1/CAT5 test, a periodic inspection, a boiler external/internal inspection, or a violation-repair. |
| Part | A synthetic inventory item representing a real component category (e.g., door operator, hydraulic pump seal, pressure relief valve). |
| Job Part (BOM line) | A part and quantity tied to a specific job. |
| Team | A crew (in-house or contracted) that performs jobs; has capacity (headcount × hours/day). |
| Main Schedule | The live, authoritative set of jobs — synced/derived jobs plus anything an Admin adds manually. |
| Scenario | A private, editable copy of the schedule a Planner can rearrange without affecting the Main Schedule. |
| Forecast Run | A computed snapshot from a scenario: workload, parts, and cost projections over a date range. |

### 4. Critical product principles

- **Main Schedule vs. Scenario**: same isolation rules as any baseline/scenario system — copying is a deep copy with new IDs, editing a scenario never touches the Main Schedule or another scenario, and promoting back requires an explicit reviewed diff.
- **Traceability, especially given mixed real/synthetic data**: every job must show where it came from — synced from NYC Open Data (with the external ID and dataset), rule-derived (with the rule and the real date it was computed from), or manually created. Every forecast number must be traceable to which inputs produced it, and whether those inputs were real or synthetic.
- **Never silently invent a compliance deadline.** If a device's history is incomplete (e.g., no `cat5_latest_report_filed` on record), show "unknown — needs manual entry," not a guessed date.

### 5. Users and roles

- **Viewer** — read-only: Main Schedule, shared scenarios, forecasts, sync status.
- **Planner** — Viewer plus: create/edit owned scenarios, edit jobs/parts/capacity within them, run forecasts, request promotion to the Main Schedule.
- **Admin** — Planner plus: edit the Main Schedule directly, manage parts/teams, configure sync scope (which boroughs/BINs to track) and trigger manual syncs, approve/promote scenarios, manage users.

### 6. System architecture and stack

Same recommendation as the general template, for the same reason — a single TypeScript stack gives the fastest iteration on the interactive Gantt/scenario UI, which is where this product lives or dies:

- **Frontend**: Next.js (App Router) + React + TypeScript, Tailwind + shadcn/ui, TanStack Query + TanStack Table, a custom Gantt built on `@dnd-kit` + `date-fns` (or prototype with `frappe-gantt`/`svar-gantt` first), Recharts for forecast charts.
- **Backend**: Node.js + TypeScript, tRPC (best fit here for end-to-end type safety with zero schema duplication), Prisma over PostgreSQL, Zod for shared validation.
- **Sync/background work**: a scheduled route (Vercel Cron, or a small worker) running the NYC Open Data fetchers; a lightweight queue (BullMQ+Redis, or Inngest) once forecast runs or syncs take more than a couple seconds.
- **Auth**: NextAuth.js (Auth.js) — email/password or magic link is enough for one company.
- **Hosting**: Vercel (app + cron) + Neon or Supabase (Postgres) + Upstash Redis if a queue is added.

### 7. Repository layout

```
gantry/
  README.md
  docs/
    PRODUCT_SPEC.md
    DATA_MODEL.md
    FORECASTING.md
    NYC_DATA_INGESTION.md      # dataset IDs, field mappings, cadence rules
  apps/
    web/
      src/
        app/
        components/
        features/
        server/
          routers/
          sync/
            nycOpenData/
              elevatorCompliance.ts
              elevatorViolations.ts
              boilerSafety.ts
              upsert.ts
          forecasting/
            workloadForecast.ts
            partsForecast.ts
            costForecast.ts
            engine.ts
          db/
      prisma/
        schema.prisma
        migrations/
  infrastructure/
    docker-compose.yml
  sample-data/
    nyc-open-data-snapshot/     # fallback CSVs pulled once from the live endpoints
    parts.csv                   # synthetic
    teams.csv                   # synthetic
```

### 8. Database design

UUID primary keys, `numeric` for money/hours, `date` for schedule dates, `timestamptz` for instants.

**8.1 Users, Teams, Capacity** — unchanged from the general model:
```
users( id, email, display_name, password_hash NULL, role, created_at, last_login_at, disabled_at NULL )
teams( id, name, hourly_rate NUMERIC, active )
capacity_entries( id, team_id, scenario_id NULL, effective_date, headcount, hours_per_person )
```

**8.2 Assets** — now carrying real external references:
```
assets
  id UUID PK
  external_source VARCHAR NOT NULL        -- 'nyc_dob_elevator' | 'nyc_dob_boiler' | 'manual'
  external_id VARCHAR NOT NULL            -- device_number or boiler_id
  asset_type VARCHAR NOT NULL             -- 'elevator' | 'boiler'
  display_name VARCHAR NOT NULL
  bin VARCHAR NULL
  borough VARCHAR NULL
  address VARCHAR NULL
  latitude NUMERIC NULL
  longitude NUMERIC NULL
  status VARCHAR NOT NULL                 -- from device_status, or manual
  metadata JSONB NULL                     -- raw extra fields (make/model/pressure_type, etc.)
  created_at, updated_at
  UNIQUE (external_source, external_id)
```

**8.3 Parts and inventory** — synthetic, same shape as the general model:
```
parts( id, sku, name, unit_cost, on_hand_count, reorder_point, reorder_quantity, lead_time_days, supplier, active )
part_stock_movements( id, part_id, job_id NULL, movement_type, quantity, unit_cost_at_time, occurred_at, note )
```

**8.4 Main Schedule and Scenarios** — unchanged pattern:
```
scenarios( id, owner_user_id, name, description, copied_from_schedule_revision, is_shared, input_revision, status, created_at, updated_at )
schedule_revisions( id, created_at, created_by, note )
```

**8.5 Jobs** — now with sync provenance:
```
jobs
  id UUID PK
  scenario_id UUID NULL                   -- NULL = Main Schedule
  copied_from_job_id UUID NULL
  asset_id UUID FK NOT NULL
  team_id UUID FK NULL
  source VARCHAR NOT NULL                 -- 'nyc_open_data' | 'derived_rule' | 'manual'
  external_id VARCHAR NULL                -- tracking_number / violation_number, when synced
  job_type VARCHAR NOT NULL               -- cat1_test | cat5_test | periodic_inspection |
                                           -- boiler_external | boiler_internal | boiler_periodic |
                                           -- violation_repair | other
  title VARCHAR NOT NULL
  status VARCHAR NOT NULL                 -- planned | in_progress | completed | cancelled
  scheduled_start DATE NOT NULL
  scheduled_end DATE NOT NULL
  estimated_labor_hours NUMERIC NOT NULL DEFAULT 0
  actual_labor_hours NUMERIC NULL
  defects_found BOOLEAN NULL              -- from defects_exist on synced boiler jobs
  real_filing_fee NUMERIC NULL            -- from filing_fee on synced boiler jobs; real $, keep separate from synthetic cost
  completed_at TIMESTAMPTZ NULL
  created_at, updated_at
  UNIQUE (source, external_id)            -- partial unique where external_id is not null; prevents duplicate sync inserts
  CHECK (scheduled_start <= scheduled_end)

job_parts( id, job_id, part_id, quantity_planned, quantity_consumed NULL, UNIQUE(job_id, part_id) )
```

**8.6 Forecast runs** — identical shape to the general model:
```
forecast_runs( id, scenario_id, created_by, status, start_date, end_date, scenario_input_revision, input_hash, engine_version, created_at, started_at NULL, completed_at NULL, failure_message NULL )
workload_forecast_daily( forecast_run_id, date, team_id, demand_hours, capacity_hours )
parts_forecast_daily( forecast_run_id, date, part_id, projected_on_hand, projected_consumption, stockout_risk, suggested_reorder_date, suggested_reorder_quantity )
cost_forecast_daily( forecast_run_id, date, labor_cost, parts_cost, real_filing_fee_cost, cumulative_cost )
```

**8.7 Sync log**
```
sync_runs( id, source, started_at, completed_at NULL, status, records_fetched, records_upserted, error_message NULL )
```

**8.8 Audit log** — unchanged: `audit_events( id, entity_type, entity_id, operation, actor_user_id, occurred_at, changes JSONB )`.

### 9. Job-type reference (drives §10 and the Gantt legend)

| job_type | Asset type | Meaning |
|---|---|---|
| `cat1_test` | Elevator | Annual Category 1 safety test |
| `cat5_test` | Elevator | Category 5 full-load test, every 5 years |
| `periodic_inspection` | Elevator | DOB-contracted periodic inspection, twice per year |
| `boiler_periodic` | Boiler (Low Pressure) | Annual inspection |
| `boiler_external` | Boiler (High Pressure) | External inspection, ~2×/year |
| `boiler_internal` | Boiler (High Pressure) | Internal inspection, ~2×/year, staggered ~6 months from external |
| `violation_repair` | Either | Corrective work created from an open DOB violation |
| `other` | Either | Manually created ad-hoc work |

### 10. Core business rules

**10.1 Deriving the forward schedule from real compliance dates** — implement as a configurable rule table (`job_type_rules`: job_type, interval_days, source_field), not hard-coded, since the city can change these:
- Elevator CAT1: next due = `cat1_latest_report_filed` + 365 days.
- Elevator CAT5: next due = `cat5_latest_report_filed` + 5 years.
- Elevator periodic inspection: next due = `periodic_latest_inspection` + ~182 days (twice yearly).
- Low-pressure boiler: next due = `inspection_date` (latest `boiler_periodic`/Initial report) + 365 days.
- High-pressure boiler: external and internal each recur roughly every 365 days, offset ~182 days from each other; derive the next of each from the most recent report of that type.
- If the source field is null (no filing on record), do not fabricate a date — create the job as "unscheduled, needs manual date" and raise a warning instead.

**10.2 Violations → corrective jobs**: an open, active violation (`violation_category` containing "ACTIVE") with no existing `violation_repair` job referencing its `violation_number` creates one automatically, `scheduled_start` = today, `status = planned`, flagged high priority.

**10.3 Defects on a boiler report → follow-up job**: `defects_exist = 'Yes'` on a synced boiler job creates a linked "Subsequent Inspection" job; per real DOB rules, defects must be corrected within 90 days and an affirmation of correction filed by day 104 — use these as the follow-up job's due date and a hard deadline warning, respectively.

**10.4 Standard rules carried over from the general model**: `scheduled_start <= scheduled_end`; completing a job decrements part stock transactionally and never lets `on_hand_count` go negative; creating/editing/promoting scenarios follows the same copy-isolation and revision-bump rules as the general spec (§9, §11 of the base template).

### 11. Warnings

- `compliance_overdue` — a derived due date has passed with no completed job of that type for the asset. (This is the real-world equivalent of a DOB violation risk — a strong, legible warning for a demo.)
- `defect_correction_deadline_approaching` — a linked follow-up job (§10.3) is within 14 days of its 90-day correction deadline or 104-day filing deadline and isn't completed.
- `same_asset_overlap`, `team_over_capacity`, `unassigned_team`, `part_stockout_before_job`, `missing_part_cost` — same as the general model.

### 12. Forecast engine

Same three-part engine as the general template (§11 of the base spec: workload, parts, cost), with two additions specific to this data:

- **Workload demand is unusually predictable here** — because CAT1/CAT5/periodic/annual boiler cycles are regulatory and known in advance, the workload forecast for synced/derived jobs should look clean and cyclical, which is a good thing to show off. Violation-repair jobs are the "noisy," less predictable demand on top of that baseline — worth splitting into two series (scheduled compliance work vs. reactive repair work) on the workload chart.
- **Cost forecast keeps real and synthetic costs visibly separate**: `cost_forecast_daily.real_filing_fee_cost` (from actual boiler `filing_fee`/`total_amount_paid`) is summed alongside, but shown as a distinct series from, the synthetic `labor_cost` and `parts_cost` — label them accordingly in the chart legend rather than blending into one unlabeled number.

### 13. Scenario mechanics, API, screens, visual design, performance, testing, sample data

These carry over directly from the general template (sections 12–20 of the base spec) with vocabulary swapped in: assets are elevators/boilers in specific buildings, jobs are inspections/tests/repairs, the Gantt's asset rows are devices grouped by building/borough. Two additions:

- **API**: add `sync.trigger(source)`, `sync.status`, `sync.history`, and `sync.config.update(scope)` (borough or BIN list) to the router list in the base spec's §13.
- **Admin screen**: add a "Data Sync" panel showing last sync time per source, record counts, and a manual "Sync now" button, plus the borough/BIN scope configuration.

### 14. Sample data / bootstrapping

Primary path: run the sync against a chosen scope (recommend one borough, e.g. Manhattan, or a curated ~100-BIN list) to get real assets and real compliance history, then run the derivation rules (§10.1) to populate the forward Main Schedule, then seed the synthetic parts catalog, teams, and job-parts mapping. Keep a one-time committed snapshot CSV of the same live pull as an offline fallback. Confirm after seeding that the demo portfolio includes at least one asset with an overdue compliance date and at least one boiler job with `defects_exist = true`, so the warnings and forecast charts have something real to show immediately.

### 15. Implementation sequence

1. **Foundation** — repo scaffold, Prisma schema, Postgres, Next.js shell, auth.
2. **Live data ingestion** — build the three NYC Open Data fetchers, upsert logic, sync log, and the Admin sync panel. Get real assets and historical jobs into the database before building much UI on top of fake data.
3. **Schedule derivation** — implement the job_type_rules engine (§10.1) and the violation/defect-to-job rules (§10.2–10.3); render the read-only Main Schedule Gantt from real + derived jobs.
4. **Parts, teams, and scenarios** — synthetic parts catalog, teams/capacity, scenario copy/edit with the Gantt drag/resize.
5. **Forecasting** — workload/parts/cost engines, results screen with linked charts, real-vs-synthetic labeling.
6. **Comparison, promotion, polish** — scenario comparison/promotion, CSV/manual-entry fallback for assets without full compliance history, accessibility and performance passes.

### 16. Definition of done

A user can: trigger (or wait for) a sync that pulls real elevator and boiler records for a chosen NYC scope, see a Main Schedule Gantt populated with real assets and rule-derived compliance due dates, see an automatically created corrective job from a real open violation, create a scenario and rearrange jobs, add parts to a job, run a forecast and see workload/parts/cost charts that clearly distinguish real (compliance-driven, and boiler filing fees) from synthetic (labor/parts cost) numbers, see a compliance-overdue warning surfaced correctly, and promote a scenario back into the Main Schedule — with sync, scheduling-rule, and authorization logic all enforced server-side.

Begin by inspecting available tooling, then scaffold the repo and get the NYC Open Data sync working end-to-end before building further UI — that live pipeline is the foundation everything else in the demo depends on.

## END CODING-AGENT PROMPT
