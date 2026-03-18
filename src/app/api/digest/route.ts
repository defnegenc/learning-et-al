import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { digests, papers } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const userId = req.cookies.get("user_id")?.value;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const url = new URL(req.url);
    const date = url.searchParams.get("date");
    const all = url.searchParams.get("all");

    // Return all digests (for theme history)
    if (all === "true") {
      const allDigests = await db.query.digests.findMany({
        where: eq(digests.userId, userId),
        orderBy: desc(digests.createdAt),
      });

      return NextResponse.json({
        digests: allDigests.map((d) => ({
          ...d,
          keyConcepts: d.keyConcepts ? JSON.parse(d.keyConcepts) : [],
        })),
      });
    }

    let digest;
    if (date) {
      digest = await db.query.digests.findFirst({
        where: and(eq(digests.userId, userId), eq(digests.date, date)),
      });
    } else {
      digest = await db.query.digests.findFirst({
        where: eq(digests.userId, userId),
        orderBy: desc(digests.createdAt),
      });
    }

    if (!digest) {
      return NextResponse.json({ digest: null, papers: [] });
    }

    const digestPapers = await db.query.papers.findMany({
      where: eq(papers.digestId, digest.id),
    });

    return NextResponse.json({
      digest: {
        ...digest,
        keyConcepts: digest.keyConcepts ? JSON.parse(digest.keyConcepts) : [],
      },
      papers: digestPapers.map((p) => ({
        ...p,
        authors: p.authors ? JSON.parse(p.authors) : [],
        keywords: p.keywords ? JSON.parse(p.keywords) : [],
      })),
    });
  } catch (error) {
    console.error("Digest fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch digest" }, { status: 500 });
  }
}
