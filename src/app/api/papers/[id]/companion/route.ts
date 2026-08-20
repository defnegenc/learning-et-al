import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { papers } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { aiComplete, aiConfigFor, type AIConfig } from "@/lib/ai/provider";
import { downloadAndParsePdf, textForPrompt, FULL_TEXT_CAP } from "@/lib/fetchers/pdf";
import { getAuthUser } from "@/lib/get-user";

// The whole paper now reaches the model rather than its first 30k characters,
// so a long one is a much larger prompt. 300 is what the digest routes already
// use; at 60 a review-length paper would have timed out mid-generation and the
// row would have cached nothing.
export const maxDuration = 300;

// The reading companion: a structured, plain-language walkthrough of the paper
// generated from its FULL TEXT (not just the abstract), created once when the
// paper is bookmarked and cached on the row.
//   GET  → cached companion or null
//   POST → generate if missing, then return it

export interface Companion {
  gist: string;      // 2-3 sentence plain-language gist
  did: string;       // what they actually did
  found: string;     // what they found
  caveats: string;   // where it's shaky
  remember: string;  // the one thing to remember
  glossary: { term: string; def: string }[];
  questions: string[]; // starter questions for the Q&A thread
}

function cronConfig(): AIConfig | null {
  const config = aiConfigFor("companion");
  return config.apiKey ? config : null;
}

const COMPANION_SYSTEM = `You are preparing a reading companion for a curious non-expert who just saved this paper to their reading list. Work from the full text provided. Sound like a sharp friend explaining it over coffee — plain language, no hedging boilerplate, define nothing with jargon.

Return ONLY a JSON object (no markdown fence) with exactly these keys:
{
  "gist": "2-3 sentences: what this paper is really about and why anyone should care",
  "did": "2-3 sentences: what the researchers actually did — the method, in concrete everyday terms (sample sizes, durations, materials where relevant)",
  "found": "2-4 sentences: the results, with the specific numbers or effects that matter",
  "caveats": "1-3 sentences: where this is shaky — limitations, small samples, conflicts, what it can't claim",
  "remember": "1 sentence: the single thing worth remembering a month from now",
  "glossary": [{"term": "<hard term as it appears in the paper>", "def": "<one plain sentence, under 25 words>"}],
  "questions": ["<3 sharp questions a curious reader would actually want to ask about this paper>"]
}
Glossary: at most 10 genuinely hard terms — skip anything a college graduate knows.`;

async function getFullText(paper: typeof papers.$inferSelect): Promise<string> {
  let fullText = paper.fullText || "";
  const abstractText = paper.abstract || "";
  const hasRichFullText = fullText.length > abstractText.length + 100;
  if (!hasRichFullText && paper.pdfUrl) {
    // Capped on the way into the row, not just on the way into a prompt: a
    // mis-parsed PDF can come back as megabytes of ligature soup, and there is
    // no reason for that to live in Turso forever.
    const pdfText = (await downloadAndParsePdf(paper.pdfUrl)).slice(0, FULL_TEXT_CAP);
    if (pdfText && pdfText.length > abstractText.length) {
      fullText = pdfText;
      await db.update(papers).set({ fullText: pdfText }).where(eq(papers.id, paper.id)).catch(() => {});
    }
  }
  return fullText || abstractText;
}

function parseCompanion(raw: string): Companion | null {
  try {
    const parsed = JSON.parse(raw.trim().replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, ""));
    if (!parsed || typeof parsed.gist !== "string" || !parsed.gist.trim()) return null;
    const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
    return {
      gist: str(parsed.gist),
      did: str(parsed.did),
      found: str(parsed.found),
      caveats: str(parsed.caveats),
      remember: str(parsed.remember),
      glossary: Array.isArray(parsed.glossary)
        ? parsed.glossary
            .filter((g: { term?: unknown; def?: unknown }) => typeof g?.term === "string" && typeof g?.def === "string")
            .map((g: { term: string; def: string }) => ({ term: g.term.trim(), def: g.def.trim() }))
            .filter((g: { term: string; def: string }) => g.term && g.def)
            .slice(0, 10)
        : [],
      questions: Array.isArray(parsed.questions)
        ? parsed.questions.filter((q: unknown) => typeof q === "string" && q.trim()).slice(0, 3)
        : [],
    };
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getAuthUser(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const paper = await db.query.papers.findFirst({ where: eq(papers.id, id) });
  if (!paper) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ companion: paper.companion ? JSON.parse(paper.companion) : null });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getAuthUser(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { id } = await params;
    const paper = await db.query.papers.findFirst({ where: eq(papers.id, id) });
    if (!paper) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (paper.companion) return NextResponse.json({ companion: JSON.parse(paper.companion) });

    const config = cronConfig();
    if (!config) return NextResponse.json({ companion: null });

    // The whole paper, minus the bibliography. Not a head slice: the beat that
    // asks where this is shaky needs the discussion and the limitations, and
    // those are the last thing a front-truncation keeps.
    const text = textForPrompt(await getFullText(paper));
    if (!text.trim()) return NextResponse.json({ companion: null });

    const raw = await aiComplete(config, COMPANION_SYSTEM, `${paper.title}\n\n${text}`).catch(() => "");
    const companion = parseCompanion(raw);
    if (!companion) return NextResponse.json({ companion: null });

    await db.update(papers).set({ companion: JSON.stringify(companion) }).where(eq(papers.id, id)).catch(() => {});
    return NextResponse.json({ companion });
  } catch (error) {
    console.error("Companion error:", error);
    return NextResponse.json({ companion: null });
  }
}
