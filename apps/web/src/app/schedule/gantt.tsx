"use client";

import { useMemo, useState } from "react";
import { addDays, differenceInCalendarDays, format, subDays } from "date-fns";

import { trpc } from "@/lib/trpc/client";

const JOB_TYPE_COLORS: Record<string, string> = {
  CAT1_TEST: "#2563eb",
  CAT5_TEST: "#7c3aed",
  PERIODIC_INSPECTION: "#0891b2",
  BOILER_PERIODIC: "#059669",
  BOILER_EXTERNAL: "#d97706",
  BOILER_INTERNAL: "#b45309",
  VIOLATION_REPAIR: "#dc2626",
  OTHER: "#6b7280",
};

const JOB_TYPE_LABELS: Record<string, string> = {
  CAT1_TEST: "CAT1",
  CAT5_TEST: "CAT5",
  PERIODIC_INSPECTION: "Periodic",
  BOILER_PERIODIC: "Boiler annual",
  BOILER_EXTERNAL: "Boiler external",
  BOILER_INTERNAL: "Boiler internal",
  VIOLATION_REPAIR: "Violation repair",
  OTHER: "Other",
};

const PX_PER_DAY = 3;

export function MainScheduleGantt() {
  const [showCompleted, setShowCompleted] = useState(false);
  const jobsQuery = trpc.schedule.mainScheduleJobs.useQuery({ scenarioId: null });
  const warningsQuery = trpc.schedule.warnings.useQuery({ scenarioId: null });

  const overdueJobIds = useMemo(
    () => new Set((warningsQuery.data ?? []).filter((w) => w.code === "compliance_overdue").map((w) => w.jobId)),
    [warningsQuery.data]
  );
  const deadlineJobIds = useMemo(
    () =>
      new Set(
        (warningsQuery.data ?? [])
          .filter((w) => w.code === "defect_correction_deadline_approaching")
          .map((w) => w.jobId)
      ),
    [warningsQuery.data]
  );

  const timelineStart = useMemo(() => subDays(new Date(), 60), []);
  const timelineEnd = useMemo(() => addDays(new Date(), 420), []);
  const timelineWidth = differenceInCalendarDays(timelineEnd, timelineStart) * PX_PER_DAY;
  const todayLeft = differenceInCalendarDays(new Date(), timelineStart) * PX_PER_DAY;

  const jobs = jobsQuery.data ?? [];
  const visibleJobs = showCompleted ? jobs : jobs.filter((j) => j.status !== "COMPLETED");

  const buildings = useMemo(() => {
    const byBin = new Map<
      string,
      { bin: string; borough: string | null; address: string | null; assets: Map<string, { id: string; name: string; jobs: typeof visibleJobs }> }
    >();

    for (const job of visibleJobs) {
      const asset = job.asset;
      const binKey = asset.bin ?? "unknown";
      if (!byBin.has(binKey)) {
        byBin.set(binKey, { bin: binKey, borough: asset.borough, address: asset.address, assets: new Map() });
      }
      const building = byBin.get(binKey)!;
      building.borough ??= asset.borough;
      building.address ??= asset.address;
      if (!building.assets.has(asset.id)) {
        building.assets.set(asset.id, { id: asset.id, name: asset.displayName, jobs: [] });
      }
      building.assets.get(asset.id)!.jobs.push(job);
    }

    return Array.from(byBin.values()).sort((a, b) => (a.borough ?? "").localeCompare(b.borough ?? ""));
  }, [visibleJobs]);

  if (jobsQuery.isLoading) return <p className="text-sm text-muted-foreground">Loading schedule…</p>;
  if (jobsQuery.error) return <p className="text-sm text-red-600">Failed to load: {jobsQuery.error.message}</p>;

  const unscheduledJobs = jobs.filter((j) => j.status === "UNSCHEDULED");
  const overdueCount = overdueJobIds.size;
  const deadlineCount = deadlineJobIds.size;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={showCompleted}
            onChange={(e) => setShowCompleted(e.target.checked)}
          />
          Show completed history
        </label>
        <span className="text-muted-foreground">{jobs.length} jobs · {buildings.length} buildings</span>
        {overdueCount > 0 && (
          <span className="rounded bg-red-100 px-2 py-0.5 text-red-800">
            {overdueCount} overdue
          </span>
        )}
        {deadlineCount > 0 && (
          <span className="rounded bg-amber-100 px-2 py-0.5 text-amber-800">
            {deadlineCount} deadline(s) approaching
          </span>
        )}
        {unscheduledJobs.length > 0 && (
          <span className="rounded bg-gray-100 px-2 py-0.5 text-gray-700">
            {unscheduledJobs.length} needs manual date
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-3 text-xs">
        {Object.entries(JOB_TYPE_LABELS).map(([type, label]) => (
          <span key={type} className="flex items-center gap-1">
            <span
              className="inline-block h-2.5 w-2.5 rounded-sm"
              style={{ background: JOB_TYPE_COLORS[type] }}
            />
            {label}
          </span>
        ))}
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <div style={{ width: 240 + timelineWidth }}>
          <div className="sticky top-0 z-10 flex border-b bg-background text-xs">
            <div className="w-60 shrink-0 border-r px-2 py-1 font-medium">Device</div>
            <div className="relative" style={{ width: timelineWidth }}>
              <TimelineHeader start={timelineStart} end={timelineEnd} />
              <div
                className="absolute top-0 h-full border-l border-red-400"
                style={{ left: todayLeft }}
                title="Today"
              />
            </div>
          </div>

          {buildings.map((building) => (
            <div key={building.bin}>
              <div className="flex bg-muted/50 text-xs">
                <div className="w-60 shrink-0 border-r px-2 py-1 font-medium">
                  {building.address ?? `BIN ${building.bin}`}
                  <span className="ml-1 text-muted-foreground">({building.borough})</span>
                </div>
                <div style={{ width: timelineWidth }} />
              </div>
              {Array.from(building.assets.values()).map((asset) => (
                <div key={asset.id} className="flex border-t">
                  <div className="w-60 shrink-0 truncate border-r px-2 py-1.5 text-xs" title={asset.name}>
                    {asset.name}
                  </div>
                  <div className="relative h-8" style={{ width: timelineWidth }}>
                    {asset.jobs.map((job) => {
                      const left = Math.max(
                        0,
                        differenceInCalendarDays(new Date(job.scheduledStart), timelineStart) * PX_PER_DAY
                      );
                      const rawWidth =
                        differenceInCalendarDays(new Date(job.scheduledEnd), new Date(job.scheduledStart)) *
                        PX_PER_DAY;
                      const width = Math.max(6, rawWidth);
                      const isOverdue = overdueJobIds.has(job.id);
                      const isDeadline = deadlineJobIds.has(job.id);
                      return (
                        <div
                          key={job.id}
                          className="absolute top-1 h-5 rounded-sm"
                          style={{
                            left,
                            width,
                            background: JOB_TYPE_COLORS[job.jobType] ?? "#6b7280",
                            outline: isOverdue
                              ? "2px solid #dc2626"
                              : isDeadline
                                ? "2px solid #d97706"
                                : undefined,
                            opacity: job.status === "COMPLETED" ? 0.5 : 1,
                          }}
                          title={`${job.title} — ${job.status} — ${format(new Date(job.scheduledStart), "MMM d, yyyy")}`}
                        />
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {unscheduledJobs.length > 0 && (
        <details className="rounded-lg border p-3 text-sm">
          <summary className="cursor-pointer font-medium">
            {unscheduledJobs.length} jobs need a manual date (no real filing on record — never fabricated)
          </summary>
          <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
            {unscheduledJobs.slice(0, 50).map((j) => (
              <li key={j.id}>
                {j.asset.displayName}: {j.title}
              </li>
            ))}
            {unscheduledJobs.length > 50 && <li>…and {unscheduledJobs.length - 50} more</li>}
          </ul>
        </details>
      )}
    </div>
  );
}

function TimelineHeader({ start, end }: { start: Date; end: Date }) {
  const months: { label: string; left: number }[] = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  while (cursor <= end) {
    months.push({
      label: format(cursor, "MMM yyyy"),
      left: Math.max(0, differenceInCalendarDays(cursor, start) * PX_PER_DAY),
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return (
    <>
      {months.map((m) => (
        <div
          key={m.label}
          className="absolute top-0 border-l px-1 py-1 text-[10px] text-muted-foreground"
          style={{ left: m.left }}
        >
          {m.label}
        </div>
      ))}
    </>
  );
}
