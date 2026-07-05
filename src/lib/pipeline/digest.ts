import { db } from "@/lib/db";
import { digests, papers, interests, users } from "@/lib/db/schema";
import { eq, and, desc, inArray } from "drizzle-orm";
import { searchSemanticScholar } from "@/lib/fetchers/semantic-scholar";
import { searchArxiv } from "@/lib/fetchers/arxiv";
import { searchOpenAlex } from "@/lib/fetchers/open-alex";
import { fetchRssArticles } from "@/lib/fetchers/rss";
import { fetchArticleText, isAcademicDomain } from "@/lib/fetchers/article";
import { webSearch } from "@/lib/fetchers/web-search";
import { aiComplete, AIConfig } from "@/lib/ai/provider";
import { selectionSkeletonPrompt, metadataPrompt, skeletonPrompt, synthesisFromSkeletonPrompt, synthesisCritiquePrompt, synthesisRevisionPrompt, SYNTHESIS_SYSTEM, SYNTHESIS_PROSE_SYSTEM } from "@/lib/ai/prompts";
import { extractJson, stripFences } from "@/lib/ai/parse";
import { bm25Score, rrfFuse } from "@/lib/bm25";
import { embedText, embedBatch, cosineSimilarity, isEmbeddingDegraded } from "@/lib/embeddings";
import { venueQualityBoost, isPredatoryVenue } from "@/lib/venue-quality";

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
  items: { index: number; plainName?: string; summary: string; keywords: string[]; findings?: string[]; connectionToTheme?: string; takeaway?: { hook?: string; stat?: string | null; line?: string } }[];
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
  /** Hint for synthesis: "this paper was selected to contradict/complicate paper 1" */
  tensionHint?: string;
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
const SIM_ONTOPIC  = 0.25; // strong match — clearly about the theme
const SIM_MIDPOINT = 0.20; // moderate match — related but not directly on-topic
const SIM_FALLBACK = 0.18; // last-resort fallback (raised from 0.15 — 0.15 lets in too much)

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
  // Only decay once per day — prevent double-decay on regeneration
  const todayStart = new Date(today + "T00:00:00");
  const alreadyDecayed = userInterests.some(i => i.updatedAt && i.updatedAt >= todayStart);
  if (!alreadyDecayed) {
    await Promise.all(userInterests.map(interest =>
      db.update(interests)
        .set({ weight: (interest.weight ?? 1.0) * 0.95, updatedAt: new Date() })
        .where(eq(interests.id, interest.id))
    ));
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
  // deprioritize them. We track the actual papers' keywords from recent digests
  // rather than just theme words, for more precise rotation.
  // Single query for all past digests — used for both rotation and dedup
  const allPastDigests = await db.query.digests.findMany({
    where: eq(digests.userId, userId),
    orderBy: desc(digests.createdAt),
  });
  const recentDigestsForRotation = allPastDigests.slice(0, 5);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const recentDigestIds = allPastDigests.filter(d => d.date >= thirtyDaysAgo).map(d => d.id);

  // Fetch papers for both rotation keywords and dedup in one query
  const seenPaperTitles = new Set<string>();
  const recentlyUsedKeywords = new Set<string>();
  if (recentDigestIds.length > 0) {
    const allRecentPapers = await db.query.papers.findMany({ where: inArray(papers.digestId, recentDigestIds) });
    const rotationDigestIds = new Set(recentDigestsForRotation.map(d => d.id));
    for (const p of allRecentPapers) {
      seenPaperTitles.add(p.title.toLowerCase());
      // Only use rotation keywords from the last 5 digests
      if (rotationDigestIds.has(p.digestId)) {
        try {
          const kws = JSON.parse(p.keywords || "[]") as string[];
          kws.forEach(kw => recentlyUsedKeywords.add(kw.toLowerCase()));
        } catch { /* ignore */ }
        p.title.toLowerCase().split(/\s+/)
          .filter(w => w.length > 4 && !STOP_WORDS.has(w))
          .forEach(w => recentlyUsedKeywords.add(w));
      }
    }
  }
  for (const d of recentDigestsForRotation) {
    if (!d.theme) continue;
    d.theme.toLowerCase().split(/\s+/)
      .filter(w => w.length > 3 && !STOP_WORDS.has(w))
      .forEach(w => recentlyUsedKeywords.add(w));
  }
  console.log(`[Digest] Cross-digest dedup: ${seenPaperTitles.size} seen, ${recentlyUsedKeywords.size} rotation keywords`);

  // Count how many recent themes each interest's keywords appear in (not just binary overlap)
  const keywordFrequency = new Map<string, number>();
  for (const d of recentDigestsForRotation) {
    if (!d.theme) continue;
    const themeTokens = d.theme.toLowerCase().split(/\s+/);
    for (const interest of deduped) {
      const words = interest.keyword.toLowerCase().split(/\s+/);
      if (words.some(w => themeTokens.includes(w) || recentlyUsedKeywords.has(w))) {
        keywordFrequency.set(interest.keyword, (keywordFrequency.get(interest.keyword) || 0) + 1);
      }
    }
  }

  const scoredPool = deduped.map(interest => {
    const freq = keywordFrequency.get(interest.keyword) || 0;
    // Penalty scales with frequency: 1 recent use = -0.5, 2 = -1.0, 3+ = -1.5 (basically kills it)
    const recentPenalty = Math.min(1.5, freq * 0.5);
    return { interest, score: (interest.weight ?? 1.0) - recentPenalty };
  });

  const candidateInterests: typeof deduped = [];
  const pool = [...scoredPool];
  while (candidateInterests.length < 5 && pool.length > 0) {
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

  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  // Dynamic paper:news ratio — starts at 2+1, adjusted after scoring (audit 4.4)
  // Will be recalculated after we know how many high-quality papers exist
  let targetPapers = 2;
  let targetNews = 1;
  const TOTAL_ITEMS = 3;
  console.log(`[Digest] Initial target: ${targetPapers} papers, ${targetNews} news`);

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
- "Can better architecture solve computational bottlenecks?" — JARGON. No normal person talks like this. "Why are AI models still so slow?" is the same idea but human.
- "When fakes become indistinguishable from reality?" — drop the question mark, it's stronger as a statement
- "Can AI out-create humans, or will it expand our artistic horizons?" — TOO LONG
- "Recent advances in AI" — not interesting, zero surprise
- "The question of whether generative AI..." — NO. Never start with "The question of"
- "Optimizing neural network architectures" — TECHNICAL DESCRIPTION, not a question anyone wonders about

Rules:
- MAX 8 WORDS. Shorten ruthlessly.
- At least ONE concrete, picturable noun — a real thing the reader can see — not only abstractions. A title made entirely of abstract words ("signals", "models", "systems") leaves the reader unable to tell what it's about.
  BAD: "When signals speak, do our models truly listen?" — all abstractions; you can't tell it's about reading emotion in text and brainwaves.
  GOOD: "Can AI read emotion in text and brainwaves?" — same idea, but graspable.
- NO JARGON in the theme. If it contains words like "computational", "architecture", "optimization", "framework", "methodology", "paradigm", "scalability" — REWRITE in plain English. Your grandma should understand the question.
- The theme must pass the DINNER TABLE TEST: would a smart non-expert actually wonder about this? "Why can't robots fold laundry?" passes. "Can better architecture solve computational bottlenecks?" fails — nobody talks like that.
- For beginner interests: concrete and real-world, avoid pure theory
- For a single interest: find the unexpected angle within it
- Only combine 2 interests if they NATURALLY connect (AI + design, robotics + cooking, biology + fashion-tech). If interests are truly unrelated (like microbiome + cryptocurrency), just pick ONE and find a great angle within it.
- The theme must sound like something a real person would actually wonder about. "Can we see our gut health?" is great. "Can bacteria become your personal health stylist?" is too goofy.

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
  "focusFields": ["primary academic field", "secondary field if cross-domain, omit if single-domain"]
}`;

  let theme = candidateInterests[0].keyword;
  let searchQueries: string[] = [candidateInterests[0].keyword];
  let newsQuery = candidateInterests[0].keyword;
  let focusFields: string[] = [candidateInterests[0].field || "Computer Science"];
  let selectedInterestKeywords: string[] = [candidateInterests[0].keyword];

  try {
    console.log(`[Digest] Step 1: generating central question from [${candidateInterests.map(i => i.keyword).join(", ")}]...`);
    const hypothesisResp = await aiComplete(
      aiConfig,
      "You generate surprising, curiosity-provoking central questions for a daily research digest. Return only JSON.",
      hypothesisPrompt
    );
    type HypothesisResult = { theme?: string; searchQueries?: string[]; newsQuery?: string; focusFields?: string[]; focusField?: string; selectedInterests?: string[] };
    const parsed = extractJson<HypothesisResult>(hypothesisResp);
    if (!parsed) throw new Error("No JSON in hypothesis response");
    if (parsed.theme) theme = parsed.theme;
    if (parsed.searchQueries && parsed.searchQueries.length > 0) searchQueries = parsed.searchQueries;
    if (parsed.newsQuery) newsQuery = parsed.newsQuery;
    if (parsed.focusFields && parsed.focusFields.length > 0) {
      focusFields = parsed.focusFields;
    } else if (parsed.focusField) {
      focusFields = [parsed.focusField];
    }
    if (parsed.selectedInterests && parsed.selectedInterests.length > 0) selectedInterestKeywords = parsed.selectedInterests;

    // Theme validation: enforce max 8 words, retry once if violated
    const wordCount = theme.split(/\s+/).length;
    if (wordCount > 8) {
      console.log(`[Digest] Theme "${theme}" is ${wordCount} words (max 8), requesting shorter version...`);
      try {
        const retryResp = await aiComplete(aiConfig,
          "You shorten headlines. Return only JSON.",
          `Shorten this to MAX 8 WORDS while keeping the surprise value. Return JSON: {"theme": "shorter version"}\n\nOriginal: "${theme}"`
        );
        const retryParsed = extractJson<{ theme?: string }>(retryResp);
        if (retryParsed) {
          if (retryParsed.theme && retryParsed.theme.split(/\s+/).length <= 8) {
            console.log(`[Digest] Theme shortened: "${retryParsed.theme}"`);
            theme = retryParsed.theme;
          }
        }
      } catch { /* keep the original if retry fails */ }
    }

    // Theme novelty: skip if too many keywords overlap with a recent theme
    const recentThemeTexts = recentDigestsForRotation
      .map(d => d.theme).filter(Boolean) as string[];
    if (recentThemeTexts.length > 0) {
      const themeWords = new Set(theme.toLowerCase().split(/\s+/).filter(w => w.length > 3 && !STOP_WORDS.has(w)));
      const tooSimilar = recentThemeTexts.some(rt => {
        const rtWords = rt.toLowerCase().split(/\s+/).filter(w => w.length > 3 && !STOP_WORDS.has(w));
        const overlap = rtWords.filter(w => themeWords.has(w)).length;
        return overlap >= 2;
      });
      if (tooSimilar) {
        console.log(`[Digest] Theme "${theme}" overlaps with a recent theme — requesting fresh angle...`);
        try {
          const noveltyResp = await aiComplete(aiConfig,
            "You generate surprising research questions. Return only JSON.",
            `This theme is too similar to a recent one. Generate a COMPLETELY DIFFERENT angle — different TOPIC, not just different phrasing.\n\nToo-similar theme: "${theme}"\nRecent themes (DO NOT repeat any of these topics): ${recentThemeTexts.map(t => `"${t}"`).join(", ")}\nInterests: ${interestList}\n\nReturn JSON: {"theme": "fresh angle MAX 8 WORDS", "searchQueries": ["q1","q2","q3"], "newsQuery": "2-4 keywords"}`
          );
          const noveltyParsed = extractJson<{ theme?: string; searchQueries?: string[]; newsQuery?: string }>(noveltyResp);
          if (noveltyParsed?.theme) {
            theme = noveltyParsed.theme;
            if (noveltyParsed.searchQueries && noveltyParsed.searchQueries.length > 0) searchQueries = noveltyParsed.searchQueries;
            if (noveltyParsed.newsQuery) newsQuery = noveltyParsed.newsQuery;
            console.log(`[Digest] Fresh theme: "${theme}"`);
          }
        } catch { /* keep original if novelty retry fails */ }
      }
    }

    console.log(`[Digest] Central question: "${theme}"`);
    console.log(`[Digest] Search queries: ${searchQueries.join(" | ")} [fields: ${focusFields.join(", ")}]`);
  } catch (err) {
    console.log(`[Digest] Hypothesis generation failed (${err}), using fallback`);
  }

  // Primary interest for learning system feedback
  const focusInterest = selectedInterestKeywords[0];
  const focusInterestObj = candidateInterests.find(i => i.keyword === focusInterest) ?? candidateInterests[0];
  const focusLevel = (focusInterestObj.level ?? "beginner") as "beginner" | "intermediate" | "expert";

  // ─── Theme → Search → Score loop: retry with new theme if papers don't match ───
  const MAX_THEME_RETRIES = 2;
  let themeEmb: number[] = [];
  let allResults: PaperSearchResult[] = [];
  let resultEmbs: number[][] = [];
  let scored: { p: PaperSearchResult; themeSim: number; score: number }[] = [];
  let qualified: typeof scored = [];
  let threshold = SIM_ONTOPIC;
  const SIM_MIN_THEME = 0.15; // hard floor — filters truly unrelated papers while allowing cross-domain picks

  for (let themeAttempt = 0; themeAttempt <= MAX_THEME_RETRIES; themeAttempt++) {
  if (themeAttempt > 0) {
    console.log(`[Digest] Theme "${theme}" produced too few papers — generating new theme (attempt ${themeAttempt + 1})...`);
    try {
      const retryResp = await aiComplete(aiConfig,
        "You generate surprising research questions. Return only JSON.",
        `The theme "${theme}" didn't find enough academic papers. Generate a COMPLETELY DIFFERENT theme that is more likely to have published research.\n\nInterests: ${interestList}\nFailed themes (avoid these topics entirely): ${[theme].join(", ")}\n\nPick a concrete, researchable angle — not abstract philosophy. "How does X affect Y?" finds papers. "Do machines dream?" does not.\n\nReturn JSON: {"theme": "MAX 8 WORDS", "searchQueries": ["q1","q2","q3"], "newsQuery": "2-4 keywords", "focusFields": ["field1"]}`
      );
      const retryParsed = extractJson<{ theme?: string; searchQueries?: string[]; newsQuery?: string; focusFields?: string[] }>(retryResp);
      if (retryParsed?.theme) {
        theme = retryParsed.theme;
        if (retryParsed.searchQueries && retryParsed.searchQueries.length > 0) searchQueries = retryParsed.searchQueries;
        if (retryParsed.newsQuery) newsQuery = retryParsed.newsQuery;
        if (retryParsed.focusFields && retryParsed.focusFields.length > 0) focusFields = retryParsed.focusFields;
        console.log(`[Digest] New theme: "${theme}"`);
      }
    } catch { /* keep current theme if retry fails */ }
  }

  // Embed the central question
  console.log(`[Digest] Embedding central question...`);
  themeEmb = await embedText(theme);
  if (themeAttempt === 0 && isEmbeddingDegraded()) {
    console.warn(`[Digest] ⚠ ONNX unavailable — running in DEGRADED mode. Similarity gates use keyword fallback.`);
  }

  // ─── Step 2: Search for papers using all generated queries ───────────────────
  // When cross-domain (2+ fields), split queries across fields for better coverage
  console.log(`[Digest] Step 2: searching papers with ${searchQueries.length} queries across ${focusFields.length} field(s)...`);
  allResults = [];
  const seenSearchTitles = new Set<string>();

  for (let qi = 0; qi < searchQueries.length; qi++) {
    const query = searchQueries[qi];
    // Distribute queries across fields: query 0 → field 0, query 1 → field 1, etc.
    const fieldForQuery = focusFields[qi % focusFields.length];
    console.log(`[Digest] Query: "${query}" [field: ${fieldForQuery}]`);
    try {
      const results = await searchPapers(query, 10, "publicationDate", fieldForQuery);
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

  // Retry without field filter if first pass found too few papers
  if (allResults.length < 3) {
    console.log(`[Digest] Only ${allResults.length} results — retrying without field filter...`);
    for (const query of searchQueries) {
      try {
        const results = await searchPapers(query, 10, "publicationDate", undefined);
        for (const p of results) {
          const key = p.title.toLowerCase();
          if (!seenSearchTitles.has(key)) {
            seenSearchTitles.add(key);
            allResults.push(p);
          }
        }
      } catch { /* already logged */ }
      await delay(300);
    }
    console.log(`[Digest] After retry: ${allResults.length} total candidates`);
  }

  if (allResults.length === 0) {
    console.log(`[Digest] No papers found for "${theme}" — will retry with new theme`);
    continue; // retry with new theme
  }

  // ─── Step 3: Hybrid scoring — BM25 + embeddings + RRF ───────────────────────
  // Research: Cormack et al. (2009) RRF, Kotkov et al. (2016) serendipity factors
  resultEmbs = await embedBatch(allResults.map(paperText));
  const currentYear = new Date().getFullYear();

  // Signal 1: Embedding similarity (semantic meaning)
  const embeddingSims = allResults.map((_, i) => cosineSimilarity(themeEmb, resultEmbs[i]));
  // Signal 2: BM25 (keyword matching — catches specific terms embeddings miss)
  const bm25Scores = bm25Score(theme, allResults.map(paperText));
  // Fuse with Reciprocal Rank Fusion
  const rrfScores = rrfFuse([embeddingSims, bm25Scores]);

  scored = allResults
    .map((p, i) => {
      const themeSim = embeddingSims[i];
      const rrfScore = rrfScores[i];
      const age = p.year ? currentYear - p.year : 2;
      const recencyBonus = age <= 0 ? 0.003 : age === 1 ? 0.0015 : 0;
      const venueBoost = venueQualityBoost(p.venueName, p.primaryDomain) * 0.3;
      const score = rrfScore + recencyBonus + venueBoost;
      if (venueBoost !== 0) {
        console.log(`[Digest] Venue signal: "${p.title.slice(0, 50)}" ${venueBoost > 0 ? "+" : ""}${venueBoost.toFixed(4)} (${p.venueName || "unknown"})`);
      }
      return { p, themeSim, score };
    })
    .filter(({ p }) => !seenPaperTitles.has(p.title.toLowerCase()))
    .filter(({ p }) => !isPredatoryVenue(p.venueName))
    .filter(({ themeSim }) => themeSim >= SIM_MIN_THEME)
    .sort((a, b) => b.score - a.score);

  // Use raw themeSim for qualification (not RRF score) — keeps thresholds interpretable
  // Cascade: SIM_ONTOPIC (strong) → SIM_MIDPOINT (moderate) → SIM_FALLBACK (last resort)
  // Only break the theme retry loop early when papers pass SIM_ONTOPIC — weaker matches
  // mean the theme and paper pool don't align well, so prefer a fresh theme over bad papers.
  threshold = SIM_ONTOPIC;
  qualified = scored.filter(({ themeSim }) => themeSim > threshold);
  if (qualified.length < 2) {
    threshold = SIM_MIDPOINT;
    qualified = scored.filter(({ themeSim }) => themeSim > threshold);
    if (qualified.length >= 2) {
      console.log(`[Digest] Fell back to SIM_MIDPOINT (${SIM_MIDPOINT}) — ${qualified.length} papers`);
    }
  }
  if (qualified.length < 2) {
    threshold = SIM_FALLBACK;
    qualified = scored.filter(({ themeSim }) => themeSim > threshold);
    if (qualified.length >= 2) {
      console.log(`[Digest] Fell back to SIM_FALLBACK (${SIM_FALLBACK}) — ${qualified.length} papers (weak match, prefer retry)`);
    }
  }
  if (qualified.length < 2) {
    threshold = SIM_MIN_THEME;
    qualified = scored.filter(({ themeSim }) => themeSim > threshold);
    if (qualified.length > 0) {
      console.log(`[Digest] Using hard-floor threshold (${SIM_MIN_THEME}) — only ${qualified.length} papers passed`);
    }
  }
  console.log(`[Digest] ${qualified.length} candidates above threshold (${threshold}), top RRF: ${scored[0]?.score.toFixed(4)} (theme: ${scored[0]?.themeSim.toFixed(2)})`);

  // Break only if we have strong matches — weak matches (below SIM_MIDPOINT) should
  // trigger a theme retry if we haven't exhausted attempts yet.
  const hasStrongMatch = qualified.length >= 2 && threshold >= SIM_MIDPOINT;
  const hasFallbackMatch = qualified.length >= 2 && threshold < SIM_MIDPOINT;
  if (hasStrongMatch) break;
  if (hasFallbackMatch && themeAttempt >= MAX_THEME_RETRIES - 1) {
    console.log(`[Digest] Accepting fallback-quality papers (exhausted theme retries)`);
    break;
  }

  // On last attempt, take whatever we have
  if (themeAttempt === MAX_THEME_RETRIES) {
    if (qualified.length === 0 && scored.length > 0) {
      console.log(`[Digest] Final attempt — taking top ${Math.min(3, scored.length)} by score`);
      qualified = scored.slice(0, Math.min(3, scored.length));
    }
    break;
  }
  } // end theme retry loop

  if (qualified.length === 0 && allResults.length === 0) {
    throw new Error(`Couldn't find papers for "${theme}". Search APIs might be rate-limited. Wait a minute and try again.`);
  }

  // Dynamic item count: only upgrade to all-papers when we have abundant strong matches.
  // Never downgrade paper slots to news — the fill passes find additional papers via
  // progressive threshold relaxation, and news rarely improves digest quality.
  const strongPapers = scored.filter(({ themeSim }) => themeSim > SIM_ONTOPIC).length;
  if (strongPapers >= 3) {
    targetPapers = TOTAL_ITEMS;
    targetNews = 0;
    console.log(`[Digest] Dynamic: ${strongPapers} strong papers → all-papers (${targetPapers}p+${targetNews}n)`);
  }
  // Otherwise keep default 2+1 — fill passes will find papers at lower thresholds

  // ─── Wide pool + LLM selection for complementarity ──────────────────────────
  // Select a WIDER pool (~6) via MMR for diversity, then let the LLM pick the
  // best subset for complementarity. Embeddings find relevance, but only the
  // LLM can assess whether papers complement each other for an argument.
  const WIDE_POOL_SIZE = Math.min(6, qualified.length);
  const MMR_LAMBDA = 0.6;
  const widePool: TaggedItem[] = [];
  const seenTitles = new Set<string>(seenPaperTitles);
  const selectedEmbs: number[][] = [];
  const mmrCandidates = [...qualified.filter(({ p }) => !seenTitles.has(p.title.toLowerCase()))];

  for (let slot = 0; slot < WIDE_POOL_SIZE && mmrCandidates.length > 0; slot++) {
    let bestIdx = 0;
    let bestMmr = -Infinity;

    for (let i = 0; i < mmrCandidates.length; i++) {
      const { score } = mmrCandidates[i];
      let maxSimToSelected = 0;
      const candidateEmb = resultEmbs[allResults.indexOf(mmrCandidates[i].p)];
      if (candidateEmb) {
        for (const selEmb of selectedEmbs) {
          const sim = cosineSimilarity(candidateEmb, selEmb);
          if (sim > maxSimToSelected) maxSimToSelected = sim;
        }
      }
      const mmrScore = MMR_LAMBDA * score - (1 - MMR_LAMBDA) * maxSimToSelected;
      if (mmrScore > bestMmr) { bestMmr = mmrScore; bestIdx = i; }
    }

    const pick = mmrCandidates[bestIdx];
    const pickEmb = resultEmbs[allResults.indexOf(pick.p)];
    if (pickEmb) selectedEmbs.push(pickEmb);

    widePool.push({
      title: pick.p.title, authors: pick.p.authors, abstract: pick.p.abstract,
      sourceUrl: pick.p.sourceUrl, pdfUrl: pick.p.pdfUrl || undefined,
      source: pick.p.source, year: pick.p.year,
      category: slot === 0 ? "foundational" : "recent",
    });
    seenTitles.add(pick.p.title.toLowerCase());
    console.log(`[Digest] Wide pool ${slot + 1}/${WIDE_POOL_SIZE}: "${pick.p.title}" (score ${pick.score.toFixed(4)}, theme ${pick.themeSim.toFixed(2)})`);
    mmrCandidates.splice(bestIdx, 1);
  }

  // If wide pool is empty, skip LLM selection — the fill passes will try harder
  let items: TaggedItem[];
  if (widePool.length === 0) {
    console.log(`[Digest] Wide pool empty — no papers passed threshold. Fill passes will try broader search.`);
    items = [];
  } else if (widePool.length <= targetPapers) {
    items = widePool;
    console.log(`[Digest] Wide pool has only ${widePool.length} papers, using all`);
  } else {
    console.log(`[Digest] LLM selecting best ${targetPapers} from ${widePool.length} candidates for complementarity...`);
    try {
      const selectionResp = await aiComplete(
        aiConfig,
        "You select research papers that complement each other for a synthesis argument. Return only JSON.",
        selectionSkeletonPrompt(
          widePool.map(p => ({ title: p.title, abstract: p.abstract, source: p.source, category: p.category, year: p.year })),
          theme,
          targetPapers
        )
      );
      const selection = extractJson<{ selectedIndices?: number[]; selectionReasoning?: string; coreInsight?: string }>(selectionResp);
      if (selection) {
        const indices: number[] = selection.selectedIndices || [];
        if (indices.length >= 2) {
          items = indices
            .filter((i: number) => i >= 1 && i <= widePool.length)
            .map((i: number) => widePool[i - 1]);
          console.log(`[Digest] LLM selected ${items.length} papers: ${selection.selectionReasoning || ""}`);
          console.log(`[Digest] Tension: ${selection.coreInsight || "none identified"}`);
        } else {
          items = widePool.slice(0, targetPapers);
          console.log(`[Digest] LLM returned too few indices, using top ${targetPapers}`);
        }
      } else {
        items = widePool.slice(0, targetPapers);
        console.log(`[Digest] Selection parse failed, using top ${targetPapers}`);
      }
    } catch (err) {
      items = widePool.slice(0, targetPapers);
      console.log(`[Digest] Selection LLM failed (${err}), using top ${targetPapers}`);
    }
  }


  // themeWords used for news validation (short snippets don't embed well)
  const themeWords = theme.toLowerCase()
    .split(/\s+/)
    .filter(w => w.length > 3 && !STOP_WORDS.has(w));

  // ─── Step 4: Fill remaining slots (news and/or papers) ───────────────────────
  const newsNeeded = targetNews;

  // Find news items if needed
  if (newsNeeded > 0) {
    const currentSearchYear = new Date().getFullYear();
    const newsSearchTerms = `${newsQuery} ${focusInterest} ${currentSearchYear - 1} ${currentSearchYear}`;
    console.log(`[Digest] Step 4: finding ${newsNeeded} news via web search: "${newsSearchTerms}"`);
    const webResults = await webSearch(newsSearchTerms, newsNeeded * 3);

    const newsTexts = webResults.map(r => `${r.title}. ${r.snippet}`);
    const newsEmbs = newsTexts.length > 0 ? await embedBatch(newsTexts) : [];
    const scoredNews = webResults
      .map((result, i) => ({ result, sim: cosineSimilarity(themeEmb, newsEmbs[i]) }))
      .filter(({ result }) => !isListicle(result.title, result.source))
      .filter(({ result }) => !isAcademicDomain(result.link))
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
      const rss = await fetchRssArticles(newsTerms, 10, focusFields[0]);
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

  // Fill remaining slots — progressively relax constraints to guarantee TOTAL_ITEMS
  // Pass 1: use third search query with moderate threshold
  if (items.length < TOTAL_ITEMS) {
    console.log(`[Digest] Filling ${TOTAL_ITEMS - items.length} remaining slot(s)...`);
    await delay(500);
    const fillQuery = searchQueries[2] || `${focusInterest} applications`;
    const fillResults = await searchPapers(fillQuery, 10, "citationCount", focusFields[0]);
    const fillEmbs = await embedBatch(fillResults.map(paperText));
    for (let fi = 0; fi < fillResults.length; fi++) {
      if (items.length >= TOTAL_ITEMS) break;
      const paper = fillResults[fi];
      if (seenTitles.has(paper.title.toLowerCase())) continue;
      const sim = cosineSimilarity(themeEmb, fillEmbs[fi]);
      if (sim > SIM_FALLBACK) { // use FALLBACK, not ONTOPIC — this is a fill, be less strict
        items.push({
          title: paper.title, authors: paper.authors, abstract: paper.abstract,
          sourceUrl: paper.sourceUrl, pdfUrl: paper.pdfUrl || undefined,
          source: paper.source, category: "recent",
          year: paper.year,
        });
        seenTitles.add(paper.title.toLowerCase());
        console.log(`[Digest] Fill paper: "${paper.title}" (sim ${sim.toFixed(2)})`);
      }
    }
  }

  // Pass 2: broad search on focus interest, no field filter, lowest threshold
  if (items.length < TOTAL_ITEMS) {
    console.log(`[Digest] Still ${items.length}/${TOTAL_ITEMS}, broad fill without field filter...`);
    await delay(500);
    const broadResults = await searchPapers(focusInterest, 12, "publicationDate", undefined); // no field filter
    const broadEmbs = await embedBatch(broadResults.map(paperText));
    for (let bi = 0; bi < broadResults.length; bi++) {
      if (items.length >= TOTAL_ITEMS) break;
      const paper = broadResults[bi];
      if (seenTitles.has(paper.title.toLowerCase())) continue;
      const sim = cosineSimilarity(themeEmb, broadEmbs[bi]);
      if (sim > SIM_MIN_THEME) { // hard floor — accept anything somewhat related
        items.push({
          title: paper.title, authors: paper.authors, abstract: paper.abstract,
          sourceUrl: paper.sourceUrl, pdfUrl: paper.pdfUrl || undefined,
          source: paper.source, year: paper.year,
          category: "recent",
        });
        seenTitles.add(paper.title.toLowerCase());
        console.log(`[Digest] Broad fill: "${paper.title}" (sim ${sim.toFixed(2)})`);
      }
    }
  }

  // Pass 3: search using the theme itself as query (last resort)
  if (items.length < TOTAL_ITEMS) {
    console.log(`[Digest] Still ${items.length}/${TOTAL_ITEMS}, searching with theme text...`);
    await delay(300);
    const themeResults = await searchPapers(theme, 10, "publicationDate", undefined);
    const themeResultEmbs = await embedBatch(themeResults.map(paperText));
    for (let ti = 0; ti < themeResults.length; ti++) {
      if (items.length >= TOTAL_ITEMS) break;
      const paper = themeResults[ti];
      if (seenTitles.has(paper.title.toLowerCase())) continue;
      const sim = cosineSimilarity(themeEmb, themeResultEmbs[ti]);
      if (sim > SIM_MIN_THEME) {
        items.push({
          title: paper.title, authors: paper.authors, abstract: paper.abstract,
          sourceUrl: paper.sourceUrl, pdfUrl: paper.pdfUrl || undefined,
          source: paper.source, year: paper.year, category: "recent",
        });
        seenTitles.add(paper.title.toLowerCase());
        console.log(`[Digest] Theme fill: "${paper.title}" (sim ${sim.toFixed(2)})`);
      }
    }
  }

  // Last resort: if we have only 1 item, try one more broad news search to hit minimum 2
  if (items.length === 1) {
    console.log(`[Digest] Only 1 item — trying broad news search for a second source...`);
    try {
      const broadNewsResults = await webSearch(`${theme} ${focusInterest}`, 6);
      const broadNewsEmbs = broadNewsResults.length > 0 ? await embedBatch(broadNewsResults.map(r => `${r.title}. ${r.snippet}`)) : [];
      for (let i = 0; i < broadNewsResults.length && items.length < 2; i++) {
        const r = broadNewsResults[i];
        if (seenTitles.has(r.title.toLowerCase())) continue;
        if (isListicle(r.title, r.source)) continue;
        const sim = cosineSimilarity(themeEmb, broadNewsEmbs[i]);
        if (sim > 0.10) { // very lenient for the second source
          const articleText = await fetchArticleText(r.link);
          items.push({
            title: r.title, authors: [r.source],
            abstract: articleText.length > 200 ? articleText : r.snippet,
            sourceUrl: r.link, source: "rss", category: "news", year: new Date().getFullYear(),
          });
          seenTitles.add(r.title.toLowerCase());
          console.log(`[Digest] Broad news fill: "${r.title}" (sim ${sim.toFixed(2)})`);
        }
      }
    } catch (err) {
      console.log(`[Digest] Broad news search failed (${err})`);
    }
  }

  if (items.length === 0) {
    throw new Error(`Couldn't find any relevant content for "${theme}". Try regenerating or add more interests.`);
  }
  console.log(`[Digest] ${items.length} items ready (target was ${TOTAL_ITEMS}).`);

  // ─── Step 4b: LLM re-ranking — score papers as "tools to think with" ─────────
  // Embedding similarity finds topically related papers, but the product goal is
  // aspectual relevance: "does this offer a useful, surprising lens on the question?"
  // LLM re-ranking on the shortlist bridges this gap (audit 4.1).
  const paperItems = items.filter(i => i.category !== "news");
  if (paperItems.length >= 2) {
    try {
      const rerankList = paperItems.map((p, i) =>
        `[${i + 1}] "${p.title}" — ${p.abstract.slice(0, 250)}`
      ).join("\n");
      console.log(`[Digest] LLM re-ranking ${paperItems.length} papers for "tool to think with" quality...`);
      const rerankResp = await aiComplete(aiConfig,
        "You evaluate research papers. Return only JSON.",
        `Theme: "${theme}"

Score each paper on TWO dimensions:

RELEVANCE (1-3): Does this paper directly address the theme question?
- 3 = Directly speaks to the theme — a reader would immediately understand why it's here
- 2 = Related topic but the connection to the theme question requires some stretching
- 1 = Off-topic — shares surface words with the theme but doesn't illuminate the question at all

INSIGHT (1-3): Does this offer a surprising or useful lens (beyond just being relevant)?
- 3 = Changes how you think about the question or adds a genuinely unexpected angle
- 2 = Useful but fairly expected given the theme
- 1 = Relevant but adds nothing beyond confirming the obvious

SCORE RELEVANCE=1 when:
- The paper is about a topic that merely shares keywords with the theme but doesn't address the core question
- A smart reader would say "wait, what does this have to do with [theme]?"
- Example: "Plywood waste management" in "Can bacteria eat our waste?" — waste is there but bacteria aren't
- Example: "Classical Greek art history" in "Can external tools rewire behavior?" — too far a stretch

SCORE RELEVANCE=2 when:
- The paper is in the right area but the connection to the theme's specific question is indirect

Papers:
${rerankList}

Return JSON: {"scores": [{"index": 1, "relevance": N, "insight": N, "reason": "one sentence"}]}`
      );
      const rerankParsed = extractJson<{ scores?: { index: number; relevance?: number; insight?: number; score?: number; reason?: string }[] }>(rerankResp);
      if (rerankParsed) {
        const { scores } = rerankParsed;
        if (scores && scores.length > 0) {
          // Process worst papers first (by combined score) so best replacements go to worst slots
          const scoredItems = scores
            .map(s => ({ ...s, combined: (s.relevance ?? s.score ?? 3) + (s.insight ?? 3) }))
            .sort((a, b) => a.combined - b.combined);

          for (const { index, relevance, insight, score: legacyScore, reason, combined } of scoredItems) {
            const effectiveRelevance = relevance ?? (legacyScore != null ? Math.ceil(legacyScore / 2) : 3);
            const itemIdx = items.indexOf(paperItems[index - 1]);
            if (itemIdx < 0) continue;
            console.log(`[Digest] Re-rank: paper ${index} relevance=${effectiveRelevance} insight=${insight ?? "?"} combined=${combined} ("${reason?.slice(0, 60)}")`);

            const isOffTopic = effectiveRelevance <= 1;
            const isWeak = combined <= 3; // relevance=2 + insight=1 or similar

            if (isOffTopic || isWeak) {
              const replacement = qualified.find(({ p, themeSim }) =>
                !seenTitles.has(p.title.toLowerCase()) &&
                !items.some(it => it.title === p.title) &&
                themeSim > SIM_MIN_THEME
              );
              if (replacement) {
                const originalCategory = items[itemIdx].category;
                console.log(`[Digest] Swapping ${isOffTopic ? "off-topic" : "weak"} paper for "${replacement.p.title.slice(0, 40)}"`);
                items[itemIdx] = {
                  title: replacement.p.title, authors: replacement.p.authors,
                  abstract: replacement.p.abstract, sourceUrl: replacement.p.sourceUrl,
                  pdfUrl: replacement.p.pdfUrl || undefined,
                  source: replacement.p.source, year: replacement.p.year,
                  category: originalCategory,
                };
                seenTitles.add(replacement.p.title.toLowerCase());
              } else if (isOffTopic && items.length >= 3) {
                // No replacement, and the paper is genuinely off-topic (relevance=1).
                // Drop it: 2 good sources beat 3 with one the synthesis would have to
                // narrate as irrelevant ("doesn't weigh in on the question at all").
                console.log(`[Digest] Dropping off-topic paper "${items[itemIdx].title.slice(0, 40)}" — no replacement, ${items.length - 1} sources remain`);
                items.splice(itemIdx, 1);
              } else {
                // Weak-but-relevant, or dropping would leave <2 sources. Keep the paper —
                // the synthesis prompt decides how much airtime to give it (one honest
                // sentence, never narrated irrelevance).
                console.log(`[Digest] Keeping ${isOffTopic ? "off-topic" : "weak"} paper "${items[itemIdx].title.slice(0, 40)}" — no replacement in qualified pool`);
              }
            }
          }
        }
      }
    } catch (err) {
      console.log(`[Digest] LLM re-ranking failed (${err}), keeping embedding-ranked papers`);
    }
  }

  // ─── Step 5: Revise the theme to better thread the actual papers ─────────────
  // The original theme was generated BEFORE we found papers. Now that we know
  // what we actually have, ask the LLM to tighten it — or keep it if it already works.
  let finalTheme = theme;
  try {
    const paperList = items.map((p, i) =>
      `[${i + 1}] "${p.title}" — ${p.abstract.slice(0, 600)}`
    ).join("\n\n");

    const revisePrompt = `Original theme: "${theme}"

Papers we actually found:
${paperList}

Your job has TWO parts: accuracy first, then surprise.

PART 1 — ACCURACY: Does the original theme genuinely thread ALL the papers at their core?

KEEP the original theme if:
- All papers directly address the question the theme poses
- The theme captures what the papers are actually about, not just their surface topic
- A reader seeing the theme and papers together would say "yes, these obviously go together"

REVISE the theme if:
- The papers collectively reveal a deeper or different angle the original theme misses
- One or more papers feel like a stretch under the original framing
- The papers are really about X but the theme says Y

BAD revision: warping the theme to justify a loosely-related paper that should have been cut
GOOD revision: recognizing the papers are actually about evidence and trust, not just AI

BAD: "Does AI hype match real classroom results?" — when the papers are really about research reproducibility
GOOD: "Can we trust the research behind the hype?" — captures what ALL three papers actually share

PART 2 — SURPRISE: Once you have an accurate theme, ask: is there a more unexpected or counterintuitive way to frame this same insight?

The best themes make a reader stop and think "wait, really?" They hide a tension or reversal inside them.

GENERIC (accurate but forgettable):
- "How does AI shape human psychology?" — broad, expected, could describe 1000 papers
- "Can machines understand emotion?" — we've heard this question a thousand times
- "AI and creativity" — a topic label, not a question worth asking

SURPRISING (accurate AND makes you think):
- "Why do AI tutors make kids worse at reading?" — specific, counterintuitive, has a villain
- "The expert is often the last to know" — implies a reversal, feels true and uncomfortable
- "Your brain lies to you. So does the model." — parallel structure with a sting

Ask yourself: if someone saw ONLY the theme, would they immediately think "I know what this is about" (bad) or "wait, tell me more" (good)? Aim for the second.

Rules:
- MAX 8 WORDS
- Must connect ALL papers at their CORE, not their surface topic
- A normal person should want to click on it
- If the original is already both accurate AND surprising, keep it unchanged

Return JSON only: {"theme": "catchy headline MAX 8 WORDS — question or statement", "kept_original": true|false}`;

    console.log(`[Digest] Step 5: revising theme to fit actual papers...`);
    const reviseResp = await aiComplete(aiConfig, "You refine central questions for research digests. Return only JSON.", revisePrompt);
    const reviseParsed = extractJson<{ theme?: string; kept_original?: boolean }>(reviseResp);
    if (reviseParsed?.theme) {
      if (reviseParsed.kept_original) {
        console.log(`[Digest] Theme kept: "${reviseParsed.theme}" (original fits papers well)`);
      } else {
        console.log(`[Digest] Theme revised: "${reviseParsed.theme}" (was: "${theme}")`);
      }
      finalTheme = reviseParsed.theme;
    }
  } catch (err) {
    console.log(`[Digest] Theme revision failed (${err}), keeping original`);
  }

  // ─── Step 6: Multi-stage synthesis ──────────────────────────────────────────
  // Research: Yao 2023 (Tree of Thoughts), Radev 2000 (CST), Madaan 2023 (Self-Refine)
  const paperListing = items.map(p => ({
    title: p.title, abstract: p.abstract, source: p.source, category: p.category, year: p.year,
    tensionHint: p.tensionHint, authors: p.authors,
  }));
  const synthesisCtx = { focusInterest, focusLevel, researchAngle: finalTheme };

  // Stage A: Metadata (items, keywords, findings, keyConcepts)
  console.log(`[Digest] Stage A: generating metadata...`);
  const metadataResp = await aiComplete(aiConfig, SYNTHESIS_SYSTEM, metadataPrompt(paperListing, finalTheme, synthesisCtx));
  let metadata: { items: DigestAIResponse["items"]; keyConcepts: string[]; suggestedQuestions?: string[] };
  try {
    const metaParsed = extractJson<typeof metadata>(metadataResp);
    if (!metaParsed) throw new Error("No JSON");
    metadata = metaParsed;
  } catch {
    console.log(`[Digest] Metadata parse failed, using empty defaults`);
    metadata = { items: items.map((_, i) => ({ index: i + 1, summary: "", keywords: [], findings: [] })), keyConcepts: [], suggestedQuestions: [] };
  }

  // Sanity check: each summary must share content words with its paper's abstract+title.
  // If not, the LLM hallucinated or swapped content across papers — fall back to a safe
  // auto-summary built from the abstract's first sentence.
  const metaStop = new Set(["the", "this", "that", "with", "from", "about", "their", "these", "those", "been", "have", "will", "what", "when", "where", "which", "there", "into", "over", "under", "more", "most", "than", "then", "also", "just", "other", "study", "paper", "research", "found", "shows", "result", "results", "method"]);
  const contentWords = (s: string) => new Set(
    s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/)
      .filter(w => w.length > 3 && !metaStop.has(w))
  );
  metadata.items = metadata.items.map((aiItem) => {
    const paperIdx = aiItem.index - 1;
    const paper = items[paperIdx];
    if (!paper || !aiItem.summary) return aiItem;
    const paperWords = contentWords(`${paper.title} ${paper.abstract}`);
    const summaryWords = [...contentWords(aiItem.summary)];
    const overlap = summaryWords.filter(w => paperWords.has(w)).length;
    if (overlap < 2 && summaryWords.length >= 3) {
      const fallback = (paper.abstract.match(/[^.!?]+[.!?]/)?.[0] ?? paper.abstract.slice(0, 180)).trim();
      console.log(`[Digest] Summary for paper ${aiItem.index} looked disconnected from abstract (overlap=${overlap}). Falling back to abstract lead.`);
      return { ...aiItem, summary: fallback };
    }
    return aiItem;
  });

  // Stage B: Skeleton (cross-document relations + argument outline)
  console.log(`[Digest] Stage B: building argument skeleton...`);
  const skeletonResp = await aiComplete(
    aiConfig,
    "You analyze relationships between research papers and plan argument structures. Return only JSON.",
    skeletonPrompt(paperListing, finalTheme)
  );
  let skeleton: {
    paperRelations?: { paper1: number; paper2: number; relation: string; explanation: string }[];
    paperRoles: { index: number; role: string; shortName: string; coreContribution: string }[];
    coreInsight: string;
    argumentArc: string;
    skipPapers?: number[];
  };
  try {
    const skelParsed = extractJson<typeof skeleton>(skeletonResp);
    if (!skelParsed) throw new Error("No JSON");
    skeleton = skelParsed;
    console.log(`[Digest] Skeleton: tension="${skeleton.coreInsight}"`);

    // Note: we no longer drop papers here — the LLM selection step earlier handles quality.
    // Dropping at this stage caused digests to shrink to 1 item with no way to refill.
    // The skeleton can still flag weak papers, and the synthesis prompt will handle them
    // (mention briefly or skip in the text, but keep them in the digest sources).
  } catch {
    console.log(`[Digest] Skeleton parse failed, using simple fallback`);
    skeleton = {
      paperRoles: items.map((p, i) => ({ index: i + 1, role: "supports", shortName: p.title.split(/\s+/).slice(0, 4).join(" "), coreContribution: "evidence" })),
      coreInsight: `What "${finalTheme}" really means according to these papers`,
      argumentArc: "Present each paper's perspective, then find the thread",
    };
  }

  // Rebuild paperListing after skeleton may have dropped papers
  const finalPaperListing = items.map(p => ({
    title: p.title, abstract: p.abstract, source: p.source, category: p.category, year: p.year,
    tensionHint: p.tensionHint,
  }));

  // Stage C: Draft synthesis from skeleton
  console.log(`[Digest] Stage C: drafting synthesis from skeleton...`);
  let synthesis = await aiComplete(
    aiConfig,
    SYNTHESIS_PROSE_SYSTEM,
    synthesisFromSkeletonPrompt(finalPaperListing, finalTheme, skeleton)
  );
  synthesis = stripFences(synthesis);

  // Factual accuracy check: verify each paper's takeaway is reflected correctly
  try {
    const factCheckResp = await aiComplete(
      aiConfig,
      "You verify factual accuracy of research synthesis paragraphs. Return only JSON.",
      `Check if this synthesis ACCURATELY reflects each paper's actual findings. Flag any paper whose contribution is misrepresented, exaggerated, or missing key nuance.

Theme: "${finalTheme}"

Papers and their actual findings:
${items.map((p, i) => {
  const aiItem = metadata.items.find(x => x.index === i + 1);
  return `[${i + 1}] "${p.title}"\nFindings: ${(aiItem?.findings || []).join("; ")}\nSummary: ${aiItem?.summary || p.abstract.slice(0, 200)}`;
}).join("\n\n")}

Synthesis:
"""
${synthesis}
"""

Return JSON:
{
  "accurate": true,
  "issues": [
    { "paperIndex": 1, "problem": "what's wrong", "fix": "what the synthesis should say instead" }
  ]
}`
    );
    const factCheck = extractJson<{ accurate?: boolean; issues?: { paperIndex: number; problem: string; fix: string }[] }>(factCheckResp);
    if (factCheck && factCheck.issues && factCheck.issues.length > 0 && !factCheck.accurate) {
      const issueDesc = factCheck.issues.map(i => `Paper ${i.paperIndex}: ${i.problem} → ${i.fix}`).join("; ");
      console.log(`[Digest] Factual issues found: ${issueDesc}`);
      const paperNames = skeleton.paperRoles.map(r => `**${r.shortName}**`).join(", ");
      const factRevision = await aiComplete(
        aiConfig,
        SYNTHESIS_PROSE_SYSTEM,
        `Fix these factual accuracy issues in the synthesis. Keep the same tone and style.

CRITICAL: ALL these papers MUST remain referenced in bold: ${paperNames}. Do NOT drop any paper.
CRITICAL: Keep the EXACT structure of the original — intro, one "- **[Source N] name**" bullet per paper (1–3 sentences each, HARD MAX 3), "> bridge" lines between bullets, one closing sentence. Fix ONLY the flagged facts; do not expand bullets or turn the structure into prose. Never write that a source "doesn't address" or "doesn't weigh in on" the theme.

Issues: ${issueDesc}

Current synthesis:
"""
${synthesis}
"""

Return ONLY the corrected synthesis.`
      );
      const revised = stripFences(factRevision);
      if (revised.length > 50) {
        synthesis = revised;
        console.log(`[Digest] Factual accuracy revision applied`);
      }
    } else {
      console.log(`[Digest] Factual accuracy check passed`);
    }
  } catch (err) {
    console.log(`[Digest] Factual accuracy check failed (${err}), proceeding`);
  }

  // Stage D: Self-Refine (critique → revision)
  console.log(`[Digest] Stage D: self-critique...`);
  try {
    const critiqueResp = await aiComplete(
      aiConfig,
      "You are a tough editor who evaluates research synthesis quality. Return only JSON.",
      synthesisCritiquePrompt(
        synthesis, finalTheme, items.map(p => p.title),
        skeleton.paperRoles.map(r => r.shortName)
      )
    );
    const critique = extractJson<{ scores?: Record<string, number>; weakestPoint?: string; revision?: string; bannedPhrasesFound?: string[] }>(critiqueResp);
    if (critique) {
      const scores = critique.scores || {};
      const minScore = Math.min(scores.argument || 5, scores.connection || 5, scores.accessibility || 5, scores.specificity || 5, scores.coverage || 5, scores.freshness || 5);
      const banned = critique.bannedPhrasesFound || [];
      console.log(`[Digest] Critique scores: arg=${scores.argument} conn=${scores.connection} acc=${scores.accessibility} spec=${scores.specificity} cov=${scores.coverage} fresh=${scores.freshness}${banned.length ? ` bannedPhrases=[${banned.slice(0, 3).join(", ")}]` : ""}`);

      if (minScore < 4 && critique.weakestPoint && critique.revision) {
        console.log(`[Digest] Revising (weakest: ${critique.weakestPoint})...`);
        const revised = await aiComplete(
          aiConfig,
          SYNTHESIS_PROSE_SYSTEM,
          synthesisRevisionPrompt(synthesis, { weakestPoint: critique.weakestPoint!, revision: critique.revision!, bannedPhrasesFound: banned }, finalTheme, skeleton.paperRoles.map(r => `**[Source ${r.index}] ${r.shortName}**`))
        );
        const cleanRevised = stripFences(revised);
        if (cleanRevised.length > 50) {
          synthesis = cleanRevised;
          console.log(`[Digest] Revision applied (${cleanRevised.length} chars)`);
        }
      } else {
        console.log(`[Digest] Synthesis passed critique (min score ${minScore}), no revision needed`);
      }
    }
  } catch (err) {
    console.log(`[Digest] Self-refine failed (${err}), keeping draft synthesis`);
  }

  // ─── Final coverage gate: ensure ALL papers are mentioned with [Source N] ────
  // Strictly require [Source N] prefix — shortName in bold without prefix doesn't count,
  // because the frontend relies on the prefix to map highlights to the correct paper.
  const findMissing = () => {
    return skeleton.paperRoles.filter(r => {
      const sourceTag = `[source ${r.index}]`;
      return !synthesis.toLowerCase().includes(sourceTag);
    });
  };

  const missingPapers = findMissing();
  if (missingPapers.length > 0) {
    const missingDesc = missingPapers.map(r => `"${r.shortName}" (Paper ${r.index}: ${r.coreContribution})`).join(", ");
    console.log(`[Digest] Final coverage gap: ${missingPapers.length} paper(s) missing: ${missingDesc}`);
    try {
      const coverageRevision = await aiComplete(
        aiConfig,
        SYNTHESIS_PROSE_SYSTEM,
        `This synthesis is MISSING ${missingPapers.length} paper(s). You MUST add them.

Theme: "${finalTheme}"
Missing papers — use EXACTLY these bold references:
${missingPapers.map(r => `- **[Source ${r.index}] ${r.shortName}**`).join("\n")}

Current synthesis:
"""
${synthesis}
"""

Rewrite to INCLUDE the missing paper(s) using the exact **[Source N] name** format above. Weave them into the argument naturally. Keep the same tone and length. Return ONLY the revised paragraph.`
      );
      const revised = stripFences(coverageRevision);
      if (revised.length > 50) {
        synthesis = revised;
        console.log(`[Digest] Final coverage revision applied — added ${missingPapers.length} missing paper(s)`);
      }
    } catch (err) {
      console.log(`[Digest] Final coverage revision failed (${err})`);
    }
  }

  // ─── Format enforcement: ensure synthesis uses "- **[Source N]" bullet structure ─
  const bulletCount = (synthesis.match(/^\s*-\s+\*\*\[source\s*\d+\]/gim) || []).length;
  if (bulletCount < skeleton.paperRoles.length) {
    console.log(`[Digest] Synthesis has ${bulletCount} bullets but expected ${skeleton.paperRoles.length} — reformatting...`);
    try {
      const reformatted = await aiComplete(
        aiConfig,
        SYNTHESIS_PROSE_SYSTEM,
        `The synthesis below must be converted to the required structure. Keep ALL the content and tone — just reformat.

REQUIRED STRUCTURE:
[One intro sentence]

${skeleton.paperRoles.map((r, idx, arr) => {
  const bullet = `- **[Source ${r.index}] ${r.shortName}** [1–3 sentences with a specific detail, HARD MAX 3]`;
  const bridge = idx < arr.length - 1 ? `\n\n> [one short bridge, max 12 words]` : "";
  return bullet + bridge;
}).join("\n\n")}

[One closing sentence]

Current synthesis to reformat:
"""
${synthesis}
"""

Return ONLY the reformatted synthesis. No JSON, no fences.`
      );
      const cleaned = stripFences(reformatted);
      if (cleaned.length > 100 && (cleaned.match(/^\s*-\s+\*\*\[source\s*\d+\]/gim) || []).length >= 1) {
        synthesis = cleaned;
        console.log(`[Digest] Format enforcement applied`);
      }
    } catch (err) {
      console.log(`[Digest] Format enforcement failed (${err}), keeping synthesis as-is`);
    }
  }

  const parsedAI: DigestAIResponse = {
    items: metadata.items,
    synthesis,
    keyConcepts: metadata.keyConcepts || [],
  };

  // Pre-generate answers for suggested questions (used in logged-out experience)
  const suggestedQuestions = metadata.suggestedQuestions || [];
  let suggestedAnswers: string[] = [];
  if (suggestedQuestions.length > 0) {
    console.log(`[Digest] Generating answers for ${suggestedQuestions.length} suggested questions...`);
    const papersContext = items.map((p, i) => {
      const aiItem = parsedAI.items.find(x => x.index === i + 1);
      return `PAPER ${i + 1}: ${p.title} (${p.year ?? "n/a"})\nAuthors: ${p.authors.slice(0, 3).join(", ")}\nSummary: ${aiItem?.summary ?? ""}\nKey findings: ${(aiItem?.findings || []).join("; ")}\nAbstract: ${(p.abstract ?? "").slice(0, 600)}`;
    }).join("\n\n");
    const answerSystem = `Answer the question directly — lead with the answer, not with context or paper summaries. No "based on the research" or "the study found" preambles. The reader already knows the digest. Just answer like you're in a group chat and already know they've seen it. 2-4 sentences max. Specific details beat vague claims.\n\nToday's synthesis:\n${synthesis}\n\n${papersContext}`;
    try {
      suggestedAnswers = await Promise.all(
        suggestedQuestions.map(q =>
          aiComplete(aiConfig, answerSystem, `Keep your answer to 3-4 sentences max. Be specific and concrete.\n\n${q}`)
            .catch(() => "")
        )
      );
      console.log(`[Digest] Generated ${suggestedAnswers.filter(a => a).length} answers`);
    } catch (err) {
      console.log(`[Digest] Answer generation failed (${err}), continuing without`);
    }
  }

  // Seed interests (drives header chips) — map the LLM's chosen keywords back to their field.
  const seedInterests = selectedInterestKeywords.map((kw) => {
    const match = candidateInterests.find(ci => ci.keyword.toLowerCase() === kw.toLowerCase());
    return { keyword: kw, field: match?.field || focusFields[0] || "Computer Science" };
  });

  // Gist (zero-click answer) + framing (curatorial provenance line) — one cheap call over the FINAL synthesis.
  let gist = "";
  let framing = "";
  try {
    const seedList = seedInterests.map(s => s.keyword).join(", ");
    const gistResp = await aiComplete(
      aiConfig,
      "You write punchy, plain-English digest headers that sound like a smart friend talking, not an AI. Return only JSON.",
      `Central question: "${finalTheme}"
Seed interests: ${seedList}

Today's synthesis:
${synthesis}

VOICE: Sound like a real person talking to a friend. Use contractions. Plain words. NO AI-speak — never use "quietly", "seamlessly", "notably", "delve", "leverage", "underscore", "landscape", "realm", "testament", "at the frontier". No em dashes. No "the studies show".

Return JSON (no markdown fences):
{
  "gist": "In ONE plain sentence (max 25 words), answer the central question the way the synthesis does. Lead with the answer, even if it's 'sort of' or 'it depends'.",
  "framing": "One short line (max 15 words) on why this is interesting — the tension or the surprising pairing across the papers. Straightforward and human. Grounded ONLY in the actual papers; never invent trends."
}`
    );
    const gp = extractJson<{ gist?: string; framing?: string }>(gistResp);
    if (gp?.gist) gist = gp.gist.trim();
    if (gp?.framing) framing = gp.framing.trim();
    console.log(`[Digest] Gist: "${gist}" | Framing: "${framing}"`);
  } catch (err) {
    console.log(`[Digest] Gist/framing generation failed (${err}), continuing without`);
  }

  const [digest] = await db.insert(digests).values({
    userId, date: today,
    theme: finalTheme,
    synthesisContent: parsedAI.synthesis,
    keyConcepts: JSON.stringify(parsedAI.keyConcepts || []),
    suggestedQuestions: JSON.stringify(suggestedQuestions),
    suggestedAnswers: JSON.stringify(suggestedAnswers),
    seedInterests: JSON.stringify(seedInterests),
    gist: gist || null,
    framing: framing || null,
  }).returning();

  await db.insert(papers).values(
    items.map((item, i) => {
      const aiItem = parsedAI.items.find(x => x.index === i + 1) || { summary: "", keywords: [], findings: [], connectionToTheme: "", plainName: "", takeaway: undefined };
      return {
        digestId: digest.id,
        title: item.title, authors: JSON.stringify(item.authors),
        abstract: item.abstract, fullText: item.abstract,
        summary: aiItem.summary, plainName: aiItem.plainName || null,
        takeawayHook: aiItem.takeaway?.hook || null,
        takeawayStat: aiItem.takeaway?.stat || null,
        takeawayLine: aiItem.takeaway?.line || null,
        source: item.source,
        sourceUrl: item.sourceUrl, pdfUrl: item.pdfUrl,
        keywords: JSON.stringify(aiItem.keywords),
        keyFindings: JSON.stringify(aiItem.findings || []),
        connectionReason: aiItem.connectionToTheme || null,
        category: item.category,
        year: item.year,
        sourceIndex: i,
      };
    })
  );

  return digest;
}
