/**
 * Default NYC Open Data sync scope. Kept small on purpose (spec §2.4: "so the
 * demo dataset stays in the hundreds of devices, not the citywide total").
 *
 * Curated as the 40 Manhattan BINs with 2-8 *active* elevator devices each
 * (skipping single-elevator walk-ups and 100+ elevator supertall towers,
 * which would either be too sparse or dominate the Gantt), plus BIN 1090764
 * added deliberately because it has a real open DOB elevator violation —
 * needed so the demo has at least one violation_repair job (spec §15
 * "Sample data" DoD) without waiting for one to appear organically.
 *
 * An Admin can change this scope from the Data Sync panel (spec §13); this
 * is only the seed default.
 */
export const defaultSyncScope = {
  borough: "MANHATTAN",
  bins: [
    "1089743", "1077352", "1087187", "1081585", "1089803", "1024737",
    "1016900", "1012834", "1022578", "1014499", "1006826", "1007956",
    "1087842", "1038761", "1082185", "1051514", "1035347", "1089452",
    "1075637", "1089968", "1086101", "1080950", "1034532", "1088609",
    "1014572", "1038758", "1063862", "1001127", "1028637", "1031139",
    "1007825", "1084594", "1026842", "1090411", "1000827", "1001232",
    "1083638", "1082771", "1012154", "1028827",
    "1090764", // has a real active DOB elevator violation as of 2026-09
  ],
} as const;
