import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { appConfig } from "@/config/app";
import { ScenarioList } from "@/app/scenarios/scenario-list";

export default async function ScenariosPage() {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");

  return (
    <main className="mx-auto flex max-w-3xl flex-1 flex-col gap-6 px-6 py-16">
      <header>
        <h1 className="text-2xl font-semibold">{appConfig.displayName} — Scenarios</h1>
        <p className="text-sm text-muted-foreground">
          A scenario is a private, editable copy of the Main Schedule — rearrange jobs
          without touching the real schedule.
        </p>
      </header>
      <ScenarioList canCreate={session.user.role !== "VIEWER"} />
    </main>
  );
}
