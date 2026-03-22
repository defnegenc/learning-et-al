import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users, interests } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { generateDigest } from "@/lib/pipeline/digest";

/**
 * Cron endpoint — generates daily digests for all users who have interests + API keys stored.
 * Called by Vercel Cron at 6am UTC (configurable per user's timezone in the future).
 *
 * Security: protected by CRON_SECRET env var.
 */
export async function GET(req: NextRequest) {
  // Verify cron secret to prevent unauthorized calls
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const allUsers = await db.select().from(users);
    const results: { userId: string; status: string; error?: string }[] = [];

    for (const user of allUsers) {
      // Skip users without interests
      const userInterests = await db.select().from(interests).where(eq(interests.userId, user.id)).limit(1);
      if (userInterests.length === 0) {
        results.push({ userId: user.id, status: "skipped", error: "no interests" });
        continue;
      }

      // For now, use a default AI config (admin's key via env, or skip if not available)
      // In the future, each user stores their own API key securely
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
        await generateDigest(user.id, aiConfig);
        results.push({ userId: user.id, status: "generated" });
      } catch (err) {
        results.push({ userId: user.id, status: "error", error: String(err).slice(0, 200) });
      }
    }

    return NextResponse.json({ ok: true, results });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
