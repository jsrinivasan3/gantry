"use client";

import { useState } from "react";
import { format } from "date-fns";
import { AlertCircle } from "lucide-react";

import { trpc } from "@/lib/trpc/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";

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
const STATUS_LABELS: Record<(typeof STATUSES)[number], string> = {
  PLANNED: "Planned",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  UNSCHEDULED: "Unscheduled (needs manual date)",
};

const UNASSIGNED = "__unassigned__";

export function JobEditPopover({
  job,
  scenarioId,
  onClose,
  onSaved,
}: {
  job: JobLike;
  /** null = editing the Main Schedule directly (Admin-only server-side). */
  scenarioId: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [start, setStart] = useState(format(new Date(job.scheduledStart), "yyyy-MM-dd"));
  const [end, setEnd] = useState(format(new Date(job.scheduledEnd), "yyyy-MM-dd"));
  const [teamId, setTeamId] = useState(job.teamId ?? UNASSIGNED);
  const [status, setStatus] = useState(job.status);
  const [error, setError] = useState<string | null>(null);

  const teamsQuery = trpc.catalog.teams.useQuery();
  const updateScenarioJob = trpc.scenario.updateJob.useMutation({
    onSuccess: onSaved,
    onError: (e) => setError(e.message),
  });
  const updateMainJob = trpc.schedule.updateMainJob.useMutation({
    onSuccess: onSaved,
    onError: (e) => setError(e.message),
  });
  const isPending = updateScenarioJob.isPending || updateMainJob.isPending;

  function handleSave() {
    setError(null);
    const payload = {
      jobId: job.id,
      scheduledStart: new Date(start),
      scheduledEnd: new Date(end),
      teamId: teamId === UNASSIGNED ? null : teamId,
      status: status as (typeof STATUSES)[number],
    };
    if (scenarioId) {
      updateScenarioJob.mutate({ scenarioId, ...payload });
    } else {
      updateMainJob.mutate(payload);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{job.title}</DialogTitle>
          <DialogDescription>{job.asset.displayName}</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="job-start">Start</Label>
            <Input id="job-start" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="job-end">End</Label>
            <Input id="job-end" type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
          </div>
          <div className="col-span-2 flex flex-col gap-1.5">
            <Label>Team</Label>
            <Select value={teamId} onValueChange={(v) => setTeamId(v ?? UNASSIGNED)}>
              <SelectTrigger className="w-full">
                <SelectValue>
                  {(value: string) =>
                    value === UNASSIGNED ? "Unassigned" : (teamsQuery.data?.find((t) => t.id === value)?.name ?? "Unassigned")
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
                {teamsQuery.data?.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2 flex flex-col gap-1.5">
            <Label>Status</Label>
            <Select value={status} onValueChange={(v) => v && setStatus(v)}>
              <SelectTrigger className="w-full">
                <SelectValue>{(value: string) => STATUS_LABELS[value as (typeof STATUSES)[number]] ?? value}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isPending}>
            {isPending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
