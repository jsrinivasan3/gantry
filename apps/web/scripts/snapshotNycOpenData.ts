/**
 * One-time pull of the same curated scope from the live NYC Open Data
 * endpoints, dumped to sample-data/nyc-open-data-snapshot/*.csv as an
 * offline-dev fallback (spec §2.4). This is a safety net, not the primary
 * path — the primary path is the live sync in server/sync/nycOpenData/.
 *
 * Run with: npx tsx scripts/snapshotNycOpenData.ts
 */
import { writeFileSync } from "node:fs";
import path from "node:path";

import { defaultSyncScope } from "../src/config/syncScope";
import { fetchAllSocrataRows, soqlInList } from "../src/server/sync/nycOpenData/socrata";

const OUT_DIR = path.resolve(__dirname, "../../../sample-data/nyc-open-data-snapshot");

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Array.from(rows.reduce((set, row) => {
    Object.keys(row).forEach((k) => set.add(k));
    return set;
  }, new Set<string>()));

  const escape = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => escape(row[h])).join(","));
  }
  return lines.join("\n");
}

async function main() {
  const bins = defaultSyncScope.bins;

  const elevatorCompliance = await fetchAllSocrataRows<Record<string, unknown>>("e5aq-a4j2", {
    where: `bin in(${soqlInList(bins)})`,
  });
  writeFileSync(path.join(OUT_DIR, "elevator_compliance.csv"), toCsv(elevatorCompliance));
  console.log(`elevator_compliance.csv: ${elevatorCompliance.length} rows`);

  const elevatorViolations = await fetchAllSocrataRows<Record<string, unknown>>("dedp-nh8d", {
    where: `bin in(${soqlInList(bins)}) AND violation_category like '%ACTIVE%'`,
  });
  writeFileSync(path.join(OUT_DIR, "elevator_violations.csv"), toCsv(elevatorViolations));
  console.log(`elevator_violations.csv: ${elevatorViolations.length} rows`);

  const boilerSafety = await fetchAllSocrataRows<Record<string, unknown>>("52dp-yji6", {
    where: `bin_number in(${soqlInList(bins)})`,
  });
  writeFileSync(path.join(OUT_DIR, "boiler_safety.csv"), toCsv(boilerSafety));
  console.log(`boiler_safety.csv: ${boilerSafety.length} rows`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
