"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CalendarRange, GitCompareArrows, LineChart, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { trpc } from "@/lib/trpc/client";
import { Gantt } from "@/components/gantt/Gantt";
import { ForecastPanel } from "@/app/(app)/scenarios/[id]/forecast-panel";
import { DiffPanel } from "@/app/(app)/scenarios/[id]/diff-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const STATUS_STYLES: Record<string, string> = {
  DRAFT: "",
  SUBMITTED:
    "border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-800 dark:bg-amber-500/15 dark:text-amber-400",
  PROMOTED:
    "border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-400",
  ARCHIVED: "text-muted-foreground",
};

export function ScenarioDetail({
  scenarioId,
  currentUserId,
  isAdmin,
}: {
  scenarioId: string;
  currentUserId: string;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const scenarioQuery = trpc.scenario.get.useQuery({ id: scenarioId });
  const [showAddJob, setShowAddJob] = useState(false);

  if (scenarioQuery.isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }
  if (scenarioQuery.error) {
    return <p className="text-sm text-destructive">{scenarioQuery.error.message}</p>;
  }
  const scenario = scenarioQuery.data!;
  const canEdit = scenario.ownerUserId === currentUserId || isAdmin;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Button
          variant="ghost"
          size="sm"
          nativeButton={false}
          className="mb-2 gap-1 px-1 text-muted-foreground"
          render={
            <Link href="/scenarios">
              <ArrowLeft className="size-3.5" />
              Scenarios
            </Link>
          }
        />
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">{scenario.name}</h1>
              <Badge variant="outline" className={STATUS_STYLES[scenario.status] ?? ""}>
                {scenario.status}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {scenario.description || "No description"} · owner {scenario.owner.displayName}
            </p>
          </div>
          {canEdit && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setShowAddJob(true)}>
                <Plus className="size-3.5" />
                Add ad-hoc job
              </Button>
              <DeleteScenarioButton scenarioId={scenarioId} onDeleted={() => router.push("/scenarios")} />
            </div>
          )}
        </div>
      </div>

      <AddJobDialog scenarioId={scenarioId} open={showAddJob} onOpenChange={setShowAddJob} />

      <Tabs defaultValue="gantt">
        <TabsList>
          <TabsTrigger value="gantt" className="gap-1.5">
            <CalendarRange className="size-3.5" />
            Gantt
          </TabsTrigger>
          <TabsTrigger value="forecast" className="gap-1.5">
            <LineChart className="size-3.5" />
            Forecast
          </TabsTrigger>
          <TabsTrigger value="promote" className="gap-1.5">
            <GitCompareArrows className="size-3.5" />
            Diff &amp; Promote
          </TabsTrigger>
        </TabsList>
        <TabsContent value="gantt">
          <Gantt scenarioId={scenarioId} editable={canEdit} />
        </TabsContent>
        <TabsContent value="forecast">
          <ForecastPanel scenarioId={scenarioId} />
        </TabsContent>
        <TabsContent value="promote">
          <DiffPanel
            scenarioId={scenarioId}
            status={scenario.status}
            isOwner={scenario.ownerUserId === currentUserId}
            isAdmin={isAdmin}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function AddJobDialog({
  scenarioId,
  open,
  onOpenChange,
}: {
  scenarioId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const utils = trpc.useUtils();
  const assetsQuery = trpc.catalog.assets.useQuery(undefined, { enabled: open });
  const addJob = trpc.scenario.addJob.useMutation({
    onSuccess: () => {
      utils.schedule.mainScheduleJobs.invalidate({ scenarioId });
      toast.success("Job added to scenario");
      reset();
      onOpenChange(false);
    },
    onError: (e) => toast.error("Couldn't add job", { description: e.message }),
  });

  const [assetId, setAssetId] = useState("");
  const [title, setTitle] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");

  function reset() {
    setAssetId("");
    setTitle("");
    setStart("");
    setEnd("");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Add ad-hoc job</DialogTitle>
          <DialogDescription>Only added to this scenario until you promote it.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label>Asset</Label>
            <Select value={assetId} onValueChange={(v) => v && setAssetId(v)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select an asset…">
                  {(value: string) => assetsQuery.data?.find((a) => a.id === value)?.displayName ?? "Select an asset…"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {assetsQuery.data?.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.displayName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="job-title">Title</Label>
            <Input id="job-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Door sensor replacement" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="job-start">Start</Label>
              <Input id="job-start" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="job-end">End</Label>
              <Input id="job-end" type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!assetId || !title || !start || !end || addJob.isPending}
            onClick={() =>
              addJob.mutate({ scenarioId, assetId, title, scheduledStart: new Date(start), scheduledEnd: new Date(end) })
            }
            className="gap-1.5"
          >
            {addJob.isPending && <Loader2 className="size-4 animate-spin" />}
            Add job
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteScenarioButton({ scenarioId, onDeleted }: { scenarioId: string; onDeleted: () => void }) {
  const [open, setOpen] = useState(false);
  const utils = trpc.useUtils();
  const deleteScenario = trpc.scenario.delete.useMutation({
    onSuccess: () => {
      utils.scenario.list.invalidate();
      toast.success("Scenario deleted");
      onDeleted();
    },
    onError: (e) => toast.error("Couldn't delete scenario", { description: e.message }),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="outline" size="sm" className="gap-1.5 text-destructive hover:text-destructive" onClick={() => setOpen(true)}>
        <Trash2 className="size-3.5" />
        Delete
      </Button>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Delete this scenario?</DialogTitle>
          <DialogDescription>This cannot be undone. The Main Schedule is unaffected.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button variant="destructive" disabled={deleteScenario.isPending} onClick={() => deleteScenario.mutate({ id: scenarioId })}>
            {deleteScenario.isPending ? "Deleting…" : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
