import { prisma } from "@/server/db/client";
import { fetchAllSocrataRows, soqlInList } from "@/server/sync/nycOpenData/socrata";
import type { ElevatorComplianceRow } from "@/server/sync/nycOpenData/types";
import { toDecimalOrNull, withSyncRun, type SyncResult } from "@/server/sync/nycOpenData/upsert";

const DATASET_ID = "e5aq-a4j2";

/**
 * Elevator compliance sync (spec §2.1). One row per device; upserts the
 * `assets` row keyed on (externalSource, externalId=device_number). The raw
 * compliance fields (cat1_latest_report_filed, etc.) are kept verbatim in
 * `metadata` — they're the real inputs the M3 schedule-derivation engine
 * reads from, never fabricated here.
 */
export async function syncElevatorCompliance(bins: readonly string[]): Promise<SyncResult> {
  return withSyncRun("NYC_DOB_ELEVATOR_COMPLIANCE", async () => {
    const rows = await fetchAllSocrataRows<ElevatorComplianceRow>(DATASET_ID, {
      where: `bin in(${soqlInList(bins)})`,
    });

    let upserted = 0;
    for (const row of rows) {
      if (!row.device_number) continue;

      const addressParts = [row.house_number, row.street_name].filter(Boolean);
      await prisma.asset.upsert({
        where: {
          externalSource_externalId: {
            externalSource: "NYC_DOB_ELEVATOR",
            externalId: row.device_number,
          },
        },
        create: {
          externalSource: "NYC_DOB_ELEVATOR",
          externalId: row.device_number,
          assetType: "ELEVATOR",
          displayName: `${row.device_type ?? "Elevator"} ${row.device_number}`,
          bin: row.bin ?? null,
          borough: row.borough ?? null,
          address: addressParts.length ? `${addressParts.join(" ")}, ${row.zip_code ?? ""}`.trim() : null,
          latitude: toDecimalOrNull(row.latitude),
          longitude: toDecimalOrNull(row.longitude),
          status: row.device_status ?? "Unknown",
          metadata: row as object,
        },
        update: {
          displayName: `${row.device_type ?? "Elevator"} ${row.device_number}`,
          bin: row.bin ?? null,
          borough: row.borough ?? null,
          address: addressParts.length ? `${addressParts.join(" ")}, ${row.zip_code ?? ""}`.trim() : null,
          latitude: toDecimalOrNull(row.latitude),
          longitude: toDecimalOrNull(row.longitude),
          status: row.device_status ?? "Unknown",
          metadata: row as object,
        },
      });
      upserted += 1;
    }

    return { recordsFetched: rows.length, recordsUpserted: upserted };
  });
}
