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
};

interface DigestAIResponse {
  items: { index: number; summary: string; keywords: string[]; findings?: string[] }[];
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
  const contentMix = user?.contentMix ?? 50;

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

GOOD themes are SHORT and PUNCHY — like a magazine cover headline:
- "Can AI out-create humans?" (5 words)
- "When will robots cook dinner?" (6 words)
- "Do machines have taste?" (4 words)
- "Is code the new poetry?" (5 words)
- "Can AI agents be fashionable?" (5 words)

BAD themes are wordy, academic, or just topic labels:
- "Can AI out-create humans, or will it expand our artistic horizons?" — TOO LONG. Just say "Can AI out-create humans?"
- "Recent advances in AI" — not a question, zero surprise
- "The question of whether generative AI..." — NO. Never start with "The question of"

Rules:
- MAX 8 WORDS. If your question is longer than 8 words, shorten it.
- For beginner interests: concrete and real-world, avoid pure theory
- For a single interest: find the unexpected angle within it
- Only combine 2 interests if they NATURALLY connect (AI + design, robotics + cooking, biology + fashion-tech). If interests are truly unrelated (like microbiome + cryptocurrency), just pick ONE and find a great angle within it.
- The theme must sound like something a real person would actually wonder about. "Can we wear our gut health?" is great. "Can bacteria become your personal health stylist?" is too goofy.

SEARCH QUERY RULES:
- Queries must find papers DIRECTLY about the selected interests, not tangentially related ancient history or random fields
- Include the interest keyword in each query (e.g. if interest is "consciousness", query should contain "consciousness")
- Papers should be from the same academic domain as the interests, not randomly pulled from archaeology or linguistics

Return JSON only (no markdown):
{
  "selectedInterests": ["interest1", "interest2"],
  "theme": "the catchy central question, MAX 8 WORDS",
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

  // ─── Step 3: Score all candidates against the central question ───────────────
  const resultEmbs = await embedBatch(allResults.map(paperText));

  const scored = allResults
    .map((p, i) => ({ p, score: cosineSimilarity(themeEmb, resultEmbs[i]) }))
    .filter(({ p }) => !seenPaperTitles.has(p.title.toLowerCase()))
    .sort((a, b) => b.score - a.score);

  const threshold = scored.some(({ score }) => score > SIM_ONTOPIC) ? SIM_ONTOPIC : SIM_FALLBACK;
  const qualified = scored.filter(({ score }) => score > threshold);
  console.log(`[Digest] ${qualified.length} candidates above threshold (${threshold}), top score: ${scored[0]?.score.toFixed(2)}`);

  const items: TaggedItem[] = [];
  const seenTitles = new Set<string>(seenPaperTitles);

  for (const { p, score } of qualified) {
    if (items.length >= 2) break;
    if (seenTitles.has(p.title.toLowerCase())) continue;
    items.push({
      title: p.title, authors: p.authors, abstract: p.abstract,
      sourceUrl: p.sourceUrl, pdfUrl: p.pdfUrl || undefined,
      source: p.source, year: p.year,
      category: items.length === 0 ? "foundational" : "recent",
    });
    seenTitles.add(p.title.toLowerCase());
    console.log(`[Digest] Paper ${items.length}: "${p.title}" (sim ${score.toFixed(2)})`);
  }

  if (items.length === 0) {
    throw new Error(`Could not find relevant papers for "${theme}". Try regenerating or adding more interests.`);
  }

  // themeWords used for news validation (short snippets don't embed well)
  const themeWords = theme.toLowerCase()
    .split(/\s+/)
    .filter(w => w.length > 3 && !STOP_WORDS.has(w));

  // ─── Step 4: Find third item ─────────────────────────────────────────────────
  if (contentMix < 15) {
    // All-research mode: find a third paper
    const thirdQuery = searchQueries[2] || searchQueries[0];
    console.log(`[Digest] Step 4 (all-research): third paper query: "${thirdQuery}"`);
    await delay(500);
    const thirdResults = await searchPapers(thirdQuery, 8, "citationCount", focusField);
    for (const p of thirdResults) {
      if (seenTitles.has(p.title.toLowerCase())) continue;
      const sim = cosineSimilarity(themeEmb, await embedText(paperText(p)));
      if (sim > SIM_ONTOPIC) {
        items.push({
          title: p.title, authors: p.authors, abstract: p.abstract,
          sourceUrl: p.sourceUrl, pdfUrl: p.pdfUrl || undefined,
          source: p.source, category: "news", year: p.year,
        });
        seenTitles.add(p.title.toLowerCase());
        console.log(`[Digest] Third paper (research): "${p.title}" (sim ${sim.toFixed(2)})`);
        break;
      }
    }
  } else {
    // Mixed/news mode: web search first
    const newsSearchTerms = `${newsQuery} ${focusInterest} 2025 2026`;
    console.log(`[Digest] Step 4: web search: "${newsSearchTerms}"`);
    const webResults = await webSearch(newsSearchTerms, 5);

    // Score news results by embedding similarity to the central question.
    // Keyword matching alone is too weak — an article mentioning "AI" and "agents"
    // might be about customer service bots, not the theme "Can AI agents invest?"
    let foundNews = false;
    const newsTexts = webResults.map(r => `${r.title}. ${r.snippet}`);
    const newsEmbs = newsTexts.length > 0 ? await embedBatch(newsTexts) : [];

    // Score and sort by theme similarity
    const scoredNews = webResults
      .map((result, i) => ({ result, sim: cosineSimilarity(themeEmb, newsEmbs[i]) }))
      .filter(({ result }) => !isListicle(result.title, result.source))
      .filter(({ result }) => !seenTitles.has(result.title.toLowerCase()))
      .sort((a, b) => b.sim - a.sim);

    for (const { result, sim } of scoredNews) {
      if (sim < 0.15) {
        console.log(`[Digest] Web news REJECTED (low theme sim ${sim.toFixed(2)}): "${result.title}"`);
        continue;
      }
      console.log(`[Digest] Fetching article text (theme sim ${sim.toFixed(2)}): ${result.link}`);
      const articleText = await fetchArticleText(result.link);
      const abstract = articleText.length > 200 ? articleText : result.snippet;
      items.push({
        title: result.title, authors: [result.source],
        abstract, sourceUrl: result.link,
        source: "rss", category: "news", year: new Date().getFullYear(),
      });
      console.log(`[Digest] Web news accepted: "${result.title}"`);
      foundNews = true;
      break;
    }

    if (!foundNews) {
      console.log(`[Digest] Web search empty, trying RSS...`);
      const newsTerms = newsQuery.split(/\s+/).slice(0, 3);
      const rss = await fetchRssArticles(newsTerms, 10);
      for (const article of rss) {
        if (seenTitles.has(article.title.toLowerCase())) continue;
        if (isNewsRelevant(article, themeWords, focusInterest)) {
          const articleText = await fetchArticleText(article.sourceUrl);
          const abstract = articleText.length > 200 ? articleText : article.abstract;
          items.push({ ...article, abstract, source: "rss", category: "news", year: new Date().getFullYear() });
          console.log(`[Digest] RSS news: "${article.title}"`);
          foundNews = true;
          break;
        }
      }
    }

    if (!foundNews) {
      console.log(`[Digest] No news found, finding third paper...`);
      await delay(500);
      const thirdResults = await searchPapers(
        `${focusInterest} applications deployment industry`, 8, "citationCount", focusField
      );
      for (const paper of thirdResults) {
        if (seenTitles.has(paper.title.toLowerCase())) continue;
        const sim = cosineSimilarity(themeEmb, await embedText(paperText(paper)));
        if (sim > SIM_ONTOPIC) {
          items.push({
            title: paper.title, authors: paper.authors, abstract: paper.abstract,
            sourceUrl: paper.sourceUrl, pdfUrl: paper.pdfUrl || undefined,
            source: paper.source, category: "news",
          });
          seenTitles.add(paper.title.toLowerCase());
          console.log(`[Digest] Third paper (no news): "${paper.title}" (sim ${sim.toFixed(2)})`);
          break;
        }
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

The theme MUST thread ALL ${items.length} items together. Look at what these papers have in common and find the question that connects them.

Example: if the papers are about Buddhist AI ethics, healthcare AI, and enterprise AI news, a BAD theme is "Can AI achieve consciousness?" (only connects to the first paper). A GOOD theme is "Can AI agents care for you?" (threads ethics + healthcare + enterprise adoption).

Another example: if papers are about AI romantic bonds, healthcare AI, and enterprise AI, a BAD theme is "Can AI agents achieve human-like consciousness?" (too abstract, doesn't connect healthcare). A GOOD theme is "Should we trust AI with our wellbeing?" (threads intimacy + healthcare + enterprise trust).

Rules:
- MAX 8 WORDS
- Must connect ALL papers, not just one
- Punchy, magazine-cover energy
- A normal person should want to click on it
- Must sound like something a real person would wonder about. NOT goofy or forced ("Can bacteria become your stylist?" = bad). YES grounded and curious ("Can we wear our gut health?" = good).

ALWAYS revise. The original was written before seeing the papers so it almost certainly doesn't fit well.

Return JSON only: {"theme": "the revised question, MAX 8 WORDS"}`;

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
    const aiItem = parsedAI.items.find(x => x.index === i + 1) || { summary: "", keywords: [], findings: [] };
    await db.insert(papers).values({
      digestId: digest.id,
      title: item.title, authors: JSON.stringify(item.authors),
      abstract: item.abstract, fullText: item.abstract,
      summary: aiItem.summary, source: item.source,
      sourceUrl: item.sourceUrl, pdfUrl: item.pdfUrl,
      keywords: JSON.stringify(aiItem.keywords),
      keyFindings: JSON.stringify(aiItem.findings || []),
      connectionReason: null,
      category: item.category,
      year: item.year,
    });
  }

  return digest;
}
