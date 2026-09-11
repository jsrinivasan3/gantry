"use client";

import { format } from "date-fns";
import { AlertTriangle, Clock } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { JOB_TYPE_COLORS, JOB_TYPE_LABELS, STATUS_LABELS } from "@/components/gantt/gantt-constants";

interface JobBarJob {
  id: string;
  title: string;
  status: string;
  jobType: string;
  scheduledStart: Date | string;
  scheduledEnd: Date | string;
  team?: { name: string } | null;
}

export function JobBar({
  job,
  left,
  width,
  editable,
  isOverdue,
  isDeadline,
  onSelect,
}: {
  job: JobBarJob;
  left: number;
  width: number;
  editable: boolean;
  isOverdue: boolean;
  isDeadline: boolean;
  onSelect: () => void;
}) {
  const color = JOB_TYPE_COLORS[job.jobType] ?? "var(--muted-foreground)";
  const isSingleDay =
    new Date(job.scheduledStart).toDateString() === new Date(job.scheduledEnd).toDateString();

  const bar = (
    <div
      role={editable ? "button" : undefined}
      tabIndex={editable ? 0 : undefined}
      className="group absolute top-1/2 h-5 -translate-y-1/2 rounded-full shadow-sm ring-1 ring-black/5 transition-all hover:z-10 hover:h-6 hover:shadow-md focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      style={{
        left,
        width,
        background: color,
        opacity: job.status === "COMPLETED" ? 0.45 : job.status === "CANCELLED" ? 0.3 : 1,
        cursor: editable ? "pointer" : "default",
        boxShadow: isOverdue
          ? "0 0 0 2px var(--destructive)"
          : isDeadline
            ? "0 0 0 2px #d97706"
            : undefined,
      }}
      aria-label={`${job.title}, ${STATUS_LABELS[job.status] ?? job.status}, ${format(new Date(job.scheduledStart), "MMM d, yyyy")}`}
      onClick={editable ? onSelect : undefined}
      onKeyDown={
        editable
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect();
              }
            }
          : undefined
      }
    >
      {(isOverdue || isDeadline) && (
        <AlertTriangle
          className="absolute top-1/2 left-1/2 size-3 -translate-x-1/2 -translate-y-1/2 text-white drop-shadow-sm"
          strokeWidth={2.5}
        />
      )}
    </div>
  );

  return (
    <Tooltip>
      <TooltipTrigger render={bar} />
      <TooltipContent className="max-w-64">
        <div className="flex flex-col gap-1 py-0.5">
          <span className="font-medium">{job.title}</span>
          <div className="flex flex-wrap items-center gap-1 text-[11px] opacity-90">
            <Badge variant="secondary" className="h-4 bg-white/15 px-1.5 py-0 text-[10px] text-inherit">
              {JOB_TYPE_LABELS[job.jobType] ?? job.jobType}
            </Badge>
            <Badge variant="secondary" className="h-4 bg-white/15 px-1.5 py-0 text-[10px] text-inherit">
              {STATUS_LABELS[job.status] ?? job.status}
            </Badge>
          </div>
          <span className="flex items-center gap-1 text-[11px] opacity-90">
            <Clock className="size-3" />
            {isSingleDay
              ? format(new Date(job.scheduledStart), "MMM d, yyyy")
              : `${format(new Date(job.scheduledStart), "MMM d")} – ${format(new Date(job.scheduledEnd), "MMM d, yyyy")}`}
          </span>
          {job.team && <span className="text-[11px] opacity-90">Team: {job.team.name}</span>}
          {isOverdue && <span className="text-[11px] font-medium text-red-300">Overdue</span>}
          {isDeadline && <span className="text-[11px] font-medium text-amber-300">Deadline approaching</span>}
          {editable && <span className="mt-0.5 text-[11px] opacity-70">Click to edit</span>}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
