import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { adminProcedure, createTRPCRouter, plannerProcedure, protectedProcedure } from "@/server/trpc/trpc";
import { attachJobParts } from "@/server/scheduling/attachJobParts";

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

  /** Planner marks a scenario ready for Admin review (spec §5). */
  submitForPromotion: plannerProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const scenario = await assertCanEditScenario(ctx.prisma, input.id, ctx.session.user.id, ctx.session.user.role);
      if (scenario.status !== "DRAFT") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Only a DRAFT scenario can be submitted." });
      }
      return ctx.prisma.scenario.update({ where: { id: input.id }, data: { status: "SUBMITTED" } });
    }),

  /**
   * The "explicit reviewed diff" spec §4 requires before promotion: every
   * changed field between a scenario job and the Main Schedule job it was
   * copied from, plus any ad-hoc jobs the scenario added.
   */
  diff: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const scenarioJobs = await ctx.prisma.job.findMany({
        where: { scenarioId: input.id },
        include: { asset: { select: { displayName: true } }, team: { select: { name: true } } },
      });

      const copiedIds = scenarioJobs.filter((j) => j.copiedFromJobId).map((j) => j.copiedFromJobId as string);
      const mainJobs = await ctx.prisma.job.findMany({ where: { id: { in: copiedIds } } });
      const mainById = new Map(mainJobs.map((j) => [j.id, j]));

      const changed: { jobId: string; assetName: string; title: string; fields: string[] }[] = [];
      const added: { jobId: string; assetName: string; title: string }[] = [];

      for (const job of scenarioJobs) {
        if (!job.copiedFromJobId) {
          added.push({ jobId: job.id, assetName: job.asset.displayName, title: job.title });
          continue;
        }
        const original = mainById.get(job.copiedFromJobId);
        if (!original) continue;

        const fields: string[] = [];
        if (job.scheduledStart.getTime() !== original.scheduledStart.getTime()) fields.push("scheduledStart");
        if (job.scheduledEnd.getTime() !== original.scheduledEnd.getTime()) fields.push("scheduledEnd");
        if (job.teamId !== original.teamId) fields.push("teamId");
        if (job.status !== original.status) fields.push("status");

        if (fields.length > 0) {
          changed.push({ jobId: job.id, assetName: job.asset.displayName, title: job.title, fields });
        }
      }

      return { changed, added };
    }),

  /**
   * Admin-only promotion (spec §4/§5): applies each changed field from the
   * scenario onto the real Main Schedule job it was copied from, and
   * creates the scenario's ad-hoc jobs directly on the Main Schedule.
   * Never touches jobs the scenario didn't change.
   */
  promote: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const scenario = await ctx.prisma.scenario.findUnique({ where: { id: input.id } });
      if (!scenario) throw new TRPCError({ code: "NOT_FOUND" });

      const scenarioJobs = await ctx.prisma.job.findMany({
        where: { scenarioId: input.id },
        include: { jobParts: true },
      });

      let updatedCount = 0;
      let createdCount = 0;

      for (const job of scenarioJobs) {
        if (job.copiedFromJobId) {
          const original = await ctx.prisma.job.findUnique({ where: { id: job.copiedFromJobId } });
          if (!original || original.scenarioId !== null) continue;
          if (
            job.scheduledStart.getTime() === original.scheduledStart.getTime() &&
            job.scheduledEnd.getTime() === original.scheduledEnd.getTime() &&
            job.teamId === original.teamId &&
            job.status === original.status
          ) {
            continue;
          }
          await ctx.prisma.job.update({
            where: { id: original.id },
            data: {
              scheduledStart: job.scheduledStart,
              scheduledEnd: job.scheduledEnd,
              teamId: job.teamId,
              status: job.status,
            },
          });
          await ctx.prisma.auditEvent.create({
            data: {
              entityType: "Job",
              entityId: original.id,
              operation: "promote_update",
              actorUserId: ctx.session.user.id,
              changes: {
                scenarioId: input.id,
                scheduledStart: job.scheduledStart.toISOString(),
                scheduledEnd: job.scheduledEnd.toISOString(),
                teamId: job.teamId,
                status: job.status,
              },
            },
          });
          updatedCount += 1;
        } else {
          const created = await ctx.prisma.job.create({
            data: {
              scenarioId: null,
              assetId: job.assetId,
              teamId: job.teamId,
              source: "MANUAL",
              jobType: job.jobType,
              title: job.title,
              status: job.status,
              scheduledStart: job.scheduledStart,
              scheduledEnd: job.scheduledEnd,
              estimatedLaborHours: job.estimatedLaborHours,
              priority: job.priority,
            },
          });
          if (job.jobParts.length) {
            await ctx.prisma.jobPart.createMany({
              data: job.jobParts.map((jp) => ({
                jobId: created.id,
                partId: jp.partId,
                quantityPlanned: jp.quantityPlanned,
              })),
            });
          } else {
            await attachJobParts(created.id, job.jobType);
          }
          await ctx.prisma.auditEvent.create({
            data: {
              entityType: "Job",
              entityId: created.id,
              operation: "promote_create",
              actorUserId: ctx.session.user.id,
              changes: { scenarioId: input.id, fromScenarioJobId: job.id },
            },
          });
          createdCount += 1;
        }
      }

      await ctx.prisma.scenario.update({ where: { id: input.id }, data: { status: "PROMOTED" } });

      return { updatedCount, createdCount };
    }),
});
