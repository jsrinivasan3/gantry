import { prisma } from "@/server/db/client";
import { fetchAllSocrataRows, soqlInList } from "@/server/sync/nycOpenData/socrata";
import type { ElevatorViolationRow } from "@/server/sync/nycOpenData/types";
import { withSyncRun, type SyncResult } from "@/server/sync/nycOpenData/upsert";
import { attachJobParts } from "@/server/scheduling/attachJobParts";
import { jobLaborHours } from "@/config/jobLaborHours";

const DATASET_ID = "dedp-nh8d";

const BORO_CODE_NAMES: Record<string, string> = {
  "1": "Manhattan",
  "2": "Bronx",
  "3": "Brooklyn",
  "4": "Queens",
  "5": "Staten Island",
};

/**
 * Elevator violations sync (spec §2.2 + rule §10.2): an open, active
 * violation with no existing violation_repair job for its violation_number
 * becomes one — scheduled_start = today, status = planned, high priority.
 * Upserted on (source, externalId=violation_number) so re-sync never
 * duplicates a job for the same violation.
 */
export async function syncElevatorViolations(bins: readonly string[]): Promise<SyncResult> {
  return withSyncRun("NYC_DOB_ELEVATOR_VIOLATIONS", async () => {
    const rows = await fetchAllSocrataRows<ElevatorViolationRow>(DATASET_ID, {
      where: `bin in(${soqlInList(bins)}) AND violation_category like '%ACTIVE%'`,
    });

    let upserted = 0;
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    for (const row of rows) {
      if (!row.violation_number || !row.device_number) continue;

      // The violations dataset sometimes references a device_number not present
      // in the compliance dataset (e.g. an older/decommissioned device that
      // still has an open violation on file). Rather than drop a real,
      // active violation, create a minimal asset from the violation row
      // itself so the corrective job still has somewhere to attach.
      const asset = await prisma.asset.upsert({
        where: {
          externalSource_externalId: {
            externalSource: "NYC_DOB_ELEVATOR",
            externalId: row.device_number,
          },
        },
        update: {},
        create: {
          externalSource: "NYC_DOB_ELEVATOR",
          externalId: row.device_number,
          assetType: "ELEVATOR",
          displayName: `Elevator ${row.device_number}`,
          bin: row.bin ?? null,
          borough: row.boro ? (BORO_CODE_NAMES[row.boro] ?? null) : null,
          address: row.house_number && row.street ? `${row.house_number} ${row.street}` : null,
          status: "Unknown (not in compliance dataset)",
          metadata: { source_row: row } as object,
        },
      });

      const violationLabel = (row.violation_type ?? row.violation_number).replace(/\s+/g, " ").trim();

      const job = await prisma.job.upsert({
        where: {
          source_externalId: {
            source: "NYC_OPEN_DATA",
            externalId: row.violation_number,
          },
        },
        create: {
          scenarioId: null,
          assetId: asset.id,
          source: "NYC_OPEN_DATA",
          externalId: row.violation_number,
          jobType: "VIOLATION_REPAIR",
          title: `Violation repair: ${violationLabel}`,
          status: "PLANNED",
          scheduledStart: today,
          scheduledEnd: today,
          priority: "high",
          estimatedLaborHours: jobLaborHours.VIOLATION_REPAIR ?? 0,
        },
        // Never overwrite planning changes (dates/team/status) an Admin has
        // since made to this job on re-sync — only the identity fields.
        update: {
          title: `Violation repair: ${violationLabel}`,
        },
      });
      await attachJobParts(job.id, "VIOLATION_REPAIR");
      upserted += 1;
    }

    return { recordsFetched: rows.length, recordsUpserted: upserted };
  });
}
