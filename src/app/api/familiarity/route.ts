import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { familiarity, familiarityPrompts, papers, users } from "@/lib/db/schema";
import { getAuthUser } from "@/lib/get-user";
import { isFamiliarityLevel, topicFromCompanion } from "@/lib/familiarity";

type Action = "offer" | "skip" | "set";

function localDay(timeZone: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}
async function context(userId: string, paperId: string) {
  const paper = await db.query.papers.findFirst({ where: eq(papers.id, paperId) });
  if (!paper?.companion) return null;
  const topic = topicFromCompanion(JSON.parse(paper.companion));
  if (!topic) return null;
  const value = await db.query.familiarity.findFirst({
    where: and(eq(familiarity.userId, userId), eq(familiarity.topicId, topic.id)),
  });
  return { topic, value };
}

export async function GET(req: NextRequest) {
  const userId = await getAuthUser(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const paperId = req.nextUrl.searchParams.get("paperId") || "";
  const state = await context(userId, paperId);
  if (!state) return NextResponse.json({ topic: null, familiarity: null });
  return NextResponse.json({ topic: state.topic, familiarity: state.value ?? null });
}

export async function POST(req: NextRequest) {
  const userId = await getAuthUser(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json() as { paperId?: unknown; action?: unknown; level?: unknown };
    const paperId = typeof body.paperId === "string" ? body.paperId : "";
    const action = body.action as Action;
    if (!paperId || !["offer", "skip", "set"].includes(action)) {
      return NextResponse.json({ error: "paperId and action are required" }, { status: 400 });
    }

    const state = await context(userId, paperId);
    if (!state) return NextResponse.json({ offered: false, topic: null, familiarity: null });
    const { topic, value } = state;

    if (action === "offer") {
      if (value) return NextResponse.json({ offered: false, topic, familiarity: value });
      const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
      const inserted = await db.insert(familiarityPrompts).values({
        userId,
        topicId: topic.id,
        topicName: topic.name,
        day: localDay(user?.timezone || "America/New_York"),
        status: "offered",
      }).onConflictDoNothing().returning({ id: familiarityPrompts.id });
      return NextResponse.json({ offered: inserted.length === 1, topic, familiarity: null });
    }

    if (action === "skip") {
      await db.update(familiarityPrompts)
        .set({ status: "skipped", updatedAt: new Date() })
        .where(and(eq(familiarityPrompts.userId, userId), eq(familiarityPrompts.topicId, topic.id)));
      return NextResponse.json({ skipped: true, topic, familiarity: null });
    }

    if (!isFamiliarityLevel(body.level)) {
      return NextResponse.json({ error: "level must be an integer from 1 to 5" }, { status: 400 });
    }
    const now = new Date();
    const source = value ? "correction" as const : "interleave" as const;
    const [saved] = await db.insert(familiarity).values({
      userId,
      topicId: topic.id,
      topicName: topic.name,
      level: body.level,
      source,
      createdAt: now,
    }).onConflictDoUpdate({
      target: [familiarity.userId, familiarity.topicId],
      set: { topicName: topic.name, level: body.level, source, createdAt: now },
    }).returning();
    await db.update(familiarityPrompts)
      .set({ status: "answered", updatedAt: now })
      .where(and(eq(familiarityPrompts.userId, userId), eq(familiarityPrompts.topicId, topic.id)));
    return NextResponse.json({ topic, familiarity: saved });
  } catch (error) {
    console.error("Familiarity error:", error);
    return NextResponse.json({ error: "Failed to update familiarity" }, { status: 500 });
  }
}
