import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { events, papers } from "@/lib/db/schema";
import { getAuthUser } from "@/lib/get-user";

/*
 * How much did you like this paper — one 1-5 rating, asked at most once, in the
 * dead air of a dig.
 *
 * Stored as an `events` row rather than a `feedback` one on purpose. `feedback`
 * is a two-value enum (star | dislike) that the interest weights read directly,
 * and a five-point opinion is not the same object as a save: somebody can rate a
 * paper 2/5 and still have wanted to be sent it. Keeping it in `events` means it
 * reaches the taste ledger without touching what a star means today.
 *
 *   GET  → { level } or { level: null }
 *   POST → store or replace this reader's rating
 */

const LATEST = { orderBy: desc(events.createdAt) } as const;

async function latestRating(userId: string, paperId: string): Promise<number | null> {
  const row = await db.query.events.findFirst({
    where: and(eq(events.userId, userId), eq(events.paperId, paperId), eq(events.type, "paper_rating")),
    ...LATEST,
  });
  if (!row?.metadata) return null;
  try {
    const level = JSON.parse(row.metadata)?.level;
    return typeof level === "number" ? level : null;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getAuthUser(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  return NextResponse.json({ level: await latestRating(userId, id) });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getAuthUser(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const level = Number(body?.level);
    if (!Number.isInteger(level) || level < 1 || level > 5) {
      return NextResponse.json({ error: "level must be 1-5" }, { status: 400 });
    }

    const paper = await db.query.papers.findFirst({
      where: eq(papers.id, id),
      columns: { id: true, digestId: true },
    });
    if (!paper) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Replace rather than accumulate: the question is "what do you think of it",
    // and the answer is whatever they last said.
    await db.delete(events).where(
      and(eq(events.userId, userId), eq(events.paperId, id), eq(events.type, "paper_rating")),
    );
    await db.insert(events).values({
      userId,
      type: "paper_rating",
      paperId: id,
      digestId: paper.digestId,
      metadata: JSON.stringify({ level }),
    });

    return NextResponse.json({ level });
  } catch (error) {
    console.error("Rating error:", error);
    return NextResponse.json({ error: "Failed to record rating" }, { status: 500 });
  }
}
