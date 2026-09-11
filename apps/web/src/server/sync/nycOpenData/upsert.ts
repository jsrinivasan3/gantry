import type { SyncSource } from "@prisma/client";

import { prisma } from "@/server/db/client";

export interface SyncResult {
  recordsFetched: number;
  recordsUpserted: number;
}

/**
 * Wraps a fetcher+upsert function with a sync_runs log entry (spec §2.4):
 * started_at/completed_at, counts, and failures surfaced rather than silent.
 */
export async function withSyncRun(
  source: SyncSource,
  run: () => Promise<SyncResult>
) {
  const syncRun = await prisma.syncRun.create({
    data: { source, status: "RUNNING" },
  });

  try {
    const result = await run();
    await prisma.syncRun.update({
      where: { id: syncRun.id },
      data: {
        status: "SUCCESS",
        completedAt: new Date(),
        recordsFetched: result.recordsFetched,
        recordsUpserted: result.recordsUpserted,
      },
    });
    return { ...result, syncRunId: syncRun.id };
  } catch (error) {
    await prisma.syncRun.update({
      where: { id: syncRun.id },
      data: {
        status: "FAILED",
        completedAt: new Date(),
        errorMessage: error instanceof Error ? error.message : String(error),
      },
    });
    throw error;
  }
}

/** Parses a Socrata "MM/DD/YYYY..." or ISO date string into a Date, or null. */
export function parseSocrataDate(value: string | undefined | null): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function toDecimalOrNull(value: string | undefined | null): string | null {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(value);
  return Number.isNaN(n) ? null : value;
}
