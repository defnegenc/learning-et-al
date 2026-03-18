import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { interests } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function POST(req: NextRequest) {
  const userId = req.cookies.get("user_id")?.value;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const keyword = body.keyword?.trim();

    if (!keyword) {
      return NextResponse.json({ added: false, reason: "no keyword provided" }, { status: 400 });
    }

    // Check if keyword already exists for this user (case-insensitive)
    const existing = await db.query.interests.findMany({
      where: eq(interests.userId, userId),
    });

    const alreadyExists = existing.some(
      (i) => i.keyword.toLowerCase() === keyword.toLowerCase()
    );

    if (alreadyExists) {
      return NextResponse.json({ added: false, reason: "already exists" });
    }

    await db.insert(interests).values({
      userId,
      keyword,
      weight: 0.5,
      source: "star",
      field: "Computer Science",
      level: "intermediate",
    });

    return NextResponse.json({ added: true });
  } catch (error) {
    console.error("Interest add error:", error);
    return NextResponse.json({ error: "Failed to add interest" }, { status: 500 });
  }
}
