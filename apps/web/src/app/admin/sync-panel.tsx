"use client";

import { useState } from "react";

import { trpc } from "@/lib/trpc/client";

const SOURCE_LABELS: Record<string, string> = {
  NYC_DOB_ELEVATOR_COMPLIANCE: "Elevator compliance",
  NYC_DOB_ELEVATOR_VIOLATIONS: "Elevator violations",
  NYC_DOB_BOILER_SAFETY: "Boiler safety",
};

export function SyncPanel() {
  const utils = trpc.useUtils();
  const status = trpc.sync.status.useQuery();
  const trigger = trpc.sync.trigger.useMutation({
    onSuccess: () => utils.sync.status.invalidate(),
  });
  const [error, setError] = useState<string | null>(null);

  return (
    <section className="rounded-lg border p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-medium">Data Sync — NYC Open Data</h2>
        <button
          className="rounded bg-black px-3 py-1.5 text-sm text-white disabled:opacity-50"
          disabled={trigger.isPending}
          onClick={() => {
            setError(null);
            trigger.mutate(undefined, {
              onError: (e) => setError(e.message),
            });
          }}
        >
          {trigger.isPending ? "Syncing…" : "Sync now"}
        </button>
      </div>

      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}

      <p className="mb-3 text-xs text-muted-foreground">
        Scope: {status.data?.scope.borough} · {status.data?.scope.bins.length ?? 0} BINs
      </p>

      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-muted-foreground">
            <th className="pb-1">Source</th>
            <th className="pb-1">Last run</th>
            <th className="pb-1">Status</th>
            <th className="pb-1">Fetched</th>
            <th className="pb-1">Upserted</th>
          </tr>
        </thead>
        <tbody>
          {status.data?.lastRuns.map((run) => (
            <tr key={run.id} className="border-t">
              <td className="py-1.5">{SOURCE_LABELS[run.source] ?? run.source}</td>
              <td className="py-1.5">{new Date(run.startedAt).toLocaleString()}</td>
              <td className="py-1.5">{run.status}</td>
              <td className="py-1.5">{run.recordsFetched}</td>
              <td className="py-1.5">{run.recordsUpserted}</td>
            </tr>
          ))}
          {status.data && status.data.lastRuns.length === 0 && (
            <tr>
              <td className="py-3 text-muted-foreground" colSpan={5}>
                No syncs yet — click &quot;Sync now&quot;.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  );
}
