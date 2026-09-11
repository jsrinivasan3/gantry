import type { JobType } from "@prisma/client";

import { prisma } from "@/server/db/client";
import { attachJobParts } from "@/server/scheduling/attachJobParts";

const ELEVATOR_RULE_TYPES: JobType[] = ["CAT1_TEST", "CAT5_TEST", "PERIODIC_INSPECTION"];

/**
 * Derives the forward elevator schedule (spec §10.1) from the real
 * compliance fields stored verbatim in Asset.metadata by the sync module.
 * One forward job per (asset, job_type), upserted on a synthetic
 * externalId so re-running this after a fresh sync always reflects the
 * latest real filing — never fabricates a date when the source field is
 * null; creates an UNSCHEDULED "needs manual entry" job instead (spec §4).
 */
export async function deriveElevatorSchedule() {
  const rules = await prisma.jobTypeRule.findMany({
    where: { jobType: { in: ELEVATOR_RULE_TYPES }, active: true },
  });
  const assets = await prisma.asset.findMany({
    where: { assetType: "ELEVATOR", status: { not: "Removed" } },
  });

  let created = 0;
  let updated = 0;
  let unscheduled = 0;

  for (const asset of assets) {
    const metadata = (asset.metadata ?? {}) as Record<string, string | undefined>;

    for (const rule of rules) {
      const externalId = `${asset.id}:${rule.jobType}`;
      const rawDate = metadata[rule.sourceField];
      const filedDate = rawDate ? new Date(rawDate) : null;
      const hasValidDate = filedDate && !Number.isNaN(filedDate.getTime());

      const existing = await prisma.job.findUnique({
        where: { source_externalId: { source: "DERIVED_RULE", externalId } },
      });

      // Never overwrite a job that's already in progress/completed/cancelled —
      // only keep re-deriving while it's still an open forward placeholder.
      if (existing && existing.status !== "PLANNED" && existing.status !== "UNSCHEDULED") {
        continue;
      }

      if (!hasValidDate) {
        const data = {
          assetId: asset.id,
          source: "DERIVED_RULE" as const,
          externalId,
          jobType: rule.jobType,
          title: `${titleFor(rule.jobType)} — needs manual date (no ${rule.sourceField} on record)`,
          status: "UNSCHEDULED" as const,
          scheduledStart: new Date(),
          scheduledEnd: new Date(),
        };
        if (existing) {
          await prisma.job.update({ where: { id: existing.id }, data });
          updated += 1;
        } else {
          await prisma.job.create({ data });
          created += 1;
        }
        unscheduled += 1;
        continue;
      }

      const nextDue = new Date(filedDate!);
      nextDue.setUTCDate(nextDue.getUTCDate() + rule.intervalDays);

      const data = {
        assetId: asset.id,
        source: "DERIVED_RULE" as const,
        externalId,
        jobType: rule.jobType,
        title: `${titleFor(rule.jobType)} due`,
        status: "PLANNED" as const,
        scheduledStart: nextDue,
        scheduledEnd: nextDue,
      };
      let jobId: string;
      if (existing) {
        await prisma.job.update({ where: { id: existing.id }, data });
        jobId = existing.id;
        updated += 1;
      } else {
        const job = await prisma.job.create({ data });
        jobId = job.id;
        created += 1;
      }
      await attachJobParts(jobId, rule.jobType);
    }
  }

  return { assetsProcessed: assets.length, created, updated, unscheduled };
}

function titleFor(jobType: JobType): string {
  switch (jobType) {
    case "CAT1_TEST":
      return "CAT1 annual safety test";
    case "CAT5_TEST":
      return "CAT5 full-load test";
    case "PERIODIC_INSPECTION":
      return "Periodic inspection";
    default:
      return jobType;
  }
}
