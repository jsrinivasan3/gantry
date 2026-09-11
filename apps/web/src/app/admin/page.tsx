import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { appConfig } from "@/config/app";
import { SyncPanel } from "@/app/admin/sync-panel";

export default async function AdminPage() {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");
  if (session.user.role !== "ADMIN") redirect("/");

  return (
    <main className="mx-auto flex max-w-3xl flex-1 flex-col gap-6 px-6 py-16">
      <h1 className="text-2xl font-semibold">{appConfig.displayName} Admin</h1>
      <SyncPanel />
    </main>
  );
}
