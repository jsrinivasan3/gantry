import { NextResponse } from "next/server";

import { runFullSync } from "@/server/sync/nycOpenData/runSync";

/**
 * Scheduled sync entry point (spec §2.4: "run it as a scheduled job — a
 * Vercel Cron hitting an API route"). Configure a Vercel Cron to hit this
 * route on a nightly cadence with `Authorization: Bearer $CRON_SECRET`.
 */
export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runFullSync();
  return NextResponse.json({ ok: true, result });
}
