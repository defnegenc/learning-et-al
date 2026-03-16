import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { papers, qaPairs } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { aiComplete, AIConfig } from "@/lib/ai/provider";
import { qaPrompt } from "@/lib/ai/prompts";

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

    const aiConfig: AIConfig = { apiKey, provider, model, baseUrl };
    const answer = await aiComplete(
      aiConfig,
      "You are a helpful research assistant that answers questions about academic papers.",
      qaPrompt(paper.title, paper.fullText || paper.abstract || "", question)
    );

    const [pair] = await db.insert(qaPairs).values({
      paperId: id,
      userId,
      question,
      answer,
    }).returning();

    return NextResponse.json({ qaPair: pair });
  } catch (error) {
    console.error("QA error:", error);
    return NextResponse.json({ error: "Failed to process question" }, { status: 500 });
  }
}
