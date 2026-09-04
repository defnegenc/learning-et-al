import { NextRequest, NextResponse } from "next/server";
import { db, ensureSchema } from "@/lib/db";
import { digestJobs } from "@/lib/db/schema";
import { desc, gte } from "drizzle-orm";
import { getAuthUser } from "@/lib/get-user";

const ADMIN_ID = process.env.ADMIN_USER_ID || "";

// Vercel Hobby keeps runtime logs for about an hour, so when the cron fails
// overnight there is nothing left to read by morning. The digest_jobs rows
// carry the same error text durably - this endpoint just makes them readable
// without a database client.
export async function GET(req: NextRequest) {
  await ensureSchema();
  const userId = await getAuthUser(req);
  if (!userId || userId !== ADMIN_ID) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const url = new URL(req.url);
  const daysParam = Number(url.searchParams.get("days") || "14");
  const days = Number.isFinite(daysParam) && daysParam > 0 ? Math.min(daysParam, 60) : 14;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  const rows = await db.query.digestJobs.findMany({
    where: gte(digestJobs.date, since),
    orderBy: desc(digestJobs.date),
    limit: 100,
  });

  return NextResponse.json({
    since,
    jobs: rows.map((j) => ({
      id: j.id,
      date: j.date,
      status: j.status,
      attempts: j.attempts,
      digestId: j.digestId,
      error: j.error,
      emailStatus: j.emailStatus,
      emailError: j.emailError,
      startedAt: j.startedAt,
      finishedAt: j.finishedAt,
    })),
  });
}
