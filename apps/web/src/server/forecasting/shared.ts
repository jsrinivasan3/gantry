import type { JobStatus } from "@prisma/client";
import { addDays, differenceInCalendarDays, formatISO, startOfDay } from "date-fns";

export function eachDay(start: Date, end: Date): Date[] {
  const days: Date[] = [];
  const total = differenceInCalendarDays(end, start);
  for (let i = 0; i <= total; i++) days.push(addDays(startOfDay(start), i));
  return days;
}

export function dayKey(d: Date): string {
  return formatISO(d, { representation: "date" });
}

/** Jobs still open (not yet resolved) are the only ones with real future demand. */
export const OPEN_STATUSES: JobStatus[] = ["PLANNED", "IN_PROGRESS"];
