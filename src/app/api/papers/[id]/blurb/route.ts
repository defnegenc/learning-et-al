import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { papers, digests } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { aiComplete, type AIConfig } from "@/lib/ai/provider";

export const maxDuration = 30;

// Generates the casual "mention it at a dinner party" one-liner for a paper, on
// demand, and caches it on the paper row so it's generated at most once. Public —
// the logged-out experience opens these on the admin digest too.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const paper = await db.query.papers.findFirst({ where: eq(papers.id, id) });
    if (!paper) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (paper.dinnerLine) return NextResponse.json({ dinner: paper.dinnerLine });

    const findings = paper.keyFindings ? (JSON.parse(paper.keyFindings) as string[]).join("; ") : "";
    const basis = `${paper.summary || paper.abstract || ""}${findings ? `\nKey findings: ${findings}` : ""}`.trim();
    if (!basis) return NextResponse.json({ dinner: "" });

    const digest = await db.query.digests.findFirst({ where: eq(digests.id, paper.digestId) });
    const cronProvider = (process.env.CRON_AI_PROVIDER || "gemini") as AIConfig["provider"];
    const cronModel =
      process.env.CRON_AI_MODEL ||
      (cronProvider === "anthropic" ? "claude-sonnet-4-20250514" : cronProvider === "openai" ? "gpt-4o" : "gemini-2.5-flash");
    const config: AIConfig = { apiKey: process.env.CRON_AI_KEY || "", provider: cronProvider, model: cronModel, baseUrl: process.env.CRON_AI_BASE_URL || "" };
    if (!config.apiKey) return NextResponse.json({ dinner: "" });

    const system = `You write ONE casual sentence a curious person could drop at a dinner party to describe a study — the kind that starts "A recent study found that…" or "Turns out…". Plain language, one specific takeaway (the X-affects-Y point), no jargon, no author names or citation, under 30 words. Return ONLY the sentence, no quotes.`;
    const user = `Topic of the day: ${digest?.theme || ""}\n\nPaper: ${paper.title}\n${basis}`;

    let dinner = (await aiComplete(config, system, user)).trim().replace(/^["']+|["']+$/g, "");
    if (dinner.length > 240) dinner = dinner.slice(0, 237) + "…";
    if (dinner) await db.update(papers).set({ dinnerLine: dinner }).where(eq(papers.id, id)).catch(() => {});
    return NextResponse.json({ dinner });
  } catch {
    return NextResponse.json({ dinner: "" });
  }
}
