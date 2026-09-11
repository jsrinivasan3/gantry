"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import { LineChart as LineChartIcon, Loader2, Package, PlayCircle } from "lucide-react";
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
import { toast } from "sonner";

import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

function monthKey(d: Date | string) {
  return format(new Date(d), "yyyy-MM");
}

const CHART_COLORS = {
  scheduled: "var(--chart-1)",
  reactive: "var(--chart-5)",
  capacity: "#059669",
  labor: "var(--chart-2)",
  parts: "var(--chart-3)",
  filingFee: "var(--chart-4)",
  onHand: "var(--chart-1)",
};

export function ForecastPanel({ scenarioId }: { scenarioId: string }) {
  const utils = trpc.useUtils();
  const latestQuery = trpc.forecast.latest.useQuery({ scenarioId });
  const runForecast = trpc.forecast.run.useMutation({
    onSuccess: () => {
      utils.forecast.latest.invalidate({ scenarioId });
      toast.success("Forecast complete");
    },
    onError: (e) => toast.error("Forecast failed", { description: e.message }),
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

  const totals = useMemo(() => {
    const demandHours = workloadByMonth.reduce((n, m) => n + m.scheduled + m.reactive, 0);
    const totalCost = costByMonth.reduce((n, m) => n + m.laborCost + m.partsCost + m.realFilingFeeCost, 0);
    const realCost = costByMonth.reduce((n, m) => n + m.realFilingFeeCost, 0);
    const stockoutDays = resultsQuery.data?.parts.filter((p) => p.stockoutRisk).length ?? 0;
    return { demandHours, totalCost, realCost, stockoutDays };
  }, [workloadByMonth, costByMonth, resultsQuery.data]);

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
      }));
  }, [resultsQuery.data, activePartId]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={() => runForecast.mutate({ scenarioId })} disabled={runForecast.isPending} className="gap-1.5">
          {runForecast.isPending ? <Loader2 className="size-4 animate-spin" /> : <PlayCircle className="size-4" />}
          {runForecast.isPending ? "Running forecast…" : "Run forecast"}
        </Button>
        {latestQuery.data && (
          <span className="text-xs text-muted-foreground">
            Last run {format(new Date(latestQuery.data.completedAt ?? latestQuery.data.createdAt), "MMM d, yyyy h:mm a")} ·
            covers {format(new Date(latestQuery.data.startDate), "MMM yyyy")} – {format(new Date(latestQuery.data.endDate), "MMM yyyy")}
          </span>
        )}
      </div>

      {runForecast.isPending && (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
          <Skeleton className="h-72 w-full" />
        </div>
      )}

      {!latestQuery.data && !runForecast.isPending && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <div className="flex size-10 items-center justify-center rounded-full bg-muted">
              <LineChartIcon className="size-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">No forecast yet</p>
            <p className="max-w-xs text-xs text-muted-foreground">
              Run one to project workload, parts, and cost from this scenario&apos;s schedule.
            </p>
          </CardContent>
        </Card>
      )}

      {resultsQuery.data && !runForecast.isPending && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Total demand" value={`${Math.round(totals.demandHours).toLocaleString()}h`} />
            <StatCard label="Total cost" value={`$${Math.round(totals.totalCost).toLocaleString()}`} />
            <StatCard label="— of which real $" value={`$${Math.round(totals.realCost).toLocaleString()}`} />
            <StatCard
              label="Stockout-risk days"
              value={totals.stockoutDays.toLocaleString()}
              tone={totals.stockoutDays > 0 ? "warn" : "default"}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Workload — scheduled vs. reactive demand vs. capacity</CardTitle>
              <CardDescription>
                Scheduled = regulatory-cadence compliance work (predictable). Reactive = violation-repair work
                triggered by real open DOB violations.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={workloadByMonth}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="month" fontSize={11} stroke="var(--muted-foreground)" />
                  <YAxis
                    fontSize={11}
                    stroke="var(--muted-foreground)"
                    label={{ value: "hours", angle: -90, position: "insideLeft", fontSize: 11 }}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "var(--popover)",
                      border: "1px solid var(--border)",
                      borderRadius: "var(--radius-md)",
                      fontSize: 12,
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="scheduled" stackId="demand" fill={CHART_COLORS.scheduled} name="Scheduled demand" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="reactive" stackId="demand" fill={CHART_COLORS.reactive} name="Reactive demand" radius={[3, 3, 0, 0]} />
                  <Line type="monotone" dataKey="capacity" stroke={CHART_COLORS.capacity} strokeWidth={2} dot={false} name="Capacity" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Cost — real vs. synthetic, kept separate</CardTitle>
              <CardDescription>
                Labor + parts are synthetic estimates. Filing fees are real dollars from actual filed boiler
                reports — never blended into one number.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={costByMonth}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="month" fontSize={11} stroke="var(--muted-foreground)" />
                  <YAxis
                    fontSize={11}
                    stroke="var(--muted-foreground)"
                    label={{ value: "$", angle: -90, position: "insideLeft", fontSize: 11 }}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "var(--popover)",
                      border: "1px solid var(--border)",
                      borderRadius: "var(--radius-md)",
                      fontSize: 12,
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="laborCost" stackId="cost" fill={CHART_COLORS.labor} name="Labor (synthetic)" />
                  <Bar dataKey="partsCost" stackId="cost" fill={CHART_COLORS.parts} name="Parts (synthetic)" />
                  <Bar
                    dataKey="realFilingFeeCost"
                    stackId="cost"
                    fill={CHART_COLORS.filingFee}
                    name="Filing fees (real $)"
                    radius={[3, 3, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-1.5 text-sm">
                  <Package className="size-4 text-muted-foreground" />
                  Parts — projected on-hand
                </CardTitle>
                <CardDescription>Synthetic catalog. Dashed line is the reorder point.</CardDescription>
              </div>
              <Select value={activePartId ?? ""} onValueChange={(v) => v && setSelectedPartId(v)}>
                <SelectTrigger className="w-48">
                  <SelectValue>
                    {(value: string) => partsOptions.find((p) => p.id === value)?.name ?? "Select a part"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {partsOptions.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={partSeries}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis
                    dataKey="date"
                    fontSize={10}
                    stroke="var(--muted-foreground)"
                    interval={Math.max(1, Math.floor(partSeries.length / 12))}
                  />
                  <YAxis fontSize={11} stroke="var(--muted-foreground)" />
                  <Tooltip
                    contentStyle={{
                      background: "var(--popover)",
                      border: "1px solid var(--border)",
                      borderRadius: "var(--radius-md)",
                      fontSize: 12,
                    }}
                  />
                  <Line type="stepAfter" dataKey="onHand" stroke={CHART_COLORS.onHand} strokeWidth={2} dot={false} name="Projected on-hand" />
                  {activePartReorderPoint !== undefined && (
                    <ReferenceLine y={activePartReorderPoint} stroke="var(--destructive)" strokeDasharray="4 4" label="Reorder point" />
                  )}
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function StatCard({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "warn" }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-1 py-4">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className={`text-xl font-semibold tabular-nums ${tone === "warn" ? "text-amber-600 dark:text-amber-400" : ""}`}>
          {value}
        </span>
      </CardContent>
    </Card>
  );
}
