"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { FolderKanban, Loader2, Plus, User } from "lucide-react";
import { toast } from "sonner";

import { trpc } from "@/lib/trpc/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const STATUS_STYLES: Record<string, string> = {
  DRAFT: "",
  SUBMITTED: "border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-800 dark:bg-amber-500/15 dark:text-amber-400",
  PROMOTED:
    "border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-400",
  ARCHIVED: "text-muted-foreground",
};

export function ScenarioList({ canCreate }: { canCreate: boolean }) {
  const router = useRouter();
  const utils = trpc.useUtils();
  const scenariosQuery = trpc.scenario.list.useQuery();
  const createScenario = trpc.scenario.create.useMutation({
    onSuccess: (scenario) => {
      setOpen(false);
      setName("");
      utils.scenario.list.invalidate();
      toast.success("Scenario created", { description: `"${scenario.name}" copied the full Main Schedule.` });
      router.push(`/scenarios/${scenario.id}`);
    },
    onError: (e) => toast.error("Couldn't create scenario", { description: e.message }),
  });
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  return (
    <div className="flex flex-col gap-4">
      {canCreate && (
        <div className="flex justify-end">
          <Button onClick={() => setOpen(true)} className="gap-1.5">
            <Plus className="size-4" />
            New scenario
          </Button>
        </div>
      )}

      {scenariosQuery.isLoading && (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      )}

      {scenariosQuery.data?.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <div className="flex size-10 items-center justify-center rounded-full bg-muted">
              <FolderKanban className="size-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">No scenarios yet</p>
            <p className="max-w-xs text-xs text-muted-foreground">
              {canCreate
                ? "Create one to copy the Main Schedule into a sandbox you can safely rearrange."
                : "Ask a Planner or Admin to create one and share it with you."}
            </p>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col gap-3">
        {scenariosQuery.data?.map((s) => (
          <Link key={s.id} href={`/scenarios/${s.id}`}>
            <Card className="transition-colors hover:border-primary/40">
              <CardContent className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <FolderKanban className="size-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{s.name}</p>
                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                      <User className="size-3" />
                      {s.owner.displayName} · {s._count.jobs} jobs · updated{" "}
                      {formatDistanceToNow(new Date(s.updatedAt), { addSuffix: true })}
                    </p>
                  </div>
                </div>
                <Badge variant="outline" className={STATUS_STYLES[s.status] ?? ""}>
                  {s.status}
                </Badge>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>New scenario</DialogTitle>
            <DialogDescription>
              This deep-copies every Main Schedule job into an isolated sandbox — it can take a few
              seconds for the full portfolio.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="scenario-name">Name</Label>
              <Input
                id="scenario-name"
                autoFocus
                placeholder="Q1 batch CAT1 tests"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="scenario-description">Description (optional)</Label>
              <Input
                id="scenario-description"
                placeholder="What are you planning?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!name.trim() || createScenario.isPending}
              onClick={() => createScenario.mutate({ name: name.trim(), description: description.trim() || undefined })}
              className="gap-1.5"
            >
              {createScenario.isPending && <Loader2 className="size-4 animate-spin" />}
              {createScenario.isPending ? "Copying Main Schedule…" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
