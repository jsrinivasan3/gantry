import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { ScenarioList } from "@/app/(app)/scenarios/scenario-list";

export default async function ScenariosPage() {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Scenarios</h1>
        <p className="text-sm text-muted-foreground">
          A private, editable copy of the Main Schedule — rearrange jobs, run a forecast,
          and promote the changes back once you&apos;re happy with them.
        </p>
      </header>
      <ScenarioList canCreate={session.user.role !== "VIEWER"} />
    </div>
  );
}
