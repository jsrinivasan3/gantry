import type { JobType } from "@prisma/client";

import { prisma } from "@/server/db/client";
import { fetchAllSocrataRows, soqlInList } from "@/server/sync/nycOpenData/socrata";
import type { BoilerSafetyRow } from "@/server/sync/nycOpenData/types";
import { parseSocrataDate, withSyncRun, type SyncResult } from "@/server/sync/nycOpenData/upsert";

const DATASET_ID = "52dp-yji6";

function jobTypeForReport(row: BoilerSafetyRow): JobType {
  const pressure = row.pressure_type?.toLowerCase() ?? "";
  const reportType = row.report_type?.toLowerCase() ?? "";
  if (pressure.includes("low")) return "BOILER_PERIODIC";
  if (reportType.includes("external")) return "BOILER_EXTERNAL";
  if (reportType.includes("internal")) return "BOILER_INTERNAL";
  return "OTHER";
}

/**
 * Boiler safety sync (spec §2.3). One asset per distinct boiler_id, one
 * completed job per filed report. filing_fee/total_amount_paid are real $
 * figures, kept on the job (real_filing_fee) separate from any synthetic
 * labor/parts cost added later in M4/M5.
 */
export async function syncBoilerSafety(bins: readonly string[]): Promise<SyncResult> {
  return withSyncRun("NYC_DOB_BOILER_SAFETY", async () => {
    const rows = await fetchAllSocrataRows<BoilerSafetyRow>(DATASET_ID, {
      where: `bin_number in(${soqlInList(bins)})`,
    });

    let upserted = 0;
    for (const row of rows) {
      if (!row.boiler_id || !row.tracking_number) continue;

      const inspectionDate = parseSocrataDate(row.inspection_date) ?? new Date();

      const asset = await prisma.asset.upsert({
        where: {
          externalSource_externalId: {
            externalSource: "NYC_DOB_BOILER",
            externalId: row.boiler_id,
          },
        },
        create: {
          externalSource: "NYC_DOB_BOILER",
          externalId: row.boiler_id,
          assetType: "BOILER",
          displayName: `Boiler ${row.boiler_id} (${row.boiler_make ?? "unknown make"})`,
          bin: row.bin_number ?? null,
          status: row.report_status ?? "Unknown",
          metadata: row as object,
        },
        update: {
          status: row.report_status ?? "Unknown",
          metadata: row as object,
        },
      });

      const defectsFound = row.defects_exist?.toLowerCase() === "yes";

      await prisma.job.upsert({
        where: {
          source_externalId: {
            source: "NYC_OPEN_DATA",
            externalId: row.tracking_number,
          },
        },
        create: {
          scenarioId: null,
          assetId: asset.id,
          source: "NYC_OPEN_DATA",
          externalId: row.tracking_number,
          jobType: jobTypeForReport(row),
          title: `${row.report_type ?? "Boiler"} inspection — ${row.boiler_id}`,
          status: "COMPLETED",
          scheduledStart: inspectionDate,
          scheduledEnd: inspectionDate,
          completedAt: inspectionDate,
          defectsFound,
          realFilingFee: row.filing_fee ? row.filing_fee : null,
        },
        update: {
          defectsFound,
          realFilingFee: row.filing_fee ? row.filing_fee : null,
        },
      });
      upserted += 1;
    }

    return { recordsFetched: rows.length, recordsUpserted: upserted };
  });
}
