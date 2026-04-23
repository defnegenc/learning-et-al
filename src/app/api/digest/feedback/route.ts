import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { digestFeedback } from "@/lib/db/schema";
import { getAuthUser } from "@/lib/get-user";

export async function POST(req: NextRequest) {
  const userId = await getAuthUser(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { digestId, reason } = await req.json();
    if (!digestId || !reason?.trim()) return NextResponse.json({ error: "digestId and reason required" }, { status: 400 });

    await db.insert(digestFeedback).values({ digestId, userId, reason: reason.trim() });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Digest feedback error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
