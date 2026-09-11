import { prisma } from "@/server/db/client";

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
  const defectiveJobs = await prisma.job.findMany({
    where: { source: "NYC_OPEN_DATA", defectsFound: true, completedAt: { not: null } },
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
      },
    });
    created += 1;
  }

  return { defectiveJobsScanned: defectiveJobs.length, created };
}
