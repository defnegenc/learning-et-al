import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { papers, digests, feedback } from "@/lib/db/schema";
import { eq, ne, and } from "drizzle-orm";
import { getAuthUser } from "@/lib/get-user";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getAuthUser(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;

    // Get the current paper
    const paper = await db.query.papers.findFirst({
      where: eq(papers.id, id),
    });

    if (!paper) {
      return NextResponse.json({ error: "Paper not found" }, { status: 404 });
    }

    const currentKeywords: string[] = paper.keywords
      ? JSON.parse(paper.keywords)
      : [];

    if (currentKeywords.length === 0) {
      return NextResponse.json({ related: [] });
    }

    // Get all papers from this user's digests (starred or in vault)
    const userDigests = await db.query.digests.findMany({
      where: eq(digests.userId, userId),
    });

    const digestIds = userDigests.map((d) => d.id);
    if (digestIds.length === 0) {
      return NextResponse.json({ related: [] });
    }

    // Get starred paper IDs
    const starredFeedback = await db.query.feedback.findMany({
      where: and(eq(feedback.userId, userId), eq(feedback.type, "star")),
    });
    const starredPaperIds = new Set(starredFeedback.map((f) => f.paperId));

    // Get all papers from user's digests, excluding the current one
    const allPapers = [];
    for (const digestId of digestIds) {
      const digestPapers = await db.query.papers.findMany({
        where: and(eq(papers.digestId, digestId), ne(papers.id, id)),
      });
      allPapers.push(...digestPapers);
    }

    // Score by keyword overlap
    const currentKeywordsLower = currentKeywords.map((k) => k.toLowerCase());

    const scored = allPapers
      .map((p) => {
        const pKeywords: string[] = p.keywords ? JSON.parse(p.keywords) : [];
        const pKeywordsLower = pKeywords.map((k) => k.toLowerCase());

        let overlap = 0;
        for (const ck of currentKeywordsLower) {
          for (const pk of pKeywordsLower) {
            // Exact match or significant substring overlap
            if (ck === pk || ck.includes(pk) || pk.includes(ck)) {
              overlap++;
            }
          }
        }

        // Boost starred papers slightly
        if (starredPaperIds.has(p.id)) {
          overlap += 0.5;
        }

        return { paper: p, keywords: pKeywords, overlap };
      })
      .filter((s) => s.overlap > 0)
      .sort((a, b) => b.overlap - a.overlap)
      .slice(0, 3);

    return NextResponse.json({
      related: scored.map((s) => ({
        id: s.paper.id,
        title: s.paper.title,
        keywords: s.keywords.slice(0, 2),
        source: s.paper.source,
      })),
    });
  } catch (error) {
    console.error("Related papers error:", error);
    return NextResponse.json(
      { error: "Failed to fetch related papers" },
      { status: 500 }
    );
  }
}
