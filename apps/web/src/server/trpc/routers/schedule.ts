import { z } from "zod";

import { adminProcedure, createTRPCRouter, protectedProcedure } from "@/server/trpc/trpc";
import { deriveMainSchedule } from "@/server/scheduling/deriveAll";
import { computeWarnings } from "@/server/scheduling/warnings";

export const scheduleRouter = createTRPCRouter({
  mainScheduleJobs: protectedProcedure
    .input(z.object({ scenarioId: z.string().uuid().nullable().default(null) }).optional())
    .query(({ ctx, input }) =>
      ctx.prisma.job.findMany({
        where: { scenarioId: input?.scenarioId ?? null },
        include: { asset: true, team: true },
        orderBy: [{ scheduledStart: "asc" }],
      })
    ),

  warnings: protectedProcedure
    .input(z.object({ scenarioId: z.string().uuid().nullable().default(null) }).optional())
    .query(({ input }) => computeWarnings(input?.scenarioId ?? null)),

  deriveNow: adminProcedure.mutation(() => deriveMainSchedule()),
});
