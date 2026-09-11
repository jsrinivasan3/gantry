import { TRPCError } from "@trpc/server";
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

  /**
   * Admin-only direct edit of a Main Schedule job (spec §5: "Admin — edit
   * the Main Schedule directly"). This is also the CSV/manual-entry
   * fallback for an UNSCHEDULED job — an Admin sets the real date once
   * it's known, rather than Gantry ever guessing one (spec §4/§14).
   */
  updateMainJob: adminProcedure
    .input(
      z.object({
        jobId: z.string().uuid(),
        scheduledStart: z.coerce.date().optional(),
        scheduledEnd: z.coerce.date().optional(),
        teamId: z.string().uuid().nullable().optional(),
        status: z.enum(["PLANNED", "IN_PROGRESS", "COMPLETED", "CANCELLED", "UNSCHEDULED"]).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const job = await ctx.prisma.job.findUnique({ where: { id: input.jobId } });
      if (!job || job.scenarioId !== null) throw new TRPCError({ code: "NOT_FOUND" });

      const scheduledStart = input.scheduledStart ?? job.scheduledStart;
      const scheduledEnd = input.scheduledEnd ?? job.scheduledEnd;
      if (scheduledStart > scheduledEnd) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "scheduledStart must be <= scheduledEnd" });
      }

      // Setting a real date on an UNSCHEDULED job promotes it back to PLANNED
      // unless the caller explicitly chose another status.
      const status = input.status ?? (job.status === "UNSCHEDULED" ? "PLANNED" : job.status);

      return ctx.prisma.job.update({
        where: { id: input.jobId },
        data: { scheduledStart, scheduledEnd, teamId: input.teamId, status },
      });
    }),
});
