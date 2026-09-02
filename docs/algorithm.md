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

**Step order vs. execution order** (added 2026-08-20, `docs/plans/digest-generation-speedup.md` Phase 1): the steps below are numbered by their place in the argument, not by wall clock. Three things now run concurrently, with no change to what any gate judges:
- **Step 2's three search queries** fire together (the scope ladder *inside* each query stays ordered — precision→recall widening is inherently serial). Results are merged afterwards in query order, so dedup stays deterministic and query 1 still owns a shared title.
- **Step 4c (foundational lane)** starts right after Step 4b and is merged after Step 5. Step 5 already filters foundational items out of its headline sources, so it never read the lane's result; the only coupling was that both mutated `items`. `findFoundationalItem()` returns instead of pushing. Accepted edge case: Step 5's exclusion gate can drop a lane paper *after* tier 1 mined its reference list — the ancestor is still a real, verified, LLM-gated foundational text, and the merge point re-checks for title collisions.
- **Stage A (metadata) and Stage B (skeleton)** fire together. Both read only `paperListing` + `finalTheme`, and the skeleton no longer drops papers.
- Smaller: the **news web search** is kicked off before the selection call and awaited in Step 4.

**Timing instrumentation**: `generateDigest` logs `[Digest][timing] <stage>: +Xs (total Ys)` at every stage boundary. Grep Vercel logs for `[Digest][timing]` to see where a slow run actually went.

### Step 1: Interest Selection & Central Question (AI calls 1-3 in the table below)

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

**Central question generation** (AI call 1, lines ~250-310 — three candidates in one call):
- **Query memory**: the last ~12 search queries (from `digests.search_queries`, last 5 digests) are shown to the LLM with "do not reuse" — prevents near-identical queries hitting the same OpenAlex window day after day.
- LLM builds around the topic-seeded interest, may add up to 2 naturally connected candidate interests, and generates **three candidate working questions** — each a genuinely different angle *inside the same seed topic*, each with its own stakes, 3 search queries and news query. It does **not** choose OpenAlex fields or taxonomy filters. `selectedInterests` is canonicalized against real user interests and the seed interest is forced into slot 0 so rotation memory cannot drift from the actual grounding. (A response in the old single-theme shape is accepted as a one-candidate list, so a model that ignores the contract still ships a digest.)
- Headline taste is calibrated to user-approved examples: recognizable subject + consequential tension + plain spoken English (for example, "Does AI help students learn or cheat?"). A bare capability question is not enough, and interrogative shape should vary across days.
- **Candidate screening is deterministic and free** (changed 2026-08-20). Every candidate must clear `themeProblemsWithoutSources()` — the ≤10-word ceiling, the paraphrased-jargon tells, insider acronyms, stacked intensifiers — plus a non-empty `stakes` and the novelty check (≥2 shared non-stop words with any of the last 5 themes). A candidate that fails is **dropped**, not repaired. This replaces two conditional LLM round-trips: the >10-word shortener and the novelty fresh-angle retry. The bar is identical; only the remedy changed, and with three candidates on the table a rewrite is rarely the cheapest fix. (Novelty is still a word check, not embedding similarity — see Part 5.2 of algo-audit.md.)
- **One batched cold read** over every candidate that survived screening (`coldRead()` has always taken an array; Step 5 uses it the same way). Among candidates with zero cold-read objections, the **highest `interest` score wins**. Only when nothing survives both filters does the single re-angle repair call fire, seeded with the least-broken candidate and its objections.
- Worst case at Step 1 is now **2 calls** (hypothesis + cold read) plus a rare third; it used to be up to 5 serial calls.
- **Lay stakes, enforced upstream** (added 2026-08-17): the hypothesis call must return a `stakes` field — what a normal person loses, gains, or misjudges if they never learn this. A headline polish is the last mile; whether a digest can interest a layman is mostly decided here, by which ANGLE of the seed topic gets picked. Empty stakes is an angle failure, not a topic failure.
- **Cold read of the working question** (added 2026-08-17, batched 2026-08-20): the same context-free judge used in Step 5 (see below) reads the candidate working questions, and a candidate with any cold-reader objection is dropped. Only if *every* candidate is objected to does ONE re-angle call fire inside the same seed. The seed rotation stays mechanical — the topic is never abandoned, only the angle moves. This matters beyond the headline: a study-shaped working question retrieves study-shaped papers, which caps how interesting Step 5 can honestly be.
- Every generated or repaired theme must be a direct question ending in a question mark. A short setup sentence may come first, but the final sentence must begin with a question word or helping verb. `themeQuestionProblems()` rejects both plain statements and statements disguised with question punctuation.
- Fallback: if the LLM fails, the pipeline builds a valid question from the OpenAlex topic or seeded interest, using `What matters in [subject]?` rather than exposing a topic label as the theme.

