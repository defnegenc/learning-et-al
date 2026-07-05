# Learning et al. — Digest Algorithm

> Referenced from CLAUDE.md. Always consult this before modifying the digest pipeline.

## Core Philosophy

Every digest is built around a **central question with wow factor** (max 8 words), not around a "best paper."

The question comes first. Papers are found to inform that question — not to answer it. A paper on AI bias can inform "Can AI be fashionable?" even if it doesn't mention fashion once. The synthesis frames everything as different lenses on the same question.

**The old approach (WRONG):** Find an anchor paper -> derive theme from anchor -> find papers related to anchor
**The current approach (RIGHT):** Generate a surprising central question from user interests -> search for papers that give us tools to think about that question -> revise theme to thread the actual papers together

---

## The Full Pipeline (step by step)

The code lives in `src/lib/pipeline/digest.ts`. Step labels here match the code comments.

### Step 1: Interest Selection & Central Question (AI calls 1-3)

**Interest sampling** (lines ~140-200):
- Fetch all user interests, **decay once per day** (`weight *= 0.95`). Skips decay if already decayed today (prevents double-decay on regeneration).
- Deduplicate by lowercased keyword. Drop keywords ≤2 chars.
- **Recency penalty**: loads paper keywords + title words from last 5 digests into `recentlyUsedKeywords`. Theme words also added as secondary signal. Any interest overlapping these words gets -0.5 penalty.
- **Weighted random sampling** without replacement to pick 5 candidates.

**Central question generation** (AI call 1, lines ~250-310):
- Trending headlines fetched via web search and injected as optional temporal context.
- LLM picks 1-3 interests, generates theme (max 8 words), 3 search queries, news query, and `focusFields[]` (array for cross-domain).
- **Theme validation**: if >8 words, a retry call (AI call 2, conditional) requests shorter version.
- **Theme novelty**: theme embedded and compared to last 5 themes. If similarity >0.5, a fresh-angle call (AI call 3, conditional) generates a completely different theme.
- Fallback: if LLM fails, top interest keyword is used as theme.

**Theme retry loop** (up to 2 retries): If the theme produces too few qualifying papers, the pipeline generates a fresh theme and re-searches. Each retry is an additional AI call.

### Step 2: Paper Search (lines ~370-400)

3 queries via source priority chain: **OpenAlex → Semantic Scholar → arXiv**.

- **Cross-domain field distribution**: queries distributed across `focusFields[]` (query 1 → field 1, query 2 → field 2, etc.)
- For beginner interests: `"introduction overview applications"` appended.
- All results deduplicated by title.
- Cross-digest dedup: skip papers seen in last 30 days.
- **Citation floor**: OpenAlex filters `cited_by_count:>1`.
- **Predatory venue filter**: papers from venues on the `PREDATORY_VENUES` list in `lib/venue-quality.ts` (SciRP, OMICS, Bentham Open, IJARCCE, etc.) are dropped at scoring. Soft penalty (-0.05 to quality boost) applied to high-volume controversial publishers (MDPI, Hindawi, "Frontiers in X" journals).

### Step 3: Hybrid Scoring + Wide Pool (lines ~430-540)

**Scoring**: BM25 + embedding (`all-MiniLM-L6-v2`) fused via **Reciprocal Rank Fusion** (k=60).

Quality boosts (scaled to RRF range):
- `recencyBonus`: +0.003 current year, +0.0015 last year
- `venueBoost`: `venueQualityBoost(venue, domain) * 0.03` (0 to ~0.0024)
- `instBoost`: `institutionBoost(institutions) * 0.03` (0 to ~0.0015)

Hard floor: `SIM_MIN_THEME = 0.15` (raw embedding similarity).

**Threshold cascade**: try `SIM_ONTOPIC` (0.25) → `SIM_MIDPOINT` (0.20) → `SIM_FALLBACK` (0.18) → hard floor (0.15). If still <2, take top papers by score.

**Theme retry on weak match**: only breaks the theme retry loop early when papers pass `SIM_MIDPOINT` or higher. If papers only pass below `SIM_MIDPOINT`, the pipeline retries with a new theme before accepting weak-match papers.

**Dynamic item count** (lines ~568-581): counts papers above `SIM_ONTOPIC`.
- ≥3 strong papers → 3 papers + 0 news
- ≤1 strong paper → 1 paper + 2 news
- Otherwise → 2 papers + 1 news (default)

**Wide pool via MMR** (λ=0.6): selects ~6 diverse papers from qualified candidates. MMR penalizes candidates similar to already-picked papers.

### Step 3b: LLM Complementarity Selection (AI call 4, lines ~548-587)

