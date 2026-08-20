import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { digests, papers } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getAuthUser } from "@/lib/get-user";
import { LIST_COLUMNS } from "@/lib/db/paper-payload";

/**
 * One paper, for the reading view at /library/[paperId].
 *
 * The reading view used to be a portal overlay the vault handed a paper object
 * to, which is why it had no URL and nothing could link to it. With a real
 * route it has to be able to load a paper cold — from an email, from a shared
 * link, or from a refresh.
 *
 * `LIST_COLUMNS` still applies: the companion and the homework come from their
 * own endpoints when the page asks for them, and `fullText` has no business in
 * a client payload at all.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getAuthUser(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await params;
    const paper = await db.query.papers.findFirst({
      where: eq(papers.id, id),
      columns: LIST_COLUMNS,
    });
    if (!paper) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const digest = await db.query.digests.findFirst({
      where: eq(digests.id, paper.digestId),
      columns: { id: true, theme: true, date: true, seedInterests: true },
    });

    return NextResponse.json({
      paper: {
        ...paper,
        authors: paper.authors ? JSON.parse(paper.authors) : [],
        keywords: paper.keywords ? JSON.parse(paper.keywords) : [],
        keyFindings: paper.keyFindings ? JSON.parse(paper.keyFindings) : [],
        methodFacts: paper.methodFacts ? JSON.parse(paper.methodFacts) : [],
        digestTheme: digest?.theme ?? null,
        digestDate: digest?.date ?? null,
      },
      // Why this paper is on the reader's shelf: the question that surfaced it
      // and the interests that seeded that question.
      provenance: {
        digestId: digest?.id ?? null,
        theme: digest?.theme ?? null,
        date: digest?.date ?? null,
        seedInterests: digest?.seedInterests
          ? (JSON.parse(digest.seedInterests) as { keyword: string; field: string }[])
              .map(s => s.keyword)
              .filter(Boolean)
              .slice(0, 3)
          : [],
      },
    });
  } catch (error) {
    console.error("Paper fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch paper" }, { status: 500 });
  }
}
