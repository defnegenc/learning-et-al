import { db } from "@/lib/db";
import { digests, papers, interests, users } from "@/lib/db/schema";
import { eq, and, desc, inArray } from "drizzle-orm";
import { searchSemanticScholar } from "@/lib/fetchers/semantic-scholar";
import { searchArxiv } from "@/lib/fetchers/arxiv";
import { searchOpenAlex } from "@/lib/fetchers/open-alex";
import { fetchRssArticles } from "@/lib/fetchers/rss";
import { fetchArticleText } from "@/lib/fetchers/article";
import { webSearch } from "@/lib/fetchers/web-search";
import { aiComplete, AIConfig } from "@/lib/ai/provider";
import { digestPrompt, SYNTHESIS_SYSTEM } from "@/lib/ai/prompts";
import { embedText, embedBatch, cosineSimilarity } from "@/lib/embeddings";
import { venueQualityBoost, institutionBoost } from "@/lib/venue-quality";

// See docs/algorithm.md for the full algorithm design.

type PaperSearchResult = {
  paperId: string;
  openAlexId?: string;
  title: string;
  authors: string[];
  abstract: string;
  sourceUrl: string;
  pdfUrl?: string;
  citationCount: number;
  year: number;
  source: "semantic_scholar" | "arxiv";
  /** Journal/conference name from OpenAlex */
  venueName?: string;
  /** Author institutions from OpenAlex */
  institutions?: string[];
  /** Academic field from OpenAlex primary_topic */
  primaryDomain?: string;
};

interface DigestAIResponse {
  items: { index: number; summary: string; keywords: string[]; findings?: string[]; connectionToTheme?: string }[];
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
  year?: number;
};

async function searchPapers(
  query: string,
  max: number,
  sort: "citationCount" | "publicationDate",
  fieldsOfStudy?: string,
): Promise<PaperSearchResult[]> {
  const oaSort = sort === "citationCount" ? "cited_by_count" : "publication_year";
  const oaSourceFor = (url: string) =>
    url.includes("arxiv.org") ? "arxiv" as const : "semantic_scholar" as const;

  const oaResults = await searchOpenAlex(query, fieldsOfStudy, oaSort, max);
  if (oaResults.length > 0) {
    return oaResults.map(p => ({ ...p, source: oaSourceFor(p.sourceUrl) }));
  }

  if (fieldsOfStudy) {
    const oaBroad = await searchOpenAlex(query, undefined, oaSort, max);
    if (oaBroad.length > 0) {
      return oaBroad.map(p => ({ ...p, source: oaSourceFor(p.sourceUrl) }));
    }
  }

  const s2 = await searchSemanticScholar(query, max, sort, fieldsOfStudy);
  if (s2.length > 0) {
    return s2.map(p => ({ ...p, openAlexId: undefined, source: "semantic_scholar" as const }));
  }

  await delay(300);
  const arxiv = await searchArxiv(query, max);
  return arxiv.map(p => ({
    paperId: "", openAlexId: undefined,
    title: p.title, authors: p.authors, abstract: p.abstract,
    sourceUrl: p.sourceUrl, pdfUrl: p.pdfUrl,
    citationCount: 0, year: new Date().getFullYear(),
    source: "arxiv" as const,
  }));
}

const STOP_WORDS = new Set([
  "with", "from", "that", "this", "based", "using", "their", "about", "been",
  "have", "will", "what", "when", "where", "which", "there", "these", "those",
  "into", "over", "under", "more", "most", "than", "then", "also", "just",
  "only", "very", "each", "every", "some", "such", "through", "between",
  "after", "before", "other", "first", "could", "would", "should", "does",
  "make", "like", "well", "back", "even", "still", "many", "much", "good",
  "long", "high", "real", "work", "used", "find", "here", "take", "come",
  "made", "know", "time", "year", "your", "them", "they", "were",
  "said", "says", "news", "report", "article", "paper", "study",
]);

