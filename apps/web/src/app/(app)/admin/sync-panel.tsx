"use client";

import { formatDistanceToNow } from "date-fns";
import { CheckCircle2, Loader2, MapPin, RefreshCcw, XCircle } from "lucide-react";
import { toast } from "sonner";

import { trpc } from "@/lib/trpc/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const SOURCE_LABELS: Record<string, string> = {
  NYC_DOB_ELEVATOR_COMPLIANCE: "Elevator compliance",
  NYC_DOB_ELEVATOR_VIOLATIONS: "Elevator violations",
  NYC_DOB_BOILER_SAFETY: "Boiler safety",
};

function StatusBadge({ status }: { status: string }) {
  if (status === "SUCCESS") {
    return (
      <Badge className="gap-1 border-emerald-300 bg-emerald-100 text-emerald-800 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-400">
        <CheckCircle2 className="size-3" />
        Success
      </Badge>
    );
  }
  if (status === "FAILED") {
    return (
      <Badge variant="destructive" className="gap-1">
        <XCircle className="size-3" />
        Failed
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="gap-1">
      <Loader2 className="size-3 animate-spin" />
      Running
    </Badge>
  );
}

export function SyncPanel() {
  const utils = trpc.useUtils();
  const status = trpc.sync.status.useQuery(undefined, { refetchInterval: 5000 });
  const history = trpc.sync.history.useQuery({ limit: 20 });
  const trigger = trpc.sync.trigger.useMutation({
    onSuccess: () => {
      toast.success("Sync completed", { description: "Main Schedule has been re-derived." });
      utils.sync.status.invalidate();
      utils.sync.history.invalidate();
      utils.schedule.mainScheduleJobs.invalidate();
      utils.schedule.warnings.invalidate();
    },
    onError: (e) => toast.error("Sync failed", { description: e.message }),
  });

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle>Data Sync — NYC Open Data</CardTitle>
            <CardDescription>Pulls real elevator + boiler records, then re-derives the schedule.</CardDescription>
          </div>
          <Button onClick={() => trigger.mutate(undefined)} disabled={trigger.isPending} className="gap-1.5">
            <RefreshCcw className={trigger.isPending ? "size-4 animate-spin" : "size-4"} />
            {trigger.isPending ? "Syncing…" : "Sync now"}
          </Button>
        </CardHeader>
        <CardContent>
          {status.isLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Source</TableHead>
                  <TableHead>Last run</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Fetched</TableHead>
                  <TableHead className="text-right">Upserted</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {status.data?.lastRuns.map((run) => (
                  <TableRow key={run.id}>
                    <TableCell className="font-medium">{SOURCE_LABELS[run.source] ?? run.source}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDistanceToNow(new Date(run.startedAt), { addSuffix: true })}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={run.status} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{run.recordsFetched}</TableCell>
                    <TableCell className="text-right tabular-nums">{run.recordsUpserted}</TableCell>
                  </TableRow>
                ))}
                {status.data && status.data.lastRuns.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="py-6 text-center text-muted-foreground">
                      No syncs yet — click &quot;Sync now&quot; to pull real data.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-1.5 text-base">
            <MapPin className="size-4 text-muted-foreground" />
            Sync scope
          </CardTitle>
          <CardDescription>Kept small on purpose so the demo stays snappy.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-muted-foreground">Borough</span>
            <Badge variant="outline">{status.data?.scope.borough ?? "—"}</Badge>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-muted-foreground">Buildings (BINs)</span>
            <span className="text-sm font-medium tabular-nums">{status.data?.scope.bins.length ?? 0}</span>
          </div>
        </CardContent>
      </Card>

      <Card className="lg:col-span-3">
        <CardHeader>
          <CardTitle className="text-base">Sync history</CardTitle>
          <CardDescription>Every sync attempt, most recent first.</CardDescription>
        </CardHeader>
        <CardContent>
          {history.isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Source</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Fetched</TableHead>
                  <TableHead className="text-right">Upserted</TableHead>
                  <TableHead>Error</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.data?.map((run) => (
                  <TableRow key={run.id}>
                    <TableCell className="font-medium">{SOURCE_LABELS[run.source] ?? run.source}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDistanceToNow(new Date(run.startedAt), { addSuffix: true })}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={run.status} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{run.recordsFetched}</TableCell>
                    <TableCell className="text-right tabular-nums">{run.recordsUpserted}</TableCell>
                    <TableCell className="max-w-48 truncate text-xs text-destructive">
                      {run.errorMessage ?? ""}
                    </TableCell>
                  </TableRow>
                ))}
                {history.data && history.data.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-6 text-center text-muted-foreground">
                      No history yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
