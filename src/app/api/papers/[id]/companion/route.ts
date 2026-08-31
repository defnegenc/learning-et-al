import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { digests, familiarity, papers } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { aiComplete, aiConfigFor, type AIConfig } from "@/lib/ai/provider";
import { BANNED_WORDS_RULE, stripBannedWords } from "@/lib/ai/banned-words";
import { downloadAndParsePdf, textForPrompt, FULL_TEXT_CAP } from "@/lib/fetchers/pdf";
import { getOpenAlexWorkTopic } from "@/lib/fetchers/open-alex";
import { getAuthUser } from "@/lib/get-user";
import {
  familiarityPrompt, pitchConsequence, stripPitchedForYou, topicFromCompanion,
  type FamiliarityTopic, type FamiliarityValue, type PitchedForYou,
} from "@/lib/familiarity";

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
  glossary: { term: string; def: string; tier?: "basic" | "working" | "deep"; analogy?: string }[];
  questions: string[]; // starter questions for the Q&A thread
  topic?: FamiliarityTopic;
  pitchedForYou?: PitchedForYou;
}

function cronConfig(): AIConfig | null {
  const config = aiConfigFor("companion");
  return config.apiKey ? config : null;
}

const COMPANION_SYSTEM = `You are preparing a reading companion for a curious non-expert who just saved this paper to their reading list. Work from the full text provided. Sound like a sharp friend explaining it over coffee — plain language, no hedging boilerplate, define nothing with jargon.

Return ONLY a JSON object (no markdown fence) with these required keys. Include a top-level "pitchedForYou" string only if a later instruction requires it:
{
  "gist": "2-3 sentences: what this paper is really about and why anyone should care",
  "did": "2-3 sentences: what the researchers actually did — the method, in concrete everyday terms (sample sizes, durations, materials where relevant)",
  "found": "2-4 sentences: the results, with the specific numbers or effects that matter",
  "caveats": "1-3 sentences: where this is shaky — limitations, small samples, conflicts, what it can't claim",
  "remember": "1 sentence: the single thing worth remembering a month from now",
  "glossary": [{"term": "<term as it appears in the paper>", "def": "<one plain sentence, under 25 words>", "tier": "<basic|working|deep>", "analogy": "<optional concrete analogy>"}],
  "questions": ["<3 sharp questions a curious reader would actually want to ask about this paper>"]
}
${BANNED_WORDS_RULE}
Glossary: generate a generous superset of up to 18 field-specific terms. Every entry MUST have one tier: basic = anyone outside the field needs it; working = practitioners know it; deep = specialists know it. Add an analogy when it genuinely helps a newcomer. The UI filters these tiers later; do not filter the list for the reader's level.`;

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
    // Every prose field goes through `str`, so the banned-word scrub rides along
    // with the trim rather than being repeated per key.
    const str = (v: unknown) => (typeof v === "string" ? stripBannedWords(v.trim()) : "");
    return {
      gist: str(parsed.gist),
      did: str(parsed.did),
      found: str(parsed.found),
      caveats: str(parsed.caveats),
      remember: str(parsed.remember),
      glossary: Array.isArray(parsed.glossary)
        ? parsed.glossary
            .filter((g: { term?: unknown; def?: unknown }) => typeof g?.term === "string" && typeof g?.def === "string")
            .map((g: { term: string; def: string; tier?: unknown; analogy?: unknown }) => ({
              term: g.term.trim(),
              def: str(g.def),
              ...(g.tier === "basic" || g.tier === "working" || g.tier === "deep" ? { tier: g.tier } : {}),
              ...(typeof g.analogy === "string" && g.analogy.trim() ? { analogy: str(g.analogy) } : {}),
            }))
            .filter((g: { term: string; def: string }) => g.term && g.def)
            .slice(0, 18)
        : [],
      questions: Array.isArray(parsed.questions)
        ? parsed.questions.filter((q: unknown) => typeof q === "string" && q.trim()).map(str).slice(0, 3)
        : [],
    };
  } catch {
    return null;
  }
}

function fallbackInterest(digest: typeof digests.$inferSelect | undefined): string | null {
  try {
    const seedTopic = JSON.parse(digest?.seedTopic || "null") as { interest?: unknown } | null;
    if (typeof seedTopic?.interest === "string" && seedTopic.interest.trim()) return seedTopic.interest.trim();
    const seeds = JSON.parse(digest?.seedInterests || "[]") as { keyword?: unknown }[];
    const keyword = seeds.find(seed => typeof seed.keyword === "string" && seed.keyword.trim())?.keyword;
    return typeof keyword === "string" ? keyword.trim() : null;
  } catch {
    return null;
  }
}

