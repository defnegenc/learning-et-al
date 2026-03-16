import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { papers, feedback, interests } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = req.cookies.get("user_id")?.value;
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

    // Record feedback
    const [fb] = await db.insert(feedback).values({
      paperId: id,
      userId,
      type,
      reason: reason || null,
    }).returning();

    // Update interest weights based on paper keywords
    const paperKeywords: string[] = paper.keywords ? JSON.parse(paper.keywords) : [];
    const weightDelta = type === "star" ? 0.5 : -0.2;
    const source = type === "star" ? "star" : "dislike";

    for (const keyword of paperKeywords) {
      const existing = await db.query.interests.findFirst({
        where: and(eq(interests.userId, userId), eq(interests.keyword, keyword)),
      });

      if (existing) {
        const newWeight = Math.max(0, (existing.weight || 1.0) + weightDelta);
        await db.update(interests)
          .set({ weight: newWeight, updatedAt: new Date() })
          .where(eq(interests.id, existing.id));
      } else {
        await db.insert(interests).values({
          userId,
          keyword,
          weight: Math.max(0, 1.0 + weightDelta),
          source,
        });
      }
    }

    return NextResponse.json({ feedback: fb });
  } catch (error) {
    console.error("Feedback error:", error);
    return NextResponse.json({ error: "Failed to record feedback" }, { status: 500 });
  }
}