function paperText(paper: { title: string; abstract: string }): string {
  return `${paper.title}. ${paper.abstract.slice(0, 500)}`;
}

function isListicle(title: string, source: string): boolean {
  const t = title.toLowerCase();
  const s = source.toLowerCase();
  return /\btop \d+|\bbest \d+|\d+\+ |\blist of\b|\bguide to\b|\bwhat is\b.*\?/.test(t)
    || /exploding.topics|producthunt|beebom|geeksforgeeks|javatpoint|analyticsvidhya|towards.?data.?science/i.test(s)
    || (t.length < 60 && /\b(everything you need|all you need to know|complete guide|ultimate guide)\b/.test(t));
}

function isNewsRelevant(article: { title: string; abstract: string }, themeWords: string[], focusInterest: string): boolean {
  const text = `${article.title} ${article.abstract}`.toLowerCase();
  const interestWords = focusInterest.toLowerCase().split(/\s+/).filter(w => w.length > 3 && !STOP_WORDS.has(w));
  if (interestWords.filter(w => text.includes(w)).length < 2) return false;
  return themeWords.filter(w => text.includes(w)).length >= 2;
}

// Embedding similarity thresholds for all-MiniLM-L6-v2
const SIM_ONTOPIC  = 0.25; // minimum similarity to theme to be included
const SIM_FALLBACK = 0.15; // last-resort fallback threshold

