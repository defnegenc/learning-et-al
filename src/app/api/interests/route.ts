import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { interests, users } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { getAuthUser } from "@/lib/get-user";

export async function PUT(req: NextRequest) {
  const userId = await getAuthUser(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const items: { keyword: string; field?: string; level?: string }[] = body.interests;
    if (!Array.isArray(items) || items.length < 3) {
      return NextResponse.json({ error: "At least 3 interests required" }, { status: 400 });
    }

    // Replace all existing interests
    await db.delete(interests).where(eq(interests.userId, userId));
    for (const item of items) {
      const level = ["beginner", "intermediate", "expert"].includes(item.level ?? "")
        ? item.level!
        : "intermediate";
      await db.insert(interests).values({
        userId,
        keyword: item.keyword.trim(),
        field: item.field ?? "Computer Science",
        weight: 1.0,
        source: "seed",
        level: level as "beginner" | "intermediate" | "expert",
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Interests update error:", error);
    return NextResponse.json({ error: "Failed to update interests" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const userId = await getAuthUser(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [userInterests, userRow] = await Promise.all([
      db.query.interests.findMany({ where: eq(interests.userId, userId), orderBy: desc(interests.weight) }),
      db.query.users.findFirst({ where: eq(users.id, userId) }),
    ]);

    return NextResponse.json({ interests: userInterests, cadence: userRow?.cadence, emailOptOut: userRow?.emailOptOut ?? false });
  } catch (error) {
    console.error("Interests fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch interests" }, { status: 500 });
  }
}