If the wide pool has more papers than needed, `selectionSkeletonPrompt` asks the LLM to pick the best N for complementarity:
- Selects papers that each contribute something DIFFERENT
- Creates genuine TENSION (supports + complicates + alternative mechanism)
- Returns `selectedIndices`, `selectionReasoning`, `coreTension`, `argumentArc`, `paperRoles`
- Falls back to top-N by score if LLM fails.
- Note: `argumentArc` and `paperRoles` from this step are currently discarded — Stage B re-derives them. Could be consolidated.

### Step 4: News Search (lines ~680-730)

When news slots are needed:
- Web search via Serper / DuckDuckGo using `newsQuery + focusInterest + currentYear-1 + currentYear`.
- Scored by embedding similarity to theme (raw cosine, threshold 0.15).
- **Listicle filter**, **academic domain filter** (20+ publisher domains), dedup.
- **Paywall detection**: article fetcher rejects pages with 2+ paywall signals.
- Article text via **paragraph density scoring** (`<p>` tag extraction), longest-run heuristic as fallback.
- RSS fallback: **field-specific feeds** + Google News RSS by topic.
- **`isNewsRelevant`** validation (word-count guard) only applied to RSS fallback, NOT primary web search path.

### Step 4 Fill Passes (lines ~732-825)

If items < 3 after news search:
- Pass 1: third search query with moderate threshold
- Pass 2: broad fill without field filter
- Pass 3: search using theme text as query (last resort)
- Pass 4: if still only 1 item, broad news search with very lenient threshold (0.10) for a second source

Minimum target: 2 sources. 1 is acceptable if nothing else fits.

### Step 4b: LLM Re-Ranking (AI call 5, lines ~830-900)

After all items are assembled, papers are scored on two dimensions:
- **Relevance** (1-3): does the paper directly address the theme question?
- **Insight** (1-3): does it offer a surprising or useful lens?

Combined score ≤3 → attempt swap with next-best from qualified pool. **If no replacement exists, the paper is kept** — dropping-without-refill collapsed digests to 2 items and stretched the synthesis thin. Graceful degradation: if LLM fails, embedding-ranked papers are kept. Worst papers are processed first so the best replacements go to the worst slots.

### Step 5: Theme Revision (AI call 6, lines ~900-925)

LLM sees actual papers (600 chars of abstract each) and conditionally revises the central question.
- **Keep** the original theme if all papers genuinely fit it — prevents the theme from being warped to accommodate a loosely-related paper that should have been cut.
- **Revise** if the papers collectively suggest a different, better-fitting angle.
- Max 8 words, punchy magazine-cover energy.
- Returns `kept_original: true|false` for logging.

### Step 6: Multi-Stage Synthesis (AI calls 7-13)

Six stages based on research (Radev 2000, Yao 2023, Madaan 2023):

**Stage A: Metadata** (AI call 7) — per-paper summaries, keywords, findings, connectionToTheme, **plainName** (plain-language paper name shown on cards above the academic title), keyConcepts, suggestedQuestions. Uses `metadataPrompt`. keyConcepts now aggressively captures jargon a non-expert trips on — model/system names (RoBERTa, DistilBERT), technical methods (subword tokenization, self-attention), and acronyms (EEG, NLP) — so the synthesis hover-definitions actually fire on scary words.

**Stage B: Argument Skeleton** (AI call 8) — cross-document relations (agrees/contradicts/extends/alternative_mechanism/unrelated), paper roles, core tension, argument arc. Uses `skeletonPrompt`.

**Stage C: Synthesis Draft** (AI call 9) — writes the paragraph following skeleton's argument arc. Explicit list of papers that MUST appear in bold. Uses `synthesisFromSkeletonPrompt`.

**Stage C.5: Factual Accuracy Check** (AI call 10) — verifies each paper's contribution is accurately represented in the synthesis. If issues found, a revision call (AI call 11, conditional) corrects them. All revision calls include "ALL papers MUST remain in bold" guard.

**Stage D: Self-Critique** (AI call 12, always fires) — critiques synthesis on 5 dimensions: argument, connection, accessibility, specificity, coverage (each 1-5). If any score <4, revision call (AI call 13, conditional) fires. Uses `synthesisCritiquePrompt` + `synthesisRevisionPrompt`.

**Final Coverage Gate** (AI call 14, conditional) — runs AFTER all revisions. Extracts all `**bold phrases**` from synthesis and checks each paper's shortName/title/author against them. If any paper is missing from bold text, a targeted revision adds it. This is the last synthesis modification — nothing overwrites after this.

