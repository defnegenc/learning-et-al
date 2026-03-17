import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { papers, qaPairs, interests } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { aiComplete, AIConfig } from "@/lib/ai/provider";
import { qaPrompt } from "@/lib/ai/prompts";
import { downloadAndParsePdf } from "@/lib/fetchers/pdf";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = req.cookies.get("user_id")?.value;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const pairs = await db.query.qaPairs.findMany({
      where: and(eq(qaPairs.paperId, id), eq(qaPairs.userId, userId)),
    });

    return NextResponse.json({ qaPairs: pairs });
  } catch (error) {
    console.error("QA fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch Q&A pairs" }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = req.cookies.get("user_id")?.value;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const { question, apiKey, provider, model, baseUrl } = await req.json();

    if (!question || !apiKey || !provider) {
      return NextResponse.json({ error: "question, apiKey, and provider are required" }, { status: 400 });
    }

    const paper = await db.query.papers.findFirst({
      where: eq(papers.id, id),
    });

    if (!paper) {
      return NextResponse.json({ error: "Paper not found" }, { status: 404 });
    }

    // On-demand PDF download: if fullText is just the abstract (or missing) and we have a pdfUrl, fetch it now
    let fullText = paper.fullText || "";
    const abstractText = paper.abstract || "";
    const hasRichFullText = fullText.length > abstractText.length + 100;

    if (!hasRichFullText && paper.pdfUrl) {
      try {
        const pdfText = await downloadAndParsePdf(paper.pdfUrl);
        if (pdfText && pdfText.length > abstractText.length) {
          fullText = pdfText;
          // Save to DB so we don't re-download next time
          await db
            .update(papers)
            .set({ fullText: pdfText })
            .where(eq(papers.id, id));
        }
      } catch (e) {
        console.error("On-demand PDF download failed, falling back to abstract:", e);
      }
    }

    // Fall back to abstract if fullText is still empty
    if (!fullText) fullText = abstractText;

    const aiConfig: AIConfig = { apiKey, provider, model, baseUrl };
    const answer = await aiComplete(
      aiConfig,
      "You are a helpful research assistant that answers questions about academic papers.",
      qaPrompt(paper.title, fullText, question)
    );

    const [pair] = await db.insert(qaPairs).values({
      paperId: id,
      userId,
      question,
      answer,
    }).returning();

    // Count total QA pairs for this paper by this user
    const allPairs = await db.query.qaPairs.findMany({
      where: and(eq(qaPairs.paperId, id), eq(qaPairs.userId, userId)),
    });
    const totalCount = allPairs.length;

    // Every 3 questions, boost the paper's keywords in user interests
    if (totalCount > 0 && totalCount % 3 === 0) {
      const keywords: string[] = paper.keywords ? JSON.parse(paper.keywords) : [];

      for (const keyword of keywords) {
        const existing = await db.query.interests.findFirst({
          where: and(
            eq(interests.userId, userId),
            eq(interests.keyword, keyword)
          ),
        });

        if (existing) {
          await db
            .update(interests)
            .set({
              weight: (existing.weight ?? 1.0) + 0.3,
              source: "engagement",
              updatedAt: new Date(),
            })
            .where(eq(interests.id, existing.id));
        } else {
          await db.insert(interests).values({
            userId,
            keyword,
            weight: 0.3,
            source: "engagement",
          });
        }
      }
    }

    return NextResponse.json({ qaPair: pair });
  } catch (error) {
    console.error("QA error:", error);
    return NextResponse.json({ error: "Failed to process question" }, { status: 500 });
  }
}
