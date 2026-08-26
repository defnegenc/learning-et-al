# Orchestrator + sub-agent digest generation

**Status: proposal, 2026-08-25. Nothing here is landed.**

**Goal:** make digest generation faster, better, and more personalized by restructuring
the pipeline as an orchestrator that fans work out to scoped, parallel sub-agents, using
both the Claude and Gemini APIs at the tier each is best at. Every gate in
`docs/algorithm.md` survives unchanged; this plan changes *when* work happens, *on which
model*, and *how the winner is chosen*, never what any gate judges.

This builds on `digest-generation-speedup.md` (all three phases landed 2026-08-20). That
plan parallelized independent work and consolidated round-trips. What it could not touch
is the remaining serial skeleton: one candidate question is adopted at Step 1, and if its
retrieval is weak the pipeline pays up to two full serial theme-retry cycles (new theme
call, full search, full scoring, each cycle ~20 to 40 s). That skeleton is the target.

---

## First, what "orchestrator + sub-agent" should mean here

Not an agent framework. The digest pipeline is deterministic control flow with audited
gates; handing it to an autonomous tool-calling loop (Claude Agent SDK, Managed Agents,
a LangGraph-style planner) would add latency, make the gates advisory instead of
enforced, and violate THE CORE ALGORITHM contract in CLAUDE.md.

The right shape: **`generateDigest` stays the orchestrator.** A "sub-agent" is a scoped
unit of work with its own inputs, its own model config, and no shared mutable state,
launched with `Promise.all` and merged at a deterministic decision point. We already do
this in miniature (the foundational lane races Step 5; Stage A races Stage B). This plan
extends the pattern to the two places it changes outcomes, not just wall clock.

---

## Lever 1 (the big one): speculative candidate racing, aka "retrieval scouts"

### Today

Step 1 generates three candidate questions, screens them deterministically, cold-reads
the survivors, and adopts exactly one, discarding the other candidates *and their search
queries*. Retrieval quality is then discovered serially: if the adopted question pulls a
weak pool, the theme-retry loop fires (up to 2 extra cycles of hypothesis + search +
scoring). Two problems:

1. **Latency tail.** The retries are the difference between a 60 s run and a 3 min run.
2. **The pick is blind.** The cold reader judges the *headline*; nobody judges what the
   question will *retrieve* until after we have committed to it. algorithm.md already
   names the failure: "a study-shaped working question retrieves study-shaped papers,
   which caps how interesting Step 5 can honestly be."

### Proposed

After the Step 1 cold read, instead of adopting one candidate:

1. **Launch one retrieval scout per eligible candidate** (up to 3, in parallel). A scout
   is Steps 2 + 3 exactly as they exist today, run read-only against that candidate's
   own `searchQueries`:
   - the 3 concurrent searches with the deterministic taxonomy routing and widening
     ladder (unchanged),
   - BM25 + embedding RRF scoring, threshold cascade, quality boosts (unchanged),
   - returns `{candidate, qualified, wide pool, relSim distribution}`. **No LLM calls
     inside a scout.** Search is OpenAlex (free), scoring is local embeddings (CPU).

2. **The orchestrator picks the winner deterministically:**
   - primary: pool strength (count of papers above `SIM_ONTOPIC`, then above
     `SIM_MIDPOINT`; the same cascade that today decides whether to retry),
   - tie-break 1: cold-read `interest` (already computed, currently the sole criterion),
   - tie-break 2 (personalization, see Lever 3): mean cosine of the pool's top papers to
     the reader's saved-paper centroids from `lib/librarian/dossier.ts`.

3. **The theme-retry loop becomes the all-scouts-failed path.** It only fires when no
   scout's pool clears `SIM_MIDPOINT`, and the reframe prompt can now say which three
   angles already failed retrieval, which is strictly more information than today's
   single failure.

4. Pipeline continues from Step 3b for the winner only. Selection, news, re-rank,
   foundational lane, Step 5, synthesis: all unchanged.

### Why this is faster, better, and more personalized at once