**Shared taste block** (`THEME_TASTE_RULES`, added 2026-08-17): every prompt that writes or rewrites a theme interpolates it — hypothesis, the re-angle repair, the not-enough-papers reframe, and Step 5 + its repair. (The shortener and novelty-retry prompts were two of the original five; both were deleted on 2026-08-20 when Step 1 went to three candidates, since a failing candidate is now dropped rather than rewritten.) The retry paths used to carry almost none of the taste rules, so a mangled theme from a retry degraded retrieval as well as the headline. They all now interpolate one constant (dinner-table test, name-the-object, placeholder ban, study-design rule, acronym rule, banned words, one-intensifier rule, length). Same class of gotcha as the `shortName` rules living in two places — change the constant, never restate a rule.

**Theme retry loop** (up to 2 retries): If the theme produces too few qualifying papers, the pipeline changes the researchable angle and queries while keeping the OpenAlex topic, then re-searches. Each retry is an additional AI call.

### Step 2: Paper Search (lines ~370-400)

3 queries via source priority chain: **OpenAlex → Semantic Scholar → arXiv** (in practice OpenAlex nearly always answers, so it's effectively the sole source — audit 6.1). The three queries run **concurrently** (3 concurrent requests, each internally serial through its scope ladder, sits well inside OpenAlex's 10 rps polite pool); the inter-query sleeps are gone.

- **Field-sensitive recency window**: rapidly changing areas search the current year plus the prior two years. Other areas search the current year plus the prior five years, so durable evidence is not excluded just for being older.
- **Relevance-ranked recency**: OpenAlex "recent" mode sorts by `relevance_score:desc` inside that window. It fetches ten candidates past the requested cutoff. In rapidly changing areas, the best current-year result and a second current-or-previous-year result are exposed when available. Standard areas do not force fresh candidates into the shortlist. This is candidate inclusion, not a guaranteed slot. Sorting by `publication_year:desc` remains rejected because it discarded relevance and returned the newest works mentioning the query words anywhere.
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
- `recencyBonus`: +0.007 current year and +0.003 last year by default; +0.010 and +0.005 in rapidly changing areas. This only reorders papers that already cleared the relevance floor.
- `venueBoost`: `venueQualityBoost(venue, domain) * 0.03` (0 to ~0.0024)
- `instBoost`: `institutionBoost(institutions) * 0.03` (0 to ~0.0015)
- `tasteBoost`: 0 to 0.02 — cosine to the nearest **saved-paper centroid** (`lib/librarian/dossier.ts`), ramped from 0.30 to 0.65 similarity. Applied to `score` only, **never to `relSim`**, so it reorders the qualified pool and can never qualify an off-theme paper. Max over clusters, not mean: one strong match to a cluster is the signal, and averaging it against the reader's other interests would erase it. Absent (0) for any reader with no dossier yet.

Hard floor: `SIM_MIN_THEME = 0.15` (raw `relSim`).

**Threshold cascade**: try `SIM_ONTOPIC` (0.25) → `SIM_MIDPOINT` (0.20) → `SIM_FALLBACK` (0.18) → hard floor (0.15). If still <2, take top papers by score.

