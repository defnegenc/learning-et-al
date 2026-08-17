import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { papers, feedback, digests } from "@/lib/db/schema";
import { eq, and, desc, inArray } from "drizzle-orm";
import { getAuthUser } from "@/lib/get-user";
import { LIST_COLUMNS } from "@/lib/db/paper-payload";

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

    // The reading list renders titles, bylines and the companion's one-line
    // "remember"; the reading view pulls the whole companion and the homework
    // from their own endpoints when a paper is opened.
    const rows = await db.query.papers.findMany({
      where: inArray(papers.id, starredIds),
      orderBy: desc(papers.createdAt),
      columns: LIST_COLUMNS,
    });

    // Just the one line, never the blob — a companion runs to a few KB and
    // LIST_COLUMNS exists to keep it out of list payloads.
    const prepRows = await db.query.papers.findMany({
      where: inArray(papers.id, starredIds),
      columns: { id: true, companion: true },
    });
    const rememberById = new Map<string, string>();
    for (const row of prepRows) {
      if (!row.companion) continue;
      try {
        const c = JSON.parse(row.companion);
        const line = typeof c?.remember === "string" && c.remember.trim()
          ? c.remember.trim()
          : typeof c?.gist === "string" ? c.gist.trim() : "";
        if (line) rememberById.set(row.id, line);
      } catch { /* unparseable prep reads as still cooking */ }
    }

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
        companionRemember: rememberById.get(p.id) ?? null,
        digestTheme: digestById.get(p.digestId)?.theme ?? null,
        digestDate: digestById.get(p.digestId)?.date ?? null,
      })),
    });
  } catch (error) {
    console.error("Vault fetch error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