### Step 6b: Digest Header — gist + framing (AI call, always after final synthesis)

Powers the zero-click header rendered under the central question (`DigestHeader` in
`today-page.tsx`, shown in all modes). One JSON call over the FINAL synthesis returns:
- **gist** — a one-sentence answer to the central question (≤25 words, plain English, leads with the answer). The reader gets the payoff before clicking through sources.
- **framing** — a curatorial one-liner (≤15 words) naming the tension or surprising pairing; grounded only in the papers (no invented trends).

Also persisted: **seed_interests** (`[{keyword, field}]`, the interests the Step-1 LLM
selected) — free, no AI call — which drives the header's domain chips (colored via
`field-hierarchy.ts`). Generated in the same block as `suggestedAnswers` so both logged-in
and public paths get them.

Note: the Step-1 theme prompt (`hypothesisPrompt`) now also requires at least one concrete,
picturable noun, so titles are graspable, not just punchy.

### Step 7: Storage

- Digest saved with: theme, synthesis, keyConcepts, suggestedQuestions, seed_interests, gist, framing, starred flag.
- Papers saved with: summaries, keywords, key findings, connectionReason, plainName.
- All linked to user and dated.

---

## Total AI Calls Per Digest: 9-15

| # | Call | Step | When | Input tokens (approx) | Output (approx) |
|---|------|------|------|-----------------------|-----------------|
| 1 | Hypothesis generation | 1 | Always | ~800 | ~100 |
| 2 | Theme shortening | 1 | If >8 words | ~100 | ~30 |
| 3 | Theme novelty retry | 1 | If sim >0.5 to recent | ~400 | ~100 |
| 4 | Theme retry (bad papers) | 1 | Up to 2x if <2 papers | ~800 | ~100 |
| 5 | Complementarity selection | 3b | If wide pool > target | ~2000 | ~200 |
| 6 | LLM re-ranking | 4b | If ≥2 papers | ~600 | ~100 |
| 7 | Theme revision | 5 | Always | ~3000 | ~50 |
| 8 | Metadata (Stage A) | 6 | Always | ~6000 | ~600 |
| 9 | Skeleton (Stage B) | 6 | Always | ~4000 | ~300 |
| 10 | Synthesis draft (Stage C) | 6 | Always | ~5000 | ~400 |
| 11 | Factual accuracy check | 6 | Always | ~3000 | ~200 |
| 12 | Factual accuracy revision | 6 | If issues found | ~2000 | ~400 |
| 13 | Self-critique (Stage D) | 6 | Always | ~2000 | ~200 |
| 14 | Self-critique revision | 6 | If any score <4 | ~2000 | ~400 |
| 15 | Final coverage revision | 6 | If paper missing in bold | ~1500 | ~400 |

**Typical: 10-12 calls.** Calls 2-4, 12, 14, 15 are conditional. Cost: ~$0.01-0.02 per digest at Gemini Flash pricing.

---

## Validation Gates

| Gate | Threshold | Applied at |
|------|-----------|-----------|
| SIM_MIN_THEME | cosine > 0.15 | Step 3 hard floor |
| SIM_ONTOPIC | cosine > 0.25 | Step 3 paper qualification |
| SIM_FALLBACK | cosine > 0.15 | Step 3 cascade fallback |
| News embedding | cosine > 0.15 (raw) | Step 4 web results |
| Broad news fallback | cosine > 0.10 | Step 4 fill pass 4 |
| Listicle filter | regex + domain blocklist | Step 4 web results |
| Academic domain | hostname check (20+ domains) | Step 4 web results |
| Paywall detection | 2+ paywall signals | Step 4 article fetch |
| Theme novelty | cosine > 0.5 vs recent themes | Step 1 |
| Theme word count | ≤ 8 words | Step 1 |
| LLM re-rank | score > 2 to keep | Step 4b |
| Cross-digest dedup | last 30 days | Step 2 |
| Citation floor | cited_by_count > 1 | Step 2 OpenAlex |
| Bold coverage | all papers in **bold** | Step 6 final gate |

Note: `SIM_MIN_THEME` (0.15) equals `SIM_FALLBACK` (0.15), making the cascade's last step equivalent to the hard floor.

---

## Degraded Mode (ONNX unavailable)

When the local embedding model fails to load (e.g., Vercel cold starts):
- `isEmbeddingDegraded()` returns `true`, warning logged
- Cosine similarity falls back to keyword overlap
- Unknown text pairs return **0.1** (conservative — was 0.3, which bypassed all gates)
- LLM re-ranking + complementarity selection partially compensate

---

## Learning System

