import { createTRPCRouter, publicProcedure } from "@/server/trpc/trpc";

export const appRouter = createTRPCRouter({
  health: publicProcedure.query(async ({ ctx }) => {
    const [userCount, assetCount] = await Promise.all([
      ctx.prisma.user.count(),
      ctx.prisma.asset.count(),
    ]);
    return {
      ok: true,
      time: new Date().toISOString(),
      userCount,
      assetCount,
    };
  }),
});

export type AppRouter = typeof appRouter;
