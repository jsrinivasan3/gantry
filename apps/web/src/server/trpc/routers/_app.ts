import { createTRPCRouter, publicProcedure } from "@/server/trpc/trpc";
import { syncRouter } from "@/server/trpc/routers/sync";

export const appRouter = createTRPCRouter({
  sync: syncRouter,

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
