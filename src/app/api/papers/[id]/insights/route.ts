import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { papers } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { aiComplete, type AIConfig } from "@/lib/ai/provider";
import { getAuthUser } from "@/lib/get-user";

export const maxDuration = 30;

// Reading-list insights for a paper's abstract, generated at most once each and
// cached on the row (same lazy pattern as the blurb route):
//   GET  → jargon: [{term, def}] hover definitions for hard words in the abstract
//   POST → eli5: a plain-language gist ("explain like I'm five")

function cronConfig(): AIConfig | null {
  const provider = (process.env.CRON_AI_PROVIDER || "gemini") as AIConfig["provider"];
  const model =
    process.env.CRON_AI_MODEL ||
    (provider === "anthropic" ? "claude-sonnet-4-6" : provider === "openai" ? "gpt-4o" : "gemini-2.5-flash");
  if (!process.env.CRON_AI_KEY) return null;
  return { apiKey: process.env.CRON_AI_KEY, provider, model, baseUrl: process.env.CRON_AI_BASE_URL || "" };
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getAuthUser(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { id } = await params;
    const paper = await db.query.papers.findFirst({ where: eq(papers.id, id) });
    if (!paper) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (paper.abstractJargon) return NextResponse.json({ jargon: JSON.parse(paper.abstractJargon) });

    const abstract = (paper.abstract || "").trim();
    const config = cronConfig();
    if (!abstract || !config) return NextResponse.json({ jargon: [] });

    const system = `You extract jargon from a paper abstract for a curious non-expert reader. Return ONLY a JSON array (no markdown fence) of at most 8 objects: [{"term": "<exact phrase as it appears in the abstract>", "def": "<plain-language definition, one sentence, under 25 words>"}]. Only include genuinely hard terms — skip words any college graduate knows. "term" must be copied verbatim from the abstract so it can be matched.`;
    const raw = await aiComplete(config, system, abstract).catch(() => "");
    let jargon: { term: string; def: string }[] = [];
    try {
      const parsed = JSON.parse(raw.trim().replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, ""));
      if (Array.isArray(parsed)) {
        jargon = parsed
          .filter((j) => j && typeof j.term === "string" && typeof j.def === "string")
          .map((j) => ({ term: j.term.trim(), def: j.def.trim() }))
          .filter((j) => j.term && j.def && abstract.toLowerCase().includes(j.term.toLowerCase()))
          .slice(0, 8);
      }
    } catch { /* leave empty — retried next open since we don't cache empties */ }

    if (jargon.length) {
      await db.update(papers).set({ abstractJargon: JSON.stringify(jargon) }).where(eq(papers.id, id)).catch(() => {});
    }
    return NextResponse.json({ jargon });
  } catch {
    return NextResponse.json({ jargon: [] });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getAuthUser(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { id } = await params;
    const paper = await db.query.papers.findFirst({ where: eq(papers.id, id) });
    if (!paper) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (paper.eli5) return NextResponse.json({ eli5: paper.eli5 });

    const abstract = (paper.abstract || paper.summary || "").trim();
    const config = cronConfig();
    if (!abstract || !config) return NextResponse.json({ eli5: "" });

    const system = `Explain this paper abstract like the reader is five years old — but never condescending. 2-3 short sentences, everyday words and one concrete analogy, no jargon at all. Return ONLY the explanation, no preamble or quotes.`;
    const raw = await aiComplete(config, system, `${paper.title}\n\n${abstract}`).catch(() => "");
    const eli5 = raw.trim().replace(/^["']+|["']+$/g, "").slice(0, 600);
    if (eli5) await db.update(papers).set({ eli5 }).where(eq(papers.id, id)).catch(() => {});
    return NextResponse.json({ eli5 });
  } catch {
    return NextResponse.json({ eli5: "" });
  }
}