export async function generateDigest(userId: string, aiConfig: AIConfig, force?: boolean) {
  const today = new Date().toISOString().split("T")[0];

  // Check for existing digest today — if not forcing, return it
  const existing = await db.query.digests.findFirst({
    where: and(eq(digests.userId, userId), eq(digests.date, today)),
    orderBy: desc(digests.createdAt),
  });
  if (existing && !force) return existing;

  // Don't delete old digests — they become history. Dedup will prevent repeats.

  const userInterests = await db.query.interests.findMany({
    where: eq(interests.userId, userId),
    orderBy: desc(interests.weight),
  });
  for (const interest of userInterests) {
    const decayed = (interest.weight ?? 1.0) * 0.95;
    await db.update(interests).set({ weight: decayed, updatedAt: new Date() }).where(eq(interests.id, interest.id));
  }

  const seen = new Map<string, string>();
  const deduped = userInterests.filter(i => {
    const key = i.keyword.toLowerCase().trim();
    if (key.length <= 2) return false;
    if (seen.has(key)) return false;
    seen.set(key, i.keyword);
    return true;
  });
  // Interest rotation: find which interests were used in recent digests so we can
  // deprioritize them. This prevents the same topic (e.g. linguistics) from dominating
  // every single digest when weights are equal.
  const recentThemes = await db.query.digests.findMany({
    where: eq(digests.userId, userId),
    orderBy: desc(digests.createdAt),
    limit: 5,
  });
  const recentlyUsedWords = new Set<string>();
  for (const d of recentThemes) {
    if (!d.theme) continue;
    // Extract meaningful words from recent theme questions
    d.theme.toLowerCase().split(/\s+/)
      .filter(w => w.length > 3)
      .forEach(w => recentlyUsedWords.add(w));
  }

  // Score each interest: base weight + penalty if recently used
  const scoredPool = deduped.map(interest => {
    const words = interest.keyword.toLowerCase().split(/\s+/);
    const recentOverlap = words.filter(w => recentlyUsedWords.has(w)).length;
    const recentPenalty = recentOverlap > 0 ? 0.5 : 0; // halve weight if recently used
    return { interest, score: (interest.weight ?? 1.0) - recentPenalty };
  });

  // Pick 5 candidates: weighted random from the scored pool
  const candidateInterests: typeof deduped = [];
  const pool = [...scoredPool];
  while (candidateInterests.length < 5 && pool.length > 0) {
    // Ensure all scores are positive for sampling
    const minScore = Math.min(...pool.map(p => p.score));
    const adjusted = pool.map(p => ({ ...p, adj: p.score - minScore + 0.1 }));
    const total = adjusted.reduce((s, p) => s + p.adj, 0);
    let r = Math.random() * total;
    let picked = pool.length - 1;
    for (let j = 0; j < adjusted.length; j++) {
      r -= adjusted[j].adj;
      if (r <= 0) { picked = j; break; }
    }
    candidateInterests.push(pool[picked].interest);
    pool.splice(picked, 1);
  }
  if (candidateInterests.length === 0) throw new Error("No interests found. Add some first.");
  console.log(`[Digest] Candidate interests: [${candidateInterests.map(i => i.keyword).join(", ")}]`);

  // Cross-digest dedup: only last 30 days to avoid pool exhaustion
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const pastDigests = await db.query.digests.findMany({ where: eq(digests.userId, userId) });
  const recentDigestIds = pastDigests
    .filter(d => d.date >= thirtyDaysAgo)
    .map(d => d.id);
  const seenPaperTitles = new Set<string>();
  if (recentDigestIds.length > 0) {
    const pastPapers = await db.query.papers.findMany({ where: inArray(papers.digestId, recentDigestIds) });
    for (const p of pastPapers) seenPaperTitles.add(p.title.toLowerCase());
  }
  console.log(`[Digest] Cross-digest dedup (last 30 days + current): ${seenPaperTitles.size} previously seen`);

  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  // Fixed at 2 papers + 1 news — best balance per recsys literature (2 exploit + 1 explore)
  const targetPapers = 2;
  const targetNews = 1;
  console.log(`[Digest] Target: ${targetPapers} papers, ${targetNews} news`);

  // ─── Step 1: Generate today's central question ──────────────────────────────
  // The LLM picks 1-3 interests and frames a catchy "wow factor" question.
  // This is the heart of the algorithm — everything else builds from this question.
  // Interests are passed sorted by weight so the LLM knows which are primary.
  const interestList = candidateInterests.map(i =>
    `"${i.keyword}" (${i.level ?? "beginner"} level, field: ${i.field ?? "general"})`
  ).join("\n");

  const hypothesisPrompt = `You curate a daily research digest. Your job: pick 1-3 of these user interests and generate a central question with genuine surprise value.

User interests (sorted by priority):
${interestList}

GOOD themes are SHORT and PUNCHY — like a magazine cover headline. Can be a question OR a statement:
- "When fakes become indistinguishable from reality" (statement)
- "Can AI out-create humans?" (question)
- "The death of the expert" (statement)
- "When will robots cook dinner?" (question)
- "Old traditions, new machines" (statement)
- "Do machines have taste?" (question)

BAD themes are wordy, academic, or just topic labels:
- "When fakes become indistinguishable from reality?" — drop the question mark, it's stronger as a statement
- "Can AI out-create humans, or will it expand our artistic horizons?" — TOO LONG
- "Recent advances in AI" — not interesting, zero surprise
- "The question of whether generative AI..." — NO. Never start with "The question of"

Rules:
- MAX 8 WORDS. Shorten ruthlessly.
- For beginner interests: concrete and real-world, avoid pure theory
- For a single interest: find the unexpected angle within it
- Only combine 2 interests if they NATURALLY connect (AI + design, robotics + cooking, biology + fashion-tech). If interests are truly unrelated (like microbiome + cryptocurrency), just pick ONE and find a great angle within it.
- The theme must sound like something a real person would actually wonder about. "Can we wear our gut health?" is great. "Can bacteria become your personal health stylist?" is too goofy.

SEARCH QUERY RULES:
- All 3 queries must find papers a PERSON WITH THESE INTERESTS would actually want to read
- Include at least one interest keyword in each query
- Papers should be from the same general domain — if interests are in design/art, don't return physics papers
- BAD query: "measurement methodology" (too broad, matches physics AND social science AND everything)
- GOOD query: "design evaluation user experience measurement" (specific to the domain)
- Each query should find papers that could plausibly appear in the same reading list

Return JSON only (no markdown):
{
  "selectedInterests": ["interest1", "interest2"],
  "theme": "catchy headline MAX 8 WORDS — question or statement. If statement, NO question mark.",
  "searchQueries": [
    "academic search query 1 (MUST include the interest keyword, 3-5 words)",
    "academic search query 2 (different angle, 3-5 words)",
    "academic search query 3 (applied/real-world angle, 3-5 words)"
  ],
  "newsQuery": "2-4 keywords for a real-world news story on this theme",
  "focusField": "primary academic field (e.g. Computer Science, Biology, Art)"
}`;

  let theme = candidateInterests[0].keyword;
  let searchQueries: string[] = [candidateInterests[0].keyword];
  let newsQuery = candidateInterests[0].keyword;
  let focusField = candidateInterests[0].field || "Computer Science";
  let selectedInterestKeywords: string[] = [candidateInterests[0].keyword];

  try {
    console.log(`[Digest] Step 1: generating central question from [${candidateInterests.map(i => i.keyword).join(", ")}]...`);
    const hypothesisResp = await aiComplete(
      aiConfig,
      "You generate surprising, curiosity-provoking central questions for a daily research digest. Return only JSON.",
      hypothesisPrompt
    );
    const hypothesisJson = hypothesisResp.match(/\{[\s\S]*\}/);
    if (!hypothesisJson) throw new Error("No JSON in hypothesis response");
    const parsed = JSON.parse(hypothesisJson[0]);
    if (parsed.theme) theme = parsed.theme;
    if (parsed.searchQueries?.length > 0) searchQueries = parsed.searchQueries;
    if (parsed.newsQuery) newsQuery = parsed.newsQuery;
    if (parsed.focusField) focusField = parsed.focusField;
    if (parsed.selectedInterests?.length > 0) selectedInterestKeywords = parsed.selectedInterests;
    console.log(`[Digest] Central question: "${theme}"`);
    console.log(`[Digest] Search queries: ${searchQueries.join(" | ")}`);
  } catch (err) {
    console.log(`[Digest] Hypothesis generation failed (${err}), using fallback`);
  }

  // Primary interest for learning system feedback
  const focusInterest = selectedInterestKeywords[0];
  const focusInterestObj = candidateInterests.find(i => i.keyword === focusInterest) ?? candidateInterests[0];
  const focusLevel = (focusInterestObj.level ?? "beginner") as "beginner" | "intermediate" | "expert";

  // Embed the central question — this is our relevance anchor for all paper scoring
  console.log(`[Digest] Embedding central question...`);
  const themeEmb = await embedText(theme);

  // ─── Step 2: Search for papers using all generated queries ───────────────────
  console.log(`[Digest] Step 2: searching papers with ${searchQueries.length} queries...`);
  const allResults: PaperSearchResult[] = [];
  const seenSearchTitles = new Set<string>();

  for (const query of searchQueries) {
    // For beginner interests: pull survey/overview papers by appending accessibility terms
    const adjustedQuery = focusLevel === "beginner"
      ? `${query} introduction overview applications`
      : query;
    console.log(`[Digest] Query: "${adjustedQuery}" [field: ${focusField}]`);
    try {
      const results = await searchPapers(adjustedQuery, 10, "publicationDate", focusField);
      for (const p of results) {
        const key = p.title.toLowerCase();
        if (!seenSearchTitles.has(key)) {
          seenSearchTitles.add(key);
          allResults.push(p);
        }
      }
    } catch (err) {
      console.log(`[Digest] Query failed: ${err}`);
    }
    await delay(500);
  }
  console.log(`[Digest] ${allResults.length} total candidates across all queries`);

  if (allResults.length === 0) {
    throw new Error(`Couldn't find papers for "${theme}". Search APIs might be rate-limited. Wait a minute and try again.`);
  }

  // ─── Step 3: Score candidates — multi-signal scoring ───────────────────────────
  // Literature says quality is one of 7 serendipity factors (Kotkov et al.)
  // Scoring: theme relevance + recency + citation velocity + venue prestige + institution
  const resultEmbs = await embedBatch(allResults.map(paperText));
  const currentYear = new Date().getFullYear();

  const SIM_MIN_THEME = 0.12; // minimum raw theme similarity — filters only truly irrelevant papers, keeps creative cross-domain picks
  const scored = allResults
    .map((p, i) => {
      const themeSim = cosineSimilarity(themeEmb, resultEmbs[i]);
      // Recency bonus: papers from this year get +0.1, last year +0.05, older +0
      const age = p.year ? currentYear - p.year : 2;
      const recencyBonus = age <= 0 ? 0.1 : age === 1 ? 0.05 : 0;
      // Citation velocity: citations per year (capped, normalized)
      const yearsOld = Math.max(1, age);
      const citationVelocity = Math.min(0.05, (p.citationCount / yearsOld) * 0.001);
      // Venue prestige: CHI paper > unknown journal (0 to +0.08)
      const venueBoost = venueQualityBoost(p.venueName, p.primaryDomain);
      // Institutional credibility: MIT/Stanford/etc. (0 to +0.05)
      const instBoost = institutionBoost(p.institutions || []);
      const score = themeSim + recencyBonus + citationVelocity + venueBoost + instBoost;
      if (venueBoost > 0 || instBoost > 0) {
        console.log(`[Digest] Quality boost: "${p.title.slice(0, 50)}" venue=${venueBoost.toFixed(2)} inst=${instBoost.toFixed(2)} (${p.venueName || "unknown"})`);
      }
      return { p, themeSim, score };
    })
    .filter(({ p }) => !seenPaperTitles.has(p.title.toLowerCase()))
    .filter(({ themeSim }) => themeSim >= SIM_MIN_THEME) // hard floor: paper must be somewhat about the theme
    .sort((a, b) => b.score - a.score);

  const threshold = scored.some(({ score }) => score > SIM_ONTOPIC) ? SIM_ONTOPIC : SIM_FALLBACK;
  const qualified = scored.filter(({ score }) => score > threshold);
  console.log(`[Digest] ${qualified.length} candidates above threshold, top: ${scored[0]?.score.toFixed(2)} (theme: ${scored[0]?.themeSim.toFixed(2)})`);

  // Slot strategy: first N-1 papers = highest combined score (exploit)
  // Last paper slot = highest theme relevance among remaining (explore — different angle)
  const items: TaggedItem[] = [];
  const seenTitles = new Set<string>(seenPaperTitles);

  // Exploit slots: best overall score
  for (const { p, score } of qualified) {
    if (items.length >= Math.max(1, targetPapers - 1)) break;
    if (seenTitles.has(p.title.toLowerCase())) continue;
    items.push({
      title: p.title, authors: p.authors, abstract: p.abstract,
      sourceUrl: p.sourceUrl, pdfUrl: p.pdfUrl || undefined,
      source: p.source, year: p.year,
      category: items.length === 0 ? "foundational" : "recent",
    });
    seenTitles.add(p.title.toLowerCase());
    console.log(`[Digest] Paper ${items.length} (exploit): "${p.title}" (score ${score.toFixed(2)})`);
  }

  // Explore slot: intentionally diverse — search with adjacent interest for structured serendipity
  // Literature: "structured exploration (bridge items) beats random novelty" (recsys-literature.md)
  if (items.length < targetPapers) {
    // Try an adjacent-field search first for genuine serendipity
    const unusedInterests = candidateInterests.filter(i =>
      !selectedInterestKeywords.includes(i.keyword)
    );
    const adjacentQuery = unusedInterests.length > 0
      ? `${theme} ${unusedInterests[0].keyword}` // bridge theme + different interest
      : searchQueries[2] || searchQueries[0]; // fallback to third search query

    console.log(`[Digest] Explore slot: searching with adjacent query: "${adjacentQuery}"`);
    await delay(500);
    const exploreResults = await searchPapers(adjacentQuery, 8, "publicationDate", focusField);
    let explorePicked = false;

    for (const p of exploreResults) {
      if (seenTitles.has(p.title.toLowerCase())) continue;
      const sim = cosineSimilarity(themeEmb, await embedText(paperText(p)));
      const vBoost = venueQualityBoost(p.venueName, p.primaryDomain);
      const iBoost = institutionBoost(p.institutions || []);
      if (sim + vBoost + iBoost > SIM_FALLBACK) {
        items.push({
          title: p.title, authors: p.authors, abstract: p.abstract,
          sourceUrl: p.sourceUrl, pdfUrl: p.pdfUrl || undefined,
          source: p.source, year: p.year, category: "recent",
        });
        seenTitles.add(p.title.toLowerCase());
        console.log(`[Digest] Paper ${items.length} (explore): "${p.title}" (sim ${sim.toFixed(2)}, venue +${vBoost.toFixed(2)})`);
        explorePicked = true;
        break;
      }
    }

    // Fallback: take from existing qualified pool
    if (!explorePicked) {
      const remaining = qualified.filter(({ p }) => !seenTitles.has(p.title.toLowerCase()));
      if (remaining.length > 0) {
        const pick = remaining[0];
        items.push({
          title: pick.p.title, authors: pick.p.authors, abstract: pick.p.abstract,
          sourceUrl: pick.p.sourceUrl, pdfUrl: pick.p.pdfUrl || undefined,
          source: pick.p.source, year: pick.p.year, category: "recent",
        });
        seenTitles.add(pick.p.title.toLowerCase());
        console.log(`[Digest] Paper ${items.length} (explore fallback): "${pick.p.title}"`);
      }
    }
  }

  if (items.length === 0) {
    throw new Error(`Could not find relevant papers for "${theme}". Try regenerating or adding more interests.`);
  }

  // themeWords used for news validation (short snippets don't embed well)
  const themeWords = theme.toLowerCase()
    .split(/\s+/)
    .filter(w => w.length > 3 && !STOP_WORDS.has(w));

  // ─── Step 4: Fill remaining slots (news and/or papers) ───────────────────────
  const newsNeeded = targetNews - items.filter(i => i.source === "rss").length;
  const papersNeeded = 3 - items.length - newsNeeded;

  // Find news items if needed
  if (newsNeeded > 0) {
    const newsSearchTerms = `${newsQuery} ${focusInterest} 2025 2026`;
    console.log(`[Digest] Step 4: finding ${newsNeeded} news via web search: "${newsSearchTerms}"`);
    const webResults = await webSearch(newsSearchTerms, newsNeeded * 3);

    const newsTexts = webResults.map(r => `${r.title}. ${r.snippet}`);
    const newsEmbs = newsTexts.length > 0 ? await embedBatch(newsTexts) : [];
    const scoredNews = webResults
      .map((result, i) => ({ result, sim: cosineSimilarity(themeEmb, newsEmbs[i]) }))
      .filter(({ result }) => !isListicle(result.title, result.source))
      .filter(({ result }) => !seenTitles.has(result.title.toLowerCase()))
      .sort((a, b) => b.sim - a.sim);

    let newsFound = 0;
    for (const { result, sim } of scoredNews) {
      if (newsFound >= newsNeeded) break;
      if (sim < 0.15) continue;
      const articleText = await fetchArticleText(result.link);
      const abstract = articleText.length > 200 ? articleText : result.snippet;
      items.push({
        title: result.title, authors: [result.source],
        abstract, sourceUrl: result.link,
        source: "rss", category: "news", year: new Date().getFullYear(),
      });
      seenTitles.add(result.title.toLowerCase());
      console.log(`[Digest] News ${newsFound + 1}/${newsNeeded}: "${result.title}" (sim ${sim.toFixed(2)})`);
      newsFound++;
    }

    // RSS fallback for remaining news slots
    if (newsFound < newsNeeded) {
      const newsTerms = newsQuery.split(/\s+/).slice(0, 3);
      const rss = await fetchRssArticles(newsTerms, 10);
      for (const article of rss) {
        if (newsFound >= newsNeeded) break;
        if (seenTitles.has(article.title.toLowerCase())) continue;
        if (isNewsRelevant(article, themeWords, focusInterest)) {
          const articleText = await fetchArticleText(article.sourceUrl);
          const abstract = articleText.length > 200 ? articleText : article.abstract;
          items.push({ ...article, abstract, source: "rss", category: "news", year: new Date().getFullYear() });
          seenTitles.add(article.title.toLowerCase());
          newsFound++;
        }
      }
    }

    console.log(`[Digest] Found ${newsFound}/${newsNeeded} news items`);
  }

  // Fill remaining slots with papers
  if (items.length < 3) {
    const remaining = 3 - items.length;
    console.log(`[Digest] Filling ${remaining} remaining slot(s) with papers...`);
    await delay(500);
    const fillQuery = searchQueries[2] || `${focusInterest} applications`;
    const fillResults = await searchPapers(fillQuery, 8, "citationCount", focusField);
    for (const paper of fillResults) {
      if (items.length >= 3) break;
      if (seenTitles.has(paper.title.toLowerCase())) continue;
      const sim = cosineSimilarity(themeEmb, await embedText(paperText(paper)));
      if (sim > SIM_ONTOPIC) {
        items.push({
          title: paper.title, authors: paper.authors, abstract: paper.abstract,
          sourceUrl: paper.sourceUrl, pdfUrl: paper.pdfUrl || undefined,
          source: paper.source, category: items.length < targetPapers ? "recent" : "news",
          year: paper.year,
        });
        seenTitles.add(paper.title.toLowerCase());
        console.log(`[Digest] Fill paper: "${paper.title}" (sim ${sim.toFixed(2)})`);
      }
    }
  }

  // Final broad fill if still under 3 items
  if (items.length < 3) {
    console.log(`[Digest] Only ${items.length} items, trying broad fill...`);
    await delay(500);
    const broadResults = await searchPapers(focusInterest, 12, "publicationDate", focusField);
    for (const paper of broadResults) {
      if (items.length >= 3) break;
      if (seenTitles.has(paper.title.toLowerCase())) continue;
      const sim = cosineSimilarity(themeEmb, await embedText(paperText(paper)));
      if (sim > SIM_FALLBACK) {
        items.push({
          title: paper.title, authors: paper.authors, abstract: paper.abstract,
          sourceUrl: paper.sourceUrl, pdfUrl: paper.pdfUrl || undefined,
          source: paper.source, year: paper.year,
          category: items.length === 2 ? "news" : "recent",
        });
        seenTitles.add(paper.title.toLowerCase());
        console.log(`[Digest] Broad fill: "${paper.title}" (sim ${sim.toFixed(2)})`);
      }
    }
  }

  if (items.length < 2) {
    throw new Error(`Could only find ${items.length} relevant item(s) for "${theme}". Try regenerating or add more interests.`);
  }
  console.log(`[Digest] ${items.length} items ready.`);

  // ─── Step 5: Revise the theme to better thread the actual papers ─────────────
  // The original theme was generated BEFORE we found papers. Now that we know
  // what we actually have, ask the LLM to tighten it — or keep it if it already works.
  let finalTheme = theme;
  try {
    const paperList = items.map((p, i) =>
      `[${i + 1}] "${p.title}" — ${p.abstract.slice(0, 300)}`
    ).join("\n\n");

    const revisePrompt = `Original theme: "${theme}"

Papers we actually found:
${paperList}

Read the papers carefully. What is the REAL thread connecting them? It might NOT be what the original theme says.

If the papers are about research methodology, reproducibility, and adoption — the theme is about EVIDENCE and TRUST, not about AI. Don't force an AI angle when the papers are really about something deeper.

BAD: "Does AI hype match real classroom results?" — when the papers are really about research reproducibility and academic visions (AI is just the context, not the point)
GOOD: "Can we trust the research behind the hype?" — captures what ALL three papers actually share

BAD: "Can AI achieve consciousness?" — only connects to one paper
GOOD: "Can AI agents care for you?" — threads all papers

The theme should capture what the papers are ACTUALLY about at their core, not the surface-level topic they happen to mention.

Rules:
- MAX 8 WORDS
- Must connect ALL papers at their CORE, not their surface topic
- Punchy, magazine-cover energy
- A normal person should want to click on it
- Drop the original framing entirely if the papers tell a different story

ALWAYS revise. The original was written before seeing the papers so it almost certainly doesn't fit well.

Return JSON only: {"theme": "catchy headline MAX 8 WORDS — question or statement"}`;

    console.log(`[Digest] Step 5: revising theme to fit actual papers...`);
    const reviseResp = await aiComplete(aiConfig, "You refine central questions for research digests. Return only JSON.", revisePrompt);
    const reviseJson = reviseResp.match(/\{[\s\S]*\}/);
    if (reviseJson) {
      const parsed = JSON.parse(reviseJson[0]);
      if (parsed.theme) {
        console.log(`[Digest] Theme revised: "${parsed.theme}" (was: "${theme}")`);
        finalTheme = parsed.theme;
      }
    }
  } catch (err) {
    console.log(`[Digest] Theme revision failed (${err}), keeping original`);
  }

  // ─── Step 6: Synthesize ──────────────────────────────────────────────────────
  console.log(`[Digest] Synthesizing with theme: "${finalTheme}"...`);
  const aiResponse = await aiComplete(
    aiConfig, SYNTHESIS_SYSTEM,
    digestPrompt(
      items.map(p => ({ title: p.title, abstract: p.abstract, source: p.source, category: p.category, year: p.year })),
      finalTheme,
      { focusInterest, focusLevel, researchAngle: finalTheme }
    )
  );

  let parsedAI: DigestAIResponse;
  try {
    // Find the outermost JSON object — greedy match gets the largest { ... } block
    const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON object found");
    parsedAI = JSON.parse(jsonMatch[0]);
    // Safety: if synthesis is empty/missing after parse, use the raw response
    if (!parsedAI.synthesis) {
      console.log(`[Digest] Synthesis field empty after JSON parse, using raw response`);
      parsedAI.synthesis = aiResponse.replace(/```json\s*/, "").replace(/```\s*$/, "").trim();
    }
  } catch (err) {
    console.log(`[Digest] JSON parse failed (${err}), using raw response as synthesis`);
    parsedAI = {
      items: items.map((_, i) => ({ index: i + 1, summary: "", keywords: [], findings: [] })),
      synthesis: aiResponse,
      keyConcepts: [],
    };
  }

  const [digest] = await db.insert(digests).values({
    userId, date: today,
    theme: finalTheme,
    synthesisContent: parsedAI.synthesis,
    keyConcepts: JSON.stringify(parsedAI.keyConcepts || []),
  }).returning();

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const aiItem = parsedAI.items.find(x => x.index === i + 1) || { summary: "", keywords: [], findings: [], connectionToTheme: "" };
    await db.insert(papers).values({
      digestId: digest.id,
      title: item.title, authors: JSON.stringify(item.authors),
      abstract: item.abstract, fullText: item.abstract,
      summary: aiItem.summary, source: item.source,
      sourceUrl: item.sourceUrl, pdfUrl: item.pdfUrl,
      keywords: JSON.stringify(aiItem.keywords),
      keyFindings: JSON.stringify(aiItem.findings || []),
      connectionReason: aiItem.connectionToTheme || null,
      category: item.category,
      year: item.year,
    });
  }

  return digest;
}
