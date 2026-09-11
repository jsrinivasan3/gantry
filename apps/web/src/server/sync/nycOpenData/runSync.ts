import { prisma } from "@/server/db/client";
import { defaultSyncScope } from "@/config/syncScope";
import { syncElevatorCompliance } from "@/server/sync/nycOpenData/elevatorCompliance";
import { syncElevatorViolations } from "@/server/sync/nycOpenData/elevatorViolations";
import { syncBoilerSafety } from "@/server/sync/nycOpenData/boilerSafety";

export async function getSyncScope() {
  const config = await prisma.syncConfig.upsert({
    where: { id: "singleton" },
    update: {},
    create: { id: "singleton", borough: defaultSyncScope.borough, bins: [...defaultSyncScope.bins] },
  });
  return config;
}

/**
 * Runs all three NYC Open Data fetchers in dependency order: elevator
 * compliance first (creates the elevator assets that violations attach to),
 * then violations, then boiler safety (independent). Each is individually
 * logged in sync_runs and idempotent, so a partial failure doesn't corrupt
 * state — re-running the whole sync is always safe.
 */
export async function runFullSync() {
  const scope = await getSyncScope();
  const bins = scope.bins;

  const elevatorCompliance = await syncElevatorCompliance(bins);
  const elevatorViolations = await syncElevatorViolations(bins);
  const boilerSafety = await syncBoilerSafety(bins);

  return { elevatorCompliance, elevatorViolations, boilerSafety };
}

export type SyncSourceKey = "elevatorCompliance" | "elevatorViolations" | "boilerSafety";

export async function runSingleSync(sourceKey: SyncSourceKey) {
  const scope = await getSyncScope();
  switch (sourceKey) {
    case "elevatorCompliance":
      return syncElevatorCompliance(scope.bins);
    case "elevatorViolations":
      return syncElevatorViolations(scope.bins);
    case "boilerSafety":
      return syncBoilerSafety(scope.bins);
  }
}
