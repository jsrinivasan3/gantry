import { Building2, Flame, MoveVertical, PackageSearch, Waypoints } from "lucide-react";

export const JOB_TYPE_COLORS: Record<string, string> = {
  CAT1_TEST: "var(--chart-1)",
  CAT5_TEST: "var(--chart-2)",
  PERIODIC_INSPECTION: "var(--chart-3)",
  BOILER_PERIODIC: "#059669",
  BOILER_EXTERNAL: "var(--chart-4)",
  BOILER_INTERNAL: "#b45309",
  VIOLATION_REPAIR: "var(--chart-5)",
  OTHER: "var(--muted-foreground)",
};

export const JOB_TYPE_LABELS: Record<string, string> = {
  CAT1_TEST: "CAT1 test",
  CAT5_TEST: "CAT5 test",
  PERIODIC_INSPECTION: "Periodic inspection",
  BOILER_PERIODIC: "Boiler annual",
  BOILER_EXTERNAL: "Boiler external",
  BOILER_INTERNAL: "Boiler internal",
  VIOLATION_REPAIR: "Violation repair",
  OTHER: "Other",
};

export const STATUS_LABELS: Record<string, string> = {
  PLANNED: "Planned",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  UNSCHEDULED: "Unscheduled",
};

/** Best-effort device icon from the free-text display name (assetType is only ELEVATOR|BOILER). */
export function iconForAsset(displayName: string, assetType: string) {
  const name = displayName.toLowerCase();
  if (assetType === "BOILER") return Flame;
  if (name.includes("escalator")) return Waypoints;
  if (name.includes("dumbwaiter") || name.includes("hoist")) return PackageSearch;
  if (name.includes("lift") || name.includes("elevator")) return MoveVertical;
  return Building2;
}

export const ZOOM_LEVELS = [
  { label: "Compact", pxPerDay: 2 },
  { label: "Comfortable", pxPerDay: 3.5 },
  { label: "Wide", pxPerDay: 6 },
] as const;
