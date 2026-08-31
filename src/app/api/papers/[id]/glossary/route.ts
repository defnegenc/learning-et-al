import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { papers } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { aiComplete, aiConfigFor } from "@/lib/ai/provider";
import { textForPrompt } from "@/lib/fetchers/pdf";
import { getAuthUser } from "@/lib/get-user";

/*
 * Add a word to this paper's glossary. POST /api/papers/[id]/glossary { term }
 *
 * The other half of highlighting. Sometimes a reader does not want a paragraph
 * of explanation about a sentence, they want to know what one word means, and
 * they want it to stay known: the glossary is the list they can look back at.
 * Asking produced a conversation turn, which is the wrong shape for "what is a
 * criterion" and buries the answer in a thread.
 *
 * The definition is written against the paper's own text, so it defines the term
 * as this paper uses it rather than in general. It appends to the cached
 * companion, which is where the glossary already lives, so it survives a reload
 * and shows up as a chip in the prose the same way a generated one does.
 */

// One short definition from a paper already in the row. Nowhere near the
// companion's own budget.
export const maxDuration = 60;

/** A term is a term. Past this it is a sentence, and the reader wanted to ask. */
export const MAX_TERM_LENGTH = 60;

const SYSTEM = `You define one term for a curious non-expert who is reading a plain-language walkthrough of a specific paper.

Return ONLY a JSON object, no markdown fence:
{"term": "<the term, tidied: trimmed, no trailing punctuation, original capitalisation unless it began a sentence>", "def": "<one plain sentence, under 25 words>", "tier": "<basic|working|deep>"}

Define the term as THIS paper uses it, not in general, and use the paper's own context to disambiguate. Plain language: do not define jargon with more jargon. If the highlighted text is not really a term (it is a whole clause, or a number, or a name that needs no definition), still return the object, with "def" explaining in one sentence what the phrase refers to in this paper. Tier: basic = anyone outside the field needs it; working = practitioners know it; deep = specialists know it. Do not use em dashes.`;

interface GlossaryEntry {
  term: string;
  def: string;
  tier?: "basic" | "working" | "deep";
  analogy?: string;
  /**
   * The reader asked for this one, so the reading view never filters it out
   * again. Without it, a reader who has said they are expert in the topic adds
   * a word and watches it vanish: `glossaryForLevel` drops basic terms at level
   * 4 and up, which is right for what the companion volunteers and wrong for
   * what was asked for.
   */
  added?: boolean;
}

function parseEntry(raw: string): GlossaryEntry | null {
  try {
    const cleaned = raw.trim().replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
    const parsed = JSON.parse(cleaned);
    if (typeof parsed?.term !== "string" || typeof parsed?.def !== "string") return null;
    const term = parsed.term.trim();
    const def = parsed.def.trim();
    if (!term || !def) return null;
    const tier = ["basic", "working", "deep"].includes(parsed.tier) ? parsed.tier : undefined;
    return { term, def, tier, added: true };
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getAuthUser(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await params;
    const body = await req.json();
    const term: string = typeof body.term === "string" ? body.term.trim().slice(0, MAX_TERM_LENGTH) : "";
    if (!term) return NextResponse.json({ error: "term is required" }, { status: 400 });

    const paper = await db.query.papers.findFirst({ where: eq(papers.id, id) });
    if (!paper) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (!paper.companion) return NextResponse.json({ error: "No companion yet" }, { status: 409 });

    const companion = JSON.parse(paper.companion);
    const glossary: GlossaryEntry[] = Array.isArray(companion.glossary) ? companion.glossary : [];

    // Already there, in any casing: hand back what we have rather than paying a
    // model call to say the same thing twice.
    const existing = glossary.find(g => g.term.toLowerCase() === term.toLowerCase());
    if (existing) return NextResponse.json({ entry: existing, added: false });

    const config = aiConfigFor("metadata");
    if (!config.apiKey) return NextResponse.json({ error: "Server AI key not configured." }, { status: 500 });

    // The paper's own words are what disambiguate the term, but a definition
    // does not need the whole paper the way the companion did.
    const context = textForPrompt(paper.fullText || paper.abstract || "").slice(0, 24000);
    const raw = await aiComplete(
      config,
      SYSTEM,
      `Paper: ${paper.title}\n\nHighlighted term: ${term}\n\nPaper text:\n${context}`,
    ).catch(() => "");

    const entry = parseEntry(raw);
    if (!entry) return NextResponse.json({ error: "That one didn't come back. Try again." }, { status: 502 });

    // Re-check after the model call: two highlights of the same word in flight
    // at once would otherwise both append.
    if (glossary.some(g => g.term.toLowerCase() === entry.term.toLowerCase())) {
      return NextResponse.json({ entry, added: false });
    }

    companion.glossary = [...glossary, entry];
    await db.update(papers)
      .set({ companion: JSON.stringify(companion) })
      .where(eq(papers.id, id))
      .catch(() => {});

    return NextResponse.json({ entry, added: true });
  } catch (error) {
    console.error("Glossary add error:", error);
    return NextResponse.json({ error: "Couldn't add that one." }, { status: 500 });
  }
}
