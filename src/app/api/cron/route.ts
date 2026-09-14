import { NextRequest, NextResponse } from "next/server";
import { getCronAiConfig, processDigestJobBatch, seedDailyDigestJobs, utcDateString } from "@/lib/pipeline/digest-jobs";
import { runContentPatches } from "@/lib/pipeline/content-patches";

// The daily cron seeds one job per user, then processes only a tiny first batch.
// The recurring worker at /api/cron/digests drains the rest in bounded chunks.
export const maxDuration = 300;

/**
 * Daily cron endpoint. Called by Vercel Cron at 4am UTC daily.
 *
 * Generation is tracked per-user in digest_jobs so an execution-time cutoff
 * leaves visible pending/failed work instead of silently starving late users.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // One-time, idempotent edition fixes (see content-patches.ts). Runs before
    // generation work so a pending fix never waits on the queue.
    let patches: string[] = [];
    try {
      patches = await runContentPatches();
    } catch (patchError) {
      console.error("content patches failed", patchError);
    }
    const date = utcDateString();
    const aiConfig = getCronAiConfig();
    if (!aiConfig.apiKey) {
      return NextResponse.json({ error: "No CRON_AI_KEY configured" }, { status: 500 });
    }
    const seeded = await seedDailyDigestJobs(date);
    const batch = await processDigestJobBatch(aiConfig, 1, date);
    return NextResponse.json({ ok: true, seeded, batch, patches });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
