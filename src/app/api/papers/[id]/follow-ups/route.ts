import { NextRequest, NextResponse, after } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, ensureSchema } from "@/lib/db";
import { feedback, papers } from "@/lib/db/schema";
import {
  getFoundationalCandidates,
  getOpenAlexCitingWorks,
  getOpenAlexRecentWorksByQuery,
  getReferencedWorkIds,
  type OpenAlexPaper,
} from "@/lib/fetchers/open-alex";
import { getAuthUser } from "@/lib/get-user";
import { aiChat, aiConfigFor } from "@/lib/ai/provider";
import { extractJson } from "@/lib/ai/parse";
import { cosineSimilarity, embedBatch } from "@/lib/embeddings";
import { getTasteContext } from "@/lib/librarian/dossier";

export const maxDuration = 120;

const CACHE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const LANE_ORDER = ["citing", "contrasting", "foundational"] as const;
type FollowUpKind = (typeof LANE_ORDER)[number];
type PaperRow = typeof papers.$inferSelect;

export interface FollowUpItem {
  openAlexId: string;
  title: string;
  authors: string[];
  year: number | null;
  venue: string | null;
  url: string | null;
  pdfUrl: string | null;
  abstract: string;
  citationCount: number;
  kind?: FollowUpKind;
  why?: string;
}

interface FollowUpCache {
  items: FollowUpItem[];
  generatedAt: Date | null;
}

type LaneCandidates = Record<FollowUpKind, OpenAlexPaper[]>;

function parseCache(current: string | null, legacy: string | null): FollowUpCache | null {
  for (const [raw, isLegacy] of [[current, false], [legacy, true]] as const) {
    if (!raw) continue;
    try {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        if (isLegacy && !parsed.every(item =>
          item && typeof item === "object" &&
          typeof item.openAlexId === "string" &&
          typeof item.title === "string" &&
          typeof item.citationCount === "number"
        )) continue;
        return { items: parsed as FollowUpItem[], generatedAt: null };
      }
      if (!isLegacy && parsed && typeof parsed === "object") {
        const cache = parsed as { items?: unknown; generatedAt?: unknown };
        if (Array.isArray(cache.items) && cache.items.length > 0) {
          const generatedAt = typeof cache.generatedAt === "string"
            ? new Date(cache.generatedAt)
            : null;
          return {
            items: cache.items as FollowUpItem[],
            generatedAt: generatedAt && !Number.isNaN(generatedAt.getTime()) ? generatedAt : null,
          };
        }
      }
    } catch {
      // Try the legacy cache before treating the shelf as empty.
    }
  }
  return null;
}

function cacheIsFresh(cache: FollowUpCache): boolean {
  return !!cache.generatedAt && Date.now() - cache.generatedAt.getTime() < CACHE_MAX_AGE_MS;
}

function normalizedTitle(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function normalizedOpenAlexId(id: string | null | undefined): string {
  return (id || "").replace("https://openalex.org/", "").trim().toUpperCase();
}

const CONCEPT_STOP_WORDS = new Set([
  "about", "after", "again", "also", "among", "because", "before", "being",
  "between", "both", "could", "during", "each", "from", "have", "into",
  "more", "most", "other", "over", "paper", "results", "show", "study",
  "such", "than", "that", "their", "these", "they", "this", "those", "through",
  "using", "were", "which", "while", "with", "would",
]);

function parseKeywords(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((value): value is string => typeof value === "string" && value.trim().length > 2)
      : [];
  } catch {
    return [];
  }
}

