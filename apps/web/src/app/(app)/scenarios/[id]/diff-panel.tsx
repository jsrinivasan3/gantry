"use client";

import { useState } from "react";
import { Check, CheckCircle2, FilePlus2, Loader2, PenSquare, Send } from "lucide-react";
import { toast } from "sonner";

import { trpc } from "@/lib/trpc/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const STEPS = ["DRAFT", "SUBMITTED", "PROMOTED"] as const;
const STEP_LABELS: Record<(typeof STEPS)[number], string> = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  PROMOTED: "Promoted",
};

function StatusSteps({ status }: { status: string }) {
  const currentIndex = STEPS.indexOf(status as (typeof STEPS)[number]);
  return (
    <div className="flex items-center gap-2">
      {STEPS.map((step, i) => {
        const done = i < currentIndex || status === "PROMOTED";
        const active = i === currentIndex && status !== "PROMOTED";
        return (
          <div key={step} className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <div
                className={cn(
                  "flex size-5 items-center justify-center rounded-full border text-[10px] font-medium",
                  done && "border-primary bg-primary text-primary-foreground",
                  active && "border-primary text-primary",
                  !done && !active && "border-muted-foreground/30 text-muted-foreground"
                )}
              >
                {done ? <Check className="size-3" /> : i + 1}
              </div>
              <span className={cn("text-xs", (done || active) && "font-medium")}>{STEP_LABELS[step]}</span>
            </div>
            {i < STEPS.length - 1 && <div className="h-px w-6 bg-border" />}
          </div>
        );
      })}
    </div>
  );
}

export function DiffPanel({
  scenarioId,
  status,
  isOwner,
  isAdmin,
}: {
  scenarioId: string;
  status: string;
  isOwner: boolean;
  isAdmin: boolean;
}) {
  const utils = trpc.useUtils();
  const diffQuery = trpc.scenario.diff.useQuery({ id: scenarioId });
  const [confirmOpen, setConfirmOpen] = useState(false);

  const submit = trpc.scenario.submitForPromotion.useMutation({
    onSuccess: () => {
      utils.scenario.get.invalidate({ id: scenarioId });
      toast.success("Submitted for promotion", { description: "An Admin can now review and promote it." });
    },
    onError: (e) => toast.error("Couldn't submit", { description: e.message }),
  });
  const promote = trpc.scenario.promote.useMutation({
    onSuccess: (result) => {
      utils.scenario.get.invalidate({ id: scenarioId });
      utils.schedule.mainScheduleJobs.invalidate({ scenarioId: null });
      utils.schedule.warnings.invalidate({ scenarioId: null });
      setConfirmOpen(false);
      toast.success("Promoted to Main Schedule", {
        description: `${result.updatedCount} job(s) updated, ${result.createdCount} created.`,
      });
    },
    onError: (e) => toast.error("Couldn't promote", { description: e.message }),
  });

  if (diffQuery.isLoading) {
    return <Skeleton className="h-64 w-full" />;
  }
  const diff = diffQuery.data!;
  const noChanges = diff.changed.length === 0 && diff.added.length === 0;

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3">
          <StatusSteps status={status} />
          <div className="flex items-center gap-2">
            {status === "DRAFT" && isOwner && (
              <Button
                size="sm"
                disabled={noChanges || submit.isPending}
                onClick={() => submit.mutate({ id: scenarioId })}
                className="gap-1.5"
              >
                {submit.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
                Submit for promotion
              </Button>
            )}
            {status === "SUBMITTED" && isAdmin && (
              <Button size="sm" onClick={() => setConfirmOpen(true)} className="gap-1.5">
                <CheckCircle2 className="size-3.5" />
                Approve &amp; promote
              </Button>
            )}
            {status === "SUBMITTED" && !isAdmin && (
              <span className="text-xs text-muted-foreground">Waiting on Admin review.</span>
            )}
            {status === "PROMOTED" && (
              <Badge className="gap-1 border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-400">
                <CheckCircle2 className="size-3" />
                Promoted to Main Schedule
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {noChanges ? (
        <Card className="border-dashed">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No changes from the Main Schedule yet — reschedule a job or add one in the Gantt tab.
          </CardContent>
        </Card>
      ) : (
        <>
          {diff.changed.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-1.5 text-sm">
                  <PenSquare className="size-4 text-muted-foreground" />
                  Changed jobs ({diff.changed.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Asset</TableHead>
                      <TableHead>Job</TableHead>
                      <TableHead>Changed fields</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {diff.changed.map((c) => (
                      <TableRow key={c.jobId}>
                        <TableCell className="font-medium">{c.assetName}</TableCell>
                        <TableCell className="text-muted-foreground">{c.title}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {c.fields.map((f) => (
                              <Badge key={f} variant="secondary" className="text-[10px]">
                                {f}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {diff.added.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-1.5 text-sm">
                  <FilePlus2 className="size-4 text-muted-foreground" />
                  New ad-hoc jobs ({diff.added.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="flex flex-col divide-y text-sm">
                  {diff.added.map((a) => (
                    <li key={a.jobId} className="py-2">
                      <span className="font-medium">{a.assetName}</span>
                      <span className="text-muted-foreground">: {a.title}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </>
      )}

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Promote to Main Schedule?</DialogTitle>
            <DialogDescription>
              This applies all {diff.changed.length} changed job(s) and creates {diff.added.length} new job(s)
              on the real Main Schedule. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button disabled={promote.isPending} onClick={() => promote.mutate({ id: scenarioId })} className="gap-1.5">
              {promote.isPending && <Loader2 className="size-4 animate-spin" />}
              {promote.isPending ? "Promoting…" : "Promote"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
