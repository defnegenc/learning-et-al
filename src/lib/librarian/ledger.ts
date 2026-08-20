import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { digestFeedback, digests, events, feedback, interests, papers, qaPairs } from "@/lib/db/schema";
import { LIST_COLUMNS } from "@/lib/db/paper-payload";

/*
 * The signal ledger — everything we know about one reader's taste, collected
 * from rows that already exist.
 *
 * Four classes, from the plan:
 *
 *  · Exemplars — papers they SAVED (positive) against papers we showed them and
 *    they walked past (soft negative). The second half is the one nobody was
 *    using: every paper ever shown is already stored for dedup, so "shown and
 *    ignored" is free and it is the only negative signal most readers ever give.
 *  · Engagement — the questions they asked, and the passages they dug into.
 *  · Stated — interests and their weights.
 *  · Negative — dislikes, and the reasons people typed when they hit regenerate.
 *    `digest_feedback` has been write-only since it shipped: rows went in, and
 *    nothing has ever read one. This is where that stops.
 *
 * Nothing here is scored. The ledger is evidence; the dossier keeper is the
 * thing that draws a conclusion from it.
 */

const SAVED_CAP = 40;     // the most recent saves carry the taste; older ones are history
const SKIPPED_CAP = 40;
const QUESTION_CAP = 30;
const DIG_CAP = 20;

export interface LedgerPaper {
  id: string;
  title: string;
  lead: string;          // first sentence of the abstract — enough to characterise it
  keywords: string[];
  year: number | null;
  digestTheme: string | null;
}

export interface Ledger {
  saved: LedgerPaper[];
  skipped: LedgerPaper[];
  questions: string[];
  digs: string[];
  interests: { keyword: string; field: string | null; weight: number }[];
  disliked: { title: string; reason: string | null }[];
  complaints: string[];
  /**
   * How much evidence the dossier was written from. The keeper compares this
   * against the stored count to decide whether a rewrite is worth a model call.
   */
  signalCount: number;
}

function lead(abstract: string | null): string {
  const text = (abstract || "").trim();
  if (!text) return "";
  return (text.match(/[^.!?]+[.!?]/)?.[0] ?? text.slice(0, 220)).trim();
}

/** Only what characterises a paper — the ledger never wants a PDF extract. */
type PaperRowLite = {
  id: string;
  digestId: string;
  title: string;
  abstract: string | null;
  keywords: string | null;
  year: number | null;
};

function toLedgerPaper(p: PaperRowLite, themeById: Map<string, string | null>): LedgerPaper {
  let keywords: string[] = [];
  try { keywords = p.keywords ? JSON.parse(p.keywords) : []; } catch { /* malformed keywords are not a signal */ }
  return {
    id: p.id,
    title: p.title,
    lead: lead(p.abstract),
    keywords: keywords.slice(0, 6),
    year: p.year ?? null,
    digestTheme: themeById.get(p.digestId) ?? null,
  };
}

export async function collectLedger(userId: string): Promise<Ledger> {
  const [feedbackRows, interestRows, complaintRows, userDigests] = await Promise.all([
    db.query.feedback.findMany({
      where: eq(feedback.userId, userId),
      orderBy: desc(feedback.createdAt),
    }),
    db.query.interests.findMany({
      where: eq(interests.userId, userId),
      orderBy: desc(interests.weight),
    }),
    db.query.digestFeedback.findMany({
      where: eq(digestFeedback.userId, userId),
      orderBy: desc(digestFeedback.createdAt),
      limit: 20,
    }),
    db.query.digests.findMany({
      where: eq(digests.userId, userId),
      orderBy: desc(digests.createdAt),
      columns: { id: true, theme: true },
      limit: 60,
    }),
  ]);

  const savedIds = feedbackRows.filter(f => f.type === "star").map(f => f.paperId);
  const dislikedIds = feedbackRows.filter(f => f.type === "dislike").map(f => f.paperId);
  const savedSet = new Set(savedIds);
  const themeById = new Map(userDigests.map(d => [d.id, d.theme]));

  // Every paper this reader has been shown, newest digest first. The saved ones
  // are the exemplars; the rest are the walked-past pile.
  const shownRows = userDigests.length
    ? await db.query.papers.findMany({
        where: inArray(papers.digestId, userDigests.map(d => d.id)),
        orderBy: desc(papers.createdAt),
        columns: LIST_COLUMNS,
      })
    : [];

  // A save can come from somebody else's shared digest, so the paper may not be
  // in this reader's own digests at all — fetch those separately.
  const missingSavedIds = savedIds.filter(id => !shownRows.some(p => p.id === id));
  const extraSaved = missingSavedIds.length
    ? await db.query.papers.findMany({
        where: inArray(papers.id, missingSavedIds),
        columns: LIST_COLUMNS,
      })
    : [];

  const saved = [...extraSaved, ...shownRows]
    .filter(p => savedSet.has(p.id))
    .slice(0, SAVED_CAP)
    .map(p => toLedgerPaper(p, themeById));

  const skipped = shownRows
    .filter(p => !savedSet.has(p.id) && !dislikedIds.includes(p.id))
    .slice(0, SKIPPED_CAP)
    .map(p => toLedgerPaper(p, themeById));

  const disliked = shownRows
    .filter(p => dislikedIds.includes(p.id))
    .map(p => ({
      title: p.title,
      reason: feedbackRows.find(f => f.paperId === p.id && f.type === "dislike")?.reason ?? null,
    }));

  // Only the question column — the reading view's own columns belong to the
  // reading view, and this query must not care which of them exist yet.
  const questionRows = await db.query.qaPairs.findMany({
    where: eq(qaPairs.userId, userId),
    orderBy: desc(qaPairs.createdAt),
    columns: { question: true },
    limit: QUESTION_CAP,
  });

  const digRows = await db.query.events.findMany({
    where: and(eq(events.userId, userId), eq(events.type, "dig_deeper")),
    orderBy: desc(events.createdAt),
    limit: DIG_CAP,
  });
  const digs = digRows.map(e => {
    try {
      const meta = JSON.parse(e.metadata || "{}");
      return String(meta.selection || meta.question || "").trim();
    } catch { return ""; }
  }).filter(Boolean);

  const questions = questionRows.map(q => q.question).filter(Boolean);

  return {
    saved,
    skipped,
    questions,
    digs,
    // TODO(librarian): when the familiarity table lands, its levels join here as
    // the fourth "stated" signal — the dossier should know what someone already
    // knows, not just what they like.
    interests: interestRows.map(i => ({ keyword: i.keyword, field: i.field, weight: i.weight ?? 1 })),
    disliked,
    complaints: complaintRows.map(c => c.reason).filter(Boolean),
    signalCount:
      saved.length + disliked.length + questions.length + digs.length + complaintRows.length,
  };
}
