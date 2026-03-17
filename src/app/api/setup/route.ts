import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users, interests } from "@/lib/db/schema";
import { cookies } from "next/headers";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { timezone, contentMix } = body;

    // Support both old format (interestStrings: string[]) and new format (interests: {keyword, level}[])
    let interestItems: { keyword: string; level: string }[];
    if (body.interests && Array.isArray(body.interests)) {
      interestItems = body.interests;
    } else if (body.interestStrings && Array.isArray(body.interestStrings)) {
      interestItems = body.interestStrings.map((s: string) => ({ keyword: s, level: "intermediate" }));
    } else {
      return NextResponse.json({ error: "interests is required" }, { status: 400 });
    }

    if (interestItems.length === 0) {
      return NextResponse.json({ error: "At least one interest is required" }, { status: 400 });
    }

    // Create user
    const [user] = await db.insert(users).values({
      timezone: timezone || "America/New_York",
      contentMix: typeof contentMix === "number" ? contentMix : 50,
    }).returning();

    // Insert seed interests with level
    for (const item of interestItems) {
      const level = ["beginner", "intermediate", "expert"].includes(item.level) ? item.level : "intermediate";
      await db.insert(interests).values({
        userId: user.id,
        keyword: item.keyword.trim(),
        weight: 1.0,
        source: "seed",
        level: level as "beginner" | "intermediate" | "expert",
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
