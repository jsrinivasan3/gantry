"use client";

import { useState } from "react";
import { format } from "date-fns";

import { trpc } from "@/lib/trpc/client";

interface JobLike {
  id: string;
  title: string;
  status: string;
  scheduledStart: Date | string;
  scheduledEnd: Date | string;
  teamId: string | null;
  asset: { displayName: string };
}

const STATUSES = ["PLANNED", "IN_PROGRESS", "COMPLETED", "CANCELLED", "UNSCHEDULED"] as const;

export function JobEditPopover({
  job,
  scenarioId,
  onClose,
  onSaved,
}: {
  job: JobLike;
  scenarioId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [start, setStart] = useState(format(new Date(job.scheduledStart), "yyyy-MM-dd"));
  const [end, setEnd] = useState(format(new Date(job.scheduledEnd), "yyyy-MM-dd"));
  const [teamId, setTeamId] = useState(job.teamId ?? "");
  const [status, setStatus] = useState(job.status);
  const [error, setError] = useState<string | null>(null);

  const teamsQuery = trpc.catalog.teams.useQuery();
  const updateJob = trpc.scenario.updateJob.useMutation({
    onSuccess: onSaved,
    onError: (e) => setError(e.message),
  });

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div className="w-80 rounded-lg border bg-background p-4 shadow-lg" onClick={(e) => e.stopPropagation()}>
        <h3 className="mb-1 text-sm font-semibold">{job.title}</h3>
        <p className="mb-3 text-xs text-muted-foreground">{job.asset.displayName}</p>

        <div className="flex flex-col gap-2 text-sm">
          <label className="flex flex-col gap-0.5">
            Start
            <input
              type="date"
              className="rounded border px-2 py-1"
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-0.5">
            End
            <input
              type="date"
              className="rounded border px-2 py-1"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-0.5">
            Team
            <select
              className="rounded border px-2 py-1"
              value={teamId}
              onChange={(e) => setTeamId(e.target.value)}
            >
              <option value="">Unassigned</option>
              {teamsQuery.data?.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-0.5">
            Status
            <select className="rounded border px-2 py-1" value={status} onChange={(e) => setStatus(e.target.value)}>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
        </div>

        {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

        <div className="mt-4 flex justify-end gap-2 text-sm">
          <button className="rounded border px-3 py-1.5" onClick={onClose}>
            Cancel
          </button>
          <button
            className="rounded bg-black px-3 py-1.5 text-white disabled:opacity-50"
            disabled={updateJob.isPending}
            onClick={() => {
              setError(null);
              updateJob.mutate({
                scenarioId,
                jobId: job.id,
                scheduledStart: new Date(start),
                scheduledEnd: new Date(end),
                teamId: teamId || null,
                status: status as (typeof STATUSES)[number],
              });
            }}
          >
            {updateJob.isPending ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
