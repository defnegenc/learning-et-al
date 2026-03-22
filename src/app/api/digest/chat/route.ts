import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { digests, papers, interests } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { aiComplete } from "@/lib/ai/provider";
import { getAuthUser } from "@/lib/get-user";

export async function POST(req: NextRequest) {
  const userId = await getAuthUser(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { question, digestId, apiKey, provider, model, baseUrl } = await req.json();

    if (!question || !digestId || !apiKey || !provider) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Fetch digest — fall back to user's latest if the given ID is stale
    let digest = await db.query.digests.findFirst({
      where: eq(digests.id, digestId),
    });

    if (!digest || digest.userId !== userId) {
      // ID might be stale after a force-regeneration. Try the user's most recent digest.
      const { desc } = await import("drizzle-orm");
      digest = await db.query.digests.findFirst({
        where: eq(digests.userId, userId),
        orderBy: desc(digests.createdAt),
      });
    }

    if (!digest) {
      return NextResponse.json({ error: "No digest found. Generate one first." }, { status: 404 });
    }

    const digestPapers = await db.query.papers.findMany({
      where: eq(papers.digestId, digestId),
    });

    // Build context
    const papersContext = digestPapers.map((p, i) => {
      const authors = p.authors ? JSON.parse(p.authors) : [];
      const findings = p.keyFindings ? JSON.parse(p.keyFindings) : [];
      return `PAPER ${i + 1}: ${p.title} (${p.year ?? "n/a"})
Authors: ${authors.slice(0, 3).join(", ")}
Summary: ${p.summary ?? ""}
Key findings: ${findings.join("; ")}
Abstract: ${(p.abstract ?? "").slice(0, 600)}`;
    }).join("\n\n");

    const systemPrompt = `Answer in 3-4 sentences MAX. Be direct and specific. No bullet points, no lists, no headers. Just a short paragraph like you're replying in a group chat. Cite paper titles when relevant but keep it brief.

Today's synthesis:
${digest.synthesisContent ?? ""}

${papersContext}`;

    const answer = await aiComplete(
      { apiKey, provider, model, baseUrl },
      systemPrompt,
      question
    );

    // Engagement tracking: boost the user interest that best matches the anchor paper.
    // Tiny boost per question (+0.05) — engagement should nudge, not dominate.
    try {
      const anchorPaper = digestPapers[0];
      if (anchorPaper) {
        const anchorText = `${anchorPaper.title} ${anchorPaper.abstract ?? ""}`.toLowerCase();
        const userInterests = await db.query.interests.findMany({
          where: eq(interests.userId, userId),
        });
        // Score each interest by how many of its words appear in the anchor paper
        const stopWords = new Set(["with","from","that","this","based","using","their","about","been","have","will"]);
        const scored = userInterests.map(interest => {
          const words = interest.keyword.toLowerCase().split(/\s+/).filter(w => w.length > 3 && !stopWords.has(w));
          const matches = words.filter(w => anchorText.includes(w)).length;
          const score = words.length > 0 ? matches / words.length : 0;
          return { interest, score };
        });
        scored.sort((a, b) => b.score - a.score);
        const best = scored[0];
        if (best && best.score > 0) {
          const newWeight = Math.min(3.0, (best.interest.weight ?? 1.0) + 0.05);
          await db.update(interests)
            .set({ weight: newWeight, updatedAt: new Date() })
            .where(and(eq(interests.id, best.interest.id), eq(interests.userId, userId)));
        }
      }
    } catch {
      // Engagement tracking is non-critical — never fail the response over it
    }

    return NextResponse.json({ answer });
  } catch (error) {
    console.error("Chat error:", error);
    const message = error instanceof Error ? error.message : "Chat failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
