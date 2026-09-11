import type { JobType } from "@prisma/client";

/**
 * Synthetic BOM: which parts (SKUs from sample-data/parts.csv) a job type
 * typically consumes, and roughly how many. Applied automatically when a
 * job is created (sync or derivation) so the M5 parts forecast has
 * something real to project against. Entirely synthetic — spec §2.5.
 */
export const jobPartsCatalog: Partial<Record<JobType, { sku: string; quantity: number }[]>> = {
  CAT1_TEST: [{ sku: "EL-BRK-006", quantity: 1 }],
  CAT5_TEST: [
    { sku: "EL-ROP-003", quantity: 1 },
    { sku: "EL-SAF-008", quantity: 1 },
  ],
  PERIODIC_INSPECTION: [{ sku: "EL-BTN-007", quantity: 1 }],
  VIOLATION_REPAIR: [
    { sku: "EL-DOR-001", quantity: 1 },
    { sku: "EL-CTL-005", quantity: 1 },
  ],
  BOILER_PERIODIC: [{ sku: "BL-GAU-102", quantity: 1 }],
  BOILER_EXTERNAL: [{ sku: "BL-VLV-101", quantity: 1 }],
  BOILER_INTERNAL: [
    { sku: "BL-GSK-105", quantity: 1 },
    { sku: "BL-REF-106", quantity: 1 },
  ],
};
