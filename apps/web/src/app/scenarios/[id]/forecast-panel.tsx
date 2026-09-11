"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { trpc } from "@/lib/trpc/client";

function monthKey(d: Date | string) {
  return format(new Date(d), "yyyy-MM");
}

export function ForecastPanel({ scenarioId }: { scenarioId: string }) {
  const utils = trpc.useUtils();
  const latestQuery = trpc.forecast.latest.useQuery({ scenarioId });
  const runForecast = trpc.forecast.run.useMutation({
    onSuccess: () => utils.forecast.latest.invalidate({ scenarioId }),
  });

  const forecastRunId = latestQuery.data?.id;
  const resultsQuery = trpc.forecast.results.useQuery(
    { forecastRunId: forecastRunId! },
    { enabled: !!forecastRunId }
  );

  const [selectedPartId, setSelectedPartId] = useState<string | null>(null);

  const workloadByMonth = useMemo(() => {
    if (!resultsQuery.data) return [];
    const buckets = new Map<string, { month: string; scheduled: number; reactive: number; capacity: number }>();
    for (const row of resultsQuery.data.workload) {
      const key = monthKey(row.date);
      const bucket = buckets.get(key) ?? { month: key, scheduled: 0, reactive: 0, capacity: 0 };
      if (row.demandKind === "scheduled") {
        bucket.scheduled += Number(row.demandHours);
        bucket.capacity += Number(row.capacityHours);
      } else {
        bucket.reactive += Number(row.demandHours);
      }
      buckets.set(key, bucket);
    }
    return Array.from(buckets.values()).sort((a, b) => a.month.localeCompare(b.month));
  }, [resultsQuery.data]);

  const costByMonth = useMemo(() => {
    if (!resultsQuery.data) return [];
    const buckets = new Map<string, { month: string; laborCost: number; partsCost: number; realFilingFeeCost: number }>();
    for (const row of resultsQuery.data.cost) {
      const key = monthKey(row.date);
      const bucket = buckets.get(key) ?? { month: key, laborCost: 0, partsCost: 0, realFilingFeeCost: 0 };
      bucket.laborCost += Number(row.laborCost);
      bucket.partsCost += Number(row.partsCost);
      bucket.realFilingFeeCost += Number(row.realFilingFeeCost);
      buckets.set(key, bucket);
    }
    return Array.from(buckets.values()).sort((a, b) => a.month.localeCompare(b.month));
  }, [resultsQuery.data]);

  const partsOptions = useMemo(() => {
    if (!resultsQuery.data) return [];
    const seen = new Map<string, string>();
    for (const row of resultsQuery.data.parts) seen.set(row.partId, row.part.name);
    return Array.from(seen.entries()).map(([id, name]) => ({ id, name }));
  }, [resultsQuery.data]);

  const activePartId = selectedPartId ?? partsOptions[0]?.id ?? null;

  const catalogPartsQuery = trpc.catalog.parts.useQuery();
  const activePartReorderPoint = catalogPartsQuery.data?.find((p) => p.id === activePartId)?.reorderPoint;

  const partSeries = useMemo(() => {
    if (!resultsQuery.data || !activePartId) return [];
    return resultsQuery.data.parts
      .filter((r) => r.partId === activePartId)
      .map((r) => ({
        date: format(new Date(r.date), "MMM d, yyyy"),
        onHand: r.projectedOnHand,
        reorderQty: r.suggestedReorderQuantity,
      }));
  }, [resultsQuery.data, activePartId]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <button
          className="rounded bg-black px-3 py-1.5 text-sm text-white disabled:opacity-50"
          disabled={runForecast.isPending}
          onClick={() => runForecast.mutate({ scenarioId })}
        >
          {runForecast.isPending ? "Running forecast…" : "Run forecast"}
        </button>
        {latestQuery.data && (
          <span className="text-xs text-muted-foreground">
            Last run {format(new Date(latestQuery.data.completedAt ?? latestQuery.data.createdAt), "MMM d, yyyy h:mm a")} ·{" "}
            {format(new Date(latestQuery.data.startDate), "MMM yyyy")} – {format(new Date(latestQuery.data.endDate), "MMM yyyy")}
          </span>
        )}
      </div>

      {!latestQuery.data && !runForecast.isPending && (
        <p className="text-sm text-muted-foreground">No forecast yet — click &quot;Run forecast&quot;.</p>
      )}

      {resultsQuery.data && (
        <>
          <section>
            <h3 className="mb-1 text-sm font-semibold">Workload — scheduled vs. reactive demand vs. capacity</h3>
            <p className="mb-2 text-xs text-muted-foreground">
              Scheduled = regulatory-cadence compliance work (predictable). Reactive = violation-repair work
              triggered by real open DOB violations.
            </p>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={workloadByMonth}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" fontSize={11} />
                <YAxis fontSize={11} label={{ value: "hours", angle: -90, position: "insideLeft", fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="scheduled" stackId="demand" fill="#2563eb" name="Scheduled demand" />
                <Bar dataKey="reactive" stackId="demand" fill="#dc2626" name="Reactive demand" />
                <Line type="monotone" dataKey="capacity" stroke="#059669" strokeWidth={2} dot={false} name="Capacity" />
              </BarChart>
            </ResponsiveContainer>
          </section>

          <section>
            <h3 className="mb-1 text-sm font-semibold">Cost — real vs. synthetic, kept separate</h3>
            <p className="mb-2 text-xs text-muted-foreground">
              Labor + parts are synthetic estimates. Filing fees are real dollars from actual filed boiler
              reports — never blended into one number.
            </p>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={costByMonth}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" fontSize={11} />
                <YAxis fontSize={11} label={{ value: "$", angle: -90, position: "insideLeft", fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="laborCost" stackId="cost" fill="#7c3aed" name="Labor (synthetic)" />
                <Bar dataKey="partsCost" stackId="cost" fill="#0891b2" name="Parts (synthetic)" />
                <Bar dataKey="realFilingFeeCost" stackId="cost" fill="#d97706" name="Filing fees (real $)" />
              </BarChart>
            </ResponsiveContainer>
          </section>

          <section>
            <div className="mb-1 flex items-center justify-between">
              <h3 className="text-sm font-semibold">Parts — projected on-hand</h3>
              <select
                className="rounded border px-2 py-1 text-xs"
                value={activePartId ?? ""}
                onChange={(e) => setSelectedPartId(e.target.value)}
              >
                {partsOptions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <p className="mb-2 text-xs text-muted-foreground">Synthetic parts catalog. A marker shows a suggested reorder date.</p>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={partSeries}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" fontSize={10} interval={Math.max(1, Math.floor(partSeries.length / 12))} />
                <YAxis fontSize={11} />
                <Tooltip />
                <Line type="stepAfter" dataKey="onHand" stroke="#2563eb" dot={false} name="Projected on-hand" />
                {activePartReorderPoint !== undefined && (
                  <ReferenceLine y={activePartReorderPoint} stroke="#dc2626" strokeDasharray="4 4" label="Reorder point" />
                )}
              </LineChart>
            </ResponsiveContainer>
          </section>
        </>
      )}
    </div>
  );
}