Engagement only boosts **existing** interests. Weight changes are intentionally tiny.

| Signal | Effect | Cap |
|--------|--------|-----|
| Star on paper | +0.1 to best-matching interest | 3.0 |
| Dislike on paper | -0.05 to matching keywords | floor 0 |
| Dig deeper question | +0.05 to interest matching anchor paper | 3.0 |
| Daily decay | ×0.95 applied once per day | — |

Feedback events also store contextual features (paper category, source, year, keywords, cross-domain flag) for future richer learning.

---

## Known Issues

1. **`SIM_MIN_THEME` = `SIM_FALLBACK`**: Both 0.15 — the cascade's last step is a no-op. Should either raise `SIM_MIN_THEME` or lower `SIM_FALLBACK`.
2. **`tensionHint` field unused**: declared on `TaggedItem` and passed to synthesis, but never assigned. Dead signal path.
3. **`digestPrompt` is dead code**: legacy single-call prompt, never called. `SYNTHESIS_RULES` also dead (only reachable from `digestPrompt`).
4. **`finalPaperListing` redundant**: identical to `paperListing` since skeleton no longer drops papers.
5. **Complementarity selection output wasted**: `argumentArc` and `paperRoles` from Step 3b are discarded, then re-derived in Stage B at cost.
6. **`isNewsRelevant` only on RSS path**: primary web search news only checks embedding similarity, not the stricter word-count guard.
7. **News short snippets**: embedding similarity on 1-2 sentence snippets is imprecise, contributing to irrelevant news.
8. **Content mix slider not wired**: stored in DB, not used by pipeline. Dynamic item count uses candidate quality instead.
9. **all-MiniLM-L6-v2 cross-domain weakness**: general-purpose embeddings, not trained on scientific papers. SPECTER2 would improve paper-to-theme matching.

---

## What Worked

- **Theme-first approach** produces genuinely interesting cross-domain questions
- **BM25 + embedding RRF** catches both semantic and keyword matches
- **MMR wide pool → LLM complementarity selection** finds papers that genuinely tension each other
- **Multi-stage synthesis** (skeleton → draft → fact-check → critique → revise → coverage) dramatically improves quality
- **Bold coverage gate** catches papers dropped during revisions
- **Theme revision step** catches bad themes
- **Interest rotation** prevents same-topic digests
- **"Max 8 words" enforced** makes themes punchy
- **Banning specific AI-speak words** dramatically improves output
- **LLM re-ranking** catches topically related but uninformative papers
- **Theme novelty scoring** prevents repetitive theme patterns
- **Academic domain filter** excludes journal articles from news slots
- **Dynamic item count** adapts to available quality
- **Broad news fallback** ensures minimum 2 sources when papers are scarce

## What Didn't Work

- **Anchor paper approach**: highly cited papers dominated
- **Citation graph**: cross-field contamination
- **Keyword matching for relevance**: terrible precision
- **Auto-creating interests from engagement**: polluted feed
- **Weight boost of +0.5 per star**: too aggressive
- **"Paper A"/"Paper B" labels in synthesis**: AI used them instead of titles
- **Letting AI decide whether to revise theme**: always said false
- **Single-call synthesis**: no structure, no self-critique
- **Per-item sequential synthesis**: chain, not lenses
- **Theme word matching for recency penalty**: imprecise
- **Returning 0.3 for unknown embeddings**: bypassed all gates
- **Single focusField for cross-domain**: secondary domain never found
- **Counter-query for tension**: replaced by LLM complementarity selection
- **No jargon ban in themes**: generated "Can better architecture solve computational bottlenecks?" Fixed.
- **No redundancy guard in selection**: two papers making the same point. Fixed.
- **No staleness guard**: 2015 paper alongside 2026 papers. Fixed.
- **Skeleton dropping papers post-fill**: shrank digests to 1 item with no refill. Removed.
- **Coverage check on plain text instead of bold**: matched "lung" anywhere, not inside `**bold**`. Fixed.
- **SIM_MIN_THEME at 0.12**: let Bhagavad Gita papers through for AI themes. Raised to 0.15.
- **SIM_ONTOPIC at 0.30**: too strict, rejected all papers for some themes. Reverted to 0.25.

---

## Top 3 Ideas to Improve (rolling)

1. **Consolidate complementarity selection + skeleton**: Step 3b's `argumentArc`/`paperRoles` output is wasted, then re-derived in Stage B. Could save 1 LLM call.
2. **Apply `isNewsRelevant` to primary web search path**: currently only guards RSS fallback, not the main news path.
3. **User digest feedback loop**: rate digests 1-5 to fine-tune interest weights and theme quality.
