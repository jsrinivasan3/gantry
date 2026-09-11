import { addDays } from "date-fns";

import { prisma } from "@/server/db/client";
import { dayKey, eachDay, OPEN_STATUSES } from "@/server/forecasting/shared";

export interface PartsRow {
  date: Date;
  partId: string;
  projectedOnHand: number;
  projectedConsumption: number;
  stockoutRisk: boolean;
  suggestedReorderDate: Date | null;
  suggestedReorderQuantity: number | null;
}

/**
 * Parts forecast (spec §12): projected on-hand/consumption/stockout per
 * part per day, walking forward from the part's current on-hand count and
 * subtracting the planned consumption of every open job scheduled that day.
 * `suggestedReorderDate` backs off the part's lead time from the day
 * on-hand would first drop below its reorder point — so there's still time
 * to receive stock before the shortfall.
 */
export async function computePartsForecast(
  scenarioId: string,
  startDate: Date,
  endDate: Date
): Promise<PartsRow[]> {
  const parts = await prisma.part.findMany({ where: { active: true } });

  const jobParts = await prisma.jobPart.findMany({
    where: {
      job: {
        scenarioId,
        status: { in: OPEN_STATUSES },
        scheduledStart: { gte: startDate, lte: endDate },
      },
    },
    select: { partId: true, quantityPlanned: true, job: { select: { scheduledStart: true } } },
  });

  const consumptionByKey = new Map<string, number>();
  for (const jp of jobParts) {
    const key = `${jp.partId}::${dayKey(jp.job.scheduledStart)}`;
    consumptionByKey.set(key, (consumptionByKey.get(key) ?? 0) + jp.quantityPlanned);
  }

  const days = eachDay(startDate, endDate);
  const rows: PartsRow[] = [];

  for (const part of parts) {
    let onHand = part.onHandCount;
    let reorderTriggerDate: Date | null = null;

    for (const date of days) {
      const consumption = consumptionByKey.get(`${part.id}::${dayKey(date)}`) ?? 0;
      onHand -= consumption;

      if (reorderTriggerDate === null && onHand < part.reorderPoint) {
        reorderTriggerDate = date;
      }

      rows.push({
        date,
        partId: part.id,
        projectedOnHand: Math.max(onHand, 0),
        projectedConsumption: consumption,
        stockoutRisk: onHand <= 0,
        suggestedReorderDate: null,
        suggestedReorderQuantity: null,
      });
    }

    if (reorderTriggerDate) {
      const rawSuggestedDate = addDays(reorderTriggerDate, -part.leadTimeDays);
      const suggestedDate = rawSuggestedDate < days[0] ? days[0] : rawSuggestedDate;
      // Attach the suggestion to the row for the day it should actually happen on.
      const targetRow = rows.find((r) => r.partId === part.id && r.date.getTime() === suggestedDate.getTime());
      if (targetRow) {
        targetRow.suggestedReorderDate = suggestedDate;
        targetRow.suggestedReorderQuantity = part.reorderQuantity;
      }
    }
  }

  return rows;
}
