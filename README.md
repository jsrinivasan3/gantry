# Gantry

Facilities compliance & maintenance planning for a portfolio of NYC buildings —
elevators and boilers — built on **live NYC Open Data**.

Gantry ingests real elevator compliance records, elevator violations, and boiler
inspection filings from NYC Open Data (Socrata/SODA), derives a forward
maintenance/compliance schedule from the real regulatory cadences (CAT1/CAT5
elevator tests, periodic inspections, annual boiler inspections), and lets a
facilities team plan changes in isolated **scenarios**, track a synthetic parts
catalog, and forecast workload/parts/cost — all rendered as an interactive
Gantt chart.

This is a sibling project to [MaintainPlan](../maintainplan) (the iOS/FastAPI
maintenance app) but a different pivot: a web app, backed by real public
regulatory data instead of a synthetic company.

See [docs/MILESTONES.md](docs/MILESTONES.md) for the build plan and current
status, and [docs/PRODUCT_SPEC.md](docs/PRODUCT_SPEC.md) for the full spec.

## What's real vs. synthetic

- **Real**: assets (devices + buildings), compliance history, open violations,
  boiler inspection reports, boiler filing fees.
- **Rule-derived from real data**: forward due dates for CAT1/CAT5/periodic
  elevator tests and boiler inspections — a documented rule applied to a real
  filed date, never an invented date.
- **Synthetic (labeled everywhere in the UI)**: parts catalog + costs, crew/team
  definitions + hourly rates, which parts a job type consumes.

## Stack

Next.js (App Router) + TypeScript, Tailwind + shadcn/ui, tRPC, Prisma +
PostgreSQL, NextAuth, TanStack Query/Table, Recharts.

## Local development

```bash
brew services start postgresql@16   # already running if you set this up before
cd apps/web
cp .env.example .env
npm install
npx prisma migrate dev
npm run dev
```
