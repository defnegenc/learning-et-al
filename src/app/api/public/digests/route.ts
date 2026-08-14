import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { digests } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET() {
  const adminId = process.env.ADMIN_USER_ID;
  if (!adminId) return NextResponse.json([]);

  try {
    const rows = await db
      .select({ id: digests.id, date: digests.date, theme: digests.theme })
      .from(digests)
      .where(eq(digests.userId, adminId))
      .orderBy(desc(digests.date))
      .limit(30);

    // Same list for every logged-out visitor — cacheable at the CDN.
    return NextResponse.json(rows, { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600" } });
  } catch {
    return NextResponse.json([]);
  }
}
