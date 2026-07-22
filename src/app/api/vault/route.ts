import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { papers, feedback } from "@/lib/db/schema";
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
    return NextResponse.json({
      papers: rows.map((p) => ({
        ...p,
        authors: p.authors ? JSON.parse(p.authors) : [],
        keywords: p.keywords ? JSON.parse(p.keywords) : [],
        keyFindings: p.keyFindings ? JSON.parse(p.keyFindings) : [],
        connectionReason: p.connectionReason || null,
        bookmarked: true,
      })),
    });
  } catch (error) {
    console.error("Vault fetch error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
