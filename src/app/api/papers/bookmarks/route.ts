import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { feedback } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getAuthUser } from "@/lib/get-user";

export async function GET(req: NextRequest) {
  const userId = await getAuthUser(req);
  if (!userId) return NextResponse.json({ ids: [] });
  const rows = await db.query.feedback.findMany({
    where: and(eq(feedback.userId, userId), eq(feedback.type, "star")),
    columns: { paperId: true },
  });
  const ids = [...new Set(rows.map((r) => r.paperId))];
  return NextResponse.json({ ids });
}
