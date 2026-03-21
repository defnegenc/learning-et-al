import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { digests, papers } from "@/lib/db/schema";
import { eq, and, like, desc, inArray } from "drizzle-orm";
import { getAuthUser } from "@/lib/get-user";

export async function GET(req: NextRequest) {
  const userId = await getAuthUser(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get("page") || "1", 10);
    const limit = parseInt(url.searchParams.get("limit") || "20", 10);
    const search = url.searchParams.get("search") || "";
    const source = url.searchParams.get("source") || "";
    const offset = (page - 1) * limit;

    // Get all digest IDs for this user
    const userDigests = await db.query.digests.findMany({
      where: eq(digests.userId, userId),
      columns: { id: true },
    });

    const digestIds = userDigests.map((d) => d.id);
    if (digestIds.length === 0) {
      return NextResponse.json({ papers: [], total: 0, page, limit });
    }

    // Query papers belonging to user's digests
    let allPapers;
    if (search) {
      allPapers = await db.query.papers.findMany({
        where: and(
          inArray(papers.digestId, digestIds),
          like(papers.title, `%${search}%`)
        ),
        orderBy: desc(papers.createdAt),
      });
    } else {
      allPapers = await db.query.papers.findMany({
        where: inArray(papers.digestId, digestIds),
        orderBy: desc(papers.createdAt),
      });
    }

    // Filter by source type
    let filtered = allPapers;
    if (source === "papers") {
      filtered = allPapers.filter(p => p.source !== "rss");
    } else if (source === "news") {
      filtered = allPapers.filter(p => p.source === "rss");
    }

    const total = filtered.length;
    const paginated = filtered.slice(offset, offset + limit);

    return NextResponse.json({
      papers: paginated.map((p) => ({
        ...p,
        authors: p.authors ? JSON.parse(p.authors) : [],
        keywords: p.keywords ? JSON.parse(p.keywords) : [],
        keyFindings: p.keyFindings ? JSON.parse(p.keyFindings) : [],
        connectionReason: p.connectionReason || null,
      })),
      total,
      page,
      limit,
    });
  } catch (error) {
    console.error("Vault fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch vault" }, { status: 500 });
  }
}
