import type { JobType } from "@prisma/client";

/**
 * Synthetic labor-hour estimates per job type — spec §2.5 ("crew capacity
 * and most costs are still synthetic"). Applied at job creation time
 * (sync + derivation) so estimatedLaborHours has real content for the M5
 * workload/cost forecasts. A real completed job's actualLaborHours is left
 * null (not fabricated) unless a user records it.
 */
export const jobLaborHours: Partial<Record<JobType, number>> = {
  CAT1_TEST: 2,
  CAT5_TEST: 6,
  PERIODIC_INSPECTION: 1.5,
  VIOLATION_REPAIR: 4,
  BOILER_PERIODIC: 3,
  BOILER_EXTERNAL: 2,
  BOILER_INTERNAL: 5,
  OTHER: 2,
};
