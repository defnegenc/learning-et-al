import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { digests } from "@/lib/db/schema";
import { eq, desc, and, or, isNull } from "drizzle-orm";

export async function GET() {
  const adminId = process.env.ADMIN_USER_ID;
  if (!adminId) return NextResponse.json([]);

  try {
    const rows = await db
      .select({ id: digests.id, date: digests.date, theme: digests.theme })
      .from(digests)
      .where(and(eq(digests.userId, adminId), or(isNull(digests.hidden), eq(digests.hidden, false))))
      // Same rule the homepage's featured pick uses (newest created first),
      // so the archive's first entry for a date IS the edition the homepage showed.
      .orderBy(desc(digests.date), desc(digests.createdAt))
      .limit(30);

    // Same list for every logged-out visitor — cacheable at the CDN.
    return NextResponse.json(rows, { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" } });
  } catch {
    return NextResponse.json([]);
  }
}
