"use client";

import { trpc } from "@/lib/trpc/client";

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

  const submit = trpc.scenario.submitForPromotion.useMutation({
    onSuccess: () => utils.scenario.get.invalidate({ id: scenarioId }),
  });
  const promote = trpc.scenario.promote.useMutation({
    onSuccess: () => {
      utils.scenario.get.invalidate({ id: scenarioId });
      utils.schedule.mainScheduleJobs.invalidate({ scenarioId: null });
    },
  });

  if (diffQuery.isLoading) return <p className="text-sm text-muted-foreground">Loading diff…</p>;
  const diff = diffQuery.data!;

  const noChanges = diff.changed.length === 0 && diff.added.length === 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        {status === "DRAFT" && isOwner && (
          <button
            className="rounded bg-black px-3 py-1.5 text-sm text-white disabled:opacity-50"
            disabled={noChanges || submit.isPending}
            onClick={() => submit.mutate({ id: scenarioId })}
          >
            {submit.isPending ? "Submitting…" : "Submit for promotion"}
          </button>
        )}
        {status === "SUBMITTED" && isAdmin && (
          <button
            className="rounded bg-green-700 px-3 py-1.5 text-sm text-white disabled:opacity-50"
            disabled={promote.isPending}
            onClick={() => {
              if (confirm("Promote this scenario into the Main Schedule? This applies every change listed below.")) {
                promote.mutate({ id: scenarioId });
              }
            }}
          >
            {promote.isPending ? "Promoting…" : "Approve & promote to Main Schedule"}
          </button>
        )}
        {status === "PROMOTED" && <span className="text-sm text-green-700">Promoted to Main Schedule.</span>}
        {promote.data && (
          <span className="text-xs text-muted-foreground">
            {promote.data.updatedCount} updated, {promote.data.createdCount} created.
          </span>
        )}
      </div>

      {noChanges && <p className="text-sm text-muted-foreground">No changes from the Main Schedule yet.</p>}

      {diff.changed.length > 0 && (
        <section>
          <h3 className="mb-2 text-sm font-semibold">Changed jobs ({diff.changed.length})</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th className="pb-1">Asset</th>
                <th className="pb-1">Job</th>
                <th className="pb-1">Changed fields</th>
              </tr>
            </thead>
            <tbody>
              {diff.changed.map((c) => (
                <tr key={c.jobId} className="border-t">
                  <td className="py-1.5">{c.assetName}</td>
                  <td className="py-1.5">{c.title}</td>
                  <td className="py-1.5">{c.fields.join(", ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {diff.added.length > 0 && (
        <section>
          <h3 className="mb-2 text-sm font-semibold">New ad-hoc jobs ({diff.added.length})</h3>
          <ul className="text-sm">
            {diff.added.map((a) => (
              <li key={a.jobId} className="border-t py-1.5">
                {a.assetName}: {a.title}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
