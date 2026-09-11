import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  Building2,
  CalendarRange,
  Flame,
  FolderKanban,
  ShieldAlert,
  ShieldCheck,
  Wrench,
} from "lucide-react";

import { auth } from "@/auth";
import { appConfig } from "@/config/app";
import { prisma } from "@/server/db/client";
import { computeWarnings } from "@/server/scheduling/warnings";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default async function HomePage() {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");
  const isAdmin = session.user.role === "ADMIN";

  const [elevatorCount, boilerCount, openJobCount, unscheduledCount, scenarioCount, lastSync] = await Promise.all([
    prisma.asset.count({ where: { assetType: "ELEVATOR" } }),
    prisma.asset.count({ where: { assetType: "BOILER" } }),
    prisma.job.count({ where: { scenarioId: null, status: { in: ["PLANNED", "IN_PROGRESS"] } } }),
    prisma.job.count({ where: { scenarioId: null, status: "UNSCHEDULED" } }),
    prisma.scenario.count({ where: { OR: [{ ownerUserId: session.user.id }, { isShared: true }] } }),
    prisma.syncRun.findFirst({ where: { status: "SUCCESS" }, orderBy: { startedAt: "desc" } }),
  ]);

  const totalAssets = elevatorCount + boilerCount;
  const warnings = totalAssets > 0 ? await computeWarnings(null) : [];
  const overdueCount = warnings.filter((w) => w.code === "compliance_overdue").length;
  const deadlineCount = warnings.filter((w) => w.code === "defect_correction_deadline_approaching").length;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          Welcome back, {session.user.name?.split(" ")[0] ?? "there"}
        </h1>
        <p className="text-sm text-muted-foreground">{appConfig.tagline}</p>
      </header>

      {totalAssets === 0 && (
        <Alert>
          <ShieldAlert />
          <AlertTitle>No data synced yet</AlertTitle>
          <AlertDescription>
            {isAdmin ? (
              <>
                This portfolio is empty. Head to{" "}
                <Link href="/admin" className="font-medium underline underline-offset-2">
                  Admin → Data Sync
                </Link>{" "}
                and click &quot;Sync now&quot; to pull real elevator and boiler records from NYC Open Data.
              </>
            ) : (
              "This portfolio is empty. Ask an Admin to run a data sync from the Admin page."
            )}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Elevators" value={elevatorCount} icon={Building2} />
        <StatCard label="Boilers" value={boilerCount} icon={Flame} />
        <StatCard label="Open jobs" value={openJobCount} icon={Wrench} sublabel={`${unscheduledCount} need a date`} />
        <StatCard
          label="Active warnings"
          value={overdueCount + deadlineCount}
          icon={ShieldAlert}
          tone={overdueCount + deadlineCount > 0 ? "warn" : "ok"}
          sublabel={`${overdueCount} overdue`}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <NavCard
          href="/schedule"
          icon={CalendarRange}
          title="Main Schedule"
          description="The live, authoritative schedule — real compliance data plus rule-derived due dates."
        />
        <NavCard
          href="/scenarios"
          icon={FolderKanban}
          title="Scenarios"
          description={
            scenarioCount > 0
              ? `You have access to ${scenarioCount} scenario${scenarioCount === 1 ? "" : "s"}.`
              : "Copy the Main Schedule into a sandbox to plan changes safely."
          }
        />
        {isAdmin && (
          <NavCard
            href="/admin"
            icon={ShieldCheck}
            title="Admin"
            description={
              lastSync
                ? `Last sync ${new Date(lastSync.startedAt).toLocaleDateString()}. Manage scope and re-sync.`
                : "Configure the NYC Open Data sync scope and run the first sync."
            }
          />
        )}
      </div>

      <Card className="bg-muted/40">
        <CardHeader>
          <CardTitle className="text-sm">What&apos;s real vs. synthetic</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm text-muted-foreground sm:grid-cols-3">
          <div>
            <Badge variant="outline" className="mb-1.5 border-emerald-300 text-emerald-700 dark:text-emerald-400">
              Real
            </Badge>
            <p>Assets, compliance history, open violations, boiler filing fees — from NYC Open Data.</p>
          </div>
          <div>
            <Badge variant="outline" className="mb-1.5 border-sky-300 text-sky-700 dark:text-sky-400">
              Rule-derived
            </Badge>
            <p>Forward due dates computed from real filings — never invented when data is missing.</p>
          </div>
          <div>
            <Badge variant="outline" className="mb-1.5">
              Synthetic
            </Badge>
            <p>Parts catalog, crew/team rates, and which parts a job type consumes.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  label,
  value,
  sublabel,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: number;
  sublabel?: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "default" | "warn" | "ok";
}) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">{label}</span>
          <span className="text-2xl font-semibold tabular-nums">{value.toLocaleString()}</span>
          {sublabel && (
            <span
              className={
                tone === "warn"
                  ? "text-xs text-amber-600 dark:text-amber-400"
                  : "text-xs text-muted-foreground"
              }
            >
              {sublabel}
            </span>
          )}
        </div>
        <div
          className={
            "flex size-9 shrink-0 items-center justify-center rounded-lg " +
            (tone === "warn"
              ? "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400"
              : "bg-primary/10 text-primary")
          }
        >
          <Icon className="size-4.5" />
        </div>
      </CardContent>
    </Card>
  );
}

function NavCard({
  href,
  icon: Icon,
  title,
  description,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <Card className="group transition-colors hover:border-primary/40">
      <CardHeader>
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Icon className="size-4" />
          </div>
          <CardTitle className="text-base">{title}</CardTitle>
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardFooter>
        <Button
          variant="ghost"
          size="sm"
          nativeButton={false}
          className="gap-1 px-0 text-primary hover:text-primary"
          render={
            <Link href={href}>
              Open
              <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
            </Link>
          }
        />
      </CardFooter>
    </Card>
  );
}
