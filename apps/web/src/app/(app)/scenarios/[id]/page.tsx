import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { ScenarioDetail } from "@/app/(app)/scenarios/[id]/scenario-detail";

export default async function ScenarioDetailPage({ params }: PageProps<"/scenarios/[id]">) {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");
  const { id } = await params;

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-4 px-6 py-10">
      <ScenarioDetail scenarioId={id} currentUserId={session.user.id} isAdmin={session.user.role === "ADMIN"} />
    </main>
  );
}
