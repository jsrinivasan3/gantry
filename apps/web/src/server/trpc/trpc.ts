import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";

import { auth } from "@/auth";
import { prisma } from "@/server/db/client";

export async function createTRPCContext() {
  const session = await auth();
  return { session, prisma };
}

type Context = Awaited<ReturnType<typeof createTRPCContext>>;

const t = initTRPC.context<Context>().create({
  transformer: superjson,
});

export const createTRPCRouter = t.router;
export const publicProcedure = t.procedure;

const enforceUserIsAuthed = t.middleware(({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({ ctx: { ...ctx, session: { ...ctx.session, user: ctx.session.user } } });
});

export const protectedProcedure = t.procedure.use(enforceUserIsAuthed);

const ROLE_RANK = { VIEWER: 0, PLANNER: 1, ADMIN: 2 } as const;
type Role = keyof typeof ROLE_RANK;

export function requireRole(minRole: Role) {
  return t.middleware(({ ctx, next }) => {
    if (!ctx.session?.user) {
      throw new TRPCError({ code: "UNAUTHORIZED" });
    }
    const userRole = ctx.session.user.role as Role;
    if (ROLE_RANK[userRole] < ROLE_RANK[minRole]) {
      throw new TRPCError({ code: "FORBIDDEN" });
    }
    return next({ ctx });
  });
}

export const plannerProcedure = protectedProcedure.use(requireRole("PLANNER"));
export const adminProcedure = protectedProcedure.use(requireRole("ADMIN"));
