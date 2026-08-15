# Algorithm Audit — Critical Review & Improvement Roadmap

> Research-backed analysis of the paper and news sourcing pipeline.
> Ordered from concrete technical bugs to structural/conceptual issues.

---

## Part 1: Bugs & Dead Code

These are things that are broken right now, not design opinions.

### 1.1 Content mix slider is disconnected

The `contentMix` field is stored in the DB (`schema.ts:7`), set during onboarding (`onboarding.tsx:122`), and exposed in settings — but `generateDigest()` hardcodes `targetPapers = 2` and `targetNews = 1` at `digest.ts:217-218`. The slider does nothing. The `algorithm.md` documents a 4-bucket slider table (lines 67-72) that doesn't exist in code.

**Fix:** Either wire it up or remove the slider and document the fixed 2+1 ratio honestly.

### 1.2 Fallback papers get `category: "news"`

When no relevant news is found, the fill passes at `digest.ts:524` and `digest.ts:547` assign `category: "news"` to academic papers filling the third slot. The UI renders these as news cards. This is the documented Known Limitation #5, but it's really a bug — a one-line fix to assign `category: "paper"` or `"fallback"`.

### 1.3 Hardcoded year tokens `"2025 2026"` in news query

`digest.ts:461` appends literal `"2025 2026"` to the news search. This will silently degrade in 2027. Should use `new Date().getFullYear()`.

### 1.4 `newsNeeded` filter is dead code

`digest.ts:456`: `const newsNeeded = targetNews - items.filter(i => i.source === "rss").length`. At this point, `items` only contains papers — no RSS items exist yet. The filter always returns 0. `newsNeeded` always equals `targetNews`.

### 1.5 Citation floor documented but not implemented

`algorithm.md` and `CLAUDE.md` mention a `>=2 citations` floor. The OpenAlex fetcher (`open-alex.ts`) has no such filter. Papers with 0 citations pass through.

### 1.6 Double-decay on regeneration

Decay (`weight *= 0.95`) fires unconditionally at the top of `generateDigest()` (`digest.ts:144-147`). Regenerating twice in one day applies decay twice. Over time, power users who regenerate frequently will see all their interest weights collapse toward zero.

---

## Part 2: Fragile Heuristics & Thresholds

Issues where the approach works today but will break under predictable conditions.

### 2.1 all-MiniLM-L6-v2 is undersized for this task

The model produces 384-dim embeddings and was trained on short sentence pairs. Research-backed concerns:

