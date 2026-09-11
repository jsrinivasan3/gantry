import { prisma } from "@/server/db/client";
import { jobLaborHours } from "@/config/jobLaborHours";

export const DEFECT_CORRECTION_DAYS = 90;
export const DEFECT_AFFIRMATION_DAYS = 104;

/**
 * Boiler defect follow-up jobs (spec §10.3): a synced boiler report with
 * defects_exist = Yes gets a linked "Subsequent Inspection" job due within
 * 90 days, with a hard affirmation-of-correction deadline at 104 days
 * (surfaced as a warning, not a separate stored field — always derivable as
 * completedAt + 104 from the linked original job).
 */
export async function deriveDefectFollowups() {
  // Main Schedule only — a scenario's copy of a defective job already carries
  // its own copied follow-up (from scenario.create's deep copy), so deriving
  // again here against scenario-scoped rows would create a second, spurious
  // Main-Schedule-scoped follow-up for the same real defect.
  const defectiveJobs = await prisma.job.findMany({
    where: { scenarioId: null, source: "NYC_OPEN_DATA", defectsFound: true, completedAt: { not: null } },
  });

  let created = 0;
  for (const job of defectiveJobs) {
    const externalId = `${job.id}:defect-followup`;
    const existing = await prisma.job.findUnique({
      where: { source_externalId: { source: "DERIVED_RULE", externalId } },
    });
    if (existing) continue;

    const dueDate = new Date(job.completedAt!);
    dueDate.setUTCDate(dueDate.getUTCDate() + DEFECT_CORRECTION_DAYS);

    await prisma.job.create({
      data: {
        scenarioId: null,
        assetId: job.assetId,
        source: "DERIVED_RULE",
        externalId,
        jobType: "OTHER",
        title: "Subsequent Inspection (defect correction required)",
        status: "PLANNED",
        priority: "high",
        scheduledStart: new Date(job.completedAt!),
        scheduledEnd: dueDate,
        linkedJobId: job.id,
        estimatedLaborHours: jobLaborHours.OTHER ?? 0,
      },
    });
    created += 1;
  }

  return { defectiveJobsScanned: defectiveJobs.length, created };
}
