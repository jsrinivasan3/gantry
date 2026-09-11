import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { createTRPCRouter, plannerProcedure, protectedProcedure } from "@/server/trpc/trpc";

async function assertCanEditScenario(
  prisma: import("@prisma/client").PrismaClient,
  scenarioId: string,
  userId: string,
  role: string
) {
  const scenario = await prisma.scenario.findUnique({ where: { id: scenarioId } });
  if (!scenario) throw new TRPCError({ code: "NOT_FOUND" });
  if (scenario.ownerUserId !== userId && role !== "ADMIN") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Only the scenario owner or an Admin can edit it." });
  }
  return scenario;
}

export const scenarioRouter = createTRPCRouter({
  list: protectedProcedure.query(({ ctx }) =>
    ctx.prisma.scenario.findMany({
      where: { OR: [{ ownerUserId: ctx.session.user.id }, { isShared: true }] },
      include: { owner: { select: { displayName: true } }, _count: { select: { jobs: true } } },
      orderBy: { updatedAt: "desc" },
    })
  ),

  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const scenario = await ctx.prisma.scenario.findUnique({
        where: { id: input.id },
        include: { owner: { select: { displayName: true } } },
      });
      if (!scenario) throw new TRPCError({ code: "NOT_FOUND" });
      if (scenario.ownerUserId !== ctx.session.user.id && !scenario.isShared) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      return scenario;
    }),

  /**
   * Deep-copies the Main Schedule (spec §4): every scenarioId=null job gets
   * a new row with a new id, scenarioId set to this scenario, and
   * copiedFromJobId pointing back — editing the copy never touches the
   * original. Job-parts are copied line-for-line alongside each job.
   */
  create: plannerProcedure
    .input(z.object({ name: z.string().min(1), description: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const revision = await ctx.prisma.scheduleRevision.create({
        data: { createdByUserId: ctx.session.user.id, note: `Copied for scenario "${input.name}"` },
      });

      const scenario = await ctx.prisma.scenario.create({
        data: {
          ownerUserId: ctx.session.user.id,
          name: input.name,
          description: input.description,
          copiedFromScheduleRevisionId: revision.id,
        },
      });

      const mainJobs = await ctx.prisma.job.findMany({
        where: { scenarioId: null },
        include: { jobParts: true },
      });

      for (const job of mainJobs) {
        const copy = await ctx.prisma.job.create({
          data: {
            scenarioId: scenario.id,
            copiedFromJobId: job.id,
            assetId: job.assetId,
            teamId: job.teamId,
            source: job.source,
            externalId: null, // the (source, externalId) unique constraint is Main-Schedule-only
            jobType: job.jobType,
            title: job.title,
            status: job.status,
            scheduledStart: job.scheduledStart,
            scheduledEnd: job.scheduledEnd,
            estimatedLaborHours: job.estimatedLaborHours,
            actualLaborHours: job.actualLaborHours,
            defectsFound: job.defectsFound,
            realFilingFee: job.realFilingFee,
            priority: job.priority,
            linkedJobId: job.linkedJobId,
            completedAt: job.completedAt,
          },
        });
        if (job.jobParts.length) {
          await ctx.prisma.jobPart.createMany({
            data: job.jobParts.map((jp) => ({
              jobId: copy.id,
              partId: jp.partId,
              quantityPlanned: jp.quantityPlanned,
              quantityConsumed: jp.quantityConsumed,
            })),
          });
        }
      }

      return scenario;
    }),

  updateJob: plannerProcedure
    .input(
      z.object({
        scenarioId: z.string().uuid(),
        jobId: z.string().uuid(),
        scheduledStart: z.coerce.date().optional(),
        scheduledEnd: z.coerce.date().optional(),
        teamId: z.string().uuid().nullable().optional(),
        status: z.enum(["PLANNED", "IN_PROGRESS", "COMPLETED", "CANCELLED", "UNSCHEDULED"]).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertCanEditScenario(ctx.prisma, input.scenarioId, ctx.session.user.id, ctx.session.user.role);

      const job = await ctx.prisma.job.findUnique({ where: { id: input.jobId } });
      if (!job || job.scenarioId !== input.scenarioId) throw new TRPCError({ code: "NOT_FOUND" });

      const scheduledStart = input.scheduledStart ?? job.scheduledStart;
      const scheduledEnd = input.scheduledEnd ?? job.scheduledEnd;
      if (scheduledStart > scheduledEnd) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "scheduledStart must be <= scheduledEnd" });
      }

      return ctx.prisma.job.update({
        where: { id: input.jobId },
        data: {
          scheduledStart,
          scheduledEnd,
          teamId: input.teamId,
          status: input.status,
        },
      });
    }),

  addJob: plannerProcedure
    .input(
      z.object({
        scenarioId: z.string().uuid(),
        assetId: z.string().uuid(),
        title: z.string().min(1),
        scheduledStart: z.coerce.date(),
        scheduledEnd: z.coerce.date(),
        teamId: z.string().uuid().nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertCanEditScenario(ctx.prisma, input.scenarioId, ctx.session.user.id, ctx.session.user.role);
      if (input.scheduledStart > input.scheduledEnd) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "scheduledStart must be <= scheduledEnd" });
      }
      return ctx.prisma.job.create({
        data: {
          scenarioId: input.scenarioId,
          assetId: input.assetId,
          teamId: input.teamId,
          source: "MANUAL",
          jobType: "OTHER",
          title: input.title,
          status: "PLANNED",
          scheduledStart: input.scheduledStart,
          scheduledEnd: input.scheduledEnd,
        },
      });
    }),

  delete: plannerProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await assertCanEditScenario(ctx.prisma, input.id, ctx.session.user.id, ctx.session.user.role);
      await ctx.prisma.scenario.delete({ where: { id: input.id } });
      return { ok: true };
    }),
});
