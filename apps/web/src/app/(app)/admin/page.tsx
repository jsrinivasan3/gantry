import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { SyncPanel } from "@/app/(app)/admin/sync-panel";

export default async function AdminPage() {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");
  if (session.user.role !== "ADMIN") redirect("/");

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Admin</h1>
        <p className="text-sm text-muted-foreground">
          Manage the live NYC Open Data sync and the Main Schedule&apos;s source data.
        </p>
      </header>
      <SyncPanel />
    </div>
  );
}
