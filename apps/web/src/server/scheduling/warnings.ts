import { prisma } from "@/server/db/client";
import { DEFECT_AFFIRMATION_DAYS } from "@/server/scheduling/deriveDefectFollowups";

export type WarningCode =
  | "compliance_overdue"
  | "defect_correction_deadline_approaching"
  | "same_asset_overlap"
  | "team_over_capacity"
  | "unassigned_team"
  | "part_stockout_before_job"
  | "missing_part_cost";

export interface Warning {
  code: WarningCode;
  jobId: string;
  assetId: string;
  message: string;
  dueDate: Date;
}

const COMPLIANCE_JOB_TYPES = [
  "CAT1_TEST",
  "CAT5_TEST",
  "PERIODIC_INSPECTION",
  "BOILER_PERIODIC",
  "BOILER_EXTERNAL",
  "BOILER_INTERNAL",
] as const;

const OPEN_STATUSES = ["PLANNED", "IN_PROGRESS"] as const;
const UNASSIGNED_HORIZON_DAYS = 30;

/**
 * Spec §11 warnings, computed at read time rather than stored — they're a
 * pure function of the current schedule (Main or a scenario), so
 * persisting them would just be a cache to keep in sync for no benefit at
 * this scale.
 */
export async function computeWarnings(scenarioId: string | null): Promise<Warning[]> {
  const jobs = await prisma.job.findMany({
    where: { scenarioId },
    include: { jobParts: { include: { part: true } } },
  });

  const warnings: Warning[] = [];
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const unassignedHorizon = new Date(today);
  unassignedHorizon.setUTCDate(unassignedHorizon.getUTCDate() + UNASSIGNED_HORIZON_DAYS);

  const openJobs = jobs.filter((j) => (OPEN_STATUSES as readonly string[]).includes(j.status));

  // --- compliance_overdue ---
  for (const job of jobs) {
    if (
      job.status === "PLANNED" &&
      COMPLIANCE_JOB_TYPES.includes(job.jobType as (typeof COMPLIANCE_JOB_TYPES)[number]) &&
      job.scheduledEnd < today
    ) {
      warnings.push({
        code: "compliance_overdue",
        jobId: job.id,
        assetId: job.assetId,
        message: `${job.title} is overdue (was due ${job.scheduledEnd.toISOString().slice(0, 10)})`,
        dueDate: job.scheduledEnd,
      });
    }
  }

  // --- defect_correction_deadline_approaching ---
  for (const job of jobs) {
    if (job.source === "DERIVED_RULE" && job.linkedJobId && job.status !== "COMPLETED") {
      const correctionDue = job.scheduledEnd;
      const affirmationDue = new Date(correctionDue);
      affirmationDue.setUTCDate(affirmationDue.getUTCDate() + (DEFECT_AFFIRMATION_DAYS - 90));

      for (const [label, due] of [
        ["correction", correctionDue],
        ["affirmation filing", affirmationDue],
      ] as const) {
        const daysUntil = Math.floor((due.getTime() - today.getTime()) / 86_400_000);
        if (daysUntil <= 14) {
          warnings.push({
            code: "defect_correction_deadline_approaching",
            jobId: job.id,
            assetId: job.assetId,
            message:
              daysUntil < 0
                ? `${job.title}: ${label} deadline passed (${due.toISOString().slice(0, 10)})`
                : `${job.title}: ${label} deadline in ${daysUntil} day(s) (${due.toISOString().slice(0, 10)})`,
            dueDate: due,
          });
        }
      }
    }
  }

  // --- same_asset_overlap: two open jobs on the same device with overlapping dates ---
  const byAsset = new Map<string, typeof openJobs>();
  for (const job of openJobs) {
    if (!byAsset.has(job.assetId)) byAsset.set(job.assetId, []);
    byAsset.get(job.assetId)!.push(job);
  }
  for (const assetJobs of byAsset.values()) {
    const sorted = [...assetJobs].sort((a, b) => a.scheduledStart.getTime() - b.scheduledStart.getTime());
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const curr = sorted[i];
      if (curr.scheduledStart <= prev.scheduledEnd) {
        warnings.push({
          code: "same_asset_overlap",
          jobId: curr.id,
          assetId: curr.assetId,
          message: `"${curr.title}" overlaps "${prev.title}" on the same device`,
          dueDate: curr.scheduledStart,
        });
      }
    }
  }

  // --- unassigned_team: open jobs due soon with no team assigned ---
  for (const job of openJobs) {
    if (job.teamId === null && job.scheduledStart <= unassignedHorizon) {
      warnings.push({
        code: "unassigned_team",
        jobId: job.id,
        assetId: job.assetId,
        message: `"${job.title}" is due within ${UNASSIGNED_HORIZON_DAYS} days with no team assigned`,
        dueDate: job.scheduledStart,
      });
    }
  }

  // --- team_over_capacity: a team's total demand on a day exceeds its capacity ---
  const capacityEntries = await prisma.capacityEntry.findMany({
    where: { OR: [{ scenarioId }, { scenarioId: null }] },
    orderBy: { effectiveDate: "asc" },
  });
  function capacityFor(teamId: string, date: Date): number {
    const entries = capacityEntries.filter((c) => c.teamId === teamId && c.effectiveDate <= date);
    const scoped = entries.filter((c) => c.scenarioId === scenarioId);
    const pool = scoped.length > 0 ? scoped : entries.filter((c) => c.scenarioId === null);
    const latest = pool.at(-1);
    return latest ? latest.headcount * Number(latest.hoursPerPerson) : 0;
  }
  const demandByTeamDay = new Map<string, { hours: number; jobId: string }>();
  for (const job of openJobs) {
    if (!job.teamId) continue;
    const key = `${job.teamId}::${job.scheduledStart.toISOString().slice(0, 10)}`;
    const existing = demandByTeamDay.get(key);
    demandByTeamDay.set(key, { hours: (existing?.hours ?? 0) + Number(job.estimatedLaborHours), jobId: job.id });
  }
  for (const [key, { hours, jobId }] of demandByTeamDay) {
    const [teamId, dateStr] = key.split("::");
    const capacity = capacityFor(teamId, new Date(dateStr));
    if (capacity > 0 && hours > capacity) {
      const job = openJobs.find((j) => j.id === jobId)!;
      warnings.push({
        code: "team_over_capacity",
        jobId,
        assetId: job.assetId,
        message: `Team demand on ${dateStr} (${hours}h) exceeds capacity (${capacity}h)`,
        dueDate: new Date(dateStr),
      });
    }
  }

  // --- part_stockout_before_job / missing_part_cost ---
  // Bounded to a near-term horizon: with no reorder-lead-time cutoff, a
  // part that ever depletes (correctly, per the parts *forecast*) would
  // flag every subsequent job for the rest of the schedule — hundreds of
  // warnings that are true but not actionable. A warning should mean
  // "do something now," so only an imminent stockout (within the window
  // there's realistically time to react to) is worth surfacing here.
  const STOCKOUT_HORIZON_DAYS = 90;
  const stockoutHorizon = new Date(today);
  stockoutHorizon.setUTCDate(stockoutHorizon.getUTCDate() + STOCKOUT_HORIZON_DAYS);

  const partRunningStock = new Map<string, number>();
  const jobsWithParts = openJobs
    .filter((j) => j.jobParts.length > 0 && j.scheduledStart >= today && j.scheduledStart <= stockoutHorizon)
    .sort((a, b) => a.scheduledStart.getTime() - b.scheduledStart.getTime());
  for (const job of jobsWithParts) {
    for (const jp of job.jobParts) {
      if (Number(jp.part.unitCost) <= 0) {
        warnings.push({
          code: "missing_part_cost",
          jobId: job.id,
          assetId: job.assetId,
          message: `Part "${jp.part.name}" has no unit cost set`,
          dueDate: job.scheduledStart,
        });
      }

      const running = partRunningStock.has(jp.partId) ? partRunningStock.get(jp.partId)! : jp.part.onHandCount;
      const remaining = running - jp.quantityPlanned;
      partRunningStock.set(jp.partId, remaining);
      if (remaining < 0) {
        warnings.push({
          code: "part_stockout_before_job",
          jobId: job.id,
          assetId: job.assetId,
          message: `"${job.title}" needs "${jp.part.name}" but projected stock runs out before this date`,
          dueDate: job.scheduledStart,
        });
      }
    }
  }

  return warnings;
}
