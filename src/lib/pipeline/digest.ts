import { db } from "@/lib/db";
import { digests, papers, interests, users } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { searchSemanticScholar } from "@/lib/fetchers/semantic-scholar";
import { fetchRssArticles } from "@/lib/fetchers/rss";
import { aiComplete, AIConfig } from "@/lib/ai/provider";
import { themePrompt, digestPrompt, SYNTHESIS_SYSTEM, THEME_SYSTEM } from "@/lib/ai/prompts";

interface ThemeResponse {
  theme: string;
  searches: {
    foundational: string;
    recent: string;
    news: string;
  };
}

interface DigestAIResponse {
  items: { index: number; summary: string; keywords: string[] }[];
  synthesis: string;
  keyConcepts: string[];
}

function delay(ms: number) { return new Promise(r => setTimeout(r, ms)); }

export async function generateDigest(userId: string, aiConfig: AIConfig, force?: boolean) {
  const today = new Date().toISOString().split("T")[0];

  // Check if digest already exists
  const existing = await db.query.digests.findFirst({
    where: and(eq(digests.userId, userId), eq(digests.date, today)),
  });
  if (existing && !force) return existing;

  if (existing && force) {
    await db.delete(papers).where(eq(papers.digestId, existing.id));
    await db.delete(digests).where(eq(digests.id, existing.id));
  }

  // Get user interests with levels and fields
  const userInterests = await db.query.interests.findMany({
    where: eq(interests.userId, userId),
    orderBy: desc(interests.weight),
  });

  // Decay weights
  for (const interest of userInterests) {
    const decayed = (interest.weight ?? 1.0) * 0.95;
    await db.update(interests).set({ weight: decayed, updatedAt: new Date() }).where(eq(interests.id, interest.id));
    interest.weight = decayed;
  }

  const topInterests = userInterests.slice(0, 5).map((i) => ({
    keyword: i.keyword,
    field: i.field ?? "Computer Science",
    level: i.level ?? "intermediate",
  }));

  if (topInterests.length === 0) {
    throw new Error("No interests found. Add some interests first.");
  }

  // Get content mix
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  const contentMix = user?.contentMix ?? 50;

  // === AI CALL 1: Pick today's theme and search queries ===
  const themeResponse = await aiComplete(aiConfig, THEME_SYSTEM, themePrompt(topInterests, contentMix));

  let themePlan: ThemeResponse;
  try {
    const cleaned = themeResponse.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    themePlan = JSON.parse(cleaned);
  } catch {
    // Fallback: use first interest as theme
    const kw = topInterests[0].keyword;
    themePlan = {
      theme: kw,
      searches: {
        foundational: `${kw} survey`,
        recent: `${kw} 2024 2025`,
        news: kw,
      },
    };
  }

  // === SEARCH: Find exactly 3 items ===
  type TaggedItem = {
    title: string;
    authors: string[];
    abstract: string;
    sourceUrl: string;
    pdfUrl?: string;
    source: "semantic_scholar" | "rss";
    category: "foundational" | "recent" | "news";
  };

  const items: TaggedItem[] = [];

  if (contentMix > 60) {
    // ALL NEWS mode: 3 news articles
    const news1 = await fetchRssArticles([themePlan.searches.foundational], 3);
    await delay(300);
    const news2 = await fetchRssArticles([themePlan.searches.recent], 3);
    await delay(300);
    const news3 = await fetchRssArticles([themePlan.searches.news], 3);

    const allNews = [...news1, ...news2, ...news3];
    const seen = new Set<string>();
    for (const article of allNews) {
      if (items.length >= 3) break;
      const key = article.title.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      items.push({
        ...article,
        pdfUrl: undefined,
        source: "rss",
        category: items.length === 0 ? "foundational" : items.length === 1 ? "recent" : "news",
      });
    }
  } else if (contentMix < 40) {
    // ALL RESEARCH mode: 3 papers (foundational, recent, contrasting)
    const foundational = await searchSemanticScholar(themePlan.searches.foundational, 3, "citationCount");
    await delay(500);
    const recent = await searchSemanticScholar(themePlan.searches.recent, 3, "publicationDate");
    await delay(500);
    const contrast = await searchSemanticScholar(themePlan.searches.news, 3, "citationCount"); // news field repurposed as contrast query

    const seen = new Set<string>();
    for (const paper of foundational) {
      if (items.length >= 1) break;
      seen.add(paper.title.toLowerCase());
      items.push({ ...paper, pdfUrl: paper.pdfUrl || undefined, source: "semantic_scholar", category: "foundational" });
    }
    for (const paper of recent) {
      if (items.length >= 2) break;
      if (seen.has(paper.title.toLowerCase())) continue;
      seen.add(paper.title.toLowerCase());
      items.push({ ...paper, pdfUrl: paper.pdfUrl || undefined, source: "semantic_scholar", category: "recent" });
    }
    for (const paper of contrast) {
      if (items.length >= 3) break;
      if (seen.has(paper.title.toLowerCase())) continue;
      items.push({ ...paper, pdfUrl: paper.pdfUrl || undefined, source: "semantic_scholar", category: "news" }); // labeled "news" but it's a contrast paper
    }
  } else {
    // MIXED mode: 1 foundational, 1 recent, 1 news
    const foundational = await searchSemanticScholar(themePlan.searches.foundational, 3, "citationCount");
    await delay(500);
    const recent = await searchSemanticScholar(themePlan.searches.recent, 3, "publicationDate");
    await delay(300);
    const news = await fetchRssArticles(themePlan.searches.news.split(" ").slice(0, 3), 5);

    if (foundational.length > 0) {
      const p = foundational[0];
      items.push({ ...p, pdfUrl: p.pdfUrl || undefined, source: "semantic_scholar", category: "foundational" });
    }
    if (recent.length > 0) {
      const seen = items.map(i => i.title.toLowerCase());
      const p = recent.find(r => !seen.includes(r.title.toLowerCase())) || recent[0];
      items.push({ ...p, pdfUrl: p.pdfUrl || undefined, source: "semantic_scholar", category: "recent" });
    }
    if (news.length > 0) {
      items.push({ ...news[0], pdfUrl: undefined, source: "rss", category: "news" });
    }
  }

  if (items.length === 0) {
    throw new Error("Couldn't find any papers or articles for today's theme. Try regenerating.");
  }

  // === AI CALL 2: Synthesize the 3 items ===
  const aiResponse = await aiComplete(
    aiConfig,
    SYNTHESIS_SYSTEM,
    digestPrompt(
      items.map((p) => ({ title: p.title, abstract: p.abstract, source: p.source, category: p.category })),
      themePlan.theme
    )
  );

  let parsed: DigestAIResponse;
  try {
    const cleaned = aiResponse.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    parsed = JSON.parse(cleaned);
  } catch {
    parsed = {
      items: items.map((_, i) => ({ index: i + 1, summary: "", keywords: [] })),
      synthesis: aiResponse,
      keyConcepts: [],
    };
  }

  // Create digest
  const [digest] = await db.insert(digests).values({
    userId,
    date: today,
    synthesisContent: parsed.synthesis,
    keyConcepts: JSON.stringify(parsed.keyConcepts || []),
  }).returning();

  // Insert exactly 3 papers
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const aiItem = parsed.items.find((x) => x.index === i + 1) || { summary: "", keywords: [] };

    await db.insert(papers).values({
      digestId: digest.id,
      title: item.title,
      authors: JSON.stringify(item.authors),
      abstract: item.abstract,
      fullText: item.abstract,
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
