import { fetchRequestHandler } from "@trpc/server/adapters/fetch";

import { appConfig } from "@/config/app";
import { appRouter } from "@/server/trpc/routers/_app";
import { createTRPCContext } from "@/server/trpc/trpc";

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: appConfig.apiBasePath,
    req,
    router: appRouter,
    createContext: createTRPCContext,
  });

export { handler as GET, handler as POST };
