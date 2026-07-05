import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { digests, papers } from "@/lib/db/schema";
import { eq, and, desc, asc } from "drizzle-orm";
import { getAuthUser } from "@/lib/get-user";

export async function GET(req: NextRequest) {
  const userId = await getAuthUser(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const url = new URL(req.url);
    const date = url.searchParams.get("date");
    const id = url.searchParams.get("id");
    const all = url.searchParams.get("all");

    // Return all digests (for theme history)
    if (all === "true") {
      const allDigests = await db.query.digests.findMany({
        where: eq(digests.userId, userId),
        orderBy: desc(digests.createdAt),
      });

      return NextResponse.json({
        digests: allDigests.map((d) => ({
          ...d,
          keyConcepts: d.keyConcepts ? JSON.parse(d.keyConcepts) : [],
          suggestedQuestions: d.suggestedQuestions ? JSON.parse(d.suggestedQuestions) : [],
        })),
      });
    }

    let digest;
    if (id) {
      digest = await db.query.digests.findFirst({
        where: and(eq(digests.userId, userId), eq(digests.id, id)),
      });
    } else if (date) {
      digest = await db.query.digests.findFirst({
        where: and(eq(digests.userId, userId), eq(digests.date, date)),
        orderBy: desc(digests.createdAt),
      });
    } else {
      // Default: show today's digest if it exists, otherwise most recent
      const today = new Date().toISOString().split("T")[0];
      digest = await db.query.digests.findFirst({
        where: and(eq(digests.userId, userId), eq(digests.date, today)),
        orderBy: desc(digests.createdAt),
      });
      if (!digest || digest.hidden) {
        digest = await db.query.digests.findFirst({
          where: eq(digests.userId, userId),
          orderBy: desc(digests.createdAt),
        });
        if (digest?.hidden) digest = undefined;
      }
    }

    if (!digest) {
      return NextResponse.json({ digest: null, papers: [] });
    }

    const digestPapers = await db.query.papers.findMany({
      where: eq(papers.digestId, digest.id),
      orderBy: asc(papers.sourceIndex),
    });

    return NextResponse.json({
      digest: {
        ...digest,
        keyConcepts: digest.keyConcepts ? JSON.parse(digest.keyConcepts) : [],
        suggestedQuestions: digest.suggestedQuestions ? JSON.parse(digest.suggestedQuestions) : [],
        seedInterests: digest.seedInterests ? JSON.parse(digest.seedInterests) : [],
      },
      papers: digestPapers.map((p) => ({
        ...p,
        authors: p.authors ? JSON.parse(p.authors) : [],
        keywords: p.keywords ? JSON.parse(p.keywords) : [],
        keyFindings: p.keyFindings ? JSON.parse(p.keyFindings) : [],
        connectionReason: p.connectionReason || null,
      })),
    });
  } catch (error) {
    console.error("Digest fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch digest" }, { status: 500 });
  }
}
