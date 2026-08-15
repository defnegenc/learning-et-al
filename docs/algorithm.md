# Learning et al. — Digest Algorithm

> Referenced from CLAUDE.md. Always consult this before modifying the digest pipeline.

## Core Philosophy

Every digest is built around a **central question with wow factor** (aim for 8 words, hard max 10), not around a "best paper."

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
- **Rotation penalty (exact-match)**: counts how many of the last 5 digests' `seed_interests` featured each interest — -0.5 per appearance (capped -1.5). This replaced theme-word overlap, which penalized "machine learning" because a theme said "machines" (audit 7.3); word overlap survives only as a fallback for rows predating `seed_interests`.
- **Weighted random sampling** without replacement to pick 5 candidates.
- **Coverage floor** (audit 7.3): with ≥10 digests, an interest absent from the last 10 digests' `seed_interests` is forced into the candidate 5 (highest-weight starved one), and the hypothesis prompt gets a "strongly prefer featuring it" line. Counters the Step-1 LLM's bias toward interests that make catchy questions.

**OpenAlex topic seed** (added 2026-08-14):
- Choose the starved interest when the coverage floor fired; otherwise use slot 0 from the weighted sample. Slot 0 is itself weight-proportional, so this does not turn list order into a hidden preference.
- Resolve that interest against the live OpenAlex taxonomy. An exact **field** such as Computer Science walks field → sampled subfield → sampled topic; an exact **subfield** such as Human-Computer Interaction walks directly to its topics; a free-form interest such as microbiome uses OpenAlex's relevance-ranked topic search.
- Exclude topic IDs used in the last 8 digests before sampling. For broad-field walks, also exclude recently used subfield IDs. When a finite pool is exhausted, reset it instead of failing generation.
- Require ≥3,000 works so a beautifully named but paper-thin topic is unlikely to strand the 2-year recent-paper search.
- Sampling inside the vetted pool uses a square-root rank discount (`1 / sqrt(rank + 1)`). Front-ranked/relevant topics remain more likely, but lower-ranked topics retain meaningful probability. This is **structured exploration**: novelty is bounded by a real research neighborhood rather than uniform randomness.
- Pass the topic name, description, subfield, and first 10 keywords into the hypothesis call as grounding. The prompt must find the human tension inside the topic, not copy its academic label. Search retries keep the topic and reformulate the angle/queries rather than abandoning it for generic AI.
- Persist `digests.seed_topic` as `{id, name, interest, subfield, subfieldId}`. This is rotation memory and makes the choice auditable; it is not currently rendered.

**Central question generation** (AI call 1, lines ~250-310):
- **Query memory**: the last ~12 search queries (from `digests.search_queries`, last 5 digests) are shown to the LLM with "do not reuse" — prevents near-identical queries hitting the same OpenAlex window day after day.
- LLM builds around the topic-seeded interest, may add up to 2 naturally connected candidate interests, and generates a **working retrieval question** (aim for 8 words, hard max 10), 3 search queries, news query, and selected interests. It does **not** choose OpenAlex fields or taxonomy filters. `selectedInterests` is canonicalized against real user interests and the seed interest is forced into slot 0 so rotation memory cannot drift from the actual grounding.
- Headline taste is calibrated to user-approved examples: recognizable subject + consequential tension + plain spoken English (for example, "Does AI help students learn or cheat?"). A bare capability question is not enough, and interrogative shape should vary across days.
- **Theme validation**: if >10 words, a retry call (AI call 2, conditional) requests a shorter version without sacrificing the specific noun. The former 8-word hard edge rejected user-approved natural questions; 8 is now the target, not the guillotine.
- **Theme novelty**: word-overlap check vs last 5 themes (≥2 shared non-stop words = too similar). If too similar, a fresh-angle call (AI call 3, conditional) generates a different question/tension within today's already-rotated topic. (Note: this is a word check, not embedding similarity — see Part 5.2 of algo-audit.md.)
- Fallback: if LLM fails, the OpenAlex topic name is used as the theme (or the seeded interest when topic lookup failed).

**Theme retry loop** (up to 2 retries): If the theme produces too few qualifying papers, the pipeline changes the researchable angle and queries while keeping the OpenAlex topic, then re-searches. Each retry is an additional AI call.

### Step 2: Paper Search (lines ~370-400)

