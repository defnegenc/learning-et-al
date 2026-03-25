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
- **Theme novelty**: theme embedded and compared to last 5 themes. If similarity >0.7, a fresh-angle call (AI call 3, conditional) generates a completely different theme.
- Fallback: if LLM fails, top interest keyword is used as theme.

### Step 2: Paper Search (lines ~370-400)

3 queries via source priority chain: **OpenAlex → Semantic Scholar → arXiv**.

- **Cross-domain field distribution**: queries distributed across `focusFields[]` (query 1 → field 1, query 2 → field 2, etc.)
- For beginner interests: `"introduction overview applications"` appended.
- All results deduplicated by title.
- Cross-digest dedup: skip papers seen in last 30 days.
- **Citation floor**: OpenAlex filters `cited_by_count:>1`.

### Step 3: Hybrid Scoring + Wide Pool (lines ~430-540)

**Scoring**: BM25 + embedding (`all-MiniLM-L6-v2`) fused via **Reciprocal Rank Fusion** (k=60).

Quality boosts (scaled to RRF range):
- `recencyBonus`: +0.003 current year, +0.0015 last year
- `venueBoost`: `venueQualityBoost(venue, domain) * 0.03` (0 to ~0.0024)
- `instBoost`: `institutionBoost(institutions) * 0.03` (0 to ~0.0015)

Hard floor: `SIM_MIN_THEME = 0.12` (raw embedding similarity).

**Dynamic item count** (lines ~484-497): counts papers above `SIM_ONTOPIC` (0.25).
- ≥3 strong papers → 3 papers + 0 news
- ≤1 strong paper → 1 paper + 2 news
- Otherwise → 2 papers + 1 news (default)

**Wide pool via MMR** (λ=0.6): selects ~6 diverse papers from qualified candidates. MMR penalizes candidates similar to already-picked papers.

### Step 3b: LLM Complementarity Selection (AI call 4, lines ~548-587)

If the wide pool has more papers than needed, `selectionSkeletonPrompt` asks the LLM to pick the best N for complementarity:
- Selects papers that each contribute something DIFFERENT
- Creates genuine TENSION (supports + complicates + alternative mechanism)
- Returns `selectedIndices`, `selectionReasoning`, `coreTension`, `argumentArc`
- Falls back to top-N by score if LLM fails.

### Step 4: News Search (lines ~595-695)

When news slots are needed:
- Web search via Serper / DuckDuckGo using `newsQuery + focusInterest + currentYear-1 + currentYear`.
- Scored by embedding similarity to theme (raw cosine, threshold 0.15).
- **Listicle filter**, **academic domain filter** (20+ publisher domains), dedup.
- **Paywall detection**: article fetcher rejects pages with 2+ paywall signals.
- Article text via **paragraph density scoring** (`<p>` tag extraction), longest-run heuristic as fallback.
- RSS fallback: **field-specific feeds** + Google News RSS by topic (no longer hardcoded US tech only).
- Last resort: fill with academic papers, correctly labeled `category: "recent"`.

### Step 4b: LLM Re-Ranking (AI call 5, lines ~702-759)

After all items are assembled, papers are scored 1-5 on **"tool to think with" quality**:
- 5 = changes how you think about the question
- 3 = related but no new angle
- 1 = topically adjacent, contributes nothing

Papers scoring ≤2 are swapped with the next-best from the qualified pool. The swapped paper preserves the original slot's `category`. Graceful degradation: if LLM fails, embedding-ranked papers are kept.

### Step 5: Theme Revision (AI call 6, lines ~761-810)

LLM sees actual papers (600 chars of abstract each) and revises the central question.
- Max 8 words, punchy magazine-cover energy.
- Instruction: "ALWAYS revise" — learned from experience that opt-out always results in no revision.
- Must capture what papers are ACTUALLY about at their core, not surface topic.

### Step 6: Multi-Stage Synthesis (AI calls 7-10, lines ~812-920)

Four stages based on research (Radev 2000, Yao 2023, Madaan 2023):

**Stage A: Metadata** (AI call 7) — per-paper summaries, keywords, findings, connectionToTheme, keyConcepts, suggestedQuestions. Uses `metadataPrompt`.

**Stage B: Argument Skeleton** (AI call 8) — cross-document relations (agrees/contradicts/extends/alternative_mechanism/unrelated), paper roles, core tension, argument arc, skip recommendations. Uses `skeletonPrompt`. Papers with `tensionHint` get `[HINT: ...]` annotations.

**Stage C: Synthesis Draft** (AI call 9) — writes the paragraph following skeleton's argument arc. Papers marked "is_weak_fit" are mentioned briefly or skipped. Uses `synthesisFromSkeletonPrompt`.

**Stage D: Self-Refine** (AI call 10, conditional) — critiques synthesis on 4 dimensions (argument, connection, accessibility, specificity, each 1-5). If any <4, revises based on specific feedback. Uses `synthesisCritiquePrompt` + `synthesisRevisionPrompt`.

### Step 7: Storage

- Digest saved with: theme, synthesis, keyConcepts, suggestedQuestions, starred flag.
- Papers saved with: summaries, keywords, key findings, connectionReason.
- All linked to user and dated.

---