**Theme retry on weak match**: only breaks the theme retry loop early when papers pass `SIM_MIDPOINT` or higher. If papers only pass below `SIM_MIDPOINT`, the pipeline retries with a new theme before accepting weak-match papers.

**Dynamic item count** (lines ~568-581): counts papers above `SIM_ONTOPIC`.
- ≥3 strong papers → 3 papers + 0 news
- ≤1 strong paper → 1 paper + 2 news
- Otherwise → 2 papers + 1 news (default)

**Wide pool via MMR** (λ=0.6): selects ~6 diverse papers from qualified candidates. MMR penalizes candidates similar to already-picked papers.

### Step 3b: LLM Complementarity Selection (AI call 5, lines ~548-587)

If the wide pool has more papers than needed, `selectionSkeletonPrompt` asks the LLM to pick the best N for complementarity. When the reader has a **taste dossier**, it is injected here as a `WHO YOU ARE PICKING FOR` block — this step is where the real quality call is made, so it is the one place taste is allowed to argue. The prompt states explicitly that the note breaks ties only: it cannot relax the relevance gate, and if the note conflicts with the theme, the theme wins.

Selection criteria:
- Selects papers that each contribute something DIFFERENT
- Creates genuine TENSION (supports + complicates + alternative mechanism)
- In rapidly changing areas, if a current-year candidate passes the relevance gate, keeps at least one
- In rapidly changing areas with three paper slots, keeps at least two papers from the current or previous calendar year when two qualified candidates add distinct evidence; this leaves at most one older paper
- In other areas, uses recency only as a tie-break and does not force a current-year paper
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
- Pass 1: third search query with moderate threshold, using the same recent-paper window as the primary pool
- Pass 2: broad fill without field filter — query is `focusInterest + 2 theme words` (varies per digest; the bare interest string returned a fixed result set every run)
- Pass 3: search using theme text as query (last resort)
- Pass 4: if still only 1 item, broad news search (threshold 0.15 + `isNewsRelevant` word guard; was 0.10 with no guard) for a second source
- Passes 1-2 score against max(theme, fill-query) embedding, mirroring Step 3.

Minimum target: 2 sources. 1 is acceptable if nothing else fits.

### Step 4b: LLM Re-Ranking (AI call 6, judge tier, lines ~830-900)

After all items are assembled, papers are scored on two dimensions:
- **Relevance** (1-3): does the paper directly address the theme question?
- **Insight** (1-3): does it offer a surprising or useful lens?

Combined score ≤3 → attempt swap with next-best from qualified pool. **If no replacement exists:** off-topic and weak-adjacent papers are dropped when ≥2 sources remain — 2 coherent sources beat 3 where the headline and synthesis have to stretch around filler. The rubric explicitly rejects generic neighboring work (for example, a general trustworthy-financial-app review does not belong in a dark-pattern digest merely because both mention UX and trust). Graceful degradation: if LLM fails, embedding-ranked papers are kept. Worst papers are processed first so the best replacements go to the worst slots.

**Current-evidence floor for rapidly changing areas:** the pipeline detects volatile topics from the seeded interest and OpenAlex topic vocabulary, including AI, machine learning, language models, computer vision, NLP, and cybersecurity. After re-ranking, if no academic source is from the current year but a current-year paper remains in the qualified pool, the pipeline adds it to an open slot or replaces the lowest-scored non-news paper. It then replaces the weakest older academic sources until at most one is older than the previous calendar year, provided enough current-or-previous-year candidates qualified. These are not relevance overrides: every replacement passed the same theme and quality filters as the rest of `qualified`. Slower-moving areas keep the relevance-led mix, so a 2024 education paper is not displaced merely because a newer paper exists.

### Step 4c: Foundational Lane (1-2 OpenAlex calls + AI gate, conditional)

Lives in `findFoundationalItem()` and **runs concurrently with Step 5**, merged into
`items` once the headline pass returns (see "Step order vs. execution order" above).

