import { db } from "@/lib/db";
import { digests, papers, interests } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { searchArxiv } from "@/lib/fetchers/arxiv";
import { fetchRssArticles } from "@/lib/fetchers/rss";
import { downloadAndParsePdf } from "@/lib/fetchers/pdf";
import { aiComplete, AIConfig } from "@/lib/ai/provider";
import { synthesisPrompt, paperSummaryPrompt, keywordExtractionPrompt, SYNTHESIS_SYSTEM } from "@/lib/ai/prompts";

export async function generateDigest(userId: string, aiConfig: AIConfig) {
  const today = new Date().toISOString().split("T")[0];

  // Check if digest already exists for today
  const existing = await db.query.digests.findFirst({
    where: and(eq(digests.userId, userId), eq(digests.date, today)),
  });
  if (existing) return existing;

  // Get user's weighted interests
  const userInterests = await db.query.interests.findMany({
    where: eq(interests.userId, userId),
    orderBy: desc(interests.weight),
  });

  // Apply 5% daily decay to all interest weights
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

  // Fetch papers and articles in parallel
  const [arxivPapers, rssArticles] = await Promise.all([
    searchArxiv(searchQuery, 10),
    fetchRssArticles(topKeywords),
  ]);

  // Pick top 3 of each
  const selectedArxiv = arxivPapers.slice(0, 3);
  const selectedRss = rssArticles.slice(0, 3);

  // Create digest record
  const [digest] = await db.insert(digests).values({
    userId,
    date: today,
  }).returning();

  // Process arXiv papers: download PDFs and parse
  for (const paper of selectedArxiv) {
    const fullText = paper.pdfUrl ? await downloadAndParsePdf(paper.pdfUrl) : paper.abstract;
    const summary = await aiComplete(aiConfig, SYNTHESIS_SYSTEM, paperSummaryPrompt(paper.title, fullText));
    const keywordsJson = await aiComplete(aiConfig, "You extract keywords from papers.", keywordExtractionPrompt(paper.title, paper.abstract));

    let extractedKeywords: string[] = [];
    try { extractedKeywords = JSON.parse(keywordsJson); } catch { /* ignore parse errors */ }

    await db.insert(papers).values({
      digestId: digest.id,
      title: paper.title,
      authors: JSON.stringify(paper.authors),
      abstract: paper.abstract,
      fullText,
      summary,
      source: "arxiv",
      sourceUrl: paper.sourceUrl,
      pdfUrl: paper.pdfUrl,
      keywords: JSON.stringify(extractedKeywords),
    });
  }

  // Process RSS articles
  for (const article of selectedRss) {
    const summary = await aiComplete(aiConfig, SYNTHESIS_SYSTEM, paperSummaryPrompt(article.title, article.abstract));
    const keywordsJson = await aiComplete(aiConfig, "You extract keywords from papers.", keywordExtractionPrompt(article.title, article.abstract));

    let extractedKeywords: string[] = [];
    try { extractedKeywords = JSON.parse(keywordsJson); } catch { /* ignore parse errors */ }

    await db.insert(papers).values({
      digestId: digest.id,
      title: article.title,
      authors: JSON.stringify(article.authors),
      abstract: article.abstract,
      fullText: article.abstract,
      summary,
      source: "rss",
      sourceUrl: article.sourceUrl,
      keywords: JSON.stringify(extractedKeywords),
    });
  }

  // Generate overall synthesis
  const allPapers = await db.query.papers.findMany({
    where: eq(papers.digestId, digest.id),
  });

  const synthesisContent = await aiComplete(
    aiConfig,
    SYNTHESIS_SYSTEM,
    synthesisPrompt(allPapers.map((p) => ({
      title: p.title,
      abstract: p.abstract || "",
      fullText: p.fullText || "",
      source: p.source,
    })))
  );

  // Extract key concepts from synthesis
  let keyConcepts: string[] = [];
  const conceptMatch = synthesisContent.match(/KEY_CONCEPTS:\s*(\[.*?\])/);
  if (conceptMatch) {
    try { keyConcepts = JSON.parse(conceptMatch[1]); } catch { /* ignore parse errors */ }
  }
  const cleanedSynthesis = synthesisContent.replace(/KEY_CONCEPTS:\s*\[.*?\]/, "").trim();

  await db.update(digests)
    .set({ synthesisContent: cleanedSynthesis, keyConcepts: JSON.stringify(keyConcepts) })
    .where(eq(digests.id, digest.id));

  return { ...digest, synthesisContent: cleanedSynthesis, keyConcepts: JSON.stringify(keyConcepts) };
}
