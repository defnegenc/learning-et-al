import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { interests } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const userId = req.cookies.get("user_id")?.value;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const userInterests = await db.query.interests.findMany({
      where: eq(interests.userId, userId),
      orderBy: desc(interests.weight),
    });

    return NextResponse.json({ interests: userInterests });
  } catch (error) {
    console.error("Interests fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch interests" }, { status: 500 });
  }
}
