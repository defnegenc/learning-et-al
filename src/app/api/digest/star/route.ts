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
    const { digestId } = await req.json();
    if (!digestId) return NextResponse.json({ error: "digestId required" }, { status: 400 });

    const digest = await db.query.digests.findFirst({
      where: and(eq(digests.id, digestId), eq(digests.userId, userId)),
    });
    if (!digest) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const newStarred = !digest.starred;
    await db.update(digests).set({ starred: newStarred }).where(eq(digests.id, digestId));

    trackEvent(userId, "star_digest", { digestId, metadata: { starred: newStarred } });

    return NextResponse.json({ starred: newStarred });
  } catch (error) {
    console.error("Star digest error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
