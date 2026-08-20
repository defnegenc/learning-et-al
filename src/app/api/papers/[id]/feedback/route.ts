import { NextRequest, NextResponse, after } from "next/server";
import { db, ensureSchema } from "@/lib/db";
import { papers, feedback, interests, digests, savedDigests } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getAuthUser } from "@/lib/get-user";
import { trackEvent } from "@/lib/track";
import { refreshDossier } from "@/lib/librarian/dossier";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await ensureSchema();
  const userId = await getAuthUser(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  await db.delete(feedback).where(and(eq(feedback.paperId, id), eq(feedback.userId, userId), eq(feedback.type, "star")));
  return NextResponse.json({ ok: true });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await ensureSchema();
  const userId = await getAuthUser(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const { type, reason } = await req.json();

    if (!type || (type !== "star" && type !== "dislike")) {
      return NextResponse.json({ error: "type must be 'star' or 'dislike'" }, { status: 400 });
    }

    const paper = await db.query.papers.findFirst({
      where: eq(papers.id, id),
    });

    if (!paper) {
      return NextResponse.json({ error: "Paper not found" }, { status: 404 });
    }

    // Bookmarking is idempotent. Apart from preventing duplicate reading-list
    // rows, this matters when a signed-out save is replayed after sign-in.
    const existingFeedback = type === "star"
      ? await db.query.feedback.findFirst({
          where: and(eq(feedback.paperId, id), eq(feedback.userId, userId), eq(feedback.type, type)),
        })
      : undefined;
    const [insertedFeedback] = existingFeedback ? [] : await db.insert(feedback).values({
      paperId: id,
      userId,
      type,
      reason: reason || null,
    }).returning();
    const fb = existingFeedback ?? insertedFeedback;

    // Saving a paper from somebody else's public digest also adds the canonical
    // digest to this reader's history. We link rather than clone, so its public
    // permalink, paper ids, and future metadata remain one coherent object.
    if (type === "star") {
      const digest = await db.query.digests.findFirst({
        where: eq(digests.id, paper.digestId),
        columns: { userId: true },
      });
      if (digest && digest.userId !== userId) {
        const existingSave = await db.query.savedDigests.findFirst({
          where: and(eq(savedDigests.userId, userId), eq(savedDigests.digestId, paper.digestId)),
        });
        if (!existingSave) {
          await db.insert(savedDigests)
            .values({ userId, digestId: paper.digestId })
            .onConflictDoNothing();
        }
      }
    }

    // Update interest weights based on paper keywords
    const paperKeywords: string[] = paper.keywords ? JSON.parse(paper.keywords) : [];
    // Small weight changes — engagement should nudge, not dominate
    const weightDelta = type === "star" ? 0.1 : -0.05;
    // Only boost EXISTING interests — don't create new ones from paper keywords.
    // Creating new interests from engagement caused random topics (like "emoji communication")
    // to pollute the user's feed when they were never intentionally selected.
    for (const keyword of existingFeedback ? [] : paperKeywords) {
      const existing = await db.query.interests.findFirst({
        where: and(eq(interests.userId, userId), eq(interests.keyword, keyword)),
      });

      if (existing) {
        const newWeight = Math.min(3.0, Math.max(0, (existing.weight || 1.0) + weightDelta));
        await db.update(interests)
          .set({ weight: newWeight, updatedAt: new Date() })
          .where(eq(interests.id, existing.id));
      }
      // Don't create new interests — the user picks their interests in settings
    }

    // Store contextual features with feedback for richer learning (audit 3.6)
    const isCrossDomain = paper.category === "recent" && paper.source !== "rss";
    if (!existingFeedback) trackEvent(userId, "paper_feedback", {
      paperId: id,
      digestId: paper.digestId,
      metadata: {
        type,
        reason: reason || undefined,
        paperCategory: paper.category,
        paperSource: paper.source,
        paperYear: paper.year,
        keywords: paperKeywords.slice(0, 5),
        isCrossDomain,
      },
    });

    // A save or a dislike is a taste signal. The keeper decides for itself
    // whether five have piled up since the last rewrite, so this costs two
    // queries in the common case — and it must never make the reader wait for
    // their bookmark. `after` rather than a bare floating promise: on Vercel the
    // invocation can be frozen the moment the response is sent, which would kill
    // a rewrite mid-flight.
    if (!existingFeedback) {
      after(() => refreshDossier(userId).catch(() => {}));
    }

    return NextResponse.json({ feedback: fb });
  } catch (error) {
    console.error("Feedback error:", error);
    return NextResponse.json({ error: "Failed to record feedback" }, { status: 500 });
  }
}
