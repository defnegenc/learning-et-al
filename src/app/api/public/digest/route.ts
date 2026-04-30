import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { digests, papers } from "@/lib/db/schema";
import { eq, desc, asc, and } from "drizzle-orm";

/**
 * Public endpoint — no auth required.
 * Serves the admin user's digest. Accepts ?digestId= to load a specific digest.
 */
export async function GET(req: NextRequest) {
  const adminId = process.env.ADMIN_USER_ID;
  if (!adminId) {
    return NextResponse.json({ digest: null, papers: [] });
  }

  const digestId = req.nextUrl.searchParams.get("digestId");

  try {
    const digest = digestId
      ? await db.query.digests.findFirst({
          where: and(eq(digests.id, digestId), eq(digests.userId, adminId)),
        })
      : await db.query.digests.findFirst({
          where: eq(digests.userId, adminId),
          orderBy: desc(digests.createdAt),
        });

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
        suggestedAnswers: digest.suggestedAnswers ? JSON.parse(digest.suggestedAnswers) : [],
      },
      papers: digestPapers.map((p) => ({
        ...p,
        authors: p.authors ? JSON.parse(p.authors) : [],
        keywords: p.keywords ? JSON.parse(p.keywords) : [],
        keyFindings: p.keyFindings ? JSON.parse(p.keyFindings) : [],
      })),
    });
  } catch (error) {
    console.error("Public digest error:", error);
    return NextResponse.json({ digest: null, papers: [] });
  }
}
