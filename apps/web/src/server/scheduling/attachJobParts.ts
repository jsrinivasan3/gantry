import type { JobType } from "@prisma/client";

import { prisma } from "@/server/db/client";
import { jobPartsCatalog } from "@/config/jobPartsCatalog";

/** Idempotently attaches the synthetic BOM for a job type to a job (spec §2.5/§14). */
export async function attachJobParts(jobId: string, jobType: JobType) {
  const lines = jobPartsCatalog[jobType];
  if (!lines || lines.length === 0) return;

  const parts = await prisma.part.findMany({ where: { sku: { in: lines.map((l) => l.sku) } } });
  const partBySku = new Map(parts.map((p) => [p.sku, p]));

  for (const line of lines) {
    const part = partBySku.get(line.sku);
    if (!part) continue;
    await prisma.jobPart.upsert({
      where: { jobId_partId: { jobId, partId: part.id } },
      update: {},
      create: { jobId, partId: part.id, quantityPlanned: line.quantity },
    });
  }
}
