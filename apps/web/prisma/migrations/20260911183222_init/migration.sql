-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('VIEWER', 'PLANNER', 'ADMIN');

-- CreateEnum
CREATE TYPE "AssetType" AS ENUM ('ELEVATOR', 'BOILER');

-- CreateEnum
CREATE TYPE "ExternalSource" AS ENUM ('NYC_DOB_ELEVATOR', 'NYC_DOB_BOILER', 'MANUAL');

-- CreateEnum
CREATE TYPE "StockMovementType" AS ENUM ('RECEIPT', 'CONSUMPTION', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "ScenarioStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'PROMOTED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "JobSource" AS ENUM ('NYC_OPEN_DATA', 'DERIVED_RULE', 'MANUAL');

-- CreateEnum
CREATE TYPE "JobType" AS ENUM ('CAT1_TEST', 'CAT5_TEST', 'PERIODIC_INSPECTION', 'BOILER_EXTERNAL', 'BOILER_INTERNAL', 'BOILER_PERIODIC', 'VIOLATION_REPAIR', 'OTHER');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'UNSCHEDULED');

-- CreateEnum
CREATE TYPE "ForecastRunStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "SyncSource" AS ENUM ('NYC_DOB_ELEVATOR_COMPLIANCE', 'NYC_DOB_ELEVATOR_VIOLATIONS', 'NYC_DOB_BOILER_SAFETY');