The main pool uses the field-sensitive recent window described above. This lane is
ADDITIVE: it asks "what did today's papers build on?" Two tiers:

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
- On a pick: added as a 4th item with `category: "foundational"` and the gate's
  `foundationalReason` (stored on `papers.foundational_reason`, scrubbed by
  `stripBannedWordsMaybe` on the way in like every other piece of generated copy).
  **The reason is now the card's opening line, not a footnote to it**: the gate is asked
  for a spoken, warm, two-sentences-at-most lead that contains the exact phrase
  "Foundational Text" once, with five worked openings in the prompt ("Today you have a
  Foundational Text: ...", "Foundational Text alert ...", "Back to basics with this
  Foundational Text: ..."). UI: gold border and gold shadow, the lead in the hero's place
  at Display 22 with the phrase drawn as a defined term (gold underline, ink tooltip), and
  the paper's own summary demoted to Body 15 under it. There is no eyebrow and no
  Significance panel; the phrase is the label. `foundationalLead()` in `paper-card.tsx`
  guarantees the phrase is present (recase, or prepend the plainest opening) so a model
  that forgets it cannot take the label off the card.
- The synthesis's ERA AWARENESS block (metadataPrompt) already handles decade-old papers:
  acknowledge the era, say why it still matters, one sentence of contrast with today.

Note: `category: "foundational"` used to be slapped on wide-pool slot 0 (just the top MMR
pick) — that mislabel is fixed; the category is now exclusive to this lane.

### Step 5: Final-Source Editorial Pass (AI call 7, conditional repair call)

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
  - (c) *Insider acronym* (added 2026-08-17) — any all-caps token of 2-5 letters (trailing plural allowed, so "TTOs" is caught) outside `HOUSEHOLD_ACRONYMS` fails. "Are incubators and TTOs choosing startup survivors?" shipped because the term appears in the sources, which is exactly backwards: source vocabulary is evidence of grounding, not of legibility. AI, VC, GPS, DNA, CEO, NASA pass; TTO, HCI, RCT, LLM do not.
  - (d) *Stacked intensifiers* (added 2026-08-17) — more than one of `ever / actually / truly / really / any(thing|one) / always / never` fails. One is explicitly fine (the approved set uses single "actually"); two compound into rhetoric — "Is one museum exhibit ever enough to teach anything?" reads as a put-down, not curiosity.
  - (e) *Banned word* (added 2026-08-25): "quietly" or "silently" anywhere in the line fails, from `bannedWordsIn()` in `src/lib/ai/banned-words.ts`. These were a standing verbal ban that kept shipping ("Will advertisers quietly corrupt how AI guides us?", 2026-08-25) because they lived only as one item in a long AI-tell list inside the *synthesis* prompts, and `THEME_TASTE_RULES` carried no word list at all. Now the rule text is in the taste block, the gate is here, and `stripBannedWords()` scrubs anything that survives on its way into the database.
  - On failure, ONE rewrite call receives the exact problems, kept sources, and evidence-backed thread; it is accepted only if it clears the deterministic gate **and the cold reader** (see below). Matters doubly because `theme` is also the email subject line (`email.ts`).
  - (f) *Question shape* (added 2026-09-02): `themeQuestionProblems()` requires a direct question ending in a question mark. The last sentence must start with a question word or helping verb, so a statement cannot pass by adding question punctuation.
  - Known limitation: lexical grounding is not full grammatical understanding. The source-connection audit is the semantic backstop; a future upgrade could use POS tagging or a concreteness lexicon.
- The **coherence guard** stays a hard rule in both the hypothesis and revise prompts: the theme must make literal sense to someone who hasn't read the papers. Comprehension beats cleverness; a specific plain question beats a vague clever one. (User feedback, July 2026 + Aug 2026.)
- The >10-word shortener in Step 1 forbids swapping a specific noun for a generic one — the specific noun is usually the longest token, so a rule-free "shorten this" cut it first and undid the specificity work at the last mile.
- Returns `thread`, per-source connections, optional exclusions, source order, ordering rationale, 3 candidates, and the selected theme for logging and enforcement.

**Cold-reader gate** (AI call, added 2026-08-17). Every other check on a headline is generation-side: regexes, plus rules inside the prompt that wrote the line. The dinner-table test was self-certified by a model that already knew what it meant, so it could not hear how the line lands on someone who doesn't — which is how both confirmed 2026-08-17 failures shipped. After Step 5 collects its unique candidates, ONE extra call with **no digest context at all** (no sources, no thread, no working question) reads the bare headlines as a smart person with no academic background, and returns per candidate:

| Field | What it catches |
|-------|-----------------|
| `guess` | self-containedness — one sentence on what the digest is about |
| `unknownTerms` | the "TTOs" failure — words a smart non-expert couldn't define |
| `wouldWonder` | the "museum exhibit" failure — a question reverse-engineered from study design rather than one a person would ask aloud |
| `stakes` | why a normal person would care; **empty fails the candidate** — clarity alone does not earn the slot |
| `interest` | 1-5, "would you stop scrolling?", forced to a spread |
| `why` | when `wouldWonder` is false: what makes the line sound contorted |

Selection is deterministic: a candidate is ELIGIBLE if it clears `themeProblems()`, has no unknown terms, `wouldWonder` is true, and `stakes` is non-empty. Among eligible candidates the pipeline takes the **highest `interest`** — the gate picks the best line, not the first that scrapes by. If none survive, the cold reader's specific objections ("A reader with no context could not define…") feed the existing repair call, and the repaired line is cold-read once more; it is accepted only if it reads clean or owes strictly fewer answers than the line it replaces. A judge that errors or skips an index blocks nothing — the deterministic checks stay in charge.

The `guess` is embedded (local MiniLM) against the editorial `thread`, logged per candidate, and currently used only to break `interest` ties. It earns a hard floor (~0.5) once there is enough production data to set one honestly.

**Debug trail**: `digests.working_theme` and `digests.theme_candidates` (JSON: each candidate's problems, cold-read verdict, guess↔thread similarity, and which one was chosen, plus any repair) are persisted so the next weird headline is diagnosable from its own row rather than by memory and a manual DB trawl.

### Step 6: Multi-Stage Synthesis

Five stages based on research (Radev 2000, Yao 2023, Madaan 2023). Stages A and B fire
concurrently; the factual pass is folded into Stage D, and the coverage gate and format
enforcement are one repair (both merged 2026-08-20).

Stage A metadata is also a publishing contract. A malformed batch response no longer becomes empty rows. Each missing, incomplete, duplicated, or source-disconnected paper item gets one independent repair call, with repairs running concurrently. If any required card field is still invalid, generation stops before storage. The digest UI never promotes a source abstract into generated card copy; legacy rows without metadata keep their synthesis passage visible beside a minimal source card.

**Stage A: Metadata** (AI call 8, judge tier, fires **concurrently with Stage B**) — per-paper summaries, keywords, findings, connectionToTheme, **plainName** (plain-language paper name shown on cards above the academic title), **takeaway** (`hook` = the one surprise, `stat` = concrete anchor or null, `line` = a distinct conversational implication — powers Conversational Papers; hook/stat/line may not paraphrase one another), **methodType/methodFacts/claim** (what the source IS — "Field study", "Opinion piece", "News feature" — plus 2-3 short how-they-did-it facts and the one-sentence central claim; these fill the card's themed See-more tiles), keyConcepts, suggestedQuestions. `plainName` must distinguish the source rather than restate the digest headline or takeaway. Scripted-casual filler ("So you'd think", "Turns out", "It's kind of like", "which sounds obvious") is explicitly banned; clarity and evidence supply the voice. Uses `metadataPrompt`. keyConcepts now aggressively captures jargon a non-expert trips on — model/system names (RoBERTa, DistilBERT), technical methods (subword tokenization, self-attention), and acronyms (EEG, NLP) — so the synthesis hover-definitions actually fire on scary words.

**Stage B: Argument Skeleton** (AI call 9, fires **concurrently with Stage A**) — cross-document relations (agrees/contradicts/extends/alternative_mechanism/unrelated), paper roles, core tension, argument arc. Uses `skeletonPrompt`.

**Stage C: Synthesis Draft** (AI call 10) — writes the paragraph following skeleton's argument arc. Explicit list of papers that MUST appear in bold. Uses `synthesisFromSkeletonPrompt`.

**Stage D: Self-Critique + factual accuracy** (AI call 11, always fires) — one review call scoring 7 dimensions (argument, connection, accessibility, relatability, specificity, coverage, freshness; each 1-5) AND checking the draft against each paper's extracted findings, returning `factIssues`. A revision (AI call 12, conditional) fires when `minScore < 4` **or** any fact issue was flagged, and carries both. Uses `synthesisCritiquePrompt` + `synthesisRevisionPrompt`.

  *Merged 2026-08-20.* The factual pass used to be its own call plus its own full-synthesis rewrite immediately before Stage D — two reviews of the same draft against the same papers, and a draft with both a weak argument and a misstated finding was regenerated **twice**. Long-output regenerations here drop from up to 2 to at most 1.

**Final repair** (AI call 13, conditional) — runs AFTER all revisions and is the last synthesis modification. Two **deterministic** checks run first and together: is any paper missing its `[Source N]` tag, and are there fewer `- **[Source N]` bullets than papers? If either fails, ONE repair call fixes both.

  *Merged 2026-08-20.* These were two sequential rewrites, and the second regularly undid the first: the format-enforcement scaffold still demanded "NO intro paragraph" and a 3-sentence bullet cap, both stale since the answer-first opening paragraph landed, so a correct coverage repair got its opening paragraph stripped straight back out. The structure contract now lives in one function, `synthesisStructureContract()` in `prompts.ts`, shared by this repair and the Stage D revision.

  *Expanded 2026-09-02.* A third deterministic check looks for reader-visible model self-commentary, including identity disclaimers, apologies, refusals, and permission language. The same repair call removes it. If any coverage, structure, or commentary problem remains, generation fails before storage. A final scan covers the gist, metadata, key concepts, suggested questions, and foundational copy so no unchecked reader-facing field can save model commentary.

### Step 6b: Digest Header — gist (AI call 14, judge tier, always after final synthesis)

Powers the zero-click header rendered under the central question (`DigestHeader` in
`today-page.tsx`, shown in all modes). One JSON call over the FINAL synthesis returns:

For genuine yes/no headlines, the gist chooses the verdict that fits the evidence instead of falling back to one stock hedge. Its prompt supplies 11 answer shapes: clear yes/no, conditional, mixed, and limited-case openings. It explicitly says not to default to "Sort of" or hedge a clear result. Who/what/how/why headlines are answered in their own shape, and the deterministic guard strips qualified yes/no verdicts if one slips onto them.
- **gist** — normally a one-sentence answer to the central question (≤25 words, plain English, leads with the answer). If the headline depends on an unfamiliar named contrast, matching `keyConcepts` definitions are injected and the gist may use two short sentences / 35 words: define both sides in parallel first, then answer. A yes/no headline with one specialist term still leads with the verdict; the term is already underlined with a tooltip, so the gist must not open with a standalone glossary sentence.

The first matching mention of each `keyConcept` in both the gist and synthesis is
underlined as an interactive definition. Its tooltip is portalled to the document body,
measured after render, flipped above or below the term, and clamped to the viewport so
cards and narrow columns cannot cut it off. Hover, keyboard focus, and click/tap all work.

(A second field, **framing** — an "I pulled N sources — a X, a Y, a Z" provenance line —
was generated here until July 2026, but was removed as too distracting. The DB column
remains for old rows; nothing renders it.)

Also persisted: **seed_interests** (`[{keyword, field}]`, the canonical user interests
used by Step 1) — free, no AI call — whose unique fields drive the category chips beside
the "Daily digest" heading (colored via `field-hierarchy.ts`), and **seed_topic** (the
OpenAlex topic + subfield that grounded the question) for topic-level rotation and debugging.

(Digest-level Q&A was removed in July 2026 — suggested questions are still stored for
legacy rows but answers are no longer pre-generated. Questions now live on reading-list
papers: bookmarking a paper generates a full-text reading companion + "Ask this paper"
thread; see `/api/papers/[id]/companion`.)

Note: the Step-1 theme prompt (`hypothesisPrompt`) now also requires at least one concrete,
picturable noun, so titles are graspable, not just punchy.

### Step 7: Storage

- Digest saved with: theme, synthesis, keyConcepts, suggestedQuestions, seed_interests, seed_topic (topic rotation memory), search_queries (query memory), gist, starred flag, working_theme + theme_candidates (headline debug trail).
- Papers saved with: summaries, keywords, key findings, connectionReason, plainName, openAlexId (dedup identity), foundationalReason (foundational lane only).
- All linked to user and dated.

---

## Total AI Calls Per Digest: 8-18

"Tier" is which model the call runs on: **strong** = the run's `aiConfig` (taste- or
knowledge-critical), **judge** = `judgeConfigFrom(aiConfig)`, i.e. `AI_MODEL_DIGEST_JUDGE`
when set and the identical strong config when it isn't. Judge-tier calls are structured
JSON judgment or grounded extraction, and every one already treats an absent verdict as
non-blocking.

| # | Call | Step | When | Tier | Input tokens (approx) | Output (approx) |
|---|------|------|------|------|-----------------------|-----------------|
| 1 | Hypothesis (3 candidates) | 1 | Always | strong | ~900 | ~300 |
| 2 | Cold read of candidate questions | 1 | If ≥1 survives screening | judge | ~500 | ~350 |
| 3 | Working-question re-angle | 1 | Only if NO candidate clears both filters | strong | ~900 | ~120 |
| 4 | Theme retry (bad papers) | 1 | Up to 2x if <2 papers | strong | ~800 | ~100 |
| 5 | Complementarity selection | 3b | If wide pool > target | strong | ~2000 | ~200 |
| 6 | LLM re-ranking | 4b | If ≥2 papers | judge | ~600 | ~100 |
| 6b | Foundational tier-2 naming | 4c | If tier 1 found nothing | strong | ~800 | ~150 |
| 6c | Foundational gate | 4c | If any candidate cleared the bars | judge | ~1200 | ~100 |
| 7 | Final-source editorial pass | 5 | Always | strong | ~4000 | ~500 |
| 7b | Cold read of headline candidates | 5 | Always | judge | ~600 | ~300 |
| 7c | Cold read of repaired headline | 5 | If the repair call fired | judge | ~500 | ~120 |
| 8 | Metadata (Stage A) | 6 | Always | judge | ~6000 | ~600 |
| 8b | Per-paper metadata repair | 6 | Only for missing, incomplete, or ungrounded card metadata; broken papers run concurrently | judge | ~2500 each | ~500 each |
| 9 | Skeleton (Stage B) | 6 | Always, concurrent with 8 | strong | ~4000 | ~300 |
| 10 | Synthesis draft (Stage C) | 6 | Always | strong | ~5000 | ~400 |
| 11 | Critique + fact check (Stage D) | 6 | Always | strong | ~4000 | ~350 |
| 12 | Revision | 6 | If any score <4 OR any fact issue | strong | ~2500 | ~400 |
| 13 | Final repair | 6 | If a paper is missing, bullets are short, or model self-commentary appears | strong | ~2000 | ~400 |
| 14 | Gist | 6b | Always | judge | ~1500 | ~60 |

**Typical: 9-11 calls** (was 12-14). Calls 3, 4, 6b, 6c, 7c, 8b, 12 and 13 are conditional. Metadata repair can add up to one concurrent call per paper when the batch response is malformed or incomplete.
**Full-synthesis regenerations are now at most 2** (draft + one revision, plus a rare
structural repair); before the 2026-08-20 merges the ceiling was 5. Cost depends on the
deployed `CRON_AI_PROVIDER`/`CRON_AI_MODEL`; Gemini Flash pricing is only one example, not
proof of the live production model.

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
| Question shape | direct final question ending in `?` | Steps 1 and 5, with a final fail-closed check |
| Insider acronym | all-caps 2-5 letter token outside `HOUSEHOLD_ACRONYMS` | Steps 1 and 5 (`themeProblems`) |
| Stacked intensifiers | >1 of ever/actually/truly/really/any(thing/one)/always/never | Steps 1 and 5 (`themeProblems`) |
| Banned words | "quietly" / "silently" anywhere in the line | Steps 1 and 5 (`themeProblems`), then stripped at the DB insert |
| Cold read | `unknownTerms` empty + `wouldWonder` + non-empty `stakes` | Steps 1 and 5 |
| Headline interest | highest `interest` (1-5) among eligible candidates | Step 5 selection |
| Guess↔thread similarity | logged only; no floor enforced yet (~0.5 planned) | Step 5 |
| LLM re-rank | score > 2 to keep | Step 4b |
| Cross-digest dedup | all past digests, openAlexId + normalized title | Step 2 |
| Citation floor | cited_by_count > 1 | Step 2 OpenAlex |
| Card metadata | every paper has a grounded summary, plain name, findings, connection, takeaway, method type, and claim | Stage A repair, then fail closed |
| Model self-commentary | no identity disclaimer, apology, refusal, placeholder, or permission language | Step 6 repair and pre-storage scan |
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

### The taste dossier (2026-08-20)

Alongside the weights there is now a second, slower memory: a per-reader
**dossier** kept by `lib/librarian/dossier.ts` from the signal ledger in
`lib/librarian/ledger.ts`.

| Class | Signal | Source |
|---|---|---|
| Exemplars | papers saved (positive) vs. shown-and-walked-past (soft negative) | `feedback` + every paper in the reader's digests |
| Engagement | questions asked, passages dug into | `qa_pairs.question`, `events` type `dig_deeper` |
| Stated | interests and their weights; self-rated familiarity per subtopic | `interests`, `familiarity` |
| Negative | dislikes, and the reasons typed at the regenerate CTA | `feedback` type `dislike`, `digest_feedback` |

`digest_feedback` had been **write-only since it shipped** — rows went in and
nothing ever read one. The keeper reads them, and a typed rejection forces a
rewrite on its own.

Two representations come out, used in two places and nowhere else:

1. **Under 90 words of prose, written to the reader in the second person** →
   the Step 3b selection prompt, and `Settings → Librarian`. Prose because it is
   inspectable, survives schema drift, and is the form the model can use. The
   selection block names who "you" refers to, so the note's second person can
   never be read as an instruction to the model. (Was ~300 words in the third
   person until 2026-09-02.)
2. **Embedding centroids of saved papers**, greedily clustered (join at cosine
   0.45, ≤5 clusters) → the `tasteBoost` in Step 3. Never one global average.

**Rewrite policy**: five new signals since the last note, or seven days,
whichever comes first — checked *before* any model call, so a save costs two
queries in the common case. Below three signals total the keeper writes nothing:
a confident invention would steer selection worse than silence. Fast tier
(`aiConfigFor("chore")`). Triggered by saves/dislikes/rejections via `after()`,
and by `/api/cron/dossier` on Sundays at 03:00 UTC, an hour before the digest
cron.

**What it is not allowed to do**: taste never touches search, the similarity
thresholds, the news lane, or `relSim`. Upstream scoring is still a filter — the
dossier is a nudge inside it and an argument at the one LLM call that decides.

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

- **Using one qualified verdict as the main gist example**: repeated "Sort of" under yes/no headlines even when a clearer or more specific answer fit. Replaced with an evidence-led palette of 11 answer shapes and an explicit no-default rule.

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
