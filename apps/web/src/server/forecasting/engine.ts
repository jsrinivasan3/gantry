import { createHash } from "node:crypto";

import { prisma } from "@/server/db/client";
import { computeWorkloadForecast } from "@/server/forecasting/workloadForecast";
import { computePartsForecast } from "@/server/forecasting/partsForecast";
import { computeCostForecast } from "@/server/forecasting/costForecast";

export const ENGINE_VERSION = "1.0.0";

async function computeInputHash(scenarioId: string) {
  const jobs = await prisma.job.findMany({
    where: { scenarioId },
    select: { id: true, updatedAt: true },
    orderBy: { id: "asc" },
  });
  const digest = createHash("sha256");
  for (const j of jobs) digest.update(`${j.id}:${j.updatedAt.toISOString()}`);
  return digest.digest("hex");
}

/**
 * Runs the full workload/parts/cost forecast for a scenario over a date
 * range and persists it as a ForecastRun + its three daily tables (spec
 * §12). Traceable by design: engineVersion + inputHash are stamped on the
 * run so a re-run with unchanged inputs is identifiable.
 */
export async function runForecast(scenarioId: string, createdByUserId: string, startDate: Date, endDate: Date) {
  const scenario = await prisma.scenario.findUniqueOrThrow({ where: { id: scenarioId } });
  const inputHash = await computeInputHash(scenarioId);

  const run = await prisma.forecastRun.create({
    data: {
      scenarioId,
      createdByUserId,
      status: "RUNNING",
      startDate,
      endDate,
      scenarioInputRevision: scenario.inputRevision,
      inputHash,
      engineVersion: ENGINE_VERSION,
      startedAt: new Date(),
    },
  });

  try {
    const [workload, parts, cost] = await Promise.all([
      computeWorkloadForecast(scenarioId, startDate, endDate),
      computePartsForecast(scenarioId, startDate, endDate),
      computeCostForecast(scenarioId, startDate, endDate),
    ]);

    if (workload.length) {
      await prisma.workloadForecastDaily.createMany({
        data: workload.map((w) => ({ forecastRunId: run.id, ...w, demandHours: w.demandHours, capacityHours: w.capacityHours })),
      });
    }
    if (parts.length) {
      await prisma.partsForecastDaily.createMany({
        data: parts.map((p) => ({ forecastRunId: run.id, ...p })),
      });
    }
    if (cost.length) {
      await prisma.costForecastDaily.createMany({
        data: cost.map((c) => ({ forecastRunId: run.id, ...c })),
      });
    }

    return prisma.forecastRun.update({
      where: { id: run.id },
      data: { status: "COMPLETED", completedAt: new Date() },
    });
  } catch (error) {
    await prisma.forecastRun.update({
      where: { id: run.id },
      data: {
        status: "FAILED",
        completedAt: new Date(),
        failureMessage: error instanceof Error ? error.message : String(error),
      },
    });
    throw error;
  }
}