3 queries via source priority chain: **OpenAlex → Semantic Scholar → arXiv** (in practice OpenAlex nearly always answers, so it's effectively the sole source — audit 6.1).

- **Relevance-ranked recency**: OpenAlex "recent" mode sorts by `relevance_score:desc` within a 2-year `publication_year` window. (Was `publication_year:desc`, which discarded relevance and returned the newest works mentioning the query words anywhere — audit 6.2.)
- **Deterministic taxonomy routing**: query 1 starts with `primary_topic.id:{seedTopic}` for precision. Queries 2-3 start with `topics.id:{seedTopic}`, which also admits cross-domain papers where the seed is a secondary topic.
- **Precision → recall widening**: if a scoped query returns fewer than its 10-candidate allotment, keep those papers and fill the remainder from `primary_topic.subfield.id:{seedSubfield}`, then unscoped OpenAlex. Widening is per query and stops as soon as the allotment is full.
- If every OpenAlex scope returns zero, Semantic Scholar receives the deterministic field stored on the seeded user interest; arXiv remains the final fallback. No LLM-generated label controls retrieval.
- Each result is tagged with its **originating query** for scoring (see Step 3).
- For beginner interests: `"introduction overview applications"` appended.
- All results deduplicated by **normalized title** (lowercase, alphanumerics only).
- Cross-digest dedup: skip papers shown in ANY past digest — `open_alex_id` match first, normalized title second. (Was exact-lowercase title, 30-day window.)
- **Citation floor**: OpenAlex filters `cited_by_count:>1`.
- **Predatory venue filter**: papers from venues on the `PREDATORY_VENUES` list in `lib/venue-quality.ts` (SciRP, OMICS, Bentham Open, IJARCCE, etc.) are dropped at scoring. Soft penalty (-0.05 to quality boost) applied to high-volume controversial publishers (MDPI, Hindawi, "Frontiers in X" journals).

### Step 3: Hybrid Scoring + Wide Pool (lines ~430-540)

**Scoring**: BM25 + embedding (`all-MiniLM-L6-v2`) fused via **Reciprocal Rank Fusion** (k=60).

- **Relevance signal (`relSim`)** = max(cosine to theme, cosine to the paper's originating search query). The theme is deliberately jargon-free, so good papers under-score against it alone (vocabulary mismatch — audit 6.3); the originating query carries domain vocabulary. The LLM re-rank (Step 4b) still judges theme fit.
- BM25 is computed against `theme + all 3 queries` for the same reason.

Quality boosts (scaled to RRF range):
- `recencyBonus`: +0.003 current year, +0.0015 last year
- `venueBoost`: `venueQualityBoost(venue, domain) * 0.03` (0 to ~0.0024)
- `instBoost`: `institutionBoost(institutions) * 0.03` (0 to ~0.0015)

Hard floor: `SIM_MIN_THEME = 0.15` (raw `relSim`).

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
- Scored by embedding similarity to theme (raw cosine, threshold 0.15) **AND** the `isNewsRelevant` word guard (≥2 interest words + ≥2 theme words in title+snippet) — snippets are too short for embeddings alone (audit 6.4).
- **Listicle filter**, **academic domain filter** (20+ publisher domains), dedup.
- **Paywall detection**: article fetcher rejects pages with 2+ paywall signals.
- Article text via **paragraph density scoring** (`<p>` tag extraction), longest-run heuristic as fallback.
- RSS fallback: **field-specific feeds** + Google News RSS by topic.
- **`isNewsRelevant`** validation (word-count guard) applied to BOTH the primary web search path and the RSS fallback (fixed 2026-07-23).

### Step 4 Fill Passes (lines ~732-825)

If items < 3 after news search:
- Pass 1: third search query with moderate threshold
- Pass 2: broad fill without field filter — query is `focusInterest + 2 theme words` (varies per digest; the bare interest string returned a fixed result set every run)
- Pass 3: search using theme text as query (last resort)
- Pass 4: if still only 1 item, broad news search (threshold 0.15 + `isNewsRelevant` word guard; was 0.10 with no guard) for a second source
- Passes 1-2 score against max(theme, fill-query) embedding, mirroring Step 3.

Minimum target: 2 sources. 1 is acceptable if nothing else fits.

### Step 4b: LLM Re-Ranking (AI call 5, lines ~830-900)

After all items are assembled, papers are scored on two dimensions:
- **Relevance** (1-3): does the paper directly address the theme question?
- **Insight** (1-3): does it offer a surprising or useful lens?

Combined score ≤3 → attempt swap with next-best from qualified pool. **If no replacement exists:** off-topic and weak-adjacent papers are dropped when ≥2 sources remain — 2 coherent sources beat 3 where the headline and synthesis have to stretch around filler. The rubric explicitly rejects generic neighboring work (for example, a general trustworthy-financial-app review does not belong in a dark-pattern digest merely because both mention UX and trust). Graceful degradation: if LLM fails, embedding-ranked papers are kept. Worst papers are processed first so the best replacements go to the worst slots.

### Step 4c: Foundational Lane (1-2 OpenAlex calls + AI gate, conditional)

The main pool is deliberately windowed to the last 2 years — recency is the product
default. This lane is ADDITIVE: it asks "what did today's papers build on?" Two tiers:

**Tier 1 — citation graph:**
- Fetch the selected papers' `referenced_works` (one batched OpenAlex call).
- Keep ancestors **≥8 years old** with **>500 citations**, excluding already-shown works;
  ancestors referenced by ≥2 of today's papers rank first (shared intellectual ancestor).

**Tier 2 — canonical lookup (when tier 1 surfaces nothing):**
- Do what a person would do: web-search "foundational seminal papers {interest} {theme words}"
  (Serper/DDG, best-effort grounding), then an LLM names up to 3 REAL canonical works
  (title + author + year) — instructed to return [] for niche topics.
- Each named work is **verified against OpenAlex** (title search sorted by citations,
  normalized-title match, same ≥8y / >500-cite bars, dedup, predatory filter).
  Hallucinated or misremembered titles die at this lookup.

Both tiers end at the same LLM gate on the top ≤3: "genuinely field-defining (Weiser's
ubiquitous computing essay), or just an old survey?" Picking NONE is the expected outcome
most days — scarcity is what keeps the gold treatment meaningful (~1-2 per week).
- On a pick: added as a 4th item with `category: "foundational"` and the gate's one-sentence
  `foundationalReason` (stored on `papers.foundational_reason`). UI: gold border + ★
  FOUNDATIONAL chip + reason line on the paper card; gold frame on the papers-mode card.
- The synthesis's ERA AWARENESS block (metadataPrompt) already handles decade-old papers:
  acknowledge the era, say why it still matters, one sentence of contrast with today.

Note: `category: "foundational"` used to be slapped on wide-pool slot 0 (just the top MMR
pick) — that mislabel is fixed; the category is now exclusive to this lane.

### Step 5: Final-Source Editorial Pass (AI call 6, conditional repair call)

The working question is retrieval scaffolding, not the displayed headline. Once selection, fills, re-ranking, and the optional foundational lane are finished, the editor sees up to 900 abstract characters from each **final main source** and works evidence-outward:
- State the one real editorial thread the sources reveal together and provide a connection for every kept source.
- Exclude a source when it only fits by climbing to a generic umbrella; never exclude merely because it disagrees. At least 2 main sources are retained.
- Return an explicit reading order. The order should make understanding cumulative — explanation/background before the study that tests it, then complication/application/consequence when that is what the particular set supports. A validated exact permutation becomes card order, metadata order, synthesis order, and stored `source_index`. Foundational context remains additive at the end.
- Draft 3 candidates and choose one. There is **no menu of headline formulas**. Few-shot examples communicate the desired clarity, stakes, and voice; they are explicitly not templates. The rejected example *"Does feeling present mean learning more?"* documents the self-containedness failure: without "virtual classrooms" or "headset," the reader cannot know what it means.
- Aim for 8 words; hard max 10. The user-approved *"We built the virtual classroom. Can students use it?"* is nine words and should not be damaged by an arbitrary eight-word cutoff.
- The original retrieval question has no keep-by-default privilege. It survives only if it is genuinely the strongest evidence-led headline.
- A scarce foundational card is excluded from the headline constraint so an old context paper cannot contort the main three-source question.
- **Specificity remains required.** The title must name the recognizable subject, object, group, or setting from source titles **or abstracts**, with a blocklist of vague placeholders. This expands grounding beyond academic titles, which often omit the plain noun a reader needs.
- **Plain spoken English remains required.** De-jargoning must name the thing ("headset"), not paraphrase a technical property into a riddle ("without touching it").
- **Editorial gate** (deterministic, AI call conditional): `themeProblems()` enforces word count, grounding, and paraphrased-jargon checks. The structured response is also rejected when it lacks the shared thread or a connection for any kept source.
  - (a) *Vague* — `themeNamesAThing()`. A placeholder noun in **subject position** (first 3 words, `SUBJECT_WINDOW`) fails outright: "Can TECHNOLOGY read your mind?" is sunk by its subject, while the same word later is harmless ("Old traditions, new machines"). Otherwise it passes on a digit, or a non-placeholder word >3 chars grounded in source **titles or abstracts**. `PLACEHOLDER_NOUNS` includes generic subjects and abstract topic nouns (emotion, behavior, presence, learning, performance, states, patterns…), so borrowing a real but vague word from a paper cannot masquerade as self-containedness.
  - (b) *Hard to read* — `PARAPHRASED_JARGON` regexes catch the negative constructions that signal a paraphrased property. The key one keys on **nominalisation, not the word "without"**: `without …<word>ing|ion|ment|ness|ity` flags "without touching it" and "without any central planning" while leaving "without soil" and "without a teacher" alone, since those name real things.
  - On failure, ONE rewrite call receives the exact problems, kept sources, and evidence-backed thread; it is accepted only if it clears the deterministic gate. Matters doubly because `theme` is also the email subject line (`email.ts`).
  - Known limitation: lexical grounding is not full grammatical understanding. The source-connection audit is the semantic backstop; a future upgrade could use POS tagging or a concreteness lexicon.
- The **coherence guard** stays a hard rule in both the hypothesis and revise prompts: the theme must make literal sense to someone who hasn't read the papers. Comprehension beats cleverness; a specific plain question beats a vague clever one. (User feedback, July 2026 + Aug 2026.)
- The >10-word shortener in Step 1 forbids swapping a specific noun for a generic one — the specific noun is usually the longest token, so a rule-free "shorten this" cut it first and undid the specificity work at the last mile.
- Returns `thread`, per-source connections, optional exclusions, source order, ordering rationale, 3 candidates, and the selected theme for logging and enforcement.

### Step 6: Multi-Stage Synthesis (AI calls 7-13)

Six stages based on research (Radev 2000, Yao 2023, Madaan 2023):

**Stage A: Metadata** (AI call 7) — per-paper summaries, keywords, findings, connectionToTheme, **plainName** (plain-language paper name shown on cards above the academic title), **takeaway** (`hook` = the one surprise, `stat` = concrete anchor or null, `line` = a distinct conversational implication — powers Conversational Papers; hook/stat/line may not paraphrase one another), **methodType/methodFacts/claim** (what the source IS — "Field study", "Opinion piece", "News feature" — plus 2-3 short how-they-did-it facts and the one-sentence central claim; these fill the card's themed See-more tiles), keyConcepts, suggestedQuestions. `plainName` must distinguish the source rather than restate the digest headline or takeaway. Scripted-casual filler ("So you'd think", "Turns out", "It's kind of like", "which sounds obvious") is explicitly banned; clarity and evidence supply the voice. Uses `metadataPrompt`. keyConcepts now aggressively captures jargon a non-expert trips on — model/system names (RoBERTa, DistilBERT), technical methods (subword tokenization, self-attention), and acronyms (EEG, NLP) — so the synthesis hover-definitions actually fire on scary words.

**Stage B: Argument Skeleton** (AI call 8) — cross-document relations (agrees/contradicts/extends/alternative_mechanism/unrelated), paper roles, core tension, argument arc. Uses `skeletonPrompt`.

**Stage C: Synthesis Draft** (AI call 9) — writes the paragraph following skeleton's argument arc. Explicit list of papers that MUST appear in bold. Uses `synthesisFromSkeletonPrompt`.

**Stage C.5: Factual Accuracy Check** (AI call 10) — verifies each paper's contribution is accurately represented in the synthesis. If issues found, a revision call (AI call 11, conditional) corrects them. All revision calls include "ALL papers MUST remain in bold" guard.

**Stage D: Self-Critique** (AI call 12, always fires) — critiques synthesis on 5 dimensions: argument, connection, accessibility, specificity, coverage (each 1-5). If any score <4, revision call (AI call 13, conditional) fires. Uses `synthesisCritiquePrompt` + `synthesisRevisionPrompt`.

**Final Coverage Gate** (AI call 14, conditional) — runs AFTER all revisions. Extracts all `**bold phrases**` from synthesis and checks each paper's shortName/title/author against them. If any paper is missing from bold text, a targeted revision adds it. This is the last synthesis modification — nothing overwrites after this.

### Step 6b: Digest Header — gist (AI call, always after final synthesis)

Powers the zero-click header rendered under the central question (`DigestHeader` in
`today-page.tsx`, shown in all modes). One JSON call over the FINAL synthesis returns:
- **gist** — a one-sentence answer to the central question (≤25 words, plain English, leads with the answer). The reader gets the payoff before clicking through sources.

(A second field, **framing** — an "I pulled N sources — a X, a Y, a Z" provenance line —
was generated here until July 2026, but was removed as too distracting. The DB column
remains for old rows; nothing renders it.)

Also persisted: **seed_interests** (`[{keyword, field}]`, the canonical user interests
used by Step 1) — free, no AI call — which drives the header's domain chips (colored via
`field-hierarchy.ts`), and **seed_topic** (the OpenAlex topic + subfield that grounded the
question) for topic-level rotation and debugging.

(Digest-level Q&A was removed in July 2026 — suggested questions are still stored for
legacy rows but answers are no longer pre-generated. Questions now live on reading-list
papers: bookmarking a paper generates a full-text reading companion + "Ask this paper"
thread; see `/api/papers/[id]/companion`.)

Note: the Step-1 theme prompt (`hypothesisPrompt`) now also requires at least one concrete,
picturable noun, so titles are graspable, not just punchy.

### Step 7: Storage

- Digest saved with: theme, synthesis, keyConcepts, suggestedQuestions, seed_interests, seed_topic (topic rotation memory), search_queries (query memory), gist, starred flag.
- Papers saved with: summaries, keywords, key findings, connectionReason, plainName, openAlexId (dedup identity), foundationalReason (foundational lane only).
- All linked to user and dated.

---

## Total AI Calls Per Digest: 9-15

| # | Call | Step | When | Input tokens (approx) | Output (approx) |
|---|------|------|------|-----------------------|-----------------|
| 1 | Hypothesis generation | 1 | Always | ~800 | ~100 |
| 2 | Working-question shortening | 1 | If >10 words | ~100 | ~30 |
| 3 | Theme novelty retry | 1 | If sim >0.5 to recent | ~400 | ~100 |
| 4 | Theme retry (bad papers) | 1 | Up to 2x if <2 papers | ~800 | ~100 |
| 5 | Complementarity selection | 3b | If wide pool > target | ~2000 | ~200 |
| 6 | LLM re-ranking | 4b | If ≥2 papers | ~600 | ~100 |
| 7 | Final-source editorial pass | 5 | Always | ~4000 | ~500 |
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
| News embedding | cosine > 0.15 (raw) + `isNewsRelevant` word guard | Step 4 web results |
| Broad news fallback | cosine > 0.15 + `isNewsRelevant` word guard | Step 4 fill pass 4 |
| Listicle filter | regex + domain blocklist | Step 4 web results |
| Academic domain | hostname check (20+ domains) | Step 4 web results |
| Paywall detection | 2+ paywall signals | Step 4 article fetch |
| Theme novelty | ≥2 shared non-stop words vs recent themes | Step 1 |
| Theme word count | ≤ 10 words (8 target) | Steps 1 and 5 |
| LLM re-rank | score > 2 to keep | Step 4b |
| Cross-digest dedup | all past digests, openAlexId + normalized title | Step 2 |
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
6. ~~**`isNewsRelevant` only on RSS path**~~ Fixed 2026-07-23 — word guard now on primary path and broad fill too.
7. **News short snippets**: embedding similarity on 1-2 sentence snippets is imprecise; mitigated by the word guard, not solved.
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
- **Eight-word target / ten-word ceiling** keeps themes punchy without breaking natural speech
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
- **LLM-generated focus fields**: brittle labels silently missed OpenAlex concepts and gave the model control over retrieval scope. Replaced by IDs copied from the sampled OpenAlex topic and a deterministic widening ladder.
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

Theme monoculture — see `algo-audit.md` Part 5 for the full audit (2026-07-19):
1. **Structure-aware theme novelty, enforced after Step 5**: recent final headlines now enter the editorial prompt and it drafts 3 candidates, but a deterministic leading-shape re-roll is still open.
2. **Measure topic-seed quality**: log which taxonomy path fired (field/subfield/free-form), candidate-pool size, and regenerate/save outcomes by seed. Tune the rank discount and 3,000-work floor from behavior rather than intuition.
3. **Digest archetypes, starting with frontier + debate**: let the returned evidence choose a format, then give each format its own selection and voice rules. Do not force foundational-first or news-first every day.

(Displaced but still valid: consolidate complementarity+skeleton; apply `isNewsRelevant` to primary news path; digest rating feedback loop.)
