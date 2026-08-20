import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { papers } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import {
  getFoundationalCandidates, getOpenAlexCitingWorks, getOpenAlexRecentTitleMentions,
  getReferencedWorkIds, type OpenAlexPaper,
} from "@/lib/fetchers/open-alex";
import { getAuthUser } from "@/lib/get-user";
import { aiChat, aiConfigFor } from "@/lib/ai/provider";
import { extractJson } from "@/lib/ai/parse";
import { getTasteContext } from "@/lib/librarian/dossier";

// Four OpenAlex round trips and a short annotation call — the old 30s was sized
// for one query.
export const maxDuration = 120;

// "What's happened since?" — the homework section at the bottom of the reading
// view. Finds recent works that cite this paper (OpenAlex `cites:` filter), or
// falls back to a recency search on the title. Generated once on bookmark and
// cached on the row as mini paper cards.
//   GET  → cached homework or null
//   POST → generate if missing, then return it

export interface HomeworkItem {
  openAlexId: string;
  title: string;
  authors: string[];
  year: number | null;
  venue: string | null;
  url: string | null;
  pdfUrl: string | null;
  abstract: string;
  citationCount: number;
  /**
   * Which lane this came from. The scout builds a SHELF rather than a list of
   * eight things that cite the paper: one work that came after it, one that
   * argues from somewhere else, one it was built on. Three papers standing in
   * different relations to what you just read beat four ranked by citation date.
   */
  kind?: "citing" | "contrasting" | "foundational";
  /** One line on why this one, for this reader. Absent when no model was available. */
  why?: string;
}

function parseHomework(raw: string | null): HomeworkItem[] | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : null;
  } catch {
    return null;
  }
}

function normalizedTitle(title: string): string {
  return title.toLowerCase().replace(/\s+/g, " ").trim();
}

const WHY_SYSTEM = `You are a librarian handing someone three follow-up papers after they finished reading one. For each, write ONE line — under 20 words — saying why it is worth their time, in relation to the paper they just read.

Say what it adds, disputes, or underpins. Be concrete: "finds the opposite in older adults", "the study everyone here is arguing with". Never "a related study", never "builds on this work", never restate the title. If you cannot say something specific from the abstract, return an empty string for that one rather than padding.

Return ONLY JSON: {"whys": [{"index": 1, "why": "…"}]}`;

/**
 * The one-line "why for you" on each shelf item.
 *
 * Fast tier: it is a short annotation over abstracts we already hold, not the
 * product's voice. Best-effort throughout — a shelf with no lines is still a
 * good shelf, so every failure path returns the items unannotated rather than
 * failing the request.
 */
