import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users, interests, digests, papers } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { generateDigest } from "@/lib/pipeline/digest";
import { sendDigestEmail } from "@/lib/email";

/**
 * Cron endpoint — generates daily digests and emails them.
 * Called by Vercel Cron at 4am UTC.
 *
 * Security: protected by CRON_SECRET env var.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const allUsers = await db.select().from(users);
    const results: { userId: string; status: string; error?: string; email?: string }[] = [];

    for (const user of allUsers) {
      // Skip users without interests
      const userInterests = await db.select().from(interests).where(eq(interests.userId, user.id)).limit(1);
      if (userInterests.length === 0) {
        results.push({ userId: user.id, status: "skipped", error: "no interests" });
        continue;
      }

      const aiConfig = {
        apiKey: process.env.CRON_AI_KEY || "",
        provider: (process.env.CRON_AI_PROVIDER || "gemini") as "openai" | "anthropic" | "gemini" | "other",
        model: process.env.CRON_AI_MODEL || "gemini-2.5-flash",
        baseUrl: process.env.CRON_AI_BASE_URL || "",
      };

      if (!aiConfig.apiKey) {
        results.push({ userId: user.id, status: "skipped", error: "no CRON_AI_KEY" });
        continue;
      }

      try {
        const digest = await generateDigest(user.id, aiConfig);
        results.push({ userId: user.id, status: "generated" });

        // Send email if user has an email address
        if (user.email && digest.synthesisContent && digest.theme) {
          // Fetch the papers for this digest
          const digestPapers = await db.select().from(papers)
            .where(eq(papers.digestId, digest.id));

          const emailResult = await sendDigestEmail(user.email, {
            theme: digest.theme,
            synthesis: digest.synthesisContent,
            papers: digestPapers.map(p => ({
              title: p.title,
              source: p.source,
              year: p.year ?? undefined,
              summary: p.summary ?? undefined,
              sourceUrl: p.sourceUrl ?? undefined,
            })),
            digestUrl: "https://learningetal.com",
          });

          if (emailResult.sent) {
            results.push({ userId: user.id, status: "emailed", email: user.email });
          } else {
            results.push({ userId: user.id, status: "email_skipped", error: emailResult.error });
          }
        }
      } catch (err) {
        results.push({ userId: user.id, status: "error", error: String(err).slice(0, 200) });
      }
    }

    return NextResponse.json({ ok: true, results });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
