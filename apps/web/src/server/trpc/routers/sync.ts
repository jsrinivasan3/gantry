import { z } from "zod";

import { adminProcedure, createTRPCRouter, protectedProcedure } from "@/server/trpc/trpc";
import { getSyncScope, runFullSync, runSingleSync } from "@/server/sync/nycOpenData/runSync";

const SOURCE_KEYS = ["elevatorCompliance", "elevatorViolations", "boilerSafety"] as const;

export const syncRouter = createTRPCRouter({
  status: protectedProcedure.query(async ({ ctx }) => {
    const [lastRuns, scope] = await Promise.all([
      ctx.prisma.syncRun.findMany({
        distinct: ["source"],
        orderBy: { startedAt: "desc" },
      }),
      getSyncScope(),
    ]);
    return { lastRuns, scope };
  }),

  history: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(200).default(50) }).optional())
    .query(({ ctx, input }) =>
      ctx.prisma.syncRun.findMany({
        orderBy: { startedAt: "desc" },
        take: input?.limit ?? 50,
      })
    ),

  trigger: adminProcedure
    .input(z.object({ source: z.enum(SOURCE_KEYS).optional() }).optional())
    .mutation(async ({ input }) => {
      if (input?.source) {
        return runSingleSync(input.source);
      }
      return runFullSync();
    }),

  configUpdate: adminProcedure
    .input(
      z.object({
        borough: z.string().min(1),
        bins: z.array(z.string().min(1)).min(1),
      })
    )
    .mutation(({ ctx, input }) =>
      ctx.prisma.syncConfig.upsert({
        where: { id: "singleton" },
        update: { borough: input.borough, bins: input.bins },
        create: { id: "singleton", borough: input.borough, bins: input.bins },
      })
    ),
});