async function resolveTopic(paper: typeof papers.$inferSelect): Promise<FamiliarityTopic | null> {
  const openAlex = paper.openAlexId ? await getOpenAlexWorkTopic(paper.openAlexId) : null;
  if (openAlex) {
    return { id: openAlex.id, name: openAlex.name, subfield: openAlex.subfield, source: "openalex" };
  }
  const digest = await db.query.digests.findFirst({ where: eq(digests.id, paper.digestId) });
  const interest = fallbackInterest(digest);
  if (!interest) return null;
  return {
    id: `interest:${interest.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    name: interest,
    source: "interest",
  };
}

async function familiarityFor(userId: string, topic: FamiliarityTopic | null): Promise<FamiliarityValue | null> {
  if (!topic) return null;
  const value = await db.query.familiarity.findFirst({
    where: and(eq(familiarity.userId, userId), eq(familiarity.topicId, topic.id)),
  });
  return value ? {
    topicId: value.topicId,
    topicName: value.topicName,
    level: value.level,
    source: value.source,
    createdAt: value.createdAt,
  } : null;
}

async function companionState(
  paper: typeof papers.$inferSelect,
  userId: string,
): Promise<{ companion: Companion | null; familiarity: FamiliarityValue | null }> {
  if (!paper.companion) return { companion: null, familiarity: null };
  const companion = JSON.parse(paper.companion) as Companion;
  let topic = topicFromCompanion(companion);
  if (!topic) {
    topic = await resolveTopic(paper);
    if (topic) {
      companion.topic = topic;
      await db.update(papers).set({ companion: JSON.stringify(companion) }).where(eq(papers.id, paper.id)).catch(() => {});
    }
  }
  return { companion, familiarity: await familiarityFor(userId, topic) };
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getAuthUser(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const paper = await db.query.papers.findFirst({ where: eq(papers.id, id) });
  if (!paper) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(await companionState(paper, userId));
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getAuthUser(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { id } = await params;
    const paper = await db.query.papers.findFirst({ where: eq(papers.id, id) });
    if (!paper) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (paper.companion) return NextResponse.json(await companionState(paper, userId));

    const config = cronConfig();
    if (!config) return NextResponse.json({ companion: null });

    // The whole paper, minus the bibliography. Not a head slice: the beat that
    // asks where this is shaky needs the discussion and the limitations, and
    // those are the last thing a front-truncation keeps.
    const text = textForPrompt(await getFullText(paper));
    if (!text.trim()) return NextResponse.json({ companion: null });

    const topic = await resolveTopic(paper);
    const storedFamiliarity = await familiarityFor(userId, topic);
    const system = storedFamiliarity && topic
      ? `${COMPANION_SYSTEM}${familiarityPrompt(topic, storedFamiliarity.level)}\nFor this JSON response, put the required PITCHED FOR YOU line in a top-level string field named "pitchedForYou" instead of before the JSON object.`
      : COMPANION_SYSTEM;
    const raw = await aiComplete(config, system, `${paper.title}\n\n${text}`).catch(() => "");
    const companion = parseCompanion(raw);
    if (!companion) return NextResponse.json({ companion: null });

    companion.topic = topic ?? undefined;
    if (storedFamiliarity) {
      try {
        const parsedRaw = JSON.parse(raw.trim().replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, ""));
        const pitched = typeof parsedRaw.pitchedForYou === "string"
          ? stripPitchedForYou(`${parsedRaw.pitchedForYou}\n`, { topic: topic!, level: storedFamiliarity.level }).pitch
          : null;
        companion.pitchedForYou = pitched ?? {
          topicId: topic!.id,
          topicName: topic!.name,
          level: storedFamiliarity.level,
          consequence: pitchConsequence(storedFamiliarity.level),
        };
      } catch { /* companion still works; the UI can derive the glossary disclosure */ }
    }

    await db.update(papers).set({ companion: JSON.stringify(companion) }).where(eq(papers.id, id)).catch(() => {});
    return NextResponse.json({ companion, familiarity: storedFamiliarity });
  } catch (error) {
    console.error("Companion error:", error);
    return NextResponse.json({ companion: null });
  }
}
