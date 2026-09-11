import { z } from "zod";

import { createTRPCRouter, plannerProcedure, protectedProcedure } from "@/server/trpc/trpc";
import { runForecast } from "@/server/forecasting/engine";

export const forecastRouter = createTRPCRouter({
  run: plannerProcedure
    .input(
      z.object({
        scenarioId: z.string().uuid(),
        startDate: z.coerce.date().optional(),
        endDate: z.coerce.date().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const today = new Date();
      const defaultStart = new Date(today);
      defaultStart.setUTCDate(defaultStart.getUTCDate() - 180);
      const defaultEnd = new Date(today);
      defaultEnd.setUTCDate(defaultEnd.getUTCDate() + 365);

      return runForecast(
        input.scenarioId,
        ctx.session.user.id,
        input.startDate ?? defaultStart,
        input.endDate ?? defaultEnd
      );
    }),

  latest: protectedProcedure
    .input(z.object({ scenarioId: z.string().uuid() }))
    .query(({ ctx, input }) =>
      ctx.prisma.forecastRun.findFirst({
        where: { scenarioId: input.scenarioId, status: "COMPLETED" },
        orderBy: { completedAt: "desc" },
      })
    ),

  results: protectedProcedure
    .input(z.object({ forecastRunId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [workload, parts, cost] = await Promise.all([
        ctx.prisma.workloadForecastDaily.findMany({ where: { forecastRunId: input.forecastRunId }, orderBy: { date: "asc" } }),
        ctx.prisma.partsForecastDaily.findMany({
          where: { forecastRunId: input.forecastRunId },
          include: { part: { select: { name: true, sku: true } } },
          orderBy: { date: "asc" },
        }),
        ctx.prisma.costForecastDaily.findMany({ where: { forecastRunId: input.forecastRunId }, orderBy: { date: "asc" } }),
      ]);
      return { workload, parts, cost };
    }),
});
