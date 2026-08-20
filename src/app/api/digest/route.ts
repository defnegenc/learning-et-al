import { NextRequest, NextResponse } from "next/server";
import { db, ensureSchema } from "@/lib/db";
import { digests, papers, savedDigests } from "@/lib/db/schema";
import { eq, and, desc, asc, inArray, or } from "drizzle-orm";
import { getAuthUser } from "@/lib/get-user";
import { LIST_COLUMNS, attachNewsFullText } from "@/lib/db/paper-payload";

export async function GET(req: NextRequest) {
  await ensureSchema();
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
      const savedRows = await db.query.savedDigests.findMany({
        where: eq(savedDigests.userId, userId),
        columns: { digestId: true },
      });
      const savedIds = [...new Set(savedRows.map((row) => row.digestId))];
      const allDigests = await db.query.digests.findMany({
        where: savedIds.length
          ? or(eq(digests.userId, userId), inArray(digests.id, savedIds))
          : eq(digests.userId, userId),
        orderBy: desc(digests.createdAt),
      });

      return NextResponse.json({
        digests: allDigests.map((d) => ({
          id: d.id,
          date: d.date,
          theme: d.theme,
          synthesisContent: d.synthesisContent,
        })),
      });
    }

    let digest;
    if (id) {
      const saved = await db.query.savedDigests.findFirst({
        where: and(eq(savedDigests.userId, userId), eq(savedDigests.digestId, id)),
        columns: { id: true },
      });
      digest = await db.query.digests.findFirst({
        where: saved
          ? eq(digests.id, id)
          : and(eq(digests.userId, userId), eq(digests.id, id)),
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

    const digestPapers = await attachNewsFullText(
      await db.query.papers.findMany({
        where: eq(papers.digestId, digest.id),
        orderBy: asc(papers.sourceIndex),
        columns: LIST_COLUMNS,
      }),
    );

    const parsedDigest = {
      ...digest,
      keyConcepts: digest.keyConcepts ? JSON.parse(digest.keyConcepts) : [],
      suggestedQuestions: digest.suggestedQuestions ? JSON.parse(digest.suggestedQuestions) : [],
      seedInterests: digest.seedInterests ? JSON.parse(digest.seedInterests) : [],
    };
    // A shared digest is readable, not co-owned. Keep its author's notes and
    // pipeline diagnostics out of the importing reader's authenticated payload.
    const responseDigest = id && digest.userId !== userId ? {
      id: parsedDigest.id,
      date: parsedDigest.date,
      theme: parsedDigest.theme,
      synthesisContent: parsedDigest.synthesisContent,
      keyConcepts: parsedDigest.keyConcepts,
      suggestedQuestions: parsedDigest.suggestedQuestions,
      suggestedAnswers: parsedDigest.suggestedAnswers,
      seedInterests: parsedDigest.seedInterests,
      gist: parsedDigest.gist,
    } : parsedDigest;

    return NextResponse.json({
      digest: responseDigest,
      papers: digestPapers.map((p) => ({
        ...p,
        authors: p.authors ? JSON.parse(p.authors) : [],
        keywords: p.keywords ? JSON.parse(p.keywords) : [],
        keyFindings: p.keyFindings ? JSON.parse(p.keyFindings) : [],
        methodFacts: p.methodFacts ? JSON.parse(p.methodFacts) : [],
        connectionReason: p.connectionReason || null,
      })),
    }, {
      // Per-user, so never shared — but a short browser cache makes Today ⇄ Vault
      // switching instant. The refetch after generating passes cache: "no-store"
      // so a fresh digest is never masked by this.
      headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=120" },
    });
  } catch (error) {
    console.error("Digest fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch digest" }, { status: 500 });
  }
}
