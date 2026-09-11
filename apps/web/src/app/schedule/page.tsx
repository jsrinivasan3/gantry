import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { appConfig } from "@/config/app";
import { Gantt } from "@/components/gantt/Gantt";

export default async function SchedulePage() {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");
  const isAdmin = session.user.role === "ADMIN";

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-4 px-6 py-10">
      <header>
        <h1 className="text-2xl font-semibold">{appConfig.displayName} — Main Schedule</h1>
        <p className="text-sm text-muted-foreground">
          {isAdmin
            ? "Real elevator + boiler compliance data from NYC Open Data, forward due dates rule-derived — never fabricated. As Admin, click a bar to edit directly (e.g. to fill in a real date for a job that needs manual entry), or copy into a scenario to plan changes without touching this."
            : "Read-only. Real elevator + boiler compliance data from NYC Open Data, forward due dates rule-derived — never fabricated. Copy into a scenario to plan changes."}
        </p>
      </header>
      <Gantt scenarioId={null} editable={isAdmin} />
    </main>
  );
}
