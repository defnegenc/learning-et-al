import { db } from "@/lib/db";
import { digests, papers, interests, users, feedback } from "@/lib/db/schema";
import { eq, and, desc, inArray } from "drizzle-orm";
import { searchSemanticScholar } from "@/lib/fetchers/semantic-scholar";
import { searchArxiv } from "@/lib/fetchers/arxiv";
import { fetchRssArticles } from "@/lib/fetchers/rss";
import { aiComplete, AIConfig } from "@/lib/ai/provider";
import { digestPrompt, SYNTHESIS_SYSTEM } from "@/lib/ai/prompts";

// See docs/algorithm.md for the full algorithm design.

interface DigestAIResponse {
  items: { index: number; summary: string; keywords: string[] }[];
  synthesis: string;
  keyConcepts: string[];
}

function delay(ms: number) { return new Promise(r => setTimeout(r, ms)); }

type TaggedItem = {
  title: string;
  authors: string[];
  abstract: string;
  sourceUrl: string;
  pdfUrl?: string;
  source: "semantic_scholar" | "rss" | "arxiv";
  category: "foundational" | "recent" | "news";
};

// Search with S2 first, fall back to arXiv
async function searchPapers(query: string, max: number, sort: "citationCount" | "publicationDate") {
  const s2 = await searchSemanticScholar(query, max, sort);
  if (s2.length > 0) return s2.map(p => ({ ...p, source: "semantic_scholar" as const }));

  console.log(`[Digest] S2 empty/rate-limited, trying arXiv for: "${query}"`);
  await delay(300);
  const arxiv = await searchArxiv(query, max);
  return arxiv.map(p => ({
    title: p.title, authors: p.authors, abstract: p.abstract,
    sourceUrl: p.sourceUrl, pdfUrl: p.pdfUrl,
    citationCount: 0, year: new Date().getFullYear(),
    source: "arxiv" as const,
  }));
}

// Check if a paper is relevant to a theme by keyword overlap
function isRelevant(paper: { title: string; abstract: string }, themeWords: string[]): boolean {
  const text = `${paper.title} ${paper.abstract}`.toLowerCase();
  const matches = themeWords.filter(w => text.includes(w));
  return matches.length >= 2;
}

function extractThemeWords(focusInterest: string, anchorTitle: string): string[] {
  const words = `${focusInterest} ${anchorTitle}`.toLowerCase()
    .split(/\s+/)
    .filter(w => w.length > 3)
    .filter(w => !["with", "from", "that", "this", "based", "using", "their", "about", "been"].includes(w));
  return [...new Set(words)];
}