- **Noise floor is ~0.05-0.15** for unrelated texts in this model ([Reimers & Gurevych, 2019](https://arxiv.org/abs/1908.10084)). The hard floor `SIM_MIN_THEME = 0.12` is barely above noise. Papers with genuine topical distance but real relevance (the cross-domain papers the algorithm *wants*) will score in the 0.12-0.20 range — exactly where signal and noise overlap.
- **Cross-domain similarity is systematically underscored.** MiniLM was trained on NLI and STS benchmarks that are mostly same-domain ([Thakur et al., BEIR 2021](https://arxiv.org/abs/2104.08663)). A paper on textile sensing technology will score low against "Can AI be fashionable?" even though it's exactly what the digest wants. The model penalizes vocabulary mismatch, which is the defining feature of cross-domain work.
- **Asymmetric query-document performance.** The theme is a short question (5-8 words); paper text is `title + 500 chars of abstract`. Length mismatch degrades cosine similarity for symmetric bi-encoders ([Muennighoff, 2022](https://arxiv.org/abs/2212.03533)). Asymmetric models (e.g., `msmarco-MiniLM-L6-v3` or `bge-small-en-v1.5`) are designed for exactly this query-to-document retrieval task.

**Impact:** The threshold regime (0.12 / 0.15 / 0.25) is calibrated to this specific model's noise floor. Any model swap requires recalibrating all thresholds. The bigger issue is that the model is fighting the algorithm's cross-domain goal.

### 2.2 ONNX fallback makes all gates meaningless

When `@xenova/transformers` can't load (e.g., Vercel cold starts), `embeddings.ts` falls back to keyword overlap returning 0.3 for unknown pairs. Since 0.3 > 0.15 (news threshold) and 0.3 > 0.25 (paper threshold), **every candidate passes every gate**. The listicle regex becomes the only quality filter. This is a silent, total degradation of the scoring pipeline with no logging or user-visible warning.

### 2.3 Article text extraction is a content-length heuristic, not readability

`article.ts` finds the longest run of lines >= 40 chars. This misses:
- Paywalled articles (returns the paywall prompt as "content")
- Cookie consent banners that happen to be long
- Sidebar text blocks that are longer than the article

The research community solved this with readability algorithms (Mozilla Readability, used by Firefox Reader View; Trafilatura for Python). The current heuristic will produce garbage `abstract` fields for news items from paywalled outlets (WSJ, NYT, FT, Bloomberg) — exactly the high-quality journalism the digest should surface.

### 2.4 DuckDuckGo HTML scraping is one DOM change from breaking

`web-search.ts:68` regex-matches DDG's internal CSS classes (`result__a`, `result__snippet`). DDG has no public commitment to this HTML structure. When it breaks, the function returns `[]` silently, news search falls through to 3 hardcoded RSS feeds, and the user gets TechCrunch articles regardless of their interests.

### 2.5 RSS feeds are hardcoded US tech media

`rss.ts:10-14` fetches from TechCrunch, Ars Technica, and Wired. A user interested in computational biology, materials science, or urban planning will never get relevant news from these feeds. The RSS fallback is effectively a "tech news" fallback regardless of user interests.

### 2.6 Recency penalty uses theme word-matching, not interest tracking

`digest.ts:168-178` penalizes interests whose keywords share any word (>3 chars) with the last 5 theme strings. Problems:
- **Over-penalization:** Theme "Can machines develop taste?" penalizes the interest "machine learning" (shares "machines"→"machine") even if that interest wasn't selected.
- **Under-penalization:** Morphological variants miss — "linguistic" in theme doesn't penalize "linguistics" as an interest.
- **Better approach:** Track which interest IDs were actually selected per digest (already partly available via `selectedInterestKeywords`), and penalize those directly.

---

## Part 3: Structural Weaknesses

Design decisions that limit the algorithm's ceiling.

### 3.1 Single `focusField` undermines cross-domain search (historical)

The LLM returns one `focusField` string for all 3 search queries. When the theme combines "AI + fashion," all OpenAlex queries filter by whichever field the LLM picked (probably Computer Science). Fashion-tech papers, textile engineering, consumer behavior research — anything in the secondary domain — gets filtered out at the API level.

**Research context:** Cross-domain recommendation is a known hard problem. The CORD framework ([Zhu et al., 2021](https://arxiv.org/abs/2108.09563)) shows that effective cross-domain retrieval requires querying each domain separately and merging results. The current single-field approach structurally prevents the cross-domain discovery that the algorithm's philosophy promises.

**Original fix:** Return `focusFields: ["Computer Science", "Art"]` from the LLM and split queries across fields.

**Superseded 2026-08-15:** The LLM no longer emits fields at all. Search routing now uses the sampled OpenAlex Topic's stable IDs: query 1 starts at `primary_topic.id`, queries 2-3 at `topics.id`, and thin result sets widen through `primary_topic.subfield.id` to unscoped search. This preserves cross-domain recall without trusting a free-form model label.

### 3.2 No quality gate on LLM theme output

The hypothesis call returns a theme, and the pipeline uses it — no validation. If the LLM returns "Recent advances in machine learning" (boring), or "What if the epistemological ramifications of quantum uncertainty could reshape interdisciplinary methodologies?" (15 words, academic), or just malformed JSON, the pipeline either uses it or falls back to a bare keyword.

**What's missing:**
- Word count check (the "max 8 words" rule is prompt-only, never enforced)
- A "surprise score" — even a simple heuristic like: does it contain a question mark? Does it combine words from 2+ different semantic fields? Is it shorter than 10 words?
- Retry with feedback: "Your theme was 12 words. Try again under 8."

### 3.3 Theme revision sees only 300 chars of each abstract

`digest.ts:566` truncates abstracts to 300 chars for the revision prompt. For a paper whose key finding is in the results section (typically 60%+ into the abstract), the revision LLM is working blind. It revises the theme based on paper titles and opening sentences, not on what the papers actually found.

**Fix:** Either increase to 500-800 chars (still cheap at ~2500 input tokens total) or pass the already-computed `paperText()` (title + 500 chars) which is already in memory.

### 3.4 No diversity enforcement in paper selection

The scoring formula (`themeSim + recencyBonus + citationVelocity + venueBoost + instBoost`) is a single ranking. The top-2 papers are simply the two highest-scoring candidates. If three papers from the same lab, same method, same subfield all score highest, the digest gets three redundant perspectives.

**Research context:** Diversity in recommendation is well-studied. Maximal Marginal Relevance (MMR) ([Carbonell & Goldstein, 1998](https://dl.acm.org/doi/10.1145/290941.291025)) re-ranks results by penalizing candidates similar to already-selected items. This is standard in search engines and news recommenders. A simple MMR pass after scoring would ensure the 2-3 papers offer genuinely different lenses.

### 3.5 The "explore" slot is weakly structured serendipity

The explore slot (`digest.ts:403`) searches `theme + unused_interest_keyword` with a lower threshold (0.15). This is the algorithm's only mechanism for surprise, but it's constrained:
- It still requires embedding similarity to the theme, so truly unexpected connections won't score
- It only uses interests the user already has — it can't discover adjacent fields the user hasn't listed
- The lower threshold means it accepts low-quality papers more readily

**Research context:** Serendipity in recommender systems requires deliberately breaking the relevance constraint ([Kotkov et al., 2016](https://link.springer.com/article/10.1007/s10115-016-0988-x)). Effective serendipity mechanisms use: (a) novelty relative to user history, (b) unexpectedness relative to the user model, and (c) relevance to a broader goal. The current explore slot only addresses (c) weakly. A better approach: search for papers that cite the same foundational works as the selected papers but come from a different field — this guarantees intellectual connection without requiring embedding similarity.

### 3.6 Engagement feedback is too coarse to learn

The weight system (+0.1 for star, -0.2 for dislike, +0.05 for chat) modifies interest weights but can't distinguish between:
- "I liked this paper" vs. "I liked this paper because of the cross-domain angle"
- "I disliked this paper" vs. "I already knew this" vs. "This was irrelevant"

The system can shift toward more/less of an interest over time, but it can't learn *what kind of papers* within that interest the user prefers (theoretical vs. applied, recent vs. seminal, from certain venues, etc.). This is a fundamental limitation of interest-weight-only feedback.

**Research context:** Multi-armed bandit approaches to content recommendation ([Li et al., 2010, LinUCB](https://arxiv.org/abs/1003.0146)) learn from contextual features of both the user and the item. Even without going full bandit, storing a feature vector per feedback event (paper venue, year, citation count, cross-domain flag) would enable richer learning.

---

## Part 4: Conceptual & Philosophical Issues

The hardest problems — where the algorithm's design assumptions may not match the product goal.

### 4.1 Embedding similarity is the wrong objective for "tools to think with"

The core philosophy says papers should give the reader "tools to think with" in relation to the central question. But the scoring pipeline optimizes for **semantic similarity** — papers whose abstracts use words that are close in embedding space to the question.

This is a subtle but important mismatch:
- A paper on "regulatory compliance in algorithmic systems" is **semantically distant** from "Can AI be fashionable?" but could be an excellent "tool to think with" (what happens when AI fashion recommendations encode biases?).
- A paper on "fashion trend prediction using deep learning" is **semantically close** but is just answering the question literally — not providing a new lens.

The current system will always prefer the literal match over the surprising connection. This is the opposite of the product's stated goal.

**Research context:** This is the difference between *topical relevance* and *aspectual relevance* ([Hjorland, 2010](https://doi.org/10.1002/asi.21261)). Topical relevance (what embeddings measure) asks "is this about the same thing?" Aspectual relevance asks "does this contribute a useful perspective?" No embedding model captures aspectual relevance — it requires reasoning about the *relationship* between the paper's contribution and the question, not surface-level text similarity.

**Possible approaches:**
- Use the LLM to score relevance instead of (or in addition to) embeddings. Pass each candidate + the theme to the LLM with the prompt: "Rate 1-5: how much does this paper offer a surprising new angle on the question?" This is expensive (N calls per digest) but could be done on the shortlisted top-10 candidates.
- Use a two-stage pipeline: embeddings for recall (broad net, low threshold), LLM for precision (re-rank top candidates by "tool to think with" quality).

### 4.2 The pipeline searches for papers that match the question, not papers that tension each other

The scoring function ranks every paper independently against the theme embedding. Papers are never compared to each other. This means the algorithm cannot explicitly seek:
- **Contradictions:** Paper A finds X works; Paper B finds X fails under condition Y
- **Complementarity:** Paper A explains the mechanism; Paper B provides the evidence
- **Scale contrast:** Paper A studies individuals; Paper B studies populations

These are exactly the relationships that make a synthesis interesting ("find the tension between papers" — CLAUDE.md). The current pipeline can only get these by luck — if the top-scoring papers happen to tension each other.

**Research context:** Aspect-based document clustering ([Titov & McDonald, 2008](https://aclanthology.org/P08-1036/)) and comparative summarization ([Wang & Ling, 2016](https://aclanthology.org/P16-1103/)) explicitly model inter-document relationships. A simpler approach: after selecting Paper 1, generate a "counter-query" ("what evidence contradicts or complicates [Paper 1's finding]?") and use it to find Paper 2.

### 4.3 "Wow factor" is prompt-engineered, not measured

The central question's surprise value is entirely determined by the LLM's interpretation of few-shot examples. There's no measurement, no feedback loop, no retry. The algorithm can't distinguish between a theme that made the user go "huh, interesting" and one that made them roll their eyes.

Over time, without measurement, the themes will regress to whatever the LLM's default "interesting-sounding" template is. Anecdotally, LLMs converge on a recognizable style of "provocative question" that becomes predictable after a few weeks of daily digests.

**Possible approaches:**
- Track click-through rate on digest themes (did user open the digest at all?)
- A/B test: generate 2-3 candidate themes, pick the one with highest predicted engagement (requires a lightweight preference model, or just random selection with retrospective analysis)
- Novelty scoring: embed the candidate theme against the user's last 30 themes. If similarity is too high, it's a repeat pattern — retry.

### 4.4 The 3-item digest is a local maximum

The fixed 2-paper + 1-news format optimizes for a single reading session. But the product goal ("foster curiosity, surface unexpected things") might be better served by variable-length digests:
- Some questions are best served by 5 papers from radically different fields
- Some questions are best served by 1 deep paper + 2 news items showing real-world impact
- Some days there simply aren't 2 good papers on the theme — forcing 2 produces filler

The hardcoded `targetPapers = 2` / `targetNews = 1` prevents the algorithm from adapting to the actual quality and quantity of available material. The content mix slider (if wired up) would be user-controlled but still static across all themes.

**Better model:** Let the pipeline determine item count dynamically based on candidate quality. If only 1 paper scores above 0.25, run with 1 paper + 2 news (or 1 paper + 1 deep-dive). If 4 papers are exceptional, include them all. The synthesis prompt already handles variable item counts.

### 4.5 No temporal awareness in theme generation

The hypothesis prompt gives the LLM no information about what's happening in the world right now. A central question like "Can AI agents be fashionable?" is just as likely on the day a major AI regulation passes as any other day. The pipeline has no mechanism to surface themes that are timely — connected to current events, trending research topics, or recent breakthroughs.

**Contrast with the product goal:** "Surface unexpected things accessibly" is partly about timing. A paper on pandemic modeling is more interesting during a pandemic. A paper on election prediction algorithms is more interesting during an election. The pipeline treats every day as identical.

**Possible approach:** Feed the LLM 3-5 trending topics from a news API alongside the user's interests. The prompt can then ask: "Generate a question that connects one of the user's interests to something happening right now." This adds a temporal dimension without changing the core theme-first architecture.

---

## Priority Matrix

| # | Issue | Effort | Impact | Category | Status |
|---|-------|--------|--------|----------|--------|
| 1.1 | Content mix slider disconnected | S | M | Bug | Documented (hardcoded 2+1 is intentional) |
| 1.2 | Fallback papers labeled as news | XS | M | Bug | **FIXED** — always `category: "recent"` |
| 1.3 | Hardcoded year tokens | XS | S | Bug | **FIXED** — uses `new Date().getFullYear()` |
| 1.4 | Dead `newsNeeded` filter | XS | — | Cleanup | **FIXED** — removed dead filter |
| 1.5 | Missing citation floor | S | S | Bug | **FIXED** — `cited_by_count:>1` in OA filter |
| 1.6 | Double-decay on regen | S | M | Bug | **FIXED** — only decays once per day |
| 2.1 | MiniLM undersized for cross-domain | L | H | Model | **Mitigated** — `EMBEDDING_MODEL` env var available, default still all-MiniLM-L6-v2. Must set explicitly in prod. |
| 2.2 | ONNX fallback disables all gates | M | H | Reliability | **FIXED** — returns 0.1 (not 0.3), `isEmbeddingDegraded()` flag, warning logs |
| 2.3 | Article extraction heuristic | M | M | Quality | **FIXED** — paragraph density scoring, paywall detection |
| 2.4 | DDG HTML scraping fragility | M | M | Reliability | **FIXED** — User-Agent rotation, 10s timeout, structured logging when regex breaks |
| 2.5 | Hardcoded US tech RSS feeds | S | M | Coverage | **FIXED** — field-specific feeds + Google News RSS by topic |
| 2.6 | Imprecise recency penalty | S | S | Quality | **Partially fixed** — paper keywords are primary signal, but theme words still merged as secondary |
| 3.1 | Single focusField blocks cross-domain | M | H | Architecture | **FIXED, THEN SUPERSEDED** — deterministic OpenAlex topic/subfield IDs now route every query; the LLM emits no fields |
| 3.2 | No quality gate on LLM theme | M | H | Quality | **FIXED** — word count enforcement + retry |
| 3.3 | Revision sees truncated abstracts | XS | M | Quality | **FIXED** — 600 chars (was 300) |
| 3.4 | No diversity in paper selection (MMR) | M | H | Algorithm | **FIXED** — MMR with λ=0.6 |
| 3.5 | Weak serendipity mechanism | L | H | Algorithm | **FIXED** — LLM complementarity selection from wide MMR pool (replaced counter-query approach) |
| 3.6 | Coarse engagement feedback | L | M | Learning | **Partially fixed** — contextual features stored with events, but weight update logic unchanged. Data available for future richer learning. |
| 4.1 | Embeddings ≠ "tools to think with" | L | H | Philosophy | **FIXED** — LLM re-ranking scores shortlist on aspectual relevance |
| 4.2 | No inter-paper tension seeking | L | H | Philosophy | **FIXED** — `selectionSkeletonPrompt` picks complementary papers from wide pool, identifies `coreTension` |
| 4.3 | Wow factor unmeasured | M | H | Philosophy | **FIXED** — theme novelty scoring vs recent themes (sim > 0.7 triggers retry) |
| 4.4 | Fixed 3-item format | M | M | Philosophy | **FIXED** — dynamic paper:news ratio adapts to candidate quality (3p+0n / 2p+1n / 1p+2n) |
| 4.5 | No temporal awareness | M | M | Philosophy | **FIXED** — trending headlines injected into hypothesis prompt as optional context |

**Effort:** XS = < 30 min, S = 1-2 hrs, M = half day, L = multi-day
**Impact:** S = polish, M = noticeable quality lift, H = step change in digest quality

---

## Implementation Status

**Implemented (2026-03-24):** 23 issues addressed. 18 fully fixed, 3 partially fixed, 2 mitigated.

**Summary:**
- 6 bugs fixed (Wave 1)
- 6 reliability improvements (Wave 2) — 2.1 mitigated (env var available, default unchanged), 2.6 partially fixed (theme words still secondary signal)
- 5 cross-domain quality improvements (Wave 3) — 3.5 fixed via LLM complementarity selection (replaced counter-query approach), 3.6 partially fixed (data stored, not yet consumed)
- 6 scoring philosophy changes (Wave 4) — 4.2 fixed via `selectionSkeletonPrompt` picking complementary papers

**New AI calls added:** complementarity selection (+1), LLM re-ranking (+1), theme shortening (conditional), theme novelty retry (conditional). Typical digest now uses 8-9 calls (was 3). Calls 2, 3, and 10 are conditional.

**Note:** The original counter-query approach was superseded by the synthesis uplift's `selectionSkeletonPrompt`, which picks complementary papers from a wider MMR pool.

**Prompt tightening (2026-03-24, post-audit):**
Based on observing a bad digest ("Can better architecture solve computational bottlenecks?" — jargon theme, two redundant papers, no tension), three prompts were tightened:
1. **Hypothesis prompt**: banned technical jargon, added "dinner table test" ("would your grandma understand the question?"), added bad examples of jargon themes
2. **Selection skeleton prompt**: added explicit rule "if two papers make the SAME POINT, drop one", rejected manufactured tensions ("people haven't adopted it" is not a tension), added staleness guard (>5yr old papers must justify inclusion)
3. **Re-ranking prompt**: expanded scoring rubric, score ≤2 for redundancy or staleness, score ≤2 if "a non-expert would say 'isn't that the same thing as paper N?'"
4. **Skeleton prompt (Stage B)**: added redundancy detection, honest tension instruction ("if you can't find genuine tension, say so")

---

## Part 5: Theme Monoculture (audited 2026-07-19)

Why every central question converges on the same "Who decides / Can we trust X?" register:

### 5.1 Every few-shot example rewards one rhetorical shape
The exemplars across `hypothesisPrompt` (digest.ts:262), the Step-5 `revisePrompt` (digest.ts:940, "has a villain", "implies a reversal"), and even the gist prompt ("Who checks AI when it grades students?") all model the same move: agency/trust framing with an implied villain. For any paper set, the cheapest way to satisfy "counterintuitive + villain + dinner-table test" is a governance question — "Who decides/checks/controls X?" — so the model regresses to that modal template.

### 5.2 Novelty guard compares topic words, not question shape
`digest.ts:361-387` rejects a theme only when ≥2 non-stop words overlap with a recent theme. "Who decides what AI can say?" vs "Who checks AI grading?" share only "AI", so the identical template passes day after day. Nothing tracks structure (leading word, who/can/do, question vs statement).

### 5.3 The final revision is never novelty-checked
The recent-themes constraint runs in Step 1 only. The Step-5 revise-to-fit-papers call (digest.ts:934-1002) — which frequently rewrites the theme — receives no recent themes and re-applies the same "surprise" instructions, so up to 4 sequential rewrites (initial → shorten → novelty retry → search-fail retry → revise) drift back to the house style with no guard at the end.

### Recommended fixes (top 3)
1. **Structure-aware novelty, enforced at the end.** Derive each recent theme's shape (leading-word class + question/statement), feed the last 7 themes + shapes into BOTH the hypothesis and Step-5 prompts ("don't reuse a shape used in the last 3 days"), and add a deterministic post-Step-5 guard: if the leading word matches ≥2 of the last 5 themes, one re-roll demanding a different shape.
2. **Rotate an exemplar bank.** Replace the fixed examples with ~15 spanning mechanism ("Why sarcasm breaks emotion-reading AI"), scale/statement ("Concrete from mine waste, minus 90% emissions"), paradox, and how-it-works forms; sample 3-4 per run so no single register anchors generation. Fix the gist example too.
3. **Collapse the rewrite chain.** One call generates 3 candidate themes (required different shapes); code picks the winner (novelty + length), keeping only the fit-to-papers revision. Fewer rewrites = less regression to the mode, and it saves 2-3 AI calls.

### Partial implementation (2026-08-14)

The largest upstream cause of monoculture is now addressed: Step 1 no longer has to
invent specificity from five bare strings. A rotating OpenAlex Topic supplies a real
research neighborhood, description, and vocabulary before the question call. Search
failure and novelty retries keep that topic instead of drifting to an easier generic
theme. The fixed exemplar bank was also replaced with user-approved direct,
consequential questions and an explicit instruction to vary question shape.

2026-08-15 follow-up: the final-source editorial pass now sees recent headlines, drafts
3 candidates, and is explicitly calibrated by user-approved few shots without a fixed
format menu. Structural novelty still is not deterministically enforced, but the old
one-candidate Step-5 rewrite and its keep-original bias are gone.

---

## Part 6: Sourcing Quality — 3-slot decay, relevance drift, repetition (audited 2026-07-23)

User-reported symptoms: (a) digests aimed at 3 sources usually deliver 2 good ones plus filler, (b) papers are sometimes only loosely related to the theme, (c) suspicion that search structure re-surfaces the same papers.

### 6.1 The "three source" fallback chain is really one source

`searchPapers()` (digest.ts:59-95) returns as soon as OpenAlex yields ≥1 result. OpenAlex almost never returns zero for a 3-5 word query, so Semantic Scholar and arXiv are effectively dead code paths — every candidate pool is OpenAlex-only, with OpenAlex's specific biases (abstract coverage gaps, inverted-index reconstruction). There is no blending or union; "priority chain" in practice means "OpenAlex".

### 6.2 OpenAlex relevance ranking is thrown away — candidates are "newest match", not "best match"

Main-path queries use `sort: "publicationDate"` (digest.ts:448), which becomes `sort=publication_year:desc` in `open-alex.ts:139` with a 2-year window. Two consequences:

1. **Relevance is discarded.** OpenAlex computes a relevance score for `search=` queries, but sorting by year overrides it. The top 10 are the *most recently indexed* works that mention the query words anywhere (OA `search` matches title+abstract+fulltext) — this is the single biggest driver of loosely-related candidates. The embedding gate downstream then has to salvage a pool that was never relevance-ranked.
2. **Year granularity means near-deterministic windows.** `publication_year` sorts at year resolution; within 2026 the tie-break is stable, so a similar query on consecutive days returns nearly the same top-10 until new works are indexed. Combined with 6.5 this drives repetition.

**Fix direction:** fetch with `sort=relevance_score:desc` and keep the 2-year `publication_year` *filter* for freshness, or fetch 25 by relevance and re-rank by recency locally.

### 6.3 Relevance is measured against the wrong text: the punchy headline

Qualification (digest.ts:493-497) embeds the **theme** — which by design is ≤8 words, jargon-free, metaphorical ("The death of the expert") — and compares it to jargon-dense abstracts using all-MiniLM-L6-v2 (already flagged in 2.1 as weak at cross-vocabulary matching). BM25 is scored against the same 8-word headline. So the gate systematically:
- **Under-scores good papers** (vocabulary mismatch → strong papers land at 0.15-0.25 → cascade falls to weak thresholds → theme retries fire → "too strict" symptom), and
- **Over-scores bad papers** that share surface words with the headline.

The search queries (LLM-written, domain-vocabulary) are a much better relevance anchor than the theme, but they're never used for scoring — only for retrieval. **Fix direction:** score each candidate against its *originating search query* embedding (or max over the 3 queries), and use the theme only for the LLM re-rank, which is the step actually equipped to judge "tool to think with" quality.

### 6.4 The third slot is structurally the pollution slot

The default mix is 2 papers + 1 news, and every path that fills slot 3 uses degraded standards:
- **News gate:** cosine > 0.15 on a 1-2 sentence snippet (digest.ts:696) — near the model's noise floor; `isNewsRelevant` word-guard applies only to the RSS fallback, not the primary web path (Known Issue #6).
- **Fill passes 1-3** (digest.ts:731-800): thresholds relax to 0.18 → 0.15 → 0.15, explicitly "accept anything somewhat related".
- **Broad news fill** (digest.ts:813): 0.10 — indistinguishable from noise.
- **Re-rank drop** (digest.ts:910-915): when the third item scores relevance=1 with no replacement, it's dropped → 2 sources.

Meanwhile the upgrade to 3 papers requires **3 papers above 0.25 vs the headline** (digest.ts:573) — rare precisely because of 6.3. Net effect: the system is simultaneously too strict where it counts (qualifying a third *paper*) and too lenient where it shouldn't be (backfilling slot 3 with weak news/fill). Fixing 6.2+6.3 raises measured sims for genuinely good papers, which flips more digests into the 3-paper path and starves the lenient fill paths.

### 6.5 Dedup is exact-title-only; no ID-based identity

Every dedup set (`seenSearchTitles`, `seenPaperTitles`, `seenTitles`) keys on `title.toLowerCase()`. Misses:
- Same work with title variants (arXiv preprint vs published version, subtitle/punctuation/casing-in-unicode differences, trailing periods).
- `openAlexId` is fetched and mapped (open-alex.ts:88) but never stored on digest papers or used for dedup.
- The 30-day window means a paper legitimately reappears on day 31 even if the user just read it.

**Fix direction:** persist `openAlexId`/DOI with each saved paper and dedup on ID first, normalized title second; consider "seen ever" for papers actually shown to the user (they're in the vault — repetition of *shown* papers has no statute of limitations).

### 6.6 Query generation has no memory, so retrieval re-treads the same ground

Interest rotation penalizes *interests* and theme novelty compares *theme words*, but nothing tracks the **search queries** themselves. Similar interests → the LLM writes near-identical 3-5 word queries day after day → same OpenAlex window (6.2.2) → same candidates, filtered only by title dedup. Fill pass 2 is worse: it searches the bare `focusInterest` string sorted by date (digest.ts:759) — a fixed query per interest returning a nearly fixed result set each run.

**Fix direction:** store the 3 queries per digest; pass the last ~10 queries into the hypothesis prompt ("don't re-search these"); add a random OpenAlex page offset or `sample` parameter as cheap diversification.

### 6.7 Doc drift: theme novelty is word-overlap, not embedding

`algorithm.md` (Step 1) says themes are "embedded and compared to last 5 themes, similarity >0.5". The code (digest.ts:361-387) actually does a ≥2 non-stop-word overlap check. The doc describes a better system than what exists (and Part 5.2 already flagged the word check as too weak).

### Recommended fixes (priority order)

1. **Sort OpenAlex by relevance, filter by year** (6.2) — one-line change with the largest expected relevance gain; likely also reduces repetition (relevance ordering varies with query wording; year ordering doesn't).
2. **Score candidates against their search query, not the headline** (6.3) — realigns the whole threshold cascade; expect fewer theme retries and more 3-paper digests.
3. **ID-based + normalized-title dedup, "seen ever" for shown papers** (6.5).
4. **Query memory in the hypothesis prompt + kill the bare-interest fill query** (6.6).
5. **Tighten slot 3:** apply `isNewsRelevant` to the primary news path; drop the 0.10 broad-news fill to a floor consistent with the rest (≥0.15 + word guard) and prefer honest 2-source digests (6.4).
6. **Consider a true multi-source union** (OpenAlex ∪ S2 top-5 each, ID-dedup) only after 1-2 land — it's the smallest win of the set (6.1).

### Part 6 implementation status (2026-07-23)

Fixes 1-5 shipped the same day as the audit: OpenAlex `relevance_score:desc` sort (6.2), `relSim = max(theme, originating query)` scoring + BM25 over theme+queries (6.3), `open_alex_id` + normalized-title dedup across ALL past digests (6.5), query memory via `digests.search_queries` + varied broad-fill query (6.6), word guard on primary news + broad-news floor 0.10 → 0.15 (6.4). Also fixed the brief-card duplicate stat chunk. NOT done: multi-source union (6.1, deliberately deferred) and the 6.7 doc drift is now documented honestly in algorithm.md rather than changed to embeddings.

DB migration (run on local sqlite AND Turso prod):
```sql
ALTER TABLE digests ADD COLUMN search_queries TEXT;
ALTER TABLE papers ADD COLUMN open_alex_id TEXT;
```

---

## Part 7: Sourcing Diversity & Depth — recency monoculture, foundational papers, interest coverage (audited 2026-07-24)

User-reported concerns: (a) fear of unrelated/uninteresting papers slipping through, (b) everything is from 2024-2026 and there's no path to foundational texts (the "Weiser 1991" problem), (c) digests cluster on a few interests (fonts, venture, AI) — is that bias in the pipeline or just venue availability?

### 7.1 Relevance drift: mostly fixed by Part 6, three residual gaps

The Part 6 fixes (relevance-sorted OpenAlex, query-anchored `relSim`, word guards on news) closed the biggest holes. What remains:

1. **The query anchor can over-admit.** `relSim = max(themeSim, querySim)` (digest.ts:530-535) means a paper only has to match its *originating search query* at 0.25 to qualify — even if that query itself drifted from the theme (the LLM writes queries before any paper exists; nothing validates query↔theme alignment). The LLM re-rank (Step 4b) is the backstop, but it only fires when ≥2 paper items survive, and its replacement pool (`qualified`) was gated by the same signal.
2. **Degraded mode is now fail-closed but silent.** With ONNX down, unknown pairs return 0.1 < every gate → nothing qualifies → theme retries burn → final fallback takes "top 3 by score", which at that point is BM25-only ranking. Correct direction (conservative), but a cold-start digest is quietly a keyword-ranked digest. Consider surfacing degraded mode in the digest row for later quality triage.
3. **Fill passes 2-3 remain the leak.** Thresholds 0.15-0.18 against theme-or-fill-query, explicitly "accept anything somewhat related" (digest.ts:824). Known and documented (6.4); the honest-2-source preference mitigates but the passes still run before the re-rank drop logic, and fill papers added *after* Step 4b's shortlist was formed are never LLM-scored at all if they arrive in passes that run post-rerank — they don't; fills run before 4b, so they ARE re-ranked. The actual residue: pass 2/3 papers score against a *fill query* even further from the theme than the originating queries.

**Verdict on concern (a):** the gate stack (floor → cascade → predatory filter → LLM re-rank with drop) is genuinely layered now; the most likely unrelated-paper path today is query drift (7.1.1), not threshold leakage.

### 7.2 Foundational papers are structurally impossible, while the UI pretends they exist

1. **The 2-year hard window.** All main-path searches call `searchPapers(query, 10, "publicationDate", field)`, and OpenAlex "recent" mode applies `publication_year:{Y-2}-{Y}` as a *filter* (open-alex.ts:131-133). A foundational text never loses a ranking contest — it is excluded from the candidate pool before ranking happens. Semantic Scholar mirrors the same window (semantic-scholar.ts:63-67). The only unwindowed path is fill pass 1 (`citationCount` sort), which fires only when slots remain unfilled.
2. **`category: "foundational"` is a lie today.** Wide-pool slot 0 — simply the top MMR pick, a 2024-2026 paper — is tagged `foundational` (digest.ts:662), and `papers-mode.tsx:37` renders it as "A foundational view". The schema enum, DB column, and a UI hook already exist; only the retrieval behind them doesn't.
3. **Prompts actively suppress old papers.** `selectionSkeletonPrompt` (prompts.ts:203): ">5 years old must offer something newer papers can't… Don't pick old papers just because they're highly cited." Right instinct for the recent pool, but it means even if an old paper leaked in, selection is biased against it. (The ERA AWARENESS block in prompts.ts:272 shows the synthesis side is already prepared to handle dated papers well.)
4. **arXiv fallback fabricates recency**: `year: new Date().getFullYear()` for every result (digest.ts:100) — an old paper arriving via arXiv would be mislabeled as current. Near-dead path (6.1), but it corrupts the year signal the staleness guard and recency bonus rely on.

**Design direction — a real foundational slot ("shared ancestor" method, preferred):**
- After Step 3b selects the recent papers, fetch their OpenAlex `referenced_works` (1 batched call per paper, IDs are already in hand via `relatedWorkIds`/select fields — add `referenced_works` to `OA_SELECT`). Find the most-cited *common or near-common ancestor* ≥8 years old above a citation bar (e.g. >500). That is a principled definition of "set the stage for this field of thought" — it's literally what today's papers built on — and it's theme-specific for free, no extra embedding gate needed.
- Fallback when no shared ancestor clears the bar: one extra OpenAlex query per digest with `sort=cited_by_count:desc`, `publication_year:<Y-8`, `cited_by_count:>500`, using the domain-vocabulary search query (not the headline), then one cheap LLM yes/no: "is this genuinely a foundational text for {theme}, or just an old survey?"
- **Cadence: not every digest.** Ship it only when a candidate clears both bars — scarcity is what makes the gold border mean something. Expect ~1-2 per week.
- **Presentation:** the enum and card hook exist. Add gold border treatment + a stored one-liner (`foundationalReason`: "This 1991 essay coined 'ubiquitous computing' — the frame every ambient-tech paper since has argued with") generated in Stage A alongside the takeaway. Loosen the prompts.ts:203 age rule for items tagged foundational; the ERA AWARENESS machinery already handles the synthesis tone.
- **Do NOT** relax the 2-year window on the main pool — recency-by-default is the right product call (user-confirmed); foundational is a separate, additive retrieval lane with its own bar.

### 7.3 Interest diversity: the sampler is fair, the layers around it aren't

The weighted sampler + rotation penalty (digest.ts:233-254) is sound. The clustering pressure comes from four surrounding mechanisms:

1. **The LLM is the real selector and it has taste.** Sampling picks 5 candidates; the hypothesis LLM picks 1-3 of them — and it's instructed to prefer interests that make catchy, dinner-table, naturally-connecting questions (digest.ts:316-321). AI/fonts/venture are simply easier to write a punchy 8-word headline about than consciousness. Nothing counteracts this preference: `seed_interests` (which interests the LLM actually chose) is persisted per digest but **never fed back into rotation** — the penalty instead uses noisy word-overlap between interest keywords and theme/paper words (2.6, still true).
2. **Rich-get-richer via engagement.** Stars add +0.1 to the best-matching interest, and you can only star what you're shown. Interests that never get picked earn no boosts while decaying ×0.95/day, so their sampling odds shrink over time. The learning loop amplifies the LLM's selection bias instead of correcting it.
3. **Theme-retry drift toward well-published fields.** When a consciousness-flavored theme finds few papers (thin OpenAlex abstract coverage + the 2-year window hits humanities/philosophy hardest), the retry prompt demands "a concrete, researchable angle" (digest.ts:444) — which in practice means drifting back to CS/AI. So venue availability is real, but the pipeline *converts* it into interest bias rather than compensating.
4. **Field mapping gaps (historical).** `OA_CONCEPT_MAP` once lacked HCI, Design, Neuroscience, and Cognitive Science. That map was filled in, then removed from the digest's primary OpenAlex path entirely on 2026-08-15: routing now uses IDs from the sampled OpenAlex Topic. The map remains only for older/other callers that still pass a free-form field.

**Verdict on concern (c):** it's both — venues do carry more AI/design material, but three pipeline layers (LLM selection with no fairness memory, engagement rich-get-richer, retry drift) each push the same direction, so the clustering is stronger than the venue base rate.

**Fix direction (priority order):**
1. **Exact-match rotation on `seed_interests`**: load the last ~7 digests' `seed_interests`, apply the -0.5/use penalty to those exact interests (replacing the word-overlap heuristic for this purpose). Cheap, data already stored.
2. **Coverage floor**: if an interest hasn't appeared in `seed_interests` for K digests (e.g. 10), force-include it in the candidate 5 and add one prompt line: "Interest X hasn't been featured in a while — strongly prefer it if it can carry a good question."
3. **Replace LLM field labels with taxonomy IDs** so punctuation, naming, and mapping gaps cannot affect the digest search path. Keep zero-result logging and deterministic widening for observability and recall.
4. **Measure before further tuning** — prod query: `SELECT json_extract(value,'$.keyword') kw, count(*) FROM digests, json_each(digests.seed_interests) WHERE date > date('now','-30 day') GROUP BY kw ORDER BY 2 DESC;` vs the interests table. If clustering persists after fixes 1-2, it's genuinely venue availability.

### Part 7 implementation status (2026-07-25)

Shipped:
- **7.2 Foundational lane** (Step 4c in digest.ts), two tiers: **Tier 1** fetches the selected papers' `referenced_works` (one batched OpenAlex call) and keeps ancestors ≥8 years old with >500 citations (ancestors shared by ≥2 of today's papers ranked first). **Tier 2** (when tier 1 surfaces nothing) mimics googling "foundational papers on X": web-search snippets ground an LLM that names up to 3 canonical works, each verified against OpenAlex (title match + same bars) so hallucinated titles die at the lookup. Both tiers end at the same LLM gate ("genuinely field-defining, not just an old survey") which writes the one-sentence `foundationalReason`. Additive 4th item; ships only when a candidate clears every bar. Gold border + ★ FOUNDATIONAL chip + reason line on `paper-card.tsx`; gold frame + reason teaser on the papers-mode RowCard. The 2-year window on the main pool is unchanged — recency stays the default.
- **7.2.2 Fake label fixed**: wide-pool slot 0 is now `category: "recent"`; `foundational` is reserved for the lane.
- **7.3 fix 1 — exact-match rotation**: the -0.5/use penalty now counts exact appearances in the last 5 digests' `seed_interests` (word-overlap heuristic kept only as fallback for pre-seed rows).
- **7.3 fix 2 — coverage floor**: with ≥10 digests, an interest absent from the last 10 digests' seeds is forced into the candidate 5 (highest-weight starved one) plus a "strongly prefer featuring it" prompt line.
- **7.3 fix 3 — OA_CONCEPT_MAP gaps**: added HCI (en-dash variant), Design, Neuroscience, Cognitive Science, Media Studies; searches log when a concept filter returns 0 results.
- **7.3 follow-up — deterministic taxonomy routing (2026-08-15)**: removed `focusField(s)` from the hypothesis contract. The main digest path now scopes with the sampled Topic/subfield IDs and widens strict → broad while retaining results. `OA_CONCEPT_MAP` is no longer on this path.

NOT done: 7.1.1 query↔theme alignment validation (LLM re-rank remains the backstop), 7.1.2 degraded-mode flag on digest rows, 7.2.4 arXiv fallback year fabrication (near-dead path).

DB migration (run on local sqlite AND Turso prod):
```sql
ALTER TABLE papers ADD COLUMN foundational_reason TEXT;
```
