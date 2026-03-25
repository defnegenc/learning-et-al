# Learning et al. — Digest Algorithm

> Referenced from CLAUDE.md. Always consult this before modifying the digest pipeline.

## Core Philosophy

Every digest is built around a **central question with wow factor** (max 8 words), not around a "best paper."

The question comes first. Papers are found to inform that question — not to answer it. A paper on AI bias can inform "Can AI be fashionable?" even if it doesn't mention fashion once. The synthesis frames everything as different lenses on the same question.

**The old approach (WRONG):** Find an anchor paper -> derive theme from anchor -> find papers related to anchor
**The current approach (RIGHT):** Generate a surprising central question from user interests -> search for papers that give us tools to think about that question -> revise theme to thread the actual papers together

---

## The Full Pipeline (step by step)

### Step 1: Interest Selection

Weighted random sampling with penalty for recently-used interests (last 5 digests).

- **5 candidate interests** selected via weighted-random-without-replacement (higher weight = more likely).
- Interests come from user settings (category-level expertise: BEG/INT/ADV).
- **Decay**: weights decay by 5% (`weight *= 0.95`) per digest generation, applied **once per day** (prevents double-decay on regeneration).
- **Recency penalty**: interests whose keywords appear in recent digest papers' keywords or theme words get a -0.5 score penalty during sampling. Tracks actual paper keywords and title words from the last 5 digests (not just theme word matching).

### Step 2: Central Question Generation (AI call 1 — hypothesis)

LLM picks 1-3 of the user's interests and generates a catchy central question.

- **Max 8 words.** Enforced: if the LLM returns >8 words, a retry call requests a shorter version.
- Cross-domain combos encouraged but **only combine interests that naturally connect**.
- Single-interest questions get an **unexpected angle within the domain** instead.
- For beginner interests: concrete and real-world, avoid pure theory.
- LLM also returns:
  - `searchQueries` (3 queries for paper search)
  - `newsQuery` (for news search)
  - `focusFields` (array of academic domains — enables cross-domain search)
- **Theme novelty check**: the generated theme is embedded and compared against the last 5 themes. If similarity > 0.7, the LLM is asked for a completely different angle. This prevents repetitive theme patterns.
- Fallback: if LLM fails, use the top interest keyword as the theme.

### Step 3: Paper Search

3 queries searched via the source priority chain: **OpenAlex -> Semantic Scholar -> arXiv fallback**.

- **Cross-domain field distribution**: when `focusFields` has 2+ fields, queries are distributed across fields (query 1 → field 1, query 2 → field 2, etc.). This ensures papers from the secondary domain are actually found.
- For beginner interests: `"introduction overview applications"` appended to each query.
- All results deduplicated by title.
- Cross-digest dedup: skip papers the user has seen in the last 30 days (includes same-day regenerations).
- **Citation floor**: OpenAlex filters to papers with >=2 citations (`cited_by_count:>1`).

**`searchPapers()` source priority:**
1. **OpenAlex with field filter** — 250M papers, no rate limits. Preferred.
2. **OpenAlex without field filter** — retry if field filter returns 0 (concept taxonomy mismatch).
3. **Semantic Scholar** — rate-limited at 1 req/sec on free tier.
4. **arXiv** — last resort, no field filter.

### Step 4: Paper Scoring & Selection

**Hybrid BM25 + Embedding Scoring with Reciprocal Rank Fusion** (Cormack et al. 2009, SIGIR)

Papers are scored by two independent systems:
1. **Embedding similarity** (`all-MiniLM-L6-v2`, local) — captures semantic meaning
2. **BM25** — captures keyword/term matches that embeddings miss

Rankings are fused using RRF: `RRF(d) = sum(1/(k + rank_i(d)))` with k=60.

**Quality boosts** (applied on top of RRF, scaled to RRF range):
- `recencyBonus`: +0.003 for current year, +0.0015 for last year
- `venueBoost`: 0 to +0.0024 for top-tier venues
- `instBoost`: 0 to +0.0015 for top institutions

