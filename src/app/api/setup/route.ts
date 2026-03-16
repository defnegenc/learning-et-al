import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users, interests } from "@/lib/db/schema";
import { cookies } from "next/headers";

export async function POST(req: NextRequest) {
  try {
    const { interestStrings, timezone } = await req.json();

    if (!interestStrings || !Array.isArray(interestStrings) || interestStrings.length === 0) {
      return NextResponse.json({ error: "interestStrings is required" }, { status: 400 });
    }

    // Create user
    const [user] = await db.insert(users).values({
      timezone: timezone || "America/New_York",
    }).returning();

    // Insert seed interests
    for (const keyword of interestStrings) {
      await db.insert(interests).values({
        userId: user.id,
        keyword: keyword.trim(),
        weight: 1.0,
        source: "seed",
      });
    }

    // Set cookie
    const cookieStore = await cookies();
    cookieStore.set("user_id", user.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365, // 1 year
      path: "/",
    });

    return NextResponse.json({ userId: user.id });
  } catch (error) {
    console.error("Setup error:", error);
    return NextResponse.json({ error: "Failed to set up user" }, { status: 500 });
  }
}
