import { prisma } from "@/server/db/client";
import { dayKey, eachDay, OPEN_STATUSES } from "@/server/forecasting/shared";

export interface WorkloadRow {
  date: Date;
  teamId: string | null;
  demandHours: number;
  capacityHours: number;
  demandKind: "scheduled" | "reactive";
}

/**
 * Workload forecast (spec §12): demand vs. capacity per team per day, split
 * into two series — scheduled (regulatory-cadence, predictable) vs. reactive
 * (violation-repair, the "noisy" demand on top of it). Capacity resolves a
 * scenario-specific CapacityEntry if one exists for a team, else falls back
 * to the Main Schedule's (scenarioId = null) capacity.
 */
export async function computeWorkloadForecast(
  scenarioId: string,
  startDate: Date,
  endDate: Date
): Promise<WorkloadRow[]> {
  const jobs = await prisma.job.findMany({
    where: {
      scenarioId,
      status: { in: OPEN_STATUSES },
      scheduledStart: { gte: startDate, lte: endDate },
    },
    select: { scheduledStart: true, teamId: true, estimatedLaborHours: true, jobType: true },
  });

  const capacityEntries = await prisma.capacityEntry.findMany({
    where: { OR: [{ scenarioId }, { scenarioId: null }] },
    orderBy: { effectiveDate: "asc" },
  });

  const teams = await prisma.team.findMany({ where: { active: true } });

  function capacityFor(teamId: string, date: Date): number {
    const entries = capacityEntries.filter((c) => c.teamId === teamId && c.effectiveDate <= date);
    // Prefer the latest scenario-specific entry; else the latest global one.
    const scenarioEntries = entries.filter((c) => c.scenarioId === scenarioId);
    const pool = scenarioEntries.length > 0 ? scenarioEntries : entries.filter((c) => c.scenarioId === null);
    const latest = pool.at(-1);
    return latest ? latest.headcount * Number(latest.hoursPerPerson) : 0;
  }

  const demandByKey = new Map<string, { scheduled: number; reactive: number }>();
  for (const job of jobs) {
    const key = `${dayKey(job.scheduledStart)}::${job.teamId ?? "unassigned"}`;
    const bucket = demandByKey.get(key) ?? { scheduled: 0, reactive: 0 };
    const hours = Number(job.estimatedLaborHours);
    if (job.jobType === "VIOLATION_REPAIR") bucket.reactive += hours;
    else bucket.scheduled += hours;
    demandByKey.set(key, bucket);
  }

  const rows: WorkloadRow[] = [];
  const days = eachDay(startDate, endDate);
  for (const date of days) {
    for (const team of teams) {
      const key = `${dayKey(date)}::${team.id}`;
      const bucket = demandByKey.get(key) ?? { scheduled: 0, reactive: 0 };
      const capacity = capacityFor(team.id, date);
      // Always emit the "scheduled" row (even at 0 demand) so capacity is
      // tracked every day a team is active — otherwise a day with only
      // reactive demand (or none at all) would silently lose its capacity
      // line in the chart.
      rows.push({ date, teamId: team.id, demandHours: bucket.scheduled, capacityHours: capacity, demandKind: "scheduled" });
      if (bucket.reactive > 0) {
        rows.push({ date, teamId: team.id, demandHours: bucket.reactive, capacityHours: 0, demandKind: "reactive" });
      }
    }
    // Unassigned demand (teamId null) — no capacity to compare against, flagged separately as a warning.
    const unassignedKey = `${dayKey(date)}::unassigned`;
    const bucket = demandByKey.get(unassignedKey);
    if (bucket) {
      if (bucket.scheduled > 0) rows.push({ date, teamId: null, demandHours: bucket.scheduled, capacityHours: 0, demandKind: "scheduled" });
      if (bucket.reactive > 0) rows.push({ date, teamId: null, demandHours: bucket.reactive, capacityHours: 0, demandKind: "reactive" });
    }
  }

  return rows;
}