**MMR diversity selection** (Maximal Marginal Relevance, Carbonell & Goldstein 1998):
- Instead of taking the top-N by score, MMR balances relevance against diversity.
- `MMR_score = λ * relevance_score - (1-λ) * max_similarity_to_selected_papers`
- λ = 0.6 (slightly favors relevance over diversity).
- This prevents all papers from being from the same lab/method/subfield.

**Thresholds:**
- `SIM_MIN_THEME = 0.12` — hard floor, filters truly irrelevant papers
- `SIM_ONTOPIC = 0.25` — primary inclusion threshold
- `SIM_FALLBACK = 0.15` — last-resort threshold

Fixed at **2 papers + 1 news** (best balance per recsys literature: 2 exploit + 1 explore).

### Step 4b: Counter-Query for Tension

After selecting paper 1, the pipeline generates a **counter-query** via LLM:
- "Find a paper that contradicts, complicates, or offers a completely different perspective on paper 1's findings"
- The counter-query searches a potentially different field than the primary
- This creates genuine intellectual tension for synthesis (not just "different topic" papers)
- Falls back to adjacent-interest search if counter-query fails

### Step 4c: LLM Re-Ranking

After all papers are selected (embedding-based), an LLM scores each paper 1-5 on **"how much does this offer a surprising or useful lens on the theme?"**

- Papers scoring ≤2 can be swapped with a better candidate from the qualified pool
- This bridges the gap between topical relevance (what embeddings measure) and aspectual relevance (what the product needs)
- Graceful degradation: if the LLM call fails, embedding-ranked papers are kept

### Step 5: News Search

When news slots are needed (currently 1):

- Web search via Serper (Google news) / DuckDuckGo fallback using `newsQuery + focusInterest + current year`.
- Scored by **embedding similarity to theme** (same model as paper scoring).
- **Listicle filter**: reject "Top N+", "Best N+" patterns and known SEO domains.
- **Academic domain filter**: reject results from academic publishers (frontiersin.org, nature.com, springer.com, etc.) — these are papers, not news.
- **Paywall detection**: article fetcher checks for paywall signals and returns empty text, falling back to snippet.
- Article text extracted via **paragraph density scoring** (<p> tag extraction), with longest-run heuristic as fallback.
- RSS fallback (keyword-matched from TechCrunch, Ars Technica, Wired).
- Last resort: substitute an academic paper (correctly labeled as `category: "recent"`, not "news").

### Step 6: Theme Revision (AI call 2 — revision)

LLM sees the actual papers found and revises the central question to better thread them.

- Max 8 words.
- Papers shown with **600 chars of abstract** (up from 300) for better context.
- Must connect ALL papers found.
- Must sound natural, not goofy.
- Instruction: "ALWAYS revise" — learned from experience that giving opt-out results in no revision.

### Step 7: Multi-Stage Synthesis (AI calls 3-6)

Previously a single LLM call. Now four stages based on research:

#### Stage A: Metadata Generation (AI call 3)
Produces per-paper summaries, keywords, findings, connectionToTheme, and keyConcepts. Separated from synthesis so the model can focus on accurate metadata extraction.

#### Stage B: Argument Skeleton (AI call 4)
**Research:** Cross-Document Structure Theory (Radev 2000), Tree of Thoughts (Yao 2023)

Before writing prose, the LLM:
1. Identifies cross-document relations (agrees, contradicts, extends, alternative mechanism, unrelated)
2. Assigns each paper a role (supports, complicates, provides evidence, is weak fit)
3. Identifies the core tension between papers
4. Plans the argument arc
5. Flags papers that should be skipped rather than forced

#### Stage C: Synthesis Draft (AI call 5)
Writes the paragraph following the skeleton's argument arc. Papers marked "is_weak_fit" are mentioned briefly or skipped entirely. This produces genuinely argumentative text because the model has already planned its structure.

#### Stage D: Self-Refine (AI call 6, conditional)
**Research:** Self-Refine (Madaan et al. 2023, NeurIPS) — ~20% quality improvement

The LLM critiques its own synthesis on four dimensions (1-5 each):
- **Argument** — is it making a point, not just summarizing?
- **Connection** — are all papers necessary to the argument?
- **Accessibility** — would a non-expert understand?
- **Specificity** — does it include real findings/numbers?