async function annotateShelf(shelf: HomeworkItem[], sourceTitle: string, userId: string): Promise<HomeworkItem[]> {
  if (shelf.length === 0) return shelf;
  const config = aiConfigFor("chore");
  if (!config) return shelf;

  try {
    const taste = await getTasteContext(userId);
    const listing = shelf.map((item, i) =>
      `[${i + 1}] (${item.kind}) "${item.title}" (${item.year ?? "n.d."}) — ${item.abstract.slice(0, 300)}`
    ).join("\n\n");

    const raw = await aiChat(config, WHY_SYSTEM, [{
      role: "user",
      content: `They just read: "${sourceTitle}"
${taste.dossier ? `\nWhat this reader tends to care about:\n"""\n${taste.dossier}\n"""\n` : ""}
Follow-ups:
${listing}`,
    }]);

    const parsed = extractJson<{ whys?: { index: number; why?: string }[] }>(raw);
    if (!parsed?.whys) return shelf;
    for (const { index, why } of parsed.whys) {
      const item = shelf[index - 1];
      if (item && why?.trim()) item.why = why.trim();
    }
  } catch (err) {
    console.log(`[Scout] Annotation skipped: ${err}`);
  }
  return shelf;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getAuthUser(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const paper = await db.query.papers.findFirst({ where: eq(papers.id, id) });
  if (!paper) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ homework: parseHomework(paper.homework) });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getAuthUser(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { id } = await params;
    const paper = await db.query.papers.findFirst({ where: eq(papers.id, id) });
    if (!paper) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const cached = parseHomework(paper.homework);
    if (cached) return NextResponse.json({ homework: cached });

    const sourceTitle = normalizedTitle(paper.title);
    const notTheSourcePaper = (r: OpenAlexPaper) => normalizedTitle(r.title) !== sourceTitle;

    // Lane 1 — what came after. Nothing citing it yet (or no OpenAlex id) falls
    // back to recent work that mentions the title, which is the closest useful
    // "since then" a new paper can have.
    let citing = paper.openAlexId ? (await getOpenAlexCitingWorks(paper.openAlexId, 8)).filter(notTheSourcePaper) : [];
    if (citing.length === 0) {
      citing = (await getOpenAlexRecentTitleMentions(paper.title, 8))
        .filter(notTheSourcePaper)
        .filter((r) => !paper.year || (r.year && r.year >= paper.year));
    }

    // Lane 2 — what this was built on. Its own references, filtered to the ones
    // old and cited enough to have set the terms of the argument. Same test the
    // digest's foundational lane uses.
    const referenced = paper.openAlexId ? await getReferencedWorkIds([paper.openAlexId]) : new Map<string, string[]>();
    const ancestorIds = paper.openAlexId ? referenced.get(paper.openAlexId) ?? [] : [];
    const foundational = ancestorIds.length
      ? (await getFoundationalCandidates(ancestorIds, 500, 8, 3)).filter(notTheSourcePaper)
      : [];

    // Lane 3 — somewhere else in the same conversation: recent work on the same
    // ground that is NOT downstream of this paper, so it can disagree with it.
    const citingIds = new Set(citing.map((r) => r.openAlexId));
    const foundationalIds = new Set(foundational.map((r) => r.openAlexId));
    const contrasting = (await getOpenAlexRecentTitleMentions(paper.title, 10))
      .filter(notTheSourcePaper)
      .filter((r) => !citingIds.has(r.openAlexId) && !foundationalIds.has(r.openAlexId));

    const toItem = (r: OpenAlexPaper, kind: HomeworkItem["kind"]): HomeworkItem => ({
      openAlexId: r.openAlexId,
      title: r.title,
      authors: r.authors,
      year: r.year || null,
      venue: r.venueName || null,
      url: r.sourceUrl || null,
      pdfUrl: r.pdfUrl || null,
      abstract: r.abstract.slice(0, 400),
      citationCount: r.citationCount,
      kind,
    });

    // One from each lane, in reading order: what came after, what it argues
    // with, what it stands on. Empty lanes are backfilled from whichever lane
    // has depth — three items beats a tidy but half-empty shelf.
    const shelf: HomeworkItem[] = [];
    const taken = new Set<string>();
    const take = (r: OpenAlexPaper | undefined, kind: HomeworkItem["kind"]) => {
      if (!r || taken.has(r.openAlexId || r.title)) return;
      taken.add(r.openAlexId || r.title);
      shelf.push(toItem(r, kind));
    };
    take(citing[0], "citing");
    take(contrasting[0], "contrasting");
    take(foundational[0], "foundational");
    for (const r of [...citing.slice(1), ...contrasting.slice(1), ...foundational.slice(1)]) {
      if (shelf.length >= 3) break;
      take(r, citing.includes(r) ? "citing" : foundational.includes(r) ? "foundational" : "contrasting");
    }

    const homework = await annotateShelf(shelf, paper.title, userId);

    if (homework.length > 0) {
      await db.update(papers).set({ homework: JSON.stringify(homework) }).where(eq(papers.id, id)).catch(() => {});
    }
    return NextResponse.json({ homework });
  } catch (error) {
    console.error("Homework error:", error);
    return NextResponse.json({ homework: null });
  }
}
