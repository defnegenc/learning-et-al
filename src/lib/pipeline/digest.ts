import { db } from "@/lib/db";
import { digests, papers, interests, users } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { searchArxiv } from "@/lib/fetchers/arxiv";
import { fetchRssArticles } from "@/lib/fetchers/rss";
import { downloadAndParsePdf } from "@/lib/fetchers/pdf";
import { aiComplete, AIConfig } from "@/lib/ai/provider";
import { digestPrompt, searchPlanPrompt, SYNTHESIS_SYSTEM, SEARCH_PLAN_SYSTEM } from "@/lib/ai/prompts";

interface DigestAIResponse {
  items: { index: number; summary: string; keywords: string[] }[];
  synthesis: string;
  keyConcepts: string[];
}

interface SearchPlan {
  searches: {
    interest: string;
    level: string;
    foundationalQuery: string;
    recentQuery: string;
    newsKeywords: string[];
  }[];
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

  // Get user's weighted interests (with levels)
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

  const topInterests = userInterests.slice(0, 10).map((i) => ({
    keyword: i.keyword,
    level: i.level ?? "intermediate",
  }));

  // Get user's content mix preference
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });
  const contentMix = user?.contentMix ?? 50;

  // === AI CALL 1: Search planning ===
  const planResponse = await aiComplete(aiConfig, SEARCH_PLAN_SYSTEM, searchPlanPrompt(topInterests));

  let searchPlan: SearchPlan;
  try {
    const cleaned = planResponse.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    searchPlan = JSON.parse(cleaned);
  } catch {
    // Fallback: build a basic plan from interests
    searchPlan = {
      searches: topInterests.map((i) => ({
        interest: i.keyword,
        level: i.level,
        foundationalQuery: `${i.keyword} survey`,
        recentQuery: i.keyword,
        newsKeywords: [i.keyword],
      })),
    };
  }

  // Determine how many items per category based on contentMix (total ~6)
  const totalItems = 6;
  let maxFoundational: number;
  let maxRecent: number;
  let maxNews: number;
  if (contentMix < 50) {
    // More research
    maxFoundational = contentMix < 25 ? 3 : 2;
    maxRecent = contentMix < 25 ? 2 : 2;
    maxNews = totalItems - maxFoundational - maxRecent;
  } else if (contentMix > 50) {
    // More news
    maxNews = contentMix > 75 ? 3 : 2;
    maxRecent = 2;
    maxFoundational = totalItems - maxNews - maxRecent;
  } else {
    // Balanced
    maxFoundational = 2;
    maxRecent = 2;
    maxNews = 2;
  }

  // Execute searches based on the plan
  type TaggedItem = {
    title: string;
    authors: string[];
    abstract: string;
    sourceUrl: string;
    pdfUrl?: string;
    fullText?: string;
    source: "arxiv" | "rss";
    category: "foundational" | "recent" | "news";
  };

  const foundationalItems: TaggedItem[] = [];
  const recentItems: TaggedItem[] = [];
  const newsItems: TaggedItem[] = [];

  // Search for each interest in parallel
  const searchPromises = searchPlan.searches.map(async (search) => {
    const [foundational, recent, news] = await Promise.all([
      searchArxiv(search.foundationalQuery, 3),
      searchArxiv(search.recentQuery, 3),
      fetchRssArticles(search.newsKeywords, 3),
    ]);

    return { search, foundational, recent, news };
  });

  const searchResults = await Promise.all(searchPromises);

  for (const result of searchResults) {
    for (const paper of result.foundational) {
      foundationalItems.push({
        ...paper,
        source: "arxiv",
        category: "foundational",
      });
    }
    for (const paper of result.recent) {
      recentItems.push({
        ...paper,
        source: "arxiv",
        category: "recent",
      });
    }
    for (const article of result.news) {
      newsItems.push({
        ...article,
        pdfUrl: undefined,
        source: "rss",
        category: "news",
      });
    }
  }

  // Deduplicate by title (same paper may appear in foundational and recent)
  const seenTitles = new Set<string>();
  function dedup(items: TaggedItem[]): TaggedItem[] {
    return items.filter((item) => {
      const key = item.title.toLowerCase().trim();
      if (seenTitles.has(key)) return false;
      seenTitles.add(key);
      return true;
    });
  }

  const selectedFoundational = dedup(foundationalItems).slice(0, maxFoundational);
  const selectedRecent = dedup(recentItems).slice(0, maxRecent);
  const selectedNews = dedup(newsItems).slice(0, maxNews);

  const allSelected = [...selectedFoundational, ...selectedRecent, ...selectedNews];

  if (allSelected.length === 0) {
    throw new Error("No papers or articles found for your interests. Try broader interest terms.");
  }

  // Download PDFs for arXiv papers (parallel)
  const allItems = await Promise.all(
    allSelected.map(async (item) => ({
      ...item,
      fullText: item.pdfUrl ? await downloadAndParsePdf(item.pdfUrl) : item.abstract,
    }))
  );

  // === AI CALL 2: Digest synthesis ===
  const aiResponse = await aiComplete(
    aiConfig,
    SYNTHESIS_SYSTEM,
    digestPrompt(allItems.map((p) => ({
      title: p.title,
      abstract: p.abstract,
      source: p.source,
      category: p.category,
    })))
  );

  // Parse the JSON response
  let parsed: DigestAIResponse;
  try {
    const cleaned = aiResponse.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    parsed = JSON.parse(cleaned);
  } catch {
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

  // Insert papers with AI-generated summaries, keywords, and category
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
      category: item.category,
    });
  }

  return digest;
}