If any score < 4, the LLM revises based on specific critique feedback. The revision targets only the weakest point.

**Style rules** (unchanged):
- Conversational tone, contractions, casual transitions
- Paper names in **bold** (short conversational name)
- Key findings must be RESULTS, not methodology
- Define jargon immediately
- Banned words: demonstrates, reveals, nuanced, multifaceted
- NO em dashes, NO filler phrases

### Step 8: Storage

- Digest saved with: theme, synthesis narrative, keyConcepts, starred flag.
- Papers saved with: summaries, keywords, key findings.
- All linked to the user and dated.

---

## Total AI Calls Per Digest: 6-9

| Call | Step | When | Input tokens (approx) | Output tokens (approx) |
|------|------|------|-----------------------|------------------------|
| 1. Hypothesis generation | Step 2 | Always | ~800 | ~100 |
| 2. Theme shortening | Step 2 | If >8 words | ~100 | ~30 |
| 3. Theme novelty retry | Step 2 | If sim >0.7 to recent | ~400 | ~100 |
| 4. Counter-query | Step 4b | Always (paper 2 slot) | ~500 | ~50 |
| 5. LLM re-ranking | Step 4c | If ≥2 papers | ~600 | ~100 |
| 6. Theme revision | Step 6 | Always | ~3000 | ~50 |
| 7. Metadata (Stage A) | Step 7 | Always | ~6000 | ~600 |
| 8. Skeleton (Stage B) | Step 7 | Always | ~4000 | ~300 |
| 9. Synthesis draft (Stage C) | Step 7 | Always | ~5000 | ~400 |
| 10. Self-critique (Stage D) | Step 7 | Always | ~1000 | ~150 |
| 11. Revision (Stage D) | Step 7 | If any score < 4 | ~1000 | ~400 |

**Typical: 8-9 calls, ~20000-25000 tokens per digest.** Calls 2-3 and 11 are conditional.

---

## Validation Gates

| Gate | Threshold | Applied at |
|------|-----------|-----------|
| SIM_MIN_THEME | cosine > 0.12 | Step 4 hard floor |
| SIM_ONTOPIC | cosine > 0.25 | Step 4 paper selection |
| SIM_FALLBACK | cosine > 0.15 | Step 4 fallback + news + explore |
| News embedding similarity | cosine > 0.15 | Step 5 web results |
| Listicle filter | regex + domain blocklist | Step 5 web results |
| Academic domain filter | domain hostname check | Step 5 web results |
| Paywall detection | 2+ paywall signals | Step 5 article fetch |
| Theme novelty | cosine < 0.7 vs recent themes | Step 2 after generation |
| Theme word count | ≤ 8 words | Step 2 after generation |
| LLM re-rank score | score > 2 to keep | Step 4c |
| Cross-digest dedup | last 30 days | Step 3 candidate filtering |
| Citation floor | cited_by_count > 1 | Step 3 OpenAlex filter |

---

## Degraded Mode (ONNX unavailable)

When the local embedding model fails to load (e.g., Vercel cold starts):
- `isEmbeddingDegraded()` returns `true`
- Warning logged: `⚠ ONNX unavailable — running in DEGRADED mode`
- Cosine similarity falls back to keyword overlap
- Unknown text pairs return **0.1** (conservative — was 0.3, which bypassed all gates)
- The LLM re-ranking step partially compensates by providing quality scoring

---

## Learning System

Engagement only boosts **existing** interests (does not create new ones). Weight changes are intentionally tiny.

Interests have a `weight` field (default 1.0). Weights affect how often an interest is selected:

| Signal | Effect | Cap |
|--------|--------|-----|
| Star on paper | +0.1 to best-matching interest | 3.0 |
| Dislike on paper | -0.2 to paper's keywords | floor 0 |
| Synthesis chat question | +0.05 to best-matching interest | 3.0 |
| Daily decay | x0.95 applied once per day | — |

---

## Cross-Digest Deduplication

