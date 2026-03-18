import { db } from "@/lib/db";
import { digests, papers, interests, users, feedback } from "@/lib/db/schema";
import { eq, and, desc, inArray } from "drizzle-orm";
import { searchSemanticScholar } from "@/lib/fetchers/semantic-scholar";
import { fetchRssArticles } from "@/lib/fetchers/rss";
import { aiComplete, AIConfig } from "@/lib/ai/provider";
import { digestPrompt, SYNTHESIS_SYSTEM } from "@/lib/ai/prompts";

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
  source: "semantic_scholar" | "rss";
  category: "foundational" | "recent" | "news";
};

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

  // Decay weights
  for (const interest of userInterests) {
    const decayed = (interest.weight ?? 1.0) * 0.95;
    await db.update(interests).set({ weight: decayed, updatedAt: new Date() }).where(eq(interests.id, interest.id));
  }

  const topInterests = userInterests.slice(0, 5).map(i => i.keyword);
  if (topInterests.length === 0) throw new Error("No interests found. Add some first.");

  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  const contentMix = user?.contentMix ?? 50;

  // Get past themes to avoid repeats
  const recentDigests = await db.query.digests.findMany({
    where: eq(digests.userId, userId),
    orderBy: desc(digests.createdAt),
    limit: 7,
  });
  const recentThemes = recentDigests
    .map(d => d.synthesisContent?.split("\n")[0]?.replace(/^Today's thread:\s*/i, "").trim())
    .filter((t): t is string => !!t);

  // Pick ONE interest to focus on today (rotate through them)
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
  const focusInterest = topInterests[dayOfYear % topInterests.length];

  console.log(`[Digest] Focus interest: "${focusInterest}"`);

  // === STEP 1: Start with a search, see what exists ===
  const items: TaggedItem[] = [];
  let theme = focusInterest;

  if (contentMix > 60) {
    // ALL NEWS: search RSS 3 times with variations
    const news = await fetchRssArticles([focusInterest], 10);
    const seen = new Set<string>();
    for (const article of news) {
      if (items.length >= 3) break;
      if (seen.has(article.title.toLowerCase())) continue;
      seen.add(article.title.toLowerCase());
      items.push({ ...article, pdfUrl: undefined, source: "rss", category: items.length === 0 ? "foundational" : items.length === 1 ? "recent" : "news" });
    }
    if (items.length > 0) {
      theme = `${focusInterest} in the news`;
    }
  } else {
    // RESEARCH or MIXED: start with Semantic Scholar
    // Step 1a: Find a foundational paper (high citations)
    console.log(`[Digest] Searching S2 for foundational: "${focusInterest}"`);
    const foundational = await searchSemanticScholar(focusInterest, 5, "citationCount");
    await delay(500);

    if (foundational.length > 0) {
      const best = foundational[0];
      items.push({ ...best, pdfUrl: best.pdfUrl || undefined, source: "semantic_scholar", category: "foundational" });
      console.log(`[Digest] Found foundational: "${best.title}" (${best.citationCount} citations)`);

      // Step 1b: Use keywords from the foundational paper to find a recent paper
      const recentQuery = `${focusInterest} ${best.title.split(" ").slice(0, 3).join(" ")}`;
      console.log(`[Digest] Searching S2 for recent: "${recentQuery}"`);
      const recent = await searchSemanticScholar(recentQuery, 5, "publicationDate");
      await delay(500);

      const recentPaper = recent.find(p => p.title.toLowerCase() !== best.title.toLowerCase());
      if (recentPaper) {
        items.push({ ...recentPaper, pdfUrl: recentPaper.pdfUrl || undefined, source: "semantic_scholar", category: "recent" });
        console.log(`[Digest] Found recent: "${recentPaper.title}"`);
      }
    }

    // Step 1c: Find news OR a third paper
    if (contentMix < 40) {
      // All research: find a contrasting paper
      const contrastQuery = foundational.length > 0
        ? `${focusInterest} critique OR limitations OR alternative`
        : focusInterest;
      console.log(`[Digest] Searching S2 for contrast: "${contrastQuery}"`);
      const contrast = await searchSemanticScholar(contrastQuery, 5, "citationCount");
      const seen = new Set(items.map(i => i.title.toLowerCase()));
      const contrastPaper = contrast.find(p => !seen.has(p.title.toLowerCase()));
      if (contrastPaper) {
        items.push({ ...contrastPaper, pdfUrl: contrastPaper.pdfUrl || undefined, source: "semantic_scholar", category: "news" });
        console.log(`[Digest] Found contrast: "${contrastPaper.title}"`);
      }
    } else {
      // Mixed: find related news
      console.log(`[Digest] Searching RSS for: "${focusInterest}"`);
      const news = await fetchRssArticles([focusInterest], 5);
      if (news.length > 0) {
        items.push({ ...news[0], pdfUrl: undefined, source: "rss", category: "news" });
        console.log(`[Digest] Found news: "${news[0].title}"`);
      }
    }

    // Build theme from what we actually found
    if (items.length >= 2) {
      theme = `${focusInterest}: from "${items[0].title.split(" ").slice(0, 5).join(" ")}..." to today`;
    }
  }

  if (items.length === 0) {
    throw new Error(`Couldn't find papers about "${focusInterest}". Try different interest terms.`);
  }

  console.log(`[Digest] ${items.length} items found. Running synthesis...`);

  // === STEP 2: AI synthesizes what we actually found ===
  const aiResponse = await aiComplete(
    aiConfig,
    SYNTHESIS_SYSTEM,
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

  // Create digest
  const [digest] = await db.insert(digests).values({
    userId,
    date: today,
    synthesisContent: parsed.synthesis,
    keyConcepts: JSON.stringify(parsed.keyConcepts || []),
  }).returning();

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const aiItem = parsed.items.find(x => x.index === i + 1) || { summary: "", keywords: [] };
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
