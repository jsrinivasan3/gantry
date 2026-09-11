import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { appConfig } from "@/config/app";
import { Gantt } from "@/components/gantt/Gantt";

export default async function SchedulePage() {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-4 px-6 py-10">
      <header>
        <h1 className="text-2xl font-semibold">{appConfig.displayName} — Main Schedule</h1>
        <p className="text-sm text-muted-foreground">
          Read-only. Real elevator + boiler compliance data from NYC Open Data, forward
          due dates rule-derived — never fabricated. Copy into a scenario to plan changes.
        </p>
      </header>
      <Gantt scenarioId={null} />
    </main>
  );
}
