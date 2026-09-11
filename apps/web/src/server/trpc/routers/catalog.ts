import { createTRPCRouter, protectedProcedure } from "@/server/trpc/trpc";

/** Read-only lookups for the synthetic teams/parts catalog — used by scenario editing UI. */
export const catalogRouter = createTRPCRouter({
  teams: protectedProcedure.query(({ ctx }) =>
    ctx.prisma.team.findMany({ where: { active: true }, orderBy: { name: "asc" } })
  ),
  parts: protectedProcedure.query(({ ctx }) =>
    ctx.prisma.part.findMany({ where: { active: true }, orderBy: { name: "asc" } })
  ),
  assets: protectedProcedure.query(({ ctx }) =>
    ctx.prisma.asset.findMany({
      select: { id: true, displayName: true, assetType: true, bin: true, borough: true },
      orderBy: { displayName: "asc" },
    })
  ),
});
