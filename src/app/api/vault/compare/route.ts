import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { papers, comparisons } from "@/lib/db/schema";
import { inArray } from "drizzle-orm";
import { aiComplete, AIConfig } from "@/lib/ai/provider";
import { comparisonPrompt, SYNTHESIS_SYSTEM } from "@/lib/ai/prompts";
import { getAuthUser } from "@/lib/get-user";

export async function POST(req: NextRequest) {
  const userId = await getAuthUser(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { paperIds } = await req.json();

    if (!paperIds || !Array.isArray(paperIds) || paperIds.length < 2 || paperIds.length > 3) {
      return NextResponse.json({ error: "paperIds must be an array of 2-3 paper IDs" }, { status: 400 });
    }

    const cronProvider = (process.env.CRON_AI_PROVIDER || "gemini") as "gemini" | "anthropic" | "openai" | "other";
    const cronDefaultModel = cronProvider === "anthropic" ? "claude-sonnet-4-20250514" : cronProvider === "openai" ? "gpt-4o" : "gemini-2.5-flash";
    const apiKey = process.env.CRON_AI_KEY || "";
    const provider = cronProvider;
    const model = process.env.CRON_AI_MODEL || cronDefaultModel;
    const baseUrl = "";

    const selectedPapers = await db.query.papers.findMany({
      where: inArray(papers.id, paperIds),
    });

    if (selectedPapers.length !== paperIds.length) {
      return NextResponse.json({ error: "One or more papers not found" }, { status: 404 });
    }

    const aiConfig: AIConfig = { apiKey, provider, model, baseUrl };
    const content = await aiComplete(
      aiConfig,
      SYNTHESIS_SYSTEM,
      comparisonPrompt(selectedPapers.map((p) => ({
        title: p.title,
        fullText: p.fullText || p.abstract || "",
      })))
    );

    const [comparison] = await db.insert(comparisons).values({
      userId,
      paperIds: JSON.stringify(paperIds),
      content,
    }).returning();

    return NextResponse.json({ comparison });
  } catch (error) {
    console.error("Comparison error:", error);
    return NextResponse.json({ error: "Failed to compare papers" }, { status: 500 });
  }
}
