import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users, interests } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { getAuthUser } from "@/lib/get-user";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { timezone, contentMix } = body;

    let interestItems: { keyword: string; field?: string; level: string }[];
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

    // Check if user already exists (from Google auth)
    let userId = await getAuthUser(req);

    if (userId) {
      // User exists from Google auth — update their settings
      await db.update(users).set({
        timezone: timezone || "America/New_York",
        contentMix: typeof contentMix === "number" ? contentMix : 50,
      }).where(eq(users.id, userId));

      // Clear existing interests and add new ones
      await db.delete(interests).where(eq(interests.userId, userId));
    } else {
      // No auth session — create a new user (legacy flow)
      const [user] = await db.insert(users).values({
        timezone: timezone || "America/New_York",
        contentMix: typeof contentMix === "number" ? contentMix : 50,
      }).returning();
      userId = user.id;

      // Set cookie for legacy auth
      const cookieStore = await cookies();
      cookieStore.set("user_id", userId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 365,
        path: "/",
      });
    }

    // Insert interests
    for (const item of interestItems) {
      const level = ["beginner", "intermediate", "expert"].includes(item.level) ? item.level : "intermediate";
      await db.insert(interests).values({
        userId,
        keyword: item.keyword.trim(),
        field: item.field || "Computer Science",
        weight: 1.0,
        source: "seed",
        level: level as "beginner" | "intermediate" | "expert",
      });
    }

    return NextResponse.json({ userId });
  } catch (error) {
    console.error("Setup error:", error);
    return NextResponse.json({ error: "Failed to set up user" }, { status: 500 });
  }
}
