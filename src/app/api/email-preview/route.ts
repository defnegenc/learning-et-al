import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { digests, papers } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { getAuthUser } from "@/lib/get-user";
import { buildEmailHtml, type DigestEmailData } from "@/lib/email";

const ADMIN_ID = process.env.ADMIN_USER_ID || "";

/**
 * GET /api/email-preview?cadence=daily|biweekly|weekly
 * Returns the rendered HTML email for the latest digest. Admin only.
 */
export async function GET(req: NextRequest) {
  const userId = await getAuthUser(req);
  if (!userId || userId !== ADMIN_ID) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const cadence = (req.nextUrl.searchParams.get("cadence") || "daily") as "daily" | "biweekly" | "weekly";

  // Get latest digest(s) for this user
  const recentDigests = await db.select().from(digests)
    .where(eq(digests.userId, userId))
    .orderBy(desc(digests.createdAt))
    .limit(cadence === "weekly" ? 7 : cadence === "biweekly" ? 3 : 1);

  if (recentDigests.length === 0) {
    return new NextResponse("No digests found", { status: 404 });
  }

  // Use the most recent as the "best" (mirrors the cron's pick)
  const best = recentDigests[0];

  const digestPapers = await db.select().from(papers).where(eq(papers.digestId, best.id));

  const bestData: DigestEmailData = {
    theme: best.theme || "Untitled Digest",
    synthesis: best.synthesisContent || "",
    digestId: best.id,
    date: new Date(best.date).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" }),
    papers: digestPapers.map(p => ({
      title: p.title,
      source: p.source,
      year: p.year ?? undefined,
      summary: p.summary ?? undefined,
      sourceUrl: p.sourceUrl ?? undefined,
      keywords: p.keywords ? JSON.parse(p.keywords) : [],
    })),
  };

  const allDigests = recentDigests.map(d => ({
    theme: d.theme || "Untitled",
    date: d.date,
    digestId: d.id,
  }));

  const html = buildEmailHtml(cadence, bestData, allDigests);

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html" },
  });
}
