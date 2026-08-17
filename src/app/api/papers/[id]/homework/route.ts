import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { papers } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getOpenAlexCitingWorks, getOpenAlexRecentTitleMentions } from "@/lib/fetchers/open-alex";
import { getAuthUser } from "@/lib/get-user";

export const maxDuration = 30;

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

    let results = paper.openAlexId ? await getOpenAlexCitingWorks(paper.openAlexId, 8) : [];
    if (results.length === 0) {
      // No OpenAlex ID (or nothing cites it yet): look for recent work that
      // mentions this title, which is the closest useful "since then" fallback.
      results = (await getOpenAlexRecentTitleMentions(paper.title, 8))
        .filter((r) => !paper.year || (r.year && r.year >= paper.year));
    }

    const sourceTitle = normalizedTitle(paper.title);
    const homework: HomeworkItem[] = results
      .filter((r) => normalizedTitle(r.title) !== sourceTitle)
      .slice(0, 4)
      .map((r) => ({
        openAlexId: r.openAlexId,
        title: r.title,
        authors: r.authors,
        year: r.year || null,
        venue: r.venueName || null,
        url: r.sourceUrl || null,
        pdfUrl: r.pdfUrl || null,
        abstract: r.abstract.slice(0, 400),
        citationCount: r.citationCount,
      }));

    if (homework.length > 0) {
      await db.update(papers).set({ homework: JSON.stringify(homework) }).where(eq(papers.id, id)).catch(() => {});
    }
    return NextResponse.json({ homework });
  } catch (error) {
    console.error("Homework error:", error);
    return NextResponse.json({ homework: null });
  }
}
