import { deriveElevatorSchedule } from "@/server/scheduling/deriveElevatorSchedule";
import { deriveBoilerSchedule } from "@/server/scheduling/deriveBoilerSchedule";
import { deriveDefectFollowups } from "@/server/scheduling/deriveDefectFollowups";

/** Runs the full §10 derivation pass. Safe to call repeatedly (idempotent upserts). */
export async function deriveMainSchedule() {
  const elevator = await deriveElevatorSchedule();
  const boiler = await deriveBoilerSchedule();
  const defectFollowups = await deriveDefectFollowups();
  return { elevator, boiler, defectFollowups };
}
