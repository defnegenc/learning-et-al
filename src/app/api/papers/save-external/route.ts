import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { papers, feedback, digests } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getAuthUser } from "@/lib/get-user";

// Stored URLs are later fetched server-side (PDF parsing), so only accept
// public https URLs with a real hostname — no IP literals or localhost.
function safeExternalUrl(raw: unknown): string | null {
  if (typeof raw !== "string" || !raw) return null;
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:") return null;
    const host = u.hostname.toLowerCase();
    if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) return null;
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(":")) return null; // IPv4/IPv6 literals
    return u.toString();
  } catch {
    return null;
  }
}

// Save a homework result (an external OpenAlex work, not yet in our papers
// table) to the reading list: insert a paper row attached to the same digest
// as the paper it was discovered from, then star it.
export async function POST(req: NextRequest) {
  const userId = await getAuthUser(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { sourcePaperId, item } = await req.json();
    if (!sourcePaperId || !item?.title) {
      return NextResponse.json({ error: "sourcePaperId and item are required" }, { status: 400 });
    }

    const sourcePaper = await db.query.papers.findFirst({ where: eq(papers.id, sourcePaperId) });
    if (!sourcePaper) return NextResponse.json({ error: "Source paper not found" }, { status: 404 });

    // Ownership check: the source paper's digest must belong to the requester.
    const digest = await db.query.digests.findFirst({ where: eq(digests.id, sourcePaper.digestId) });
    if (!digest || digest.userId !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Reuse an existing row for this work under the same digest (double-save guard).
    let paper = item.openAlexId
      ? await db.query.papers.findFirst({
          where: and(eq(papers.digestId, sourcePaper.digestId), eq(papers.openAlexId, item.openAlexId)),
        })
      : undefined;

    if (!paper) {
      const sourceUrl = safeExternalUrl(item.url);
      const pdfUrl = safeExternalUrl(item.pdfUrl);
      [paper] = await db.insert(papers).values({
        digestId: sourcePaper.digestId,
        title: String(item.title),
        authors: JSON.stringify(Array.isArray(item.authors) ? item.authors : []),
        abstract: item.abstract || null,
        source: (sourceUrl || "").toLowerCase().includes("arxiv") ? "arxiv" : "semantic_scholar",
        sourceUrl,
        pdfUrl,
        year: typeof item.year === "number" ? item.year : null,
        openAlexId: item.openAlexId || null,
        category: "recent",
      }).returning();
    }

    const existingStar = await db.query.feedback.findFirst({
      where: and(eq(feedback.paperId, paper.id), eq(feedback.userId, userId), eq(feedback.type, "star")),
    });
    if (!existingStar) {
      await db.insert(feedback).values({ paperId: paper.id, userId, type: "star" });
    }

    return NextResponse.json({ paperId: paper.id });
  } catch (error) {
    console.error("Save external error:", error);
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }
}
