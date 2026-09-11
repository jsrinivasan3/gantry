/**
 * Single source of truth for display name / branding / API base.
 * Spec §1: "Centralize the display name, API base URL, and branding in one config file."
 */
export const appConfig = {
  displayName: "Gantry",
  tagline: "Facilities compliance & maintenance planning for NYC elevators and boilers",
  apiBasePath: "/api/trpc",
  defaultSyncBorough: process.env.GANTRY_SYNC_DEFAULT_BOROUGH ?? "MANHATTAN",
} as const;
