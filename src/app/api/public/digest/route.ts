import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { digests, papers } from "@/lib/db/schema";
import { eq, desc, asc, and, or, isNull } from "drizzle-orm";
import { LIST_COLUMNS, attachNewsFullText } from "@/lib/db/paper-payload";

/**
 * The logged-out digest is the same bytes for everyone, so let the CDN answer it.
 * This is what keeps a first-time visitor off a cold serverless function — a cold
 * /api/public/digest was measured at ~1.9s against ~0.2s warm.
 */
const PUBLIC_CACHE_HEADERS = { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600" };

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
          // A hidden digest is one the admin rejected mid-regeneration; the
          // logged-out homepage must not serve it while the replacement runs.
          // (Direct ?digestId= permalinks stay reachable on purpose.)
          where: and(
            eq(digests.userId, adminId),
            or(isNull(digests.hidden), eq(digests.hidden, false)),
          ),
          orderBy: desc(digests.createdAt),
        });

    if (!digest) {
      return NextResponse.json({ digest: null, papers: [] });
    }

    const digestPapers = await attachNewsFullText(
      await db.query.papers.findMany({
        where: eq(papers.digestId, digest.id),
        orderBy: asc(papers.sourceIndex),
        columns: LIST_COLUMNS,
      }),
    );

    // Whitelist, never spread: the row also carries the owner's userId, private
    // notes, seedInterests profile, and pipeline debug fields (workingTheme,
    // themeCandidates, searchQueries). None of that belongs on an
    // unauthenticated endpoint.
    return NextResponse.json({
      digest: {
        id: digest.id,
        date: digest.date,
        theme: digest.theme,
        synthesisContent: digest.synthesisContent,
        gist: digest.gist,
        starred: digest.starred,
        createdAt: digest.createdAt,
        keyConcepts: digest.keyConcepts ? JSON.parse(digest.keyConcepts) : [],
        suggestedQuestions: digest.suggestedQuestions ? JSON.parse(digest.suggestedQuestions) : [],
        suggestedAnswers: digest.suggestedAnswers ? JSON.parse(digest.suggestedAnswers) : [],
      },
      papers: digestPapers.map((p) => ({
        ...p,
        authors: p.authors ? JSON.parse(p.authors) : [],
        keywords: p.keywords ? JSON.parse(p.keywords) : [],
        keyFindings: p.keyFindings ? JSON.parse(p.keyFindings) : [],
        methodFacts: p.methodFacts ? JSON.parse(p.methodFacts) : [],
      })),
    }, { headers: PUBLIC_CACHE_HEADERS });
  } catch (error) {
    console.error("Public digest error:", error);
    return NextResponse.json({ digest: null, papers: [] });
  }
}