export async function generateDigest(userId: string, aiConfig: AIConfig, force?: boolean) {
  const today = new Date().toISOString().split("T")[0];

  const existing = await db.query.digests.findFirst({
    where: and(eq(digests.userId, userId), eq(digests.date, today)),
  });
  if (existing && !force) return existing;
  if (existing && force) {
    await db.delete(papers).where(eq(papers.digestId, existing.id));
    await db.delete(digests).where(eq(digests.id, existing.id));
  }

  // Get user interests
  const userInterests = await db.query.interests.findMany({
    where: eq(interests.userId, userId),
    orderBy: desc(interests.weight),
  });
  for (const interest of userInterests) {
    const decayed = (interest.weight ?? 1.0) * 0.95;
    await db.update(interests).set({ weight: decayed, updatedAt: new Date() }).where(eq(interests.id, interest.id));
  }

  const topInterests = userInterests.slice(0, 5).map(i => i.keyword);
  if (topInterests.length === 0) throw new Error("No interests found. Add some first.");

  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  const contentMix = user?.contentMix ?? 50;

  // Step 1: Pick ONE focus interest (rotate daily)
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
  const focusInterest = topInterests[dayOfYear % topInterests.length];
  console.log(`[Digest] Focus: "${focusInterest}"`);

  const items: TaggedItem[] = [];

  // Step 2: Find the ANCHOR paper
  console.log(`[Digest] Step 2: Searching for anchor paper...`);
  const anchorResults = await searchPapers(focusInterest, 5, "citationCount");
  await delay(500);

  if (anchorResults.length === 0) {
    throw new Error(`Couldn't find papers about "${focusInterest}". Search APIs might be rate-limited. Wait a minute and try again.`);
  }

  const anchor = anchorResults[0];
  items.push({
    title: anchor.title, authors: anchor.authors, abstract: anchor.abstract,
    sourceUrl: anchor.sourceUrl, pdfUrl: anchor.pdfUrl || undefined,
    source: anchor.source, category: "foundational",
  });
  console.log(`[Digest] Anchor: "${anchor.title}" (${anchor.citationCount} citations)`);

  const themeWords = extractThemeWords(focusInterest, anchor.title);

  // Step 3: Ask AI for theme + next search query
  console.log(`[Digest] Step 3: Asking AI for theme...`);
  const themeResponse = await aiComplete(aiConfig,
    "You help find related research. Return only valid JSON.",
    `I found this paper about "${focusInterest}":
Title: "${anchor.title}"
Abstract: ${anchor.abstract.slice(0, 500)}

Give me:
1. A specific theme that connects this paper to the broader topic of "${focusInterest}" (e.g. "AI agents as financial advisors" not just "fintech")
2. A search query (3-5 words) to find a RECENT paper that builds on or challenges this work
3. Search keywords (2-3 words) for a related news article

Return JSON only:
{"theme": "...", "recentQuery": "...", "newsKeywords": "..."}`
  );

  let theme = focusInterest;
  let recentQuery = focusInterest;
  let newsKeywords = focusInterest;
  try {
    const parsed = JSON.parse(themeResponse.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim());
    theme = parsed.theme || focusInterest;
    recentQuery = parsed.recentQuery || focusInterest;
    newsKeywords = parsed.newsKeywords || focusInterest;
    console.log(`[Digest] Theme: "${theme}", next query: "${recentQuery}"`);
  } catch {
    console.log(`[Digest] AI theme parse failed, using defaults`);
  }

  // Step 4: Find second item using AI's query, VALIDATE relevance
  console.log(`[Digest] Step 4: Searching for recent paper: "${recentQuery}"`);
  await delay(500);
  const recentResults = await searchPapers(recentQuery, 5, "publicationDate");

  const seenTitles = new Set([anchor.title.toLowerCase()]);
  for (const paper of recentResults) {
    if (seenTitles.has(paper.title.toLowerCase())) continue;
    if (isRelevant(paper, themeWords)) {
      items.push({
        title: paper.title, authors: paper.authors, abstract: paper.abstract,
        sourceUrl: paper.sourceUrl, pdfUrl: paper.pdfUrl || undefined,
        source: paper.source, category: "recent",
      });
      seenTitles.add(paper.title.toLowerCase());
      console.log(`[Digest] Recent (validated): "${paper.title}"`);
      break;
    } else {
      console.log(`[Digest] Skipping irrelevant: "${paper.title}"`);
    }
  }
  // If no validated result, take the first non-duplicate anyway (better than nothing)
  if (items.length < 2 && recentResults.length > 0) {
    const fallback = recentResults.find(p => !seenTitles.has(p.title.toLowerCase()));
    if (fallback) {
      items.push({
        title: fallback.title, authors: fallback.authors, abstract: fallback.abstract,
        sourceUrl: fallback.sourceUrl, pdfUrl: fallback.pdfUrl || undefined,
        source: fallback.source, category: "recent",
      });
      seenTitles.add(fallback.title.toLowerCase());
      console.log(`[Digest] Recent (fallback, unvalidated): "${fallback.title}"`);
    }
  }

  // Step 5: Find third item — news or contrasting paper
  if (contentMix < 40) {
    // All research: find a contrasting paper
    const contrastQuery = `${focusInterest} critique OR alternative OR comparison`;
    console.log(`[Digest] Step 5: Searching for contrast: "${contrastQuery}"`);
    await delay(500);
    const contrastResults = await searchPapers(contrastQuery, 5, "citationCount");
    for (const paper of contrastResults) {
      if (seenTitles.has(paper.title.toLowerCase())) continue;
      if (isRelevant(paper, themeWords)) {
        items.push({
          title: paper.title, authors: paper.authors, abstract: paper.abstract,
          sourceUrl: paper.sourceUrl, pdfUrl: paper.pdfUrl || undefined,
          source: paper.source, category: "news",
        });
        console.log(`[Digest] Contrast (validated): "${paper.title}"`);
        break;
      }
    }
  } else {
    // Mixed or all news: find a relevant news article
    const newsTerms = newsKeywords.split(/\s+/).slice(0, 3);
    console.log(`[Digest] Step 5: Searching news for: ${newsTerms.join(", ")}`);
    const news = await fetchRssArticles(newsTerms, 10);
    // Validate: does the news article relate to the theme?
    for (const article of news) {
      if (isRelevant(article, themeWords)) {
        items.push({
          ...article, pdfUrl: undefined, source: "rss", category: "news",
        });
        console.log(`[Digest] News (validated): "${article.title}"`);
        break;
      }
    }
    // Fallback: take first news if none validated
    if (items.length < 3 && news.length > 0 && !items.some(i => i.source === "rss")) {
      items.push({
        ...news[0], pdfUrl: undefined, source: "rss", category: "news",
      });
      console.log(`[Digest] News (fallback): "${news[0].title}"`);
    }
  }

  console.log(`[Digest] ${items.length} items ready. Synthesizing...`);

  // Step 6: Synthesize
  const aiResponse = await aiComplete(
    aiConfig, SYNTHESIS_SYSTEM,
    digestPrompt(
      items.map(p => ({ title: p.title, abstract: p.abstract, source: p.source, category: p.category })),
      theme
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

  const [digest] = await db.insert(digests).values({
    userId, date: today,
    synthesisContent: parsed.synthesis,
    keyConcepts: JSON.stringify(parsed.keyConcepts || []),
  }).returning();

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const aiItem = parsed.items.find(x => x.index === i + 1) || { summary: "", keywords: [] };
    await db.insert(papers).values({
      digestId: digest.id,
      title: item.title, authors: JSON.stringify(item.authors),
      abstract: item.abstract, fullText: item.abstract,
      summary: aiItem.summary, source: item.source,
      sourceUrl: item.sourceUrl, pdfUrl: item.pdfUrl,
      keywords: JSON.stringify(aiItem.keywords),
      category: item.category,
    });
  }

  return digest;
}