At the start of each generation, paper titles from the last 30 days of digests are loaded into `seenPaperTitles`. Any candidate paper already seen is skipped. This includes same-day regenerations (so regenerating gives fresh papers). Time limit of 30 days prevents pool exhaustion for long-term users.

---

## Known Limitations

1. **LLM determinism**: The central question generation may produce different themes on regeneration (LLM is not deterministic). This is acceptable — regeneration is an explicit user action.
2. **Single-word interests**: "robotics" or "cooking" alone produce a weaker theme than cross-domain combos. The LLM handles this by finding surprising angles within the single domain.
3. **SIM_ONTOPIC threshold**: 0.25 is relatively loose (all-MiniLM-L6-v2 scores). If theme is very abstract, many tangentially related papers may pass. MMR diversity + LLM re-ranking compensate.
4. **News validation**: Embedding similarity + academic domain filter + listicle filter is multi-layered but short snippets may still produce false positives.
5. ~~**Academic papers in news slots**~~ (FIXED): Academic domain detection now filters publisher URLs from news results.
6. ~~**Sequential synthesis structure**~~ (FIXED): Now uses lens-based structure.
7. **Content mix slider**: Stored in DB but currently hardcoded to 2+1. Could be wired up later.
8. **all-MiniLM-L6-v2 cross-domain weakness**: Symmetric bi-encoders underscores cross-domain papers. LLM re-ranking partially compensates but a model upgrade (e.g., bge-small-en-v1.5) would help.
9. **RSS feeds are US tech only**: TechCrunch, Ars Technica, Wired. Non-tech interests get poor news coverage from RSS fallback.

---

## What Worked

- **Theme-first approach** produces genuinely interesting cross-domain questions
- **Embedding-based scoring** is far better than keyword matching
- **Theme revision step** catches bad themes that don't fit the actual papers
- **Interest rotation** prevents same-topic digests every day
- **"Max 8 words" rule** makes themes punchy
- **Conversational synthesis tone** with concrete examples in prompt
- **Banning specific AI-speak words** dramatically improves output
- **MMR diversity** prevents redundant paper sets from same lab/method
- **Counter-query for tension** finds papers that genuinely challenge paper 1
- **LLM re-ranking** catches papers that are topically related but add no new angle
- **Theme novelty scoring** prevents repetitive theme patterns across days
- **Academic domain filter** properly excludes journal articles from news slots

## What Didn't Work

- **Anchor paper approach**: highly cited papers dominated, pulled in methodology papers from wrong fields
- **Citation graph** (OA related_works, S2 recommendations): cross-field contamination, PRISMA showing up in AI digests
- **Domain guard**: too strict filtered good papers; too loose let garbage through
- **Keyword matching for relevance**: terrible. "AI" + "agents" matched customer service bot articles
- **Auto-creating interests from engagement**: "emoji communication" polluted the feed after one starred paper
- **Weight boost of +0.5 per star**: too aggressive, one star dominated all future digests
- **"Paper A" / "Paper B" labels in synthesis**: AI kept using them instead of actual titles
- **Letting AI decide whether to revise theme** ("changed: true/false"): it always said false. Now we always revise.
- **Per-item sequential synthesis paragraphs**: creates a chain, not lenses. Third item feels like afterthought.
- **Theme word matching for recency penalty**: imprecise — shared words between themes and interests caused over/under-penalization. Now tracks actual paper keywords.
- **Returning 0.3 for unknown embedding pairs**: bypassed all quality gates when ONNX unavailable. Now returns 0.1.
- **Single focusField for cross-domain themes**: all queries went to one field, secondary domain papers were never found.

---

## Top 3 Ideas to Improve (rolling)

1. **Upgrade embedding model**: Switch to `bge-small-en-v1.5` or `msmarco-MiniLM-L6-v3` for better cross-domain and asymmetric query-document scoring. Requires recalibrating all thresholds.
2. **User digest feedback loop**: after reading a digest, user rates it 1-5. Use this to fine-tune interest weights and theme quality over time.
3. **Dynamic item count**: Let the pipeline determine 2-5 items based on candidate quality rather than forcing a fixed 3-item format.
