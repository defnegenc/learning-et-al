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

### 3.1 Single `focusField` undermines cross-domain search

The LLM returns one `focusField` string for all 3 search queries. When the theme combines "AI + fashion," all OpenAlex queries filter by whichever field the LLM picked (probably Computer Science). Fashion-tech papers, textile engineering, consumer behavior research — anything in the secondary domain — gets filtered out at the API level.

**Research context:** Cross-domain recommendation is a known hard problem. The CORD framework ([Zhu et al., 2021](https://arxiv.org/abs/2108.09563)) shows that effective cross-domain retrieval requires querying each domain separately and merging results. The current single-field approach structurally prevents the cross-domain discovery that the algorithm's philosophy promises.

**Fix:** Return `focusFields: ["Computer Science", "Art"]` from the LLM and split queries across fields.

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
| 3.1 | Single focusField blocks cross-domain | M | H | Architecture | **FIXED** — `focusFields[]` array, queries distributed across fields |
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
