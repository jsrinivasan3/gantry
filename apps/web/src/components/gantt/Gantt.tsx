"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { addDays, differenceInCalendarDays, format, startOfMonth, subDays } from "date-fns";
import {
  AlertTriangle,
  CalendarSearch,
  ChevronDown,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  Minus,
  Plus,
  Search,
  ShieldAlert,
} from "lucide-react";

import { trpc } from "@/lib/trpc/client";
import { JobEditPopover } from "@/components/gantt/JobEditPopover";
import { JobBar } from "@/components/gantt/JobBar";
import { JOB_TYPE_COLORS, JOB_TYPE_LABELS, ZOOM_LEVELS, iconForAsset } from "@/components/gantt/gantt-constants";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const ROW_HEIGHT = 34;

export function Gantt({ scenarioId, editable = false }: { scenarioId: string | null; editable?: boolean }) {
  const [showCompleted, setShowCompleted] = useState(false);
  const [search, setSearch] = useState("");
  const [zoomIndex, setZoomIndex] = useState(1);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [hiddenTypes, setHiddenTypes] = useState<Set<string>>(new Set());
  const [showUnscheduled, setShowUnscheduled] = useState(false);
  const [showOtherWarnings, setShowOtherWarnings] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const hasAutoScrolled = useRef(false);

  const utils = trpc.useUtils();
  const jobsQuery = trpc.schedule.mainScheduleJobs.useQuery({ scenarioId });
  const warningsQuery = trpc.schedule.warnings.useQuery({ scenarioId });

  const pxPerDay = ZOOM_LEVELS[zoomIndex].pxPerDay;

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
  const timelineWidth = differenceInCalendarDays(timelineEnd, timelineStart) * pxPerDay;
  const todayLeft = differenceInCalendarDays(new Date(), timelineStart) * pxPerDay;

  const jobs = jobsQuery.data ?? [];
  const searchLower = search.trim().toLowerCase();
  const visibleJobs = jobs.filter((j) => {
    if (!showCompleted && j.status === "COMPLETED") return false;
    if (hiddenTypes.has(j.jobType)) return false;
    if (searchLower && !j.asset.displayName.toLowerCase().includes(searchLower)) return false;
    return true;
  });

  const buildings = useMemo(() => {
    const byBin = new Map<
      string,
      {
        bin: string;
        borough: string | null;
        address: string | null;
        assets: Map<string, { id: string; name: string; assetType: string; jobs: typeof visibleJobs }>;
      }
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
        building.assets.set(asset.id, { id: asset.id, name: asset.displayName, assetType: asset.assetType, jobs: [] });
      }
      building.assets.get(asset.id)!.jobs.push(job);
    }

    return Array.from(byBin.values()).sort((a, b) => (a.borough ?? "").localeCompare(b.borough ?? ""));
  }, [visibleJobs]);

  const months = useMemo(() => {
    const result: { start: Date; left: number; width: number }[] = [];
    let cursor = startOfMonth(timelineStart);
    while (cursor <= timelineEnd) {
      const next = addDays(startOfMonth(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1)), 0);
      const left = Math.max(0, differenceInCalendarDays(cursor, timelineStart) * pxPerDay);
      const rawEnd = differenceInCalendarDays(next, timelineStart) * pxPerDay;
      result.push({ start: cursor, left, width: Math.min(rawEnd, timelineWidth) - left });
      cursor = next;
    }
    return result;
  }, [timelineStart, timelineEnd, pxPerDay, timelineWidth]);

  useEffect(() => {
    if (hasAutoScrolled.current || !scrollRef.current) return;
    hasAutoScrolled.current = true;
    scrollRef.current.scrollLeft = Math.max(0, todayLeft - 160);
  }, [todayLeft]);

  const selectedJob = jobs.find((j) => j.id === selectedJobId) ?? null;

  const unscheduledJobs = jobs.filter((j) => j.status === "UNSCHEDULED");
  const overdueCount = overdueJobIds.size;
  const deadlineCount = deadlineJobIds.size;
  const otherWarnings = (warningsQuery.data ?? []).filter(
    (w) => w.code !== "compliance_overdue" && w.code !== "defect_correction_deadline_approaching"
  );

  function jumpToToday() {
    scrollRef.current?.scrollTo({ left: Math.max(0, todayLeft - 160), behavior: "smooth" });
  }

  function toggleBuilding(bin: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(bin)) next.delete(bin);
      else next.add(bin);
      return next;
    });
  }

  function toggleType(type: string) {
    setHiddenTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }

  if (jobsQuery.isLoading) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }
  if (jobsQuery.error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle />
        <AlertTitle>Failed to load schedule</AlertTitle>
        <AlertDescription>{jobsQuery.error.message}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search devices…"
            className="h-8 w-48 pl-8"
          />
        </div>

        <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Checkbox checked={showCompleted} onCheckedChange={(v) => setShowCompleted(v === true)} />
          Show completed
        </label>

        <div className="flex items-center rounded-md border">
          <Button
            variant="ghost"
            size="icon-sm"
            disabled={zoomIndex === 0}
            onClick={() => setZoomIndex((z) => Math.max(0, z - 1))}
            aria-label="Zoom out"
          >
            <Minus />
          </Button>
          <span className="w-20 text-center text-xs text-muted-foreground">{ZOOM_LEVELS[zoomIndex].label}</span>
          <Button
            variant="ghost"
            size="icon-sm"
            disabled={zoomIndex === ZOOM_LEVELS.length - 1}
            onClick={() => setZoomIndex((z) => Math.min(ZOOM_LEVELS.length - 1, z + 1))}
            aria-label="Zoom in"
          >
            <Plus />
          </Button>
        </div>

        <Button variant="outline" size="sm" onClick={jumpToToday} className="gap-1.5">
          <CalendarSearch className="size-3.5" />
          Today
        </Button>

        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() =>
            setCollapsed((prev) => (prev.size > 0 ? new Set() : new Set(buildings.map((b) => b.bin))))
          }
        >
          {collapsed.size > 0 ? <ChevronsUpDown className="size-3.5" /> : <ChevronsDownUp className="size-3.5" />}
          {collapsed.size > 0 ? "Expand all" : "Collapse all"}
        </Button>

        <span className="ml-auto text-xs text-muted-foreground">
          {visibleJobs.length} of {jobs.length} jobs · {buildings.length} buildings
        </span>
      </div>

      {/* Warnings + legend */}
      <div className="flex flex-wrap items-center gap-1.5">
        {overdueCount > 0 && (
          <Badge variant="destructive" className="gap-1">
            <ShieldAlert className="size-3" />
            {overdueCount} overdue
          </Badge>
        )}
        {deadlineCount > 0 && (
          <Badge className="gap-1 border-amber-300 bg-amber-100 text-amber-800 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-500/15 dark:text-amber-400">
            <AlertTriangle className="size-3" />
            {deadlineCount} deadline(s) approaching
          </Badge>
        )}
        {unscheduledJobs.length > 0 && (
          <Badge
            variant="secondary"
            className="cursor-pointer gap-1"
            onClick={() => setShowUnscheduled((v) => !v)}
          >
            {unscheduledJobs.length} need a manual date
            <ChevronDown className={cn("size-3 transition-transform", showUnscheduled && "rotate-180")} />
          </Badge>
        )}
        {otherWarnings.length > 0 && (
          <Badge
            variant="outline"
            className="cursor-pointer gap-1 border-violet-300 text-violet-700 dark:border-violet-800 dark:text-violet-400"
            onClick={() => setShowOtherWarnings((v) => !v)}
          >
            {otherWarnings.length} other warning(s)
            <ChevronDown className={cn("size-3 transition-transform", showOtherWarnings && "rotate-180")} />
          </Badge>
        )}

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {Object.entries(JOB_TYPE_LABELS).map(([type, label]) => {
            const active = !hiddenTypes.has(type);
            return (
              <button
                key={type}
                onClick={() => toggleType(type)}
                className={cn(
                  "flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] transition-colors",
                  active ? "border-transparent bg-muted" : "border-dashed text-muted-foreground opacity-50"
                )}
              >
                <span className="inline-block size-2 rounded-full" style={{ background: JOB_TYPE_COLORS[type] }} />
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {showUnscheduled && unscheduledJobs.length > 0 && (
        <div className="rounded-lg border p-3 text-sm">
          <p className="mb-2 text-xs text-muted-foreground">
            No real filing on record for these — Gantry never invents a date.
          </p>
          <ul className="grid max-h-40 grid-cols-1 gap-1 overflow-y-auto text-xs sm:grid-cols-2 lg:grid-cols-3">
            {unscheduledJobs.slice(0, 90).map((j) => (
              <li key={j.id} className="truncate text-muted-foreground">
                <span className="font-medium text-foreground">{j.asset.displayName}</span>: {j.title}
              </li>
            ))}
            {unscheduledJobs.length > 90 && <li>…and {unscheduledJobs.length - 90} more</li>}
          </ul>
        </div>
      )}

      {showOtherWarnings && otherWarnings.length > 0 && (
        <div className="rounded-lg border p-3 text-sm">
          <ul className="grid max-h-40 grid-cols-1 gap-1 overflow-y-auto text-xs">
            {otherWarnings.slice(0, 90).map((w, i) => (
              <li key={`${w.jobId}-${w.code}-${i}`} className="text-muted-foreground">
                <span className="font-medium text-foreground">{w.code.replaceAll("_", " ")}</span>: {w.message}
              </li>
            ))}
            {otherWarnings.length > 90 && <li>…and {otherWarnings.length - 90} more</li>}
          </ul>
        </div>
      )}

      {/* Chart */}
      <div ref={scrollRef} className="relative max-h-[70vh] overflow-auto rounded-lg border">
        <div style={{ width: 220 + timelineWidth, minWidth: "100%" }}>
          {/* Header */}
          <div className="sticky top-0 z-30 flex border-b bg-background text-xs">
            <div className="sticky left-0 z-30 flex w-55 shrink-0 items-center border-r bg-background px-2 py-2 font-medium">
              Device
            </div>
            <div className="relative" style={{ width: timelineWidth, height: 36 }}>
              {months.map((m, i) => (
                <div
                  key={m.start.toISOString()}
                  className={cn("absolute top-0 h-full border-l", i % 2 === 1 && "bg-muted/30")}
                  style={{ left: m.left, width: m.width }}
                >
                  <span className="sticky left-1 px-1 py-2 text-[10px] whitespace-nowrap text-muted-foreground">
                    {format(m.start, "MMM yyyy")}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Rows */}
          <div className="relative">
            {/* Month background bands behind all rows */}
            <div className="pointer-events-none absolute top-0 left-55 h-full" style={{ width: timelineWidth }}>
              {months.map(
                (m, i) =>
                  i % 2 === 1 && (
                    <div
                      key={m.start.toISOString()}
                      className="absolute top-0 h-full bg-muted/20"
                      style={{ left: m.left, width: m.width }}
                    />
                  )
              )}
              <div className="absolute top-0 h-full w-px bg-red-400/70" style={{ left: todayLeft }} />
            </div>

            {buildings.length === 0 && (
              <div className="p-10 text-center text-sm text-muted-foreground">
                No devices match the current filters.
              </div>
            )}

            {buildings.map((building) => {
              const isCollapsed = collapsed.has(building.bin);
              const jobCount = Array.from(building.assets.values()).reduce((n, a) => n + a.jobs.length, 0);
              return (
                <div key={building.bin}>
                  <div className="flex border-t bg-muted/50 text-xs">
                    <button
                      onClick={() => toggleBuilding(building.bin)}
                      className="sticky left-0 z-10 flex w-55 shrink-0 items-center gap-1 border-r bg-muted/50 px-2 py-1.5 text-left font-medium hover:bg-muted"
                      style={{ height: ROW_HEIGHT }}
                    >
                      {isCollapsed ? (
                        <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
                      )}
                      <span className="truncate">{building.address ?? `BIN ${building.bin}`}</span>
                      <Badge variant="outline" className="ml-auto h-4 shrink-0 px-1 text-[9px]">
                        {building.borough ?? "—"}
                      </Badge>
                    </button>
                    <div style={{ width: timelineWidth, height: ROW_HEIGHT }} className="relative">
                      {isCollapsed && (
                        <span className="absolute top-1/2 left-2 -translate-y-1/2 text-[11px] text-muted-foreground">
                          {jobCount} job{jobCount === 1 ? "" : "s"} hidden
                        </span>
                      )}
                    </div>
                  </div>
                  {!isCollapsed &&
                    Array.from(building.assets.values()).map((asset) => {
                      const AssetIcon = iconForAsset(asset.name, asset.assetType);
                      return (
                        <div key={asset.id} className="flex border-t">
                          <Tooltip>
                            <TooltipTrigger
                              render={
                                <div
                                  className="sticky left-0 z-10 flex w-55 shrink-0 items-center gap-1.5 truncate border-r bg-background px-2 text-xs"
                                  style={{ height: ROW_HEIGHT }}
                                >
                                  <AssetIcon className="size-3.5 shrink-0 text-muted-foreground" />
                                  <span className="truncate">{asset.name}</span>
                                </div>
                              }
                            />
                            <TooltipContent side="right">{asset.name}</TooltipContent>
                          </Tooltip>
                          <div className="relative" style={{ width: timelineWidth, height: ROW_HEIGHT }}>
                            {asset.jobs.map((job) => {
                              const left = Math.max(
                                0,
                                differenceInCalendarDays(new Date(job.scheduledStart), timelineStart) * pxPerDay
                              );
                              const rawWidth =
                                differenceInCalendarDays(new Date(job.scheduledEnd), new Date(job.scheduledStart)) *
                                pxPerDay;
                              const width = Math.max(8, rawWidth);
                              return (
                                <JobBar
                                  key={job.id}
                                  job={job}
                                  left={left}
                                  width={width}
                                  editable={editable}
                                  isOverdue={overdueJobIds.has(job.id)}
                                  isDeadline={deadlineJobIds.has(job.id)}
                                  onSelect={() => setSelectedJobId(job.id)}
                                />
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {editable && (
        <p className="text-xs text-muted-foreground">Click any bar to reschedule it or reassign its team.</p>
      )}

      {editable && selectedJob && (
        <JobEditPopover
          job={selectedJob}
          scenarioId={scenarioId}
          onClose={() => setSelectedJobId(null)}
          onSaved={() => {
            setSelectedJobId(null);
            utils.schedule.mainScheduleJobs.invalidate({ scenarioId });
            utils.schedule.warnings.invalidate({ scenarioId });
          }}
        />
      )}
    </div>
  );
}
