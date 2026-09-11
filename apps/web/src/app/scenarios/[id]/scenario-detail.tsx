"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { trpc } from "@/lib/trpc/client";
import { Gantt } from "@/components/gantt/Gantt";
import { ForecastPanel } from "@/app/scenarios/[id]/forecast-panel";

export function ScenarioDetail({ scenarioId }: { scenarioId: string }) {
  const router = useRouter();
  const scenarioQuery = trpc.scenario.get.useQuery({ id: scenarioId });
  const [showAddJob, setShowAddJob] = useState(false);
  const [tab, setTab] = useState<"gantt" | "forecast">("gantt");

  if (scenarioQuery.isLoading) return <p className="text-sm text-muted-foreground">Loading scenario…</p>;
  if (scenarioQuery.error) return <p className="text-sm text-red-600">{scenarioQuery.error.message}</p>;
  const scenario = scenarioQuery.data!;

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{scenario.name}</h1>
          <p className="text-sm text-muted-foreground">
            {scenario.description || "No description"} · owner {scenario.owner.displayName} · {scenario.status}
          </p>
        </div>
        <div className="flex gap-2">
          <button className="rounded border px-3 py-1.5 text-sm" onClick={() => setShowAddJob((v) => !v)}>
            {showAddJob ? "Cancel" : "Add ad-hoc job"}
          </button>
          <DeleteScenarioButton scenarioId={scenarioId} onDeleted={() => router.push("/scenarios")} />
        </div>
      </header>

      {showAddJob && <AddJobForm scenarioId={scenarioId} onDone={() => setShowAddJob(false)} />}

      <div className="flex gap-1 border-b text-sm">
        <button
          className={`px-3 py-1.5 ${tab === "gantt" ? "border-b-2 border-black font-medium" : "text-muted-foreground"}`}
          onClick={() => setTab("gantt")}
        >
          Gantt
        </button>
        <button
          className={`px-3 py-1.5 ${tab === "forecast" ? "border-b-2 border-black font-medium" : "text-muted-foreground"}`}
          onClick={() => setTab("forecast")}
        >
          Forecast
        </button>
      </div>

      {tab === "gantt" ? <Gantt scenarioId={scenarioId} editable /> : <ForecastPanel scenarioId={scenarioId} />}
    </div>
  );
}

function AddJobForm({ scenarioId, onDone }: { scenarioId: string; onDone: () => void }) {
  const utils = trpc.useUtils();
  const assetsQuery = trpc.catalog.assets.useQuery();
  const addJob = trpc.scenario.addJob.useMutation({
    onSuccess: () => {
      utils.schedule.mainScheduleJobs.invalidate({ scenarioId });
      onDone();
    },
  });

  const [assetId, setAssetId] = useState("");
  const [title, setTitle] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-wrap items-end gap-2 rounded-lg border p-3 text-sm">
      <label className="flex flex-col gap-0.5">
        Asset
        <select className="rounded border px-2 py-1" value={assetId} onChange={(e) => setAssetId(e.target.value)}>
          <option value="">Select…</option>
          {assetsQuery.data?.map((a) => (
            <option key={a.id} value={a.id}>
              {a.displayName}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-0.5">
        Title
        <input className="rounded border px-2 py-1" value={title} onChange={(e) => setTitle(e.target.value)} />
      </label>
      <label className="flex flex-col gap-0.5">
        Start
        <input type="date" className="rounded border px-2 py-1" value={start} onChange={(e) => setStart(e.target.value)} />
      </label>
      <label className="flex flex-col gap-0.5">
        End
        <input type="date" className="rounded border px-2 py-1" value={end} onChange={(e) => setEnd(e.target.value)} />
      </label>
      <button
        className="rounded bg-black px-3 py-1.5 text-white disabled:opacity-50"
        disabled={!assetId || !title || !start || !end || addJob.isPending}
        onClick={() => {
          setError(null);
          addJob.mutate(
            { scenarioId, assetId, title, scheduledStart: new Date(start), scheduledEnd: new Date(end) },
            { onError: (e) => setError(e.message) }
          );
        }}
      >
        Add
      </button>
      {error && <p className="w-full text-xs text-red-600">{error}</p>}
    </div>
  );
}

function DeleteScenarioButton({ scenarioId, onDeleted }: { scenarioId: string; onDeleted: () => void }) {
  const utils = trpc.useUtils();
  const deleteScenario = trpc.scenario.delete.useMutation({
    onSuccess: () => {
      utils.scenario.list.invalidate();
      onDeleted();
    },
  });

  return (
    <button
      className="rounded border border-red-300 px-3 py-1.5 text-sm text-red-700 disabled:opacity-50"
      disabled={deleteScenario.isPending}
      onClick={() => {
        if (confirm("Delete this scenario? This cannot be undone.")) {
          deleteScenario.mutate({ id: scenarioId });
        }
      }}
    >
      Delete
    </button>
  );
}
