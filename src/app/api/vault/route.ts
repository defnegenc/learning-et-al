import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { papers, feedback, digests } from "@/lib/db/schema";
import { eq, and, desc, inArray } from "drizzle-orm";
import { getAuthUser } from "@/lib/get-user";

// The vault is the reading list: the papers this user has bookmarked
// (feedback rows of type "star"). Returns them all, newest first.
export async function GET(req: NextRequest) {
  const userId = await getAuthUser(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const starredRows = await db.query.feedback.findMany({
      where: and(eq(feedback.userId, userId), eq(feedback.type, "star")),
      columns: { paperId: true },
    });
    const starredIds = [...new Set(starredRows.map((r) => r.paperId))];
    if (starredIds.length === 0) return NextResponse.json({ papers: [] });

    const rows = await db.query.papers.findMany({
      where: inArray(papers.id, starredIds),
      orderBy: desc(papers.createdAt),
    });

    // Attach the digest each paper came from so the reading list can attribute it.
    const digestIds = [...new Set(rows.map((p) => p.digestId))];
    const digestRows = digestIds.length
      ? await db.query.digests.findMany({
          where: inArray(digests.id, digestIds),
          columns: { id: true, theme: true, date: true },
        })
      : [];
    const digestById = new Map(digestRows.map((d) => [d.id, d]));

    return NextResponse.json({
      papers: rows.map((p) => ({
        ...p,
        authors: p.authors ? JSON.parse(p.authors) : [],
        keywords: p.keywords ? JSON.parse(p.keywords) : [],
        keyFindings: p.keyFindings ? JSON.parse(p.keyFindings) : [],
        methodFacts: p.methodFacts ? JSON.parse(p.methodFacts) : [],
        connectionReason: p.connectionReason || null,
        bookmarked: true,
        digestTheme: digestById.get(p.digestId)?.theme ?? null,
        digestDate: digestById.get(p.digestId)?.date ?? null,
      })),
    });
  } catch (error) {
    console.error("Vault fetch error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
