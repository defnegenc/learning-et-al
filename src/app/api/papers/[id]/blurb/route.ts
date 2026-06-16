import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { papers, digests } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { aiComplete, type AIConfig } from "@/lib/ai/provider";
import { extractJson } from "@/lib/ai/parse";

export const maxDuration = 30;

// Generates two reader-facing one-liners for a paper, on demand, cached on the
// row so they're produced at most once:
//   dinner  — casual "mention it at a dinner party" takeaway
//   relates — clean one sentence on how it answers the day's question
// Public — the logged-out experience opens these on the admin digest too.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const paper = await db.query.papers.findFirst({ where: eq(papers.id, id) });
    if (!paper) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (paper.dinnerLine != null && paper.relatesLine != null) return NextResponse.json({ dinner: paper.dinnerLine, relates: paper.relatesLine });

    const findings = paper.keyFindings ? (JSON.parse(paper.keyFindings) as string[]).join("; ") : "";
    const basis = `${paper.summary || paper.abstract || ""}${findings ? `\nKey findings: ${findings}` : ""}`.trim();
    if (!basis) return NextResponse.json({ dinner: "", relates: "" });

    const digest = await db.query.digests.findFirst({ where: eq(digests.id, paper.digestId) });
    const theme = digest?.theme || "the day's question";
    const cronProvider = (process.env.CRON_AI_PROVIDER || "gemini") as AIConfig["provider"];
    const cronModel =
      process.env.CRON_AI_MODEL ||
      (cronProvider === "anthropic" ? "claude-sonnet-4-20250514" : cronProvider === "openai" ? "gpt-4o" : "gemini-2.5-flash");
    const config: AIConfig = { apiKey: process.env.CRON_AI_KEY || "", provider: cronProvider, model: cronModel, baseUrl: process.env.CRON_AI_BASE_URL || "" };
    if (!config.apiKey) return NextResponse.json({ dinner: "", relates: "" });

    const system = `You describe one research paper for a curious reader. Return ONLY JSON with two fields, each ONE complete sentence:
- "dinner": how you'd mention this study at a dinner party — casual, starts like "A recent study found…" or "Turns out…", one specific X-affects-Y takeaway, no jargon, no author names, under 30 words.
- "relates": how this paper helps answer the question "${theme}" — a complete, specific sentence (start with "It " or the subject, never a bare verb), plain language, under 25 words.
Return ONLY: {"dinner":"...","relates":"..."}`;
    const user = `Question of the day: ${theme}\n\nPaper: ${paper.title}\n${basis}`;

    const raw = await aiComplete(config, system, user);
    const parsed = extractJson<{ dinner?: string; relates?: string }>(raw);
    const clean = (s: string | undefined, max: number) => {
      const t = (s || "").trim().replace(/^["']+|["']+$/g, "");
      return t.length > max ? t.slice(0, max - 1) + "…" : t;
    };
    const dinner = clean(parsed?.dinner, 240);
    const relates = clean(parsed?.relates, 200);
    // Store null (not "") for blanks so a failed field is retried on the next open
    // rather than cached as permanently empty.
    if (dinner || relates) await db.update(papers).set({ dinnerLine: dinner || null, relatesLine: relates || null }).where(eq(papers.id, id)).catch(() => {});
    return NextResponse.json({ dinner, relates });
  } catch {
    return NextResponse.json({ dinner: "", relates: "" });
  }
}
