import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users, interests, digests, papers } from "@/lib/db/schema";
import { eq, desc, and, gte } from "drizzle-orm";
import { generateDigest } from "@/lib/pipeline/digest";
import { sendDigestEmail, type DigestEmailData } from "@/lib/email";
import { postDigestToX } from "@/lib/twitter";

/**
 * Cron endpoint — generates daily digests and emails based on cadence.
 * Called by Vercel Cron at 4am UTC daily.
 *
 * - Daily users: generate + email every day
 * - Biweekly users: generate daily, email best-of on Tuesday + Friday
 * - Weekly users: generate daily, email best-of on Sunday
 *
 * "Best" = starred digest if any, otherwise most recent.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = new Date();
  const dayOfWeek = today.getUTCDay(); // 0=Sun, 1=Mon, ..., 5=Fri, 6=Sat
  const isBiweeklyDay = dayOfWeek === 2 || dayOfWeek === 5; // Tue or Fri
  const isWeeklyDay = dayOfWeek === 0; // Sunday

  try {
    const allUsers = await db.select().from(users);
    const results: { userId: string; status: string; error?: string; email?: string }[] = [];

    const aiConfig = {
      apiKey: process.env.CRON_AI_KEY || "",
      provider: (process.env.CRON_AI_PROVIDER || "gemini") as "openai" | "anthropic" | "gemini" | "other",
      model: process.env.CRON_AI_MODEL || "gemini-2.5-flash",
      baseUrl: process.env.CRON_AI_BASE_URL || "",
    };

    if (!aiConfig.apiKey) {
      return NextResponse.json({ error: "No CRON_AI_KEY configured" }, { status: 500 });
    }

    for (const user of allUsers) {
      const userInterests = await db.select().from(interests).where(eq(interests.userId, user.id)).limit(1);
      if (userInterests.length === 0) {
        results.push({ userId: user.id, status: "skipped", error: "no interests" });
        continue;
      }

      const cadence = (user.cadence as "daily" | "biweekly" | "weekly") || "daily";

      // Step 1: Always generate a digest (builds the archive)
      let generatedDigest: Awaited<ReturnType<typeof generateDigest>> | undefined;
      try {
        generatedDigest = await generateDigest(user.id, aiConfig);
        results.push({ userId: user.id, status: "generated" });
      } catch (err) {
        results.push({ userId: user.id, status: "error", error: String(err).slice(0, 200) });
        continue;
      }

      // Step 1b: Post admin digest to X
      if (user.id === process.env.ADMIN_USER_ID && generatedDigest?.id) {
        const digestPapersForX = await db.select().from(papers).where(eq(papers.digestId, generatedDigest.id));
        // Extract lede: first paragraph(s) before the first bullet in synthesis
        const synthesis = generatedDigest.synthesisContent || "";
        const lines = synthesis.split("\n");
        const firstBulletLine = lines.findIndex(l => /^\s*-\s+\*\*\[source/i.test(l));
        const lede = firstBulletLine > 0
          ? lines.slice(0, firstBulletLine).filter(l => l.trim()).join(" ").trim()
          : null;
        const xResult = await postDigestToX({
          theme: generatedDigest.theme || "Today's Research Digest",
          lede,
          papers: digestPapersForX.map(p => ({ title: p.title, sourceUrl: p.sourceUrl })),
          digestId: generatedDigest.id,
        });
        results.push({ userId: user.id, status: xResult.ok ? "x_posted" : "x_failed", error: xResult.error });
      }

      // Step 2: Send email based on cadence
      if (!user.email || user.emailOptOut) continue;

      const shouldEmail =
        cadence === "daily" ||
        (cadence === "biweekly" && isBiweeklyDay) ||
        (cadence === "weekly" && isWeeklyDay);

      if (!shouldEmail) {
        results.push({ userId: user.id, status: "email_deferred", error: `${cadence}: not email day` });
        continue;
      }

      // Get the digests for the relevant period
      const periodDays = cadence === "weekly" ? 7 : cadence === "biweekly" ? 3 : 1;
      const periodStart = new Date(today);
      periodStart.setUTCDate(periodStart.getUTCDate() - periodDays);
      const periodStartStr = periodStart.toISOString().split("T")[0];

      const periodDigests = await db.select().from(digests)
        .where(and(eq(digests.userId, user.id), gte(digests.date, periodStartStr)))
        .orderBy(desc(digests.createdAt));

      if (periodDigests.length === 0) continue;

      // Pick the "best" digest: starred first, then most recent
      const starred = periodDigests.find(d => d.starred);
      const best = starred || periodDigests[0];

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

      const allDigestSummaries = periodDigests.map(d => ({
        theme: d.theme || "Untitled",
        date: d.date,
        digestId: d.id,
        starred: !!d.starred,
      }));

      const emailResult = await sendDigestEmail(user.email, cadence, bestData, allDigestSummaries);
      results.push({
        userId: user.id,
        status: emailResult.sent ? "emailed" : "email_skipped",
        email: user.email,
        error: emailResult.error,
      });
    }

    return NextResponse.json({ ok: true, day: dayOfWeek, results });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
