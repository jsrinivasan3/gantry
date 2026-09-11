import { createTRPCRouter, publicProcedure } from "@/server/trpc/trpc";
import { syncRouter } from "@/server/trpc/routers/sync";
import { scheduleRouter } from "@/server/trpc/routers/schedule";
import { scenarioRouter } from "@/server/trpc/routers/scenario";
import { catalogRouter } from "@/server/trpc/routers/catalog";
import { forecastRouter } from "@/server/trpc/routers/forecast";

export const appRouter = createTRPCRouter({
  sync: syncRouter,
  schedule: scheduleRouter,
  scenario: scenarioRouter,
  catalog: catalogRouter,
  forecast: forecastRouter,

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
