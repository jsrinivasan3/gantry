import Link from "next/link";

import { auth, signOut } from "@/auth";
import { appConfig } from "@/config/app";
import { prisma } from "@/server/db/client";

export default async function HomePage() {
  const session = await auth();
  const [userCount, assetCount, jobCount] = await Promise.all([
    prisma.user.count(),
    prisma.asset.count(),
    prisma.job.count(),
  ]);

  return (
    <main className="mx-auto flex max-w-3xl flex-1 flex-col gap-8 px-6 py-16">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">{appConfig.displayName}</h1>
        <p className="text-muted-foreground text-sm">{appConfig.tagline}</p>
      </header>

      <nav className="flex gap-4 text-sm">
        <Link className="underline" href="/schedule">
          Main Schedule
        </Link>
      </nav>

      <section className="rounded-lg border p-4">
        <h2 className="mb-2 font-medium">Foundation status (M1)</h2>
        <ul className="text-sm text-muted-foreground space-y-1">
          <li>Users in DB: {userCount}</li>
          <li>Assets in DB: {assetCount} (populated in M2 — NYC Open Data sync)</li>
          <li>Jobs in DB: {jobCount} (populated in M3 — schedule derivation)</li>
        </ul>
      </section>

      <section className="rounded-lg border p-4">
        <h2 className="mb-2 font-medium">Session</h2>
        {session?.user ? (
          <div className="flex items-center justify-between text-sm">
            <span>
              Signed in as <strong>{session.user.email}</strong> ({session.user.role})
            </span>
            <div className="flex gap-4">
              {session.user.role === "ADMIN" && (
                <Link className="underline" href="/admin">
                  Admin
                </Link>
              )}
              <form
                action={async () => {
                  "use server";
                  await signOut({ redirectTo: "/" });
                }}
              >
                <button className="underline" type="submit">
                  Sign out
                </button>
              </form>
            </div>
          </div>
        ) : (
          <Link className="text-sm underline" href="/sign-in">
            Sign in
          </Link>
        )}
      </section>
    </main>
  );
}
