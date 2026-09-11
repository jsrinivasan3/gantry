"use client";

import { useState } from "react";
import Link from "next/link";

import { trpc } from "@/lib/trpc/client";

export function ScenarioList({ canCreate }: { canCreate: boolean }) {
  const utils = trpc.useUtils();
  const scenariosQuery = trpc.scenario.list.useQuery();
  const createScenario = trpc.scenario.create.useMutation({
    onSuccess: () => {
      setName("");
      utils.scenario.list.invalidate();
    },
  });
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-4">
      {canCreate && (
        <div className="flex gap-2">
          <input
            className="flex-1 rounded border px-3 py-1.5 text-sm"
            placeholder="New scenario name (e.g. 'Q1 batch CAT1 tests')"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button
            className="rounded bg-black px-3 py-1.5 text-sm text-white disabled:opacity-50"
            disabled={!name.trim() || createScenario.isPending}
            onClick={() => {
              setError(null);
              createScenario.mutate({ name: name.trim() }, { onError: (e) => setError(e.message) });
            }}
          >
            {createScenario.isPending ? "Copying Main Schedule…" : "Create scenario"}
          </button>
        </div>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}

      <ul className="divide-y rounded-lg border">
        {scenariosQuery.data?.map((s) => (
          <li key={s.id} className="flex items-center justify-between px-4 py-3 text-sm">
            <div>
              <Link className="font-medium underline" href={`/scenarios/${s.id}`}>
                {s.name}
              </Link>
              <p className="text-xs text-muted-foreground">
                {s._count.jobs} jobs · owner {s.owner.displayName} · {s.status}
              </p>
            </div>
          </li>
        ))}
        {scenariosQuery.data?.length === 0 && (
          <li className="px-4 py-6 text-center text-sm text-muted-foreground">
            No scenarios yet.
          </li>
        )}
      </ul>
    </div>
  );
}