function conceptSearchQuery(paper: PaperRow): string {
  const keywords = parseKeywords(paper.keywords).slice(0, 5);
  if (keywords.length > 0) return keywords.join(" ");

  const source = paper.abstract?.trim() || paper.title;
  const counts = new Map<string, number>();
  for (const token of source.toLowerCase().match(/[a-z][a-z-]{3,}/g) || []) {
    if (CONCEPT_STOP_WORDS.has(token)) continue;
    counts.set(token, (counts.get(token) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
    .slice(0, 8)
    .map(([token]) => token)
    .join(" ");
}

async function savedOpenAlexIds(userId: string): Promise<Set<string>> {
  const rows = await db.select({ openAlexId: papers.openAlexId })
    .from(feedback)
    .innerJoin(papers, eq(feedback.paperId, papers.id))
    .where(and(eq(feedback.userId, userId), eq(feedback.type, "star")));
  return new Set(rows.map(row => normalizedOpenAlexId(row.openAlexId)).filter(Boolean));
}

async function withoutSavedItems(items: FollowUpItem[], userId: string): Promise<{
  items: FollowUpItem[];
  removed: boolean;
}> {
  const savedIds = await savedOpenAlexIds(userId);
  const visible = items.filter(item => !savedIds.has(normalizedOpenAlexId(item.openAlexId)));
  return { items: visible, removed: visible.length !== items.length };
}

async function rankBySimilarity(source: string, candidates: OpenAlexPaper[]): Promise<OpenAlexPaper[]> {
  if (!source.trim() || candidates.length < 2) return candidates;
  try {
    const vectors = await embedBatch([
      source.slice(0, 2_000),
      ...candidates.map(candidate => `${candidate.title}. ${candidate.abstract}`.slice(0, 1_500)),
    ]);
    const sourceVector = vectors[0];
    return candidates
      .map((candidate, index) => ({
        candidate,
        similarity: cosineSimilarity(sourceVector, vectors[index + 1]),
      }))
      .sort((a, b) => b.similarity - a.similarity || b.candidate.citationCount - a.candidate.citationCount)
      .map(scored => scored.candidate);
  } catch (error) {
    console.log(`[Follow-ups] Similarity ranking skipped: ${error}`);
    return candidates;
  }
}

function toItem(paper: OpenAlexPaper, kind: FollowUpKind, why?: string): FollowUpItem {
  return {
    openAlexId: paper.openAlexId,
    title: paper.title,
    authors: paper.authors,
    year: paper.year || null,
    venue: paper.venueName || null,
    url: paper.sourceUrl || null,
    pdfUrl: paper.pdfUrl || null,
    abstract: paper.abstract.slice(0, 400),
    citationCount: paper.citationCount,
    kind,
    ...(why?.trim() ? { why: why.trim() } : {}),
  };
}

function paperKey(paper: OpenAlexPaper): string {
  return normalizedOpenAlexId(paper.openAlexId) || normalizedTitle(paper.title);
}

function buildShelf(
  candidates: LaneCandidates,
  selections: Partial<Record<FollowUpKind, { paper: OpenAlexPaper; why?: string }>> = {},
): FollowUpItem[] {
  const shelf: FollowUpItem[] = [];
  const taken = new Set<string>();
  const take = (paper: OpenAlexPaper | undefined, kind: FollowUpKind, why?: string) => {
    if (!paper || taken.has(paperKey(paper))) return false;
    taken.add(paperKey(paper));
    shelf.push(toItem(paper, kind, why));
    return true;
  };

  for (const kind of LANE_ORDER) {
    const selected = selections[kind];
    if (!take(selected?.paper, kind, selected?.why)) {
      take(candidates[kind].find(candidate => !taken.has(paperKey(candidate))), kind);
    }
  }
  for (const kind of LANE_ORDER) {
    for (const candidate of candidates[kind]) {
      if (shelf.length >= 3) return shelf;
      take(candidate, kind);
    }
  }
  return shelf;
}

const SELECTION_SYSTEM = `You are a librarian choosing three follow-up papers after a reader finished one paper.

Choose at most one candidate from each available lane:
- citing: the strongest meaningful work that came after it. Prefer a consequential follow-up over a trivial newer citation.
- contrasting: work in the same conversation that takes a genuinely different position, uses a revealingly different method, or challenges the source's framing.
- foundational: the earlier work that most clearly set the terms the source depends on.

For every choice, write one concrete line under 20 words explaining what it adds, disputes, or underpins. Do not write generic phrases such as "a related study". If the abstracts do not support a specific contrast, still choose the best candidate but leave why empty.

Return only JSON: {"picks":[{"kind":"citing","index":1,"why":"..."}]}`;

async function selectAndAnnotateShelf(
  candidates: LaneCandidates,
  source: PaperRow,
  userId: string,
): Promise<FollowUpItem[]> {
  const fallback = buildShelf(candidates);
  if (fallback.length === 0) return fallback;

  const config = aiConfigFor("metadata");
  if (!config.apiKey) return fallback;

  const entries = LANE_ORDER.flatMap(kind => candidates[kind].map(paper => ({ kind, paper })));
  try {
    const taste = await getTasteContext(userId);
    const listing = entries.map((entry, index) =>
      `[${index + 1}] lane=${entry.kind}; year=${entry.paper.year || "n.d."}; citations=${entry.paper.citationCount}\n` +
      `Title: ${entry.paper.title}\nAbstract: ${entry.paper.abstract.slice(0, 500)}`
    ).join("\n\n");
    const raw = await aiChat(config, [{
      role: "system",
      content: SELECTION_SYSTEM,
    }, {
      role: "user",
      content: `Source paper: ${source.title}\nSource abstract: ${(source.abstract || "Unavailable").slice(0, 1_500)}\n` +
        (taste.dossier ? `\nReader taste:\n${taste.dossier}\n` : "") +
        `\nCandidates:\n${listing}`,
    }]);
    const parsed = extractJson<{ picks?: { kind?: string; index?: number; why?: string }[] }>(raw);
    if (!parsed?.picks) return fallback;

    const selections: Partial<Record<FollowUpKind, { paper: OpenAlexPaper; why?: string }>> = {};
    for (const pick of parsed.picks) {
      if (!LANE_ORDER.includes(pick.kind as FollowUpKind)) continue;
      if (typeof pick.index !== "number" || !Number.isInteger(pick.index) || pick.index < 1) continue;
      const entry = entries[pick.index - 1];
      const kind = pick.kind as FollowUpKind;
      if (!entry || entry.kind !== kind || selections[kind]) continue;
      selections[kind] = { paper: entry.paper, why: pick.why };
    }
    return buildShelf(candidates, selections);
  } catch (error) {
    console.log(`[Follow-ups] Model selection skipped: ${error}`);
    return fallback;
  }
}

async function candidateLanes(source: PaperRow, userId: string): Promise<LaneCandidates> {
  const sourceId = normalizedOpenAlexId(source.openAlexId);
  const sourceTitle = normalizedTitle(source.title);
  const query = conceptSearchQuery(source);
  const isNotSource = (candidate: OpenAlexPaper) =>
    normalizedOpenAlexId(candidate.openAlexId) !== sourceId && normalizedTitle(candidate.title) !== sourceTitle;

  const foundationalTask = (async () => {
    if (!sourceId) return [];
    const references = await getReferencedWorkIds([sourceId]);
    const ancestorIds = references.get(sourceId) || [];
    return ancestorIds.length ? getFoundationalCandidates(ancestorIds, 500, 8, 8) : [];
  })();

  const [citingResults, foundationalResults, recentResults, savedIds] = await Promise.all([
    sourceId ? getOpenAlexCitingWorks(sourceId, 8, source.year) : Promise.resolve([]),
    foundationalTask,
    getOpenAlexRecentWorksByQuery(query, 12),
    savedOpenAlexIds(userId),
  ]);
  if (sourceId) savedIds.add(sourceId);

  const available = (candidate: OpenAlexPaper) =>
    isNotSource(candidate) && !savedIds.has(normalizedOpenAlexId(candidate.openAlexId));
  const foundational = foundationalResults.filter(available);
  const recent = await rankBySimilarity(
    `${source.title}. ${source.abstract || ""}`,
    recentResults.filter(available),
  );
  const directCiting = citingResults.filter(available);
  const citing = directCiting.length > 0
    ? directCiting
    : recent.filter(candidate => !source.year || candidate.year >= source.year).slice(0, 8);

  const citingIds = new Set(citing.map(candidate => normalizedOpenAlexId(candidate.openAlexId)));
  const foundationalIds = new Set(foundational.map(candidate => normalizedOpenAlexId(candidate.openAlexId)));
  const contrasting = recent.filter(candidate =>
    !citingIds.has(normalizedOpenAlexId(candidate.openAlexId)) &&
    !foundationalIds.has(normalizedOpenAlexId(candidate.openAlexId))
  ).slice(0, 8);

  return {
    citing: citing.slice(0, 8),
    contrasting,
    foundational: foundational.slice(0, 8),
  };
}

async function generateFollowUps(source: PaperRow, userId: string): Promise<FollowUpItem[]> {
  const candidates = await candidateLanes(source, userId);
  return selectAndAnnotateShelf(candidates, source, userId);
}

const refreshes = new Map<string, Promise<FollowUpItem[]>>();

function refreshFollowUps(id: string, userId: string): Promise<FollowUpItem[]> {
  const key = `${id}:${userId}`;
  const existing = refreshes.get(key);
  if (existing) return existing;

  const refresh = (async () => {
    const source = await db.query.papers.findFirst({ where: eq(papers.id, id) });
    if (!source) return [];
    const items = await generateFollowUps(source, userId);
    if (items.length > 0) {
      await db.update(papers).set({
        followUps: JSON.stringify({ generatedAt: new Date().toISOString(), items }),
      }).where(eq(papers.id, id));
    }
    return items;
  })().finally(() => refreshes.delete(key));

  refreshes.set(key, refresh);
  return refresh;
}

function refreshInBackground(id: string, userId: string): void {
  after(() => refreshFollowUps(id, userId).catch(error => {
    console.error("Follow-up refresh error:", error);
  }));
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await ensureSchema();
  const userId = await getAuthUser(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const paper = await db.query.papers.findFirst({ where: eq(papers.id, id) });
  if (!paper) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const cached = parseCache(paper.followUps, paper.homework);
  if (!cached) return NextResponse.json({ followUps: null });

  const visible = await withoutSavedItems(cached.items, userId);
  if (!cacheIsFresh(cached) || visible.removed) refreshInBackground(id, userId);
  return NextResponse.json({ followUps: visible.items });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await ensureSchema();
  const userId = await getAuthUser(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await params;
    const paper = await db.query.papers.findFirst({ where: eq(papers.id, id) });
    if (!paper) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const cached = parseCache(paper.followUps, paper.homework);
    if (cached) {
      const visible = await withoutSavedItems(cached.items, userId);
      if (!cacheIsFresh(cached) || visible.removed) refreshInBackground(id, userId);
      return NextResponse.json({ followUps: visible.items });
    }

    const followUps = await refreshFollowUps(id, userId);
    return NextResponse.json({ followUps });
  } catch (error) {
    console.error("Follow-ups error:", error);
    return NextResponse.json({ followUps: null });
  }
}
