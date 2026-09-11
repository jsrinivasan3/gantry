import { redirect } from "next/navigation";
import { Lock, Pencil } from "lucide-react";

import { auth } from "@/auth";
import { Gantt } from "@/components/gantt/Gantt";
import { Badge } from "@/components/ui/badge";

export default async function SchedulePage() {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");
  const isAdmin = session.user.role === "ADMIN";

  return (
    <div className="flex w-full flex-1 flex-col gap-4">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Main Schedule</h1>
          <p className="max-w-3xl text-sm text-muted-foreground">
            The live, authoritative schedule. Real elevator &amp; boiler compliance data from NYC Open
            Data, forward due dates rule-derived — never fabricated.
          </p>
        </div>
        {isAdmin ? (
          <Badge variant="outline" className="shrink-0 gap-1.5 py-1.5">
            <Pencil className="size-3" />
            Editable — you&apos;re an Admin
          </Badge>
        ) : (
          <Badge variant="secondary" className="shrink-0 gap-1.5 py-1.5">
            <Lock className="size-3" />
            Read-only — copy into a scenario to plan changes
          </Badge>
        )}
      </header>
      <Gantt scenarioId={null} editable={isAdmin} />
    </div>
  );
}