-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('RUNNING', 'SUCCESS', 'FAILED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "passwordHash" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'VIEWER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastLoginAt" TIMESTAMP(3),
    "disabledAt" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teams" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "hourlyRate" DECIMAL(10,2) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "capacity_entries" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "scenarioId" TEXT,
    "effectiveDate" DATE NOT NULL,
    "headcount" INTEGER NOT NULL,
    "hoursPerPerson" DECIMAL(5,2) NOT NULL,

    CONSTRAINT "capacity_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assets" (
    "id" TEXT NOT NULL,
    "externalSource" "ExternalSource" NOT NULL,
    "externalId" TEXT NOT NULL,
    "assetType" "AssetType" NOT NULL,
    "displayName" TEXT NOT NULL,
    "bin" TEXT,
    "borough" TEXT,
    "address" TEXT,
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "status" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parts" (
    "id" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unitCost" DECIMAL(10,2) NOT NULL,
    "onHandCount" INTEGER NOT NULL DEFAULT 0,
    "reorderPoint" INTEGER NOT NULL DEFAULT 0,
    "reorderQuantity" INTEGER NOT NULL DEFAULT 0,
    "leadTimeDays" INTEGER NOT NULL DEFAULT 0,
    "supplier" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "parts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "part_stock_movements" (
    "id" TEXT NOT NULL,
    "partId" TEXT NOT NULL,
    "jobId" TEXT,
    "movementType" "StockMovementType" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitCostAtTime" DECIMAL(10,2) NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,

    CONSTRAINT "part_stock_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scenarios" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "copiedFromScheduleRevisionId" TEXT,
    "isShared" BOOLEAN NOT NULL DEFAULT false,
    "inputRevision" INTEGER NOT NULL DEFAULT 1,
    "status" "ScenarioStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scenarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schedule_revisions" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdByUserId" TEXT NOT NULL,
    "note" TEXT,

    CONSTRAINT "schedule_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jobs" (
    "id" TEXT NOT NULL,
    "scenarioId" TEXT,
    "copiedFromJobId" TEXT,
    "assetId" TEXT NOT NULL,
    "teamId" TEXT,
    "source" "JobSource" NOT NULL,
    "externalId" TEXT,
    "jobType" "JobType" NOT NULL,
    "title" TEXT NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'PLANNED',
    "scheduledStart" DATE NOT NULL,
    "scheduledEnd" DATE NOT NULL,
    "estimatedLaborHours" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "actualLaborHours" DECIMAL(6,2),
    "defectsFound" BOOLEAN,
    "realFilingFee" DECIMAL(10,2),
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "linkedJobId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_parts" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "partId" TEXT NOT NULL,
    "quantityPlanned" INTEGER NOT NULL,
    "quantityConsumed" INTEGER,

    CONSTRAINT "job_parts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_type_rules" (
    "id" TEXT NOT NULL,
    "jobType" "JobType" NOT NULL,
    "intervalDays" INTEGER NOT NULL,
    "sourceField" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "job_type_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "forecast_runs" (
    "id" TEXT NOT NULL,
    "scenarioId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "status" "ForecastRunStatus" NOT NULL DEFAULT 'PENDING',
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "scenarioInputRevision" INTEGER NOT NULL,
    "inputHash" TEXT NOT NULL,
    "engineVersion" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "failureMessage" TEXT,

    CONSTRAINT "forecast_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workload_forecast_daily" (
    "id" TEXT NOT NULL,
    "forecastRunId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "teamId" TEXT,
    "demandHours" DECIMAL(8,2) NOT NULL,
    "capacityHours" DECIMAL(8,2) NOT NULL,
    "demandKind" TEXT NOT NULL DEFAULT 'scheduled',

    CONSTRAINT "workload_forecast_daily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parts_forecast_daily" (
    "id" TEXT NOT NULL,
    "forecastRunId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "partId" TEXT NOT NULL,
    "projectedOnHand" INTEGER NOT NULL,
    "projectedConsumption" INTEGER NOT NULL,
    "stockoutRisk" BOOLEAN NOT NULL DEFAULT false,
    "suggestedReorderDate" DATE,
    "suggestedReorderQuantity" INTEGER,

    CONSTRAINT "parts_forecast_daily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cost_forecast_daily" (
    "id" TEXT NOT NULL,
    "forecastRunId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "laborCost" DECIMAL(12,2) NOT NULL,
    "partsCost" DECIMAL(12,2) NOT NULL,
    "realFilingFeeCost" DECIMAL(12,2) NOT NULL,
    "cumulativeCost" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "cost_forecast_daily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_runs" (
    "id" TEXT NOT NULL,
    "source" "SyncSource" NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "status" "SyncStatus" NOT NULL DEFAULT 'RUNNING',
    "recordsFetched" INTEGER NOT NULL DEFAULT 0,
    "recordsUpserted" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,

    CONSTRAINT "sync_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_events" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "actorUserId" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "changes" JSONB,

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "capacity_entries_teamId_scenarioId_effectiveDate_idx" ON "capacity_entries"("teamId", "scenarioId", "effectiveDate");

-- CreateIndex
CREATE INDEX "assets_assetType_borough_idx" ON "assets"("assetType", "borough");

-- CreateIndex
CREATE UNIQUE INDEX "assets_externalSource_externalId_key" ON "assets"("externalSource", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "parts_sku_key" ON "parts"("sku");

-- CreateIndex
CREATE INDEX "part_stock_movements_partId_occurredAt_idx" ON "part_stock_movements"("partId", "occurredAt");

-- CreateIndex
CREATE INDEX "jobs_scenarioId_assetId_idx" ON "jobs"("scenarioId", "assetId");

-- CreateIndex
CREATE INDEX "jobs_scheduledStart_scheduledEnd_idx" ON "jobs"("scheduledStart", "scheduledEnd");

-- CreateIndex
CREATE UNIQUE INDEX "jobs_source_externalId_key" ON "jobs"("source", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "job_parts_jobId_partId_key" ON "job_parts"("jobId", "partId");

-- CreateIndex
CREATE UNIQUE INDEX "job_type_rules_jobType_key" ON "job_type_rules"("jobType");

-- CreateIndex
CREATE INDEX "workload_forecast_daily_forecastRunId_date_idx" ON "workload_forecast_daily"("forecastRunId", "date");

-- CreateIndex
CREATE INDEX "parts_forecast_daily_forecastRunId_date_idx" ON "parts_forecast_daily"("forecastRunId", "date");

-- CreateIndex
CREATE INDEX "cost_forecast_daily_forecastRunId_date_idx" ON "cost_forecast_daily"("forecastRunId", "date");

-- CreateIndex
CREATE INDEX "sync_runs_source_startedAt_idx" ON "sync_runs"("source", "startedAt");

-- CreateIndex
CREATE INDEX "audit_events_entityType_entityId_idx" ON "audit_events"("entityType", "entityId");

-- AddForeignKey
ALTER TABLE "capacity_entries" ADD CONSTRAINT "capacity_entries_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "capacity_entries" ADD CONSTRAINT "capacity_entries_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "scenarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "part_stock_movements" ADD CONSTRAINT "part_stock_movements_partId_fkey" FOREIGN KEY ("partId") REFERENCES "parts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "part_stock_movements" ADD CONSTRAINT "part_stock_movements_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scenarios" ADD CONSTRAINT "scenarios_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scenarios" ADD CONSTRAINT "scenarios_copiedFromScheduleRevisionId_fkey" FOREIGN KEY ("copiedFromScheduleRevisionId") REFERENCES "schedule_revisions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_revisions" ADD CONSTRAINT "schedule_revisions_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "scenarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_parts" ADD CONSTRAINT "job_parts_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_parts" ADD CONSTRAINT "job_parts_partId_fkey" FOREIGN KEY ("partId") REFERENCES "parts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forecast_runs" ADD CONSTRAINT "forecast_runs_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "scenarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forecast_runs" ADD CONSTRAINT "forecast_runs_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workload_forecast_daily" ADD CONSTRAINT "workload_forecast_daily_forecastRunId_fkey" FOREIGN KEY ("forecastRunId") REFERENCES "forecast_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workload_forecast_daily" ADD CONSTRAINT "workload_forecast_daily_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parts_forecast_daily" ADD CONSTRAINT "parts_forecast_daily_forecastRunId_fkey" FOREIGN KEY ("forecastRunId") REFERENCES "forecast_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parts_forecast_daily" ADD CONSTRAINT "parts_forecast_daily_partId_fkey" FOREIGN KEY ("partId") REFERENCES "parts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cost_forecast_daily" ADD CONSTRAINT "cost_forecast_daily_forecastRunId_fkey" FOREIGN KEY ("forecastRunId") REFERENCES "forecast_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
