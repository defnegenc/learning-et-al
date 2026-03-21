import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { digests, papers } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

/**
 * Public endpoint — no auth required.
 * Serves the admin user's latest digest for the logged-out experience.
 */
export async function GET() {
  const adminId = process.env.ADMIN_USER_ID;
  if (!adminId) {
    return NextResponse.json({ digest: null, papers: [] });
  }

  try {
    const digest = await db.query.digests.findFirst({
      where: eq(digests.userId, adminId),
      orderBy: desc(digests.createdAt),
    });

    if (!digest) {
      return NextResponse.json({ digest: null, papers: [] });
    }

    const digestPapers = await db.query.papers.findMany({
      where: eq(papers.digestId, digest.id),
    });

    return NextResponse.json({
      digest: {
        ...digest,
        keyConcepts: digest.keyConcepts ? JSON.parse(digest.keyConcepts) : [],
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
