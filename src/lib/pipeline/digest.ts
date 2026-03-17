import { db } from "@/lib/db";
import { digests, papers, interests, users } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { searchArxiv } from "@/lib/fetchers/arxiv";
import { fetchRssArticles } from "@/lib/fetchers/rss";
import { downloadAndParsePdf } from "@/lib/fetchers/pdf";
import { aiComplete, AIConfig } from "@/lib/ai/provider";
import { digestPrompt, SYNTHESIS_SYSTEM } from "@/lib/ai/prompts";

interface DigestAIResponse {
  items: { index: number; summary: string; keywords: string[] }[];
  synthesis: string;
  keyConcepts: string[];
}

export async function generateDigest(userId: string, aiConfig: AIConfig, force?: boolean) {
  const today = new Date().toISOString().split("T")[0];

  // Check if digest already exists for today
  const existing = await db.query.digests.findFirst({
    where: and(eq(digests.userId, userId), eq(digests.date, today)),
  });
  if (existing && !force) return existing;

  // If forcing, delete old digest and its papers
  if (existing && force) {
    await db.delete(papers).where(eq(papers.digestId, existing.id));
    await db.delete(digests).where(eq(digests.id, existing.id));
  }

  // Get user's weighted interests
  const userInterests = await db.query.interests.findMany({
    where: eq(interests.userId, userId),
    orderBy: desc(interests.weight),
  });

  // Apply 5% daily decay
  for (const interest of userInterests) {
    const decayedWeight = (interest.weight ?? 1.0) * 0.95;
    await db
      .update(interests)
      .set({ weight: decayedWeight, updatedAt: new Date() })
      .where(eq(interests.id, interest.id));
    interest.weight = decayedWeight;
  }

  const topKeywords = userInterests.slice(0, 10).map((i) => i.keyword);
  const searchQuery = topKeywords.join(" OR ");

  // Get user's content mix preference
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });
  const contentMix = user?.contentMix ?? 50;

  // Determine paper/article counts based on contentMix (total always 6)
  let arxivCount: number;
  let rssCount: number;
  if (contentMix < 50) {
    // More research: 4-5 arxiv, 1-2 rss
    arxivCount = contentMix < 25 ? 5 : 4;
    rssCount = 6 - arxivCount;
  } else if (contentMix > 50) {
    // More news: 1-2 arxiv, 4-5 rss
    rssCount = contentMix > 75 ? 5 : 4;
    arxivCount = 6 - rssCount;
  } else {
    // Balanced: 3 each
    arxivCount = 3;
    rssCount = 3;
  }

  // Fetch papers and articles in parallel
  const [arxivPapers, rssArticles] = await Promise.all([
    searchArxiv(searchQuery, 10),
    fetchRssArticles(topKeywords),
  ]);

  const selectedArxiv = arxivPapers.slice(0, arxivCount);
  const selectedRss = rssArticles.slice(0, rssCount);

  // Download PDFs for arXiv papers (parallel, no AI calls)
  const arxivWithText = await Promise.all(
    selectedArxiv.map(async (paper) => ({
      ...paper,
      fullText: paper.pdfUrl ? await downloadAndParsePdf(paper.pdfUrl) : paper.abstract,
    }))
  );

  // Build the list of all items for the single AI call
  const allItems = [
    ...arxivWithText.map((p) => ({ title: p.title, abstract: p.abstract, source: "arxiv" as const, fullText: p.fullText, authors: p.authors, sourceUrl: p.sourceUrl, pdfUrl: p.pdfUrl })),
    ...selectedRss.map((a) => ({ title: a.title, abstract: a.abstract, source: "rss" as const, fullText: a.abstract, authors: a.authors, sourceUrl: a.sourceUrl, pdfUrl: undefined })),
  ];

  if (allItems.length === 0) {
    throw new Error("No papers or articles found for your interests. Try broader interest terms.");
  }

  // === ONE AI CALL for everything ===
  const aiResponse = await aiComplete(aiConfig, SYNTHESIS_SYSTEM, digestPrompt(allItems));

  // Parse the JSON response
  let parsed: DigestAIResponse;
  try {
    // Strip markdown code fences if present
    const cleaned = aiResponse.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    parsed = JSON.parse(cleaned);
  } catch {
    // Fallback: use the raw response as synthesis, no per-paper summaries
    parsed = {
      items: allItems.map((_, i) => ({ index: i + 1, summary: "", keywords: [] })),
      synthesis: aiResponse,
      keyConcepts: [],
    };
  }

  // Create digest record
  const [digest] = await db.insert(digests).values({
    userId,
    date: today,
    synthesisContent: parsed.synthesis,
    keyConcepts: JSON.stringify(parsed.keyConcepts || []),
  }).returning();

  // Insert papers with AI-generated summaries and keywords
  for (let i = 0; i < allItems.length; i++) {
    const item = allItems[i];
    const aiItem = parsed.items.find((x) => x.index === i + 1) || { summary: "", keywords: [] };

    await db.insert(papers).values({
      digestId: digest.id,
      title: item.title,
      authors: JSON.stringify(item.authors),
      abstract: item.abstract,
      fullText: item.fullText,
      summary: aiItem.summary,
      source: item.source,
      sourceUrl: item.sourceUrl,
      pdfUrl: item.pdfUrl,
      keywords: JSON.stringify(aiItem.keywords),
    });
  }

  return digest;
}
