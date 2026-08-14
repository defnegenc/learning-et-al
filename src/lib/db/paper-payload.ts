import { inArray } from "drizzle-orm";
import { db } from "./index";
import { papers } from "./schema";

/**
 * Heavy columns that list endpoints must NOT ship.
 *
 * A paper row carries a full PDF extract (`fullText`, routinely 100 KB+) plus
 * generated JSON blobs (`companion`, `homework`, `abstractJargon`, `eli5`) that
 * the digest and vault views never render — they're fetched on demand from
 * /api/papers/[id]/companion and /homework when a paper is actually opened.
 * Selecting them made a three-paper digest a ~390 KB response; excluding them
 * puts it around 20 KB.
 *
 * Pass as `columns` to a drizzle papers query. Add a column here whenever the
 * pipeline starts storing another large generated blob on `papers`.
 */
export const LIST_COLUMNS = {
  fullText: false,
  companion: false,
  homework: false,
  abstractJargon: false,
  eli5: false,
} as const;

/**
 * News is the one exception to LIST_COLUMNS: for an rss item the "full text" is
 * the article body the detail view shows, and it's a few KB rather than a PDF.
 * Fetch it back for those rows only, capped — a scrape that swallowed a whole
 * page shouldn't be able to put a PDF-sized string back into the payload.
 */
const NEWS_TEXT_CAP = 20_000; // ~4,000 words, longer than any article we show

export async function attachNewsFullText<T extends { id: string; source: string }>(
  rows: T[],
): Promise<(T & { fullText?: string | null })[]> {
  const newsIds = rows.filter((r) => r.source === "rss").map((r) => r.id);
  if (newsIds.length === 0) return rows;

  const texts = await db.query.papers.findMany({
    where: inArray(papers.id, newsIds),
    columns: { id: true, fullText: true },
  });
  const textById = new Map(texts.map((t) => [t.id, t.fullText?.slice(0, NEWS_TEXT_CAP) ?? null]));
  return rows.map((r) => (textById.has(r.id) ? { ...r, fullText: textById.get(r.id) ?? null } : r));
}