## Total AI Calls Per Digest: 7-10

| # | Call | Step | When | Input tokens (approx) | Output (approx) |
|---|------|------|------|-----------------------|-----------------|
| 1 | Hypothesis generation | 1 | Always | ~800 | ~100 |
| 2 | Theme shortening | 1 | If >8 words | ~100 | ~30 |
| 3 | Theme novelty retry | 1 | If sim >0.7 | ~400 | ~100 |
| 4 | Complementarity selection | 3b | If wide pool > target | ~2000 | ~200 |
| 5 | LLM re-ranking | 4b | If ≥2 papers | ~600 | ~100 |
| 6 | Theme revision | 5 | Always | ~3000 | ~50 |
| 7 | Metadata (Stage A) | 6 | Always | ~6000 | ~600 |
| 8 | Skeleton (Stage B) | 6 | Always | ~4000 | ~300 |
| 9 | Synthesis draft (Stage C) | 6 | Always | ~5000 | ~400 |
| 10 | Self-critique + revision (Stage D) | 6 | If any score <4 | ~2000 | ~550 |

**Typical: 8-9 calls.** Calls 2, 3, and 10 are conditional. Call 4 fires when pool > target (usually true).

---

## Validation Gates

| Gate | Threshold | Applied at |
|------|-----------|-----------|
| SIM_MIN_THEME | cosine > 0.12 | Step 3 hard floor |
| SIM_ONTOPIC | cosine > 0.25 | Step 3 paper qualification |
| SIM_FALLBACK | cosine > 0.15 | Step 3 fallback threshold |
| News embedding | cosine > 0.15 (raw, not RRF) | Step 4 web results |
| Listicle filter | regex + domain blocklist | Step 4 web results |
| Academic domain | hostname check (20+ domains) | Step 4 web results |
| Paywall detection | 2+ paywall signals | Step 4 article fetch |
| Theme novelty | cosine < 0.7 vs recent themes | Step 1 |
| Theme word count | ≤ 8 words | Step 1 |
| LLM re-rank | score > 2 to keep | Step 4b |
| Cross-digest dedup | last 30 days | Step 2 |
| Citation floor | cited_by_count > 1 | Step 2 OpenAlex |

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

## Known Limitations

1. **LLM determinism**: themes vary on regeneration. Acceptable — regeneration is explicit.
2. **Single-word interests**: weaker themes. LLM finds surprising within-domain angles.
3. **SIM_ONTOPIC at 0.25**: relatively loose. MMR diversity + LLM selection + re-ranking compensate.
4. **News validation**: multi-layered but short snippets can still produce false positives.
5. ~~**Academic papers in news slots**~~ (FIXED): fallback papers now `category: "recent"`, academic domains filtered from news.
6. ~~**Sequential synthesis**~~ (FIXED): 4-stage pipeline with skeleton + self-refine.
7. **Content mix slider**: stored in DB, not wired to pipeline. Default 2+1, dynamically adjusted by candidate quality.
8. **all-MiniLM-L6-v2 cross-domain weakness**: configurable via `EMBEDDING_MODEL` env var (`bge-small-en-v1.5` available), but default unchanged.
9. **Recency penalty imprecision**: paper keywords are primary signal, but theme words are still merged in as secondary. Over-penalization can still occur for shared words.
10. **`tensionHint` field unused**: declared on `TaggedItem` and passed to synthesis, but never assigned. The complementarity selection step achieves tension through its own mechanism instead.

---

## What Worked

- **Theme-first approach** produces genuinely interesting cross-domain questions
- **BM25 + embedding RRF** catches both semantic and keyword matches
- **MMR wide pool → LLM complementarity selection** finds papers that genuinely tension each other
- **4-stage synthesis** (skeleton → draft → critique → revise) dramatically improves quality
- **Theme revision step** catches bad themes
- **Interest rotation** prevents same-topic digests
- **"Max 8 words" enforced** makes themes punchy
- **Banning specific AI-speak words** dramatically improves output
- **LLM re-ranking** catches topically related but uninformative papers
- **Theme novelty scoring** prevents repetitive theme patterns
- **Academic domain filter** excludes journal articles from news slots
- **Dynamic item count** adapts to available quality

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
- **Counter-query for tension (attempted)**: replaced by LLM complementarity selection which picks from a wide pool rather than generating counter-searches
- **No jargon ban in themes**: LLM generated themes like "Can better architecture solve computational bottlenecks?" — technically valid, zero human appeal. Fixed by banning technical terms and adding dinner table test.
- **No redundancy guard in selection**: LLM picked two papers making the same point (both say "X is faster"), producing boring digests. Fixed by explicit "if two papers agree, drop one" rule.
- **No staleness guard**: 2015 Faster R-CNN picked alongside 2026 papers — added nothing new. Fixed by requiring old papers to justify their inclusion.

---

## Top 3 Ideas to Improve (rolling)

1. **Wire up `tensionHint`**: the complementarity selection's `coreTension` could be passed as a hint to synthesis Stage B for even more reliable tension framing.
2. **User digest feedback loop**: rate digests 1-5 to fine-tune interest weights and theme quality.
3. **Adaptive synthesis length**: longer when papers connect well, shorter when connection is a stretch.
