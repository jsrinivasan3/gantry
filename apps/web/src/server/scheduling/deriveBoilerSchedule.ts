import type { JobType } from "@prisma/client";

import { prisma } from "@/server/db/client";
import { attachJobParts } from "@/server/scheduling/attachJobParts";
import { jobLaborHours } from "@/config/jobLaborHours";

const RULE_BY_JOB_TYPE: Record<string, JobType[]> = {
  low: ["BOILER_PERIODIC"],
  high: ["BOILER_EXTERNAL", "BOILER_INTERNAL"],
};

/**
 * Derives the forward boiler schedule (spec §10.1): low-pressure boilers
 * recur annually off their latest completed inspection; high-pressure
 * boilers recur annually per external/internal, each derived independently
 * off the most recent *real, completed* report of that specific type. If no
 * report of that type has ever been filed (true for every high-pressure
 * boiler in the current sync scope — see docs/NYC_DATA_INGESTION.md), the
 * forward job is UNSCHEDULED rather than guessed (spec §4).
 */
export async function deriveBoilerSchedule() {
  const rules = await prisma.jobTypeRule.findMany({
    where: { jobType: { in: ["BOILER_PERIODIC", "BOILER_EXTERNAL", "BOILER_INTERNAL"] }, active: true },
  });
  const ruleByType = new Map(rules.map((r) => [r.jobType, r]));
  const assets = await prisma.asset.findMany({ where: { assetType: "BOILER" } });

  let created = 0;
  let updated = 0;
  let unscheduled = 0;

  for (const asset of assets) {
    const metadata = (asset.metadata ?? {}) as Record<string, string | undefined>;
    const pressure = metadata.pressure_type?.toLowerCase().includes("low") ? "low" : "high";
    const applicableTypes = RULE_BY_JOB_TYPE[pressure];

    for (const jobType of applicableTypes) {
      const rule = ruleByType.get(jobType);
      if (!rule) continue;

      const latestReport = await prisma.job.findFirst({
        where: {
          assetId: asset.id,
          jobType,
          source: "NYC_OPEN_DATA",
          status: "COMPLETED",
        },
        orderBy: { scheduledEnd: "desc" },
      });

      const externalId = `${asset.id}:${jobType}`;
      const existing = await prisma.job.findUnique({
        where: { source_externalId: { source: "DERIVED_RULE", externalId } },
      });
      if (existing && existing.status !== "PLANNED" && existing.status !== "UNSCHEDULED") {
        continue;
      }

      if (!latestReport) {
        const data = {
          assetId: asset.id,
          source: "DERIVED_RULE" as const,
          externalId,
          jobType,
          title: `${titleFor(jobType)} — needs manual date (no prior ${jobType} report on record)`,
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

      const nextDue = new Date(latestReport.scheduledEnd);
      nextDue.setUTCDate(nextDue.getUTCDate() + rule.intervalDays);

      const data = {
        assetId: asset.id,
        source: "DERIVED_RULE" as const,
        externalId,
        jobType,
        title: `${titleFor(jobType)} due`,
        status: "PLANNED" as const,
        scheduledStart: nextDue,
        scheduledEnd: nextDue,
        estimatedLaborHours: jobLaborHours[jobType] ?? 0,
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
      await attachJobParts(jobId, jobType);
    }
  }

  return { assetsProcessed: assets.length, created, updated, unscheduled };
}

function titleFor(jobType: JobType): string {
  switch (jobType) {
    case "BOILER_PERIODIC":
      return "Boiler annual inspection";
    case "BOILER_EXTERNAL":
      return "Boiler external inspection";
    case "BOILER_INTERNAL":
      return "Boiler internal inspection";
    default:
      return jobType;
  }
}
