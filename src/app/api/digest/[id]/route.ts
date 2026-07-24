import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { digests, papers } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

/**
 * GET /api/digest/[id] — public permalink for any digest.
 * No auth required — digests are public by design.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const digest = await db.query.digests.findFirst({
      where: eq(digests.id, id),
    });

    if (!digest) {
      return NextResponse.json({ error: "Digest not found" }, { status: 404 });
    }

    const digestPapers = await db.query.papers.findMany({
      where: eq(papers.digestId, digest.id),
    });

    return NextResponse.json({
      digest: {
        ...digest,
        keyConcepts: digest.keyConcepts ? JSON.parse(digest.keyConcepts) : [],
        seedInterests: digest.seedInterests ? JSON.parse(digest.seedInterests) : [],
      },
      papers: digestPapers.map((p) => ({
        ...p,
        authors: p.authors ? JSON.parse(p.authors) : [],
        keywords: p.keywords ? JSON.parse(p.keywords) : [],
        keyFindings: p.keyFindings ? JSON.parse(p.keyFindings) : [],
        methodFacts: p.methodFacts ? JSON.parse(p.methodFacts) : [],
      })),
    });
  } catch (error) {
    console.error("Digest permalink error:", error);
    return NextResponse.json({ error: "Failed to load digest" }, { status: 500 });
  }
}
