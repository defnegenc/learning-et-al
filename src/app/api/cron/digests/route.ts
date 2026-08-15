import { NextRequest, NextResponse } from "next/server";
import { getCronAiConfig, processDigestJobBatch, utcDateString } from "@/lib/pipeline/digest-jobs";

// Each invocation handles a small bounded batch. Vercel Hobby cron jobs can run
// only once per day, so vercel.json schedules several daily slot paths that
// re-export this handler.
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const url = new URL(req.url);
    const date = url.searchParams.get("date") || utcDateString();
    const batchSizeParam = Number(url.searchParams.get("batchSize") || "");
    const batchSize = Number.isFinite(batchSizeParam) && batchSizeParam > 0
      ? Math.min(Math.floor(batchSizeParam), 5)
      : 2;
    const aiConfig = getCronAiConfig();
    const batch = await processDigestJobBatch(aiConfig, batchSize, date);
    return NextResponse.json({ ok: true, batch });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