- **Faster:** the retry tail collapses. A candidate that would have triggered a retry
  simply loses a race that ran concurrently with the eventual winner's search. Typical
  runs pay nothing extra in wall clock (the winner's search had to happen anyway).
- **Better:** the candidate choice is grounded in evidence, not just headline appeal.
  Today a 5/5-interest question with a thin literature beats a 4/5 question with a rich,
  tension-filled pool; after this, it loses, which is the correct outcome for a digest
  whose quality is capped by its papers.
- **More personalized:** the dossier centroids get a third surface (see Lever 3) that
  respects the existing taste containment rules.

### Constraints and costs

- **OpenAlex politeness:** 3 scouts x 3 queries = up to 9 concurrent requests, each
  internally serial through its widening ladder. That brushes the 10 rps polite pool.
  Cap scout concurrency at 2 (`p-limit` style), or dedupe identical queries across
  candidates before launch (candidates share a seed topic, so query overlap is common).
- **Scoring cost:** up to 3x embedding work, all local MiniLM on CPU. On Vercel this is
  tens of seconds of CPU only in the worst case; measure with the existing
  `[Digest][timing]` instrumentation before and after.
- **Cross-digest dedup and rotation memory:** scouts are read-only; `seenTitles`,
  `search_queries` persistence, and `seed_interests` are written only for the winner.
  The losers' queries should NOT enter query memory (they never produced a digest).
- **Scoping in code:** the scout is essentially "extract Steps 2 + 3 into a pure
  function," which the theme-retry loop body already almost is. This is the same
  refactor shape as `findFoundationalItem()` in speedup Phase 1.3.

---

## Lever 2: two-provider model routing (Claude for taste, Gemini for judgment)

We hold keys for both APIs. The tier split already exists (`judgeConfigFrom()` routes 7
judge-tier calls when `AI_MODEL_DIGEST_JUDGE` is set), but it can only swap the *model*,
never the provider, because it reuses the caller's key. So today we cannot run the taste
tier on Claude and the judge tier on Gemini Flash simultaneously, which is exactly the
pairing that makes sense:

| Tier | Calls | Best fit | Why |
|---|---|---|---|
| Strong (taste/knowledge) | hypothesis, selection, foundational naming, Step 5 headline + repair, skeleton, synthesis draft + critique + revision | **Claude Sonnet** (`claude-sonnet-4-6`, or `claude-sonnet-5` when we next verify pricing) | prose voice, headline taste, instruction-following on the banned-word and structure contracts |
| Judge (structured verdicts) | cold reads x3, Step 4b re-rank, foundational gate, Stage A metadata, gist | **Gemini Flash** (`gemini-2.5-flash` or flash-lite) | ~1 s structured-JSON responses, near-zero cost, every call already treats an absent verdict as non-blocking |

### Change

Extend `judgeConfigFrom()` in `src/lib/ai/provider.ts` to honor three optional envs:
`AI_JUDGE_PROVIDER`, `AI_JUDGE_KEY`, `AI_MODEL_DIGEST_JUDGE`. If provider or key is set,
all three must be set together and validated for consistency (the CLAUDE.md gotcha:
never pair a Gemini model with an Anthropic key). Unset = today's behavior, byte for
byte, so rollback stays one env var. The provider abstraction already speaks to both
through OpenAI-compatible endpoints; no client change needed.

Both providers should also get independent failure isolation they mostly already have:
every judge call has a non-blocking fallback, so a Gemini outage degrades to
deterministic checks instead of taking the digest down, and vice versa. That resilience
is itself an argument for splitting providers.

### Cost sketch (verify current prices before setting envs)

Per digest, strong tier is roughly 20K input / 2.5K output tokens. On Claude Sonnet at
$3/$15 per MTok that is about $0.10 per digest; judge tier on Gemini Flash is well under
a cent. Order of $3/month per daily reader on the strong tier. If that matters at scale,
`claude-haiku-4-5` ($1/$5) is the intermediate option for the strong tier, but the
synthesis voice is the product, so downgrade only with an eval in hand.

---

## Lever 3: personalization surfaces for the dossier

The taste dossier's containment rule (algorithm.md, Learning System) is load-bearing:
taste never touches search, thresholds, the news lane, or `relSim`. It currently argues
in exactly two places: the `tasteBoost` reordering in Step 3 and the prose block in the
Step 3b selection prompt. Two additions, one clearly inside the rules and one that needs
a product decision:

1. **Race tie-break (inside the rules, recommended).** When two candidate pools are
   equally strong on relevance, break the tie toward the pool whose top papers sit
   closer to the reader's saved-paper centroids. This is the same "nudge inside the
   filter" shape as `tasteBoost`: it cannot qualify an off-theme pool, cannot move a
   threshold, and is absent for readers with no dossier. It makes the *daily question
   itself* lean toward what this reader demonstrably engages with, which is the most
   visible personalization win available anywhere in the pipeline.

2. **Dossier line in the hypothesis prompt (needs a decision, default OFF).** Injecting
   "this reader consistently saves methods-heavy work" into the Step 1 prompt would
   shape which angles get proposed at all. It does not touch retrieval scope, but it
   moves taste upstream of every other gate, and the containment rule exists because
   upstream taste is how feeds collapse into filter bubbles. If we ever try it, it goes
   behind a flag, and the coverage floor + rotation machinery must keep winning
   conflicts. Not part of this plan's initial scope.

Also worth stating: the dossier rewrite path (`lib/librarian/`) is already the
"personalization sub-agent" in this architecture. It runs out of band on the chore tier,
and its two outputs are exactly the interfaces the levers above consume. No new
personalization model is needed; the work is giving its outputs more decision points.

3. **Taste-aware agentic retrieval (product decision, 2026-08-25: Defne wants this).**
   This supersedes part of the containment rule. The direction: the scout lane becomes
   agentic (it may reformulate queries, follow citations, consult Semantic Scholar
   recommendations within a hard call budget) AND consults the user model while doing
   so, not merely re-ranking afterwards. The literature basis is real
   (`learning/research/user-models.md` section 6.3): Bridger (CHI 2022) matches
   scholars on partial facet commonality plus deliberate contrast, and PURS (RecSys
   2020) models personalized unexpectedness per user; both are retrieval-side taste,
   validated by user studies. Safeguards that stay non-negotiable so this does not
   collapse into a filter bubble:
   - **Relevance gates unchanged.** `SIM_ONTOPIC` and the cascade still decide what
     qualifies; taste shapes what is *fetched and proposed*, never what passes.
   - **Taste as contrast, not just affinity.** Following Bridger, at least one scout
     query per run should deliberately *contrast* with the reader's consumption
     clusters (adjacent facet, unfamiliar subfield) rather than lean into them. The
     dossier steers exploration as much as exploitation.
   - **Coverage floor and topic rotation keep winning conflicts.** The mechanical
     rotation machinery is the anti-monoculture backstop and outranks taste.
   - **Budgeted and logged.** The agentic scout has a hard tool-call budget, and every
     taste-influenced query is persisted (like `search_queries` today) so a weird
     digest is diagnosable from its row.
   - When this ships, algorithm.md's containment rule must be rewritten to say what it
     now protects (thresholds and qualification, not query formulation), per the
     docs-update rules in CLAUDE.md.

---

## Lever 5: reader voice profile (personalize the language, not just the papers)

The containment rule constrains *retrieval*, not *voice*. Synthesis-side
personalization is the safest kind available: the papers are already chosen when the
synthesis runs, so adapting how they are explained cannot narrow what the reader sees.
And the plumbing half-exists. `focusLevel` (beginner/intermediate/expert, per interest)
already flows through `synthesisCtx` into tone and jargon handling (CLAUDE.md:
"focusLevel belongs in synthesis, not retrieval"). What is missing is that the richer
signals in the ledger never reach the prose:

| Signal | What it says about voice |
|---|---|
| `familiarity` self-ratings | jargon appetite per subtopic: define "self-attention" for one reader, use it for another |
| `qa_pairs.question` texts | what confuses or hooks this reader: mechanism questions vs implication questions |
| `dig_deeper` selections | which passages they stop on: stats, claims, methods |
| `digest_feedback` reasons | typed complaints about tone/level, currently only steering selection |

**Change:** the dossier keeper (`lib/librarian/dossier.ts`) produces a third output
alongside the taste prose and the centroids: a ~100-word **voice profile** ("assumes ML
vocabulary but not neuroscience; asks how-does-it-work questions; stops on concrete
numbers; skims long bullets"). Injected into `synthesisCtx` and rendered in the Stage C
draft prompt, the Stage A takeaway/`plainName` instructions, and the gist prompt. Same
rewrite cadence as the rest of the dossier (five signals or seven days); below the
signal floor it writes nothing and the prompts render exactly as today.

**Boundaries:**
- The hard contracts are untouched: banned words, structure contract, `[Source N]`
  bolding, hover-definition capture. The profile is additive context, like `focusLevel`.
- The **headline stays universal.** The cold-reader gate's premise is "a smart person
  with no academic background and no context," and the admin's digest doubles as the
  logged-out front page. Voice personalization stops at the synthesis and card copy.
- keyConcepts extraction still captures all jargon; an expert reader gets fewer
  definitions *inline* but hover-definitions remain for everything.

---

## Where agentic actually fits (and why the happy path stays deterministic)

Recommending against a full agent loop is not a style preference; it is this pipeline's
own recorded history. "Letting AI decide whether to revise theme: always said false" is
in algorithm.md's What Didn't Work list, and every deterministic gate exists because a
model's self-judgment about control flow proved unreliable. A fully agentic generator
turns those gates back into suggestions, and turns headline debugging from reading
`theme_candidates` into transcript archaeology. On an unattended cron with a 60 to 90 s
budget, serial decide-act-observe loops are also the most expensive possible shape.

But one path is genuinely open-ended: **retrieval failure.** When every scout's pool is
weak, today's remedy is "reformulate and re-run the same ladder." That is the one place
a bounded agent earns its cost:

- **Scout-of-last-resort:** a small tool-loop agent with tools `searchOpenAlex`,
  `getReferencedWorkIds`, Semantic Scholar recommendations, and query reformulation,
  a hard budget of 4 to 6 tool calls, and a strict output contract (a candidate paper
  pool, nothing else). It runs only when the deterministic ladder has already failed,
  so it can only improve on the current outcome (a thin digest or a retry cycle).
- Everything it returns still passes the normal gates: scoring, thresholds, dedup,
  predatory filter, re-rank. Agency is in the exploration, never in the judgment.

Rule of thumb for future extensions: agentic where the task is open-ended exploration
with no settled rule (failure-path retrieval), deterministic wherever a taste rule has
already been paid for in shipped mistakes.

---

## Lever 4 (optional experiment): synthesis draft race

Stage C is the single longest LLM call. Generate two drafts in parallel, one on Claude
and one on Gemini Pro, and let Stage D's existing critique score both and revise the
winner. Wall clock is unchanged (parallel drafts, and the critique already always
fires); cost adds one long-output call (~$0.02 to $0.06/day). The 7-dimension critique
scores make this cheaply measurable: run it for two weeks, compare picked-winner rates
and post-revision `minScore` against baseline, keep or kill.

This is the classic judge-panel pattern and the only place I would use it. Racing the
headline or metadata is not worth the added variance; those already have repair loops.

## Smaller fan-outs (take or leave)

- **Stage A per-paper fan-out:** metadata is one ~6K-token call over all papers; split
  into one flash-tier call per paper, in parallel. Slightly faster, and per-paper focus
  tends to improve `plainName`/takeaway distinctness. Low risk, low reward.
- **Known-issue cleanup that this refactor touches anyway:** Step 3b's discarded
  `argumentArc`/`paperRoles` (algorithm.md Known Issue 5). If selection output were
  trusted, Stage B could start earlier or shrink. Fold into the scout refactor only if
  the code is already open.

---

## What this plan deliberately does not do

- No autonomous agent loop on the happy path. The orchestrator is `digest.ts`;
  determinism is the feature. The one sanctioned agent is the budgeted
  scout-of-last-resort above, on the retrieval-failure path only.
- No LLM control over retrieval scope. Scouts run the deterministic taxonomy routing
  exactly as written; "LLM-generated focus fields" is already in the What Didn't Work
  list and stays there.
- No gate changes. Every threshold, cold read, and repair path is judged identically;
  only the order of discovery and the model serving each call change.
- No taste in *qualification*. Lever 3.3 (2026-08-25) lets taste shape which queries an
  agentic scout runs, under the safeguards listed there, but the relevance thresholds
  and gates that decide what qualifies remain taste-free.

## Landing order

1. **Lever 2** (cross-provider judge tier): smallest diff, instant rollback, and it
   makes every judge call in Lever 1's world cheap. Land, set envs in Vercel, watch a
   week of `[Digest][timing]` logs.
2. **Lever 1** (retrieval scouts): the structural change. Extract Steps 2 + 3 into a
   pure function, race candidates, pick deterministically. Verify with timing logs that
   the retry path stops appearing and the p95 collapses.
3. **Lever 3.1** (dossier tie-break): a few lines once Lever 1 exists, since the scout
   already returns the pool needed to score it.
4. **Lever 5** (voice profile): independent of 1 to 3; needs only the dossier keeper
   and prompt plumbing. Can land any time; verify by reading a week of syntheses for a
   high-familiarity vs a beginner account.
5. **Lever 4 + Stage A fan-out + scout-of-last-resort**: optional experiments. The
   draft race is evaluated on critique scores; the last-resort scout on how often the
   retry path still fires after Lever 1.

## Expected impact

| | Today (post-speedup) | After levers 1 + 2 |
|---|---|---|
| Typical wall clock | ~60–90 s | ~45–70 s |
| Bad-day wall clock (theme retries) | ~2.5–4 min | ~60–90 s (retry path nearly extinct) |
| Candidate choice grounded in | headline cold read only | actual retrieved evidence + reader taste |
| Judge-tier latency/cost | strong-model prices unless judge env set same-provider | Gemini Flash prices, independent failure domain |

## Docs to update after landing (CLAUDE.md rules)

- `docs/algorithm.md`: Step 1/2/3 flow (candidate racing), tier table provider column,
  Learning System (tie-break surface).
- `docs/changelog.md`: dated entry per lever.
- CLAUDE.md env list: `AI_JUDGE_PROVIDER`, `AI_JUDGE_KEY` semantics.
