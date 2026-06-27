import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { digests } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getAuthUser } from "@/lib/get-user";
import { trackEvent } from "@/lib/track";

export async function POST(req: NextRequest) {
  const userId = await getAuthUser(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { digestId, notes } = await req.json();
    if (!digestId) return NextResponse.json({ error: "digestId required" }, { status: 400 });
    if (typeof notes !== "string") return NextResponse.json({ error: "notes must be a string" }, { status: 400 });

    const digest = await db.query.digests.findFirst({
      where: and(eq(digests.id, digestId), eq(digests.userId, userId)),
    });
    if (!digest) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const trimmed = notes.replace(/\s+$/, "");
    await db.update(digests).set({ notes: trimmed }).where(eq(digests.id, digestId));

    trackEvent(userId, "save_digest_notes", { digestId, metadata: { length: trimmed.length } });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Save digest notes error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
