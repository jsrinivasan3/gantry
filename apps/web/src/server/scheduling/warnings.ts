import { prisma } from "@/server/db/client";
import { DEFECT_AFFIRMATION_DAYS } from "@/server/scheduling/deriveDefectFollowups";

export interface Warning {
  code: "compliance_overdue" | "defect_correction_deadline_approaching";
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

/**
 * Spec §11 warnings, computed at read time rather than stored — they're a
 * pure function of the current Main Schedule, so persisting them would just
 * be a cache to keep in sync for no benefit at this scale.
 *
 * `same_asset_overlap`, `team_over_capacity`, `unassigned_team`,
 * `part_stockout_before_job`, and `missing_part_cost` need teams/capacity/
 * parts (M4) and are deferred to that milestone — see docs/MILESTONES.md.
 */
export async function computeWarnings(scenarioId: string | null): Promise<Warning[]> {
  const jobs = await prisma.job.findMany({ where: { scenarioId } });

  const warnings: Warning[] = [];
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

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

    if (job.source === "DERIVED_RULE" && job.linkedJobId && job.status !== "COMPLETED") {
      const correctionDue = job.scheduledEnd;
      const affirmationDue = new Date(correctionDue);
      affirmationDue.setUTCDate(
        affirmationDue.getUTCDate() + (DEFECT_AFFIRMATION_DAYS - 90)
      );

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

  return warnings;
}
