import { prisma } from "@/server/db/client";
import { dayKey, eachDay, OPEN_STATUSES } from "@/server/forecasting/shared";

export interface CostRow {
  date: Date;
  laborCost: number;
  partsCost: number;
  realFilingFeeCost: number;
  cumulativeCost: number;
}

/**
 * Cost forecast (spec §12): synthetic labor + parts cost kept as separate
 * columns from real boiler filing fees — never blended into one number.
 * Labor cost only accrues for jobs with a team assigned (a job with no
 * team has an unknown rate — surfaced by the `unassigned_team` warning
 * rather than guessed at here). Real filing fees only appear on completed
 * boiler jobs actually filed in this scenario's copy of history — there is
 * no synthetic estimate for a not-yet-filed future report.
 */
export async function computeCostForecast(scenarioId: string, startDate: Date, endDate: Date): Promise<CostRow[]> {
  const openJobs = await prisma.job.findMany({
    where: {
      scenarioId,
      status: { in: OPEN_STATUSES },
      scheduledStart: { gte: startDate, lte: endDate },
      teamId: { not: null },
    },
    select: { scheduledStart: true, estimatedLaborHours: true, team: { select: { hourlyRate: true } } },
  });

  const jobParts = await prisma.jobPart.findMany({
    where: {
      job: { scenarioId, status: { in: OPEN_STATUSES }, scheduledStart: { gte: startDate, lte: endDate } },
    },
    select: { quantityPlanned: true, part: { select: { unitCost: true } }, job: { select: { scheduledStart: true } } },
  });

  const filedBoilerJobs = await prisma.job.findMany({
    where: {
      scenarioId,
      status: "COMPLETED",
      realFilingFee: { not: null },
      scheduledEnd: { gte: startDate, lte: endDate },
    },
    select: { scheduledEnd: true, realFilingFee: true },
  });

  const laborByDay = new Map<string, number>();
  for (const job of openJobs) {
    const key = dayKey(job.scheduledStart);
    laborByDay.set(key, (laborByDay.get(key) ?? 0) + Number(job.estimatedLaborHours) * Number(job.team!.hourlyRate));
  }

  const partsByDay = new Map<string, number>();
  for (const jp of jobParts) {
    const key = dayKey(jp.job.scheduledStart);
    partsByDay.set(key, (partsByDay.get(key) ?? 0) + jp.quantityPlanned * Number(jp.part.unitCost));
  }

  const filingFeeByDay = new Map<string, number>();
  for (const job of filedBoilerJobs) {
    const key = dayKey(job.scheduledEnd);
    filingFeeByDay.set(key, (filingFeeByDay.get(key) ?? 0) + Number(job.realFilingFee));
  }

  const rows: CostRow[] = [];
  let cumulative = 0;
  for (const date of eachDay(startDate, endDate)) {
    const key = dayKey(date);
    const laborCost = laborByDay.get(key) ?? 0;
    const partsCost = partsByDay.get(key) ?? 0;
    const realFilingFeeCost = filingFeeByDay.get(key) ?? 0;
    cumulative += laborCost + partsCost + realFilingFeeCost;
    rows.push({ date, laborCost, partsCost, realFilingFeeCost, cumulativeCost: cumulative });
  }

  return rows;
}
