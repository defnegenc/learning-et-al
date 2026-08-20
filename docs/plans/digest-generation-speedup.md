# Digest generation speedup

**Goal:** cut typical digest generation from ~2.5–4 min to ~60–90 s without changing what the pipeline judges, only *when* and *on what model* it judges. Every gate in `docs/algorithm.md` survives; nothing here weakens selection, cold reads, or the synthesis quality chain.

**Why it's slow today:** `generateDigest` in `src/lib/pipeline/digest.ts` makes ~13 sequential LLM round-trips on a happy path (~20 on a bad day) and runs every network search serially with hardcoded sleeps. Up to five of those calls regenerate the *entire synthesis* as long output (draft, fact revision, critique revision, coverage revision, format reformat), and long-output calls are where LLM latency lives. Nothing runs concurrently anywhere in the file.

Three phases, in landing order. Each is independently shippable and verifiable. Phase 1 changes no prompts at all.

---

## Phase 0 — Instrumentation (land with Phase 1) — **LANDED 2026-08-20**

Implemented as specified, with `logStage()` calls at: setup, step 1 theme, step 2 search (per theme attempt), step 3 scoring (per theme attempt), selection, step 4 news + fills, step 4b re-rank, step 5 headline, step 4c foundational merge, stage A+B, stage C draft, fact check + revision, stage D critique + revision, coverage gate + format enforcement, gist, db insert.

No baseline was captured before landing — there is no local env for a real run, so the first preview run after this lands *is* the baseline, and Phase 2's numbers get compared against it.


Add a stage timer so the wins are measurable in Vercel logs instead of vibes.

**`src/lib/pipeline/digest.ts`**, top of `generateDigest`:

```ts
const runStart = Date.now();
let lastMark = runStart;
const logStage = (name: string) => {
  const now = Date.now();
  console.log(`[Digest][timing] ${name}: +${((now - lastMark) / 1000).toFixed(1)}s (total ${((now - runStart) / 1000).toFixed(1)}s)`);
  lastMark = now;
};
```

Call `logStage(...)` after: Step 1 (theme), Step 2 (search), Step 3 (scoring), selection, Step 4 (news + fills), Step 4b (re-rank), Step 4c (foundational), Step 5 (headline), Stage A+B, Stage C (draft), review/revision, coverage/format, gist, DB insert. Capture one baseline run's numbers in this doc before landing Phase 1.

---

## Phase 1 — Parallelize independent work (no prompt changes, no quality change) — **LANDED 2026-08-20**

All four sub-changes implemented as specified. Two deltas worth recording:
- 1.3's tier-2 verification loop, in addition to losing its `await delay(300)`, now runs its ≤3 OpenAlex lookups via `Promise.all`.
- 1.4's `.catch(() => [])` on the news web search is a small behavior *improvement*: the old `await webSearch(...)` was unguarded, so a Serper/DDG outage threw out of `generateDigest` entirely. It now degrades to the RSS fallback.


### 1.1 Run the three search queries concurrently

**Where:** `digest.ts`, Step 2 loop (`for (let qi = 0; qi < searchQueries.length; qi++)` with `await searchPapers(...)` and `await delay(500)`), plus the `< 3 results` broad-retry loop right after it.

**Change:**

```ts
const perQuery = await Promise.all(searchQueries.map((query, qi) =>
  searchPapers(query, 10, "publicationDate", paperSearchPlan(qi))
    .catch(err => { console.log(`[Digest] Query failed: ${err}`); return [] as PaperSearchResult[]; })
));
// Merge in query order so dedup stays deterministic (first query wins a shared title)
for (let qi = 0; qi < perQuery.length; qi++) {
  for (const p of perQuery[qi]) {
    const key = normTitle(p.title);
    if (seenSearchTitles.has(key)) continue;
    seenSearchTitles.add(key);
    originQueryIdx.set(key, qi);
    allResults.push(p);
  }
}
```

- Delete the `await delay(500)` between queries and the `await delay(300)` in the retry block; apply the same `Promise.all` shape to the retry block.
- Do **not** touch the scope ladder *inside* `searchPapers` — precision→recall widening is inherently ordered.
- Rate-limit note: OpenAlex's polite pool allows 10 rps; 3 concurrent requests (each internally serial) is well within it.

### 1.2 Run Stage A (metadata) and Stage B (skeleton) concurrently

**Where:** `digest.ts`, Step 6 — the two back-to-back `aiComplete` calls for `metadataPrompt(...)` and `skeletonPrompt(...)`.

Both depend only on `paperListing` + `finalTheme` (+ `synthesisCtx`), and the skeleton no longer drops papers (see the comment in that block), so there is no data dependency.

**Change:**

```ts
const [metadataResp, skeletonResp] = await Promise.all([
  aiComplete(aiConfig, SYNTHESIS_SYSTEM, metadataPrompt(paperListing, finalTheme, synthesisCtx)),
  aiComplete(aiConfig, "You analyze relationships between research papers and plan argument structures. Return only JSON.", skeletonPrompt(paperListing, finalTheme)),
]);
```

Parsing and fallbacks stay exactly as they are.

### 1.3 Run the foundational lane (Step 4c) concurrently with Step 5 (headline)

Step 5 already filters foundational items out of its headline sources, so it never reads Step 4c's result. The only coupling is that both touch the shared `items` array — Step 4c pushes into it, Step 5 splices it. Break that coupling:

1. **Extract** the entire Step 4c body into a function that *returns* instead of pushing:

   ```ts
   async function findFoundationalItem(
     aiConfig: AIConfig,
     theme: string,                      // working theme — Step 4c already runs pre-finalTheme
     lanePapers: TaggedItem[],           // SNAPSHOT: items.filter(i => i.category !== "news") taken at call time
     seenTitles: ReadonlySet<string>,
     seenOpenAlexIds: ReadonlySet<string>,
     focusInterest: string,
     themeWords: string[],
   ): Promise<TaggedItem | null>
   ```

   Inside: identical logic (tier 1 citation graph → tier 2 canonical lookup → `pickFoundational` gate). Remove the `seenTitles.add(...)` and `items.push(...)` — those move to the merge point. Also replace the tier-2 verification loop (up to 3 serial OpenAlex lookups with `await delay(300)`) with `Promise.all` over the named works.

2. **In `generateDigest`:** start it right after Step 4b, before Step 5:

   ```ts
   const foundationalPromise = findFoundationalItem(aiConfig, theme, items.filter(i => i.category !== "news"), seenTitles, seenOpenAlexIds, focusInterest, themeWords)
     .catch(err => { console.log(`[Digest] Foundational lane failed (${err}), continuing without`); return null; });
   ```

3. **After Step 5 completes**, merge:

   ```ts
   const foundationalItem = await foundationalPromise;
   if (foundationalItem
       && !seenTitles.has(normTitle(foundationalItem.title))
       && !items.some(it => normTitle(it.title) === normTitle(foundationalItem.title))) {
     items.push(foundationalItem);
     seenTitles.add(normTitle(foundationalItem.title));
   }
   ```

**Accepted edge case (document in code):** Step 5's exclusion gate can drop a lane paper *after* tier 1 already mined its reference list. The ancestor is still a real, verified, LLM-gated foundational text for the theme, so this is acceptable; the dedup at the merge point handles title collisions.

### 1.4 Overlap the news web search with the selection LLM call (smaller win)

`newsSearchTerms` depends only on `newsQuery`/`focusInterest`, both known before selection. When `targetNews > 0`, kick off `const webResultsPromise = webSearch(newsSearchTerms, targetNews * 3).catch(() => [])` immediately before the selection `aiComplete`, and `await` it inside Step 4. Everything downstream (scoring, listicle/word guards, `fetchArticleText`) is unchanged.

**Phase 1 expected saving:** ~30–60 s (search serialization + sleeps + one full LLM round-trip hidden behind Step 5 + one hidden behind Stage B).

---

## Phase 2 — Fewer LLM round-trips (prompt consolidation, same judgments)

### 2.1 Step 1: three theme candidates + one batched cold read

Today's Step 1 worst case is five serial calls: hypothesis → shortener → novelty retry → cold read → re-angle. Replace with two (three on total failure).

**Change in `digest.ts`** (the `hypothesisPrompt` template literal and the blocks that follow it):

1. **Hypothesis prompt output schema** becomes:

   ```json
   {
     "selectedInterests": ["..."],
     "candidates": [
       { "theme": "...", "stakes": "...", "searchQueries": ["q1","q2","q3"], "newsQuery": "..." }
     ]
   }
   ```

   Ask for exactly 3 candidates with *genuinely different angles inside the same seed topic*. All existing content (taste rules, seed block, query memory, coverage-floor note) is unchanged.

2. **Deterministic pre-filter** on each candidate — no LLM calls:
   - word count ≤ `MAX_THEME_WORDS` (replaces the shortener retry call — an overlong candidate is just dropped)
   - `PARAPHRASED_JARGON`, insider-acronym, and stacked-intensifier checks (the paperless subset of `themeProblems`)
   - novelty: ≥2-word overlap with any recent theme (replaces the novelty-retry call — an overlapping candidate is just dropped)
   - empty `stakes` → dropped

3. **One batched `coldRead(aiConfig, survivingThemes)`** — the function already accepts arrays; Step 5 already uses it that way.

4. **Pick:** among candidates with zero cold-read problems, highest `interest` wins; adopt that candidate's `theme`, `stakes`, `searchQueries`, `newsQuery`.

5. **Only if zero candidates survive both filters:** fire the existing re-angle repair prompt once (keep its wording), accept best-effort, continue. This is the only remaining serial retry.

6. **Delete:** the shortener retry block, the novelty retry block, and the single-theme cold-read + re-angle block. The theme-retry loop for *too few papers* (`MAX_THEME_RETRIES`) stays — it's a retrieval failure path, not a taste path.

### 2.2 Merge the fact-check into the critique (one review call, one revision)

Both calls read the same draft synthesis against the same papers. Merge them.

**`src/lib/ai/prompts.ts`:**
- Extend `synthesisCritiquePrompt` to also take `paperFindings: { index: number; findings: string[]; summary: string }[]` and add to its JSON output:

  ```json
  "factIssues": [{ "paperIndex": 1, "problem": "...", "fix": "..." }]
  ```

  with the existing fact-check instructions ("flag any paper whose contribution is misrepresented, exaggerated, or missing key nuance") folded in.
- Extend `synthesisRevisionPrompt` to accept the `factIssues` list and render them as a "fix these facts" section, and **re-state the full structure contract** in the same prompt: one `- **[Source N] shortName**` bullet per paper (1–3 sentences, hard max 3), `> bridge` lines between bullets, one closing sentence, no intro paragraph, every shortName present, never narrate a source's irrelevance.

**`digest.ts`:**
- Delete the standalone fact-check block (the `aiComplete` + `factRevision` pair between Stage C and Stage D).
- Stage D fires its single revision when `minScore < 4 || factIssues.length > 0`, passing both the critique's revision instructions and the fact issues.

**Effect:** long-output synthesis generations drop from draft + up to 2 rewrites to draft + at most 1.

### 2.3 Merge the coverage gate and format enforcement into one repair call

**Where:** `digest.ts`, the `findMissing()` block and the `bulletCount` block after Stage D.

Keep both **deterministic checks** exactly as they are, but compute both *first*, and if either fails, fire **one** combined `aiComplete` repair whose prompt contains:
- the full required-structure listing (the existing format-enforcement scaffold built from `skeleton.paperRoles`), and
- an explicit "these sources are MISSING and must be added with exactly this bold reference" list when `missingPapers.length > 0`.

Delete the second call. Because 2.2's revision prompt now re-states the structure contract, this repair should fire rarely; the timing logs from Phase 0 will confirm.

**Phase 2 expected saving:** ~5 round-trips typical-case, 8 worst-case; removes 1–2 full-synthesis regenerations (~30–60 s).

---

## Phase 3 — Route judge/extract calls to a fast model

The plumbing half-exists (`aiConfigFor()` in `src/lib/ai/provider.ts`, `AI_MODEL_*` envs), but `generateDigest` uses one config for everything. About half the calls are structured-JSON judgment or grounded extraction where a flash-class model returns in ~1 s instead of 5–8 s, and every one already has a graceful fallback path.

### 3.1 Add a judge config derived from the run's config

**`src/lib/ai/provider.ts`:**

```ts
/** Same provider + key as the run's config; model swapped to the judge-tier
 *  override when set. Unset env = identical config = zero behavior change. */
export function judgeConfigFrom(cfg: AIConfig): AIConfig {
  const model = process.env.AI_MODEL_DIGEST_JUDGE?.trim();
  return model ? { ...cfg, model } : cfg;
}
```

Deriving from the caller's config (not `aiConfigFor`) keeps this correct on both the cron path and any bring-your-own-key path, and dodges the provider/model mismatch gotcha in CLAUDE.md.

**Also update:** `.env.example` and the CLAUDE.md environment list with `AI_MODEL_DIGEST_JUDGE`.

### 3.2 Route the calls

In `digest.ts`, `const judge = judgeConfigFrom(aiConfig);` and use `judge` for:

| Call | Why it's safe on a fast model |
|---|---|
| `coldRead` (Step 1 batch, Step 5 batch, repair re-read) | context-blind comprehension check; fallbacks already treat an absent verdict as non-blocking |
| Step 4b re-rank | 1–3 scoring against explicit rubrics; failure path keeps embedding order |
| `pickFoundational` gate | single yes/no judgment; null is the expected outcome |
| Stage A metadata | grounded extraction from abstracts; the overlap sanity-check already guards hallucination |
| Gist | 25-word grounded summary of the final synthesis |

**Stays on the strong model** (taste- or knowledge-critical, per CLAUDE.md): Step 1 hypothesis, wide-pool **selection** ("the LLM in `selectionSkeletonPrompt` makes the real quality call"), foundational tier-2 *naming* (needs real knowledge of the canon), Step 5 headline + repair, Stage B skeleton, Stage C draft, the merged review + revision from 2.2.

### 3.3 Rollout

1. Land with `AI_MODEL_DIGEST_JUDGE` unset → provably zero behavior change.
2. Set it in Vercel to a flash-class model **on the same provider as the live `CRON_AI_PROVIDER`** (verify in Vercel directly — masked values can't confirm the live provider).
3. Compare a week of timing logs and digest quality; the env var is the instant rollback.

**Phase 3 expected saving:** roughly halves the remaining judge-call latency (~20–40 s).

---

## Verification (no test suite — manual)

Per phase, on the preview deploy:
1. `POST /api/digest/generate` with `{"force": true}` as admin (or the Generate button).
2. Check Vercel logs: `[Digest][timing]` lines vs. baseline; no new error/fallback log lines (`parse failed`, `unavailable`, `failed the editorial gate` at unusual rates).
3. Check the rendered digest: headline quality, every paper highlighted via `[Source N]` mapping, bullet structure intact, foundational card still appears when earned (and its gold border still means something — Step 4c's gates are unchanged).
4. After Phase 2: confirm a digest whose logs show `factIssues` or a coverage gap still comes out structurally correct from the single merged repair.

## Docs to update after landing (CLAUDE.md rules)

- `docs/algorithm.md` — pipeline stage order/concurrency and the Step 1 three-candidate flow.
- `docs/changelog.md` — dated entry per phase.

## Expected impact summary

| | Serial LLM calls (typical) | Full-synthesis generations | Wall clock |
|---|---|---|---|
| Baseline | ~13 | up to 5 | ~2.5–4 min |
| After Phase 1 | ~11 effective (2 hidden by overlap) | unchanged | −30–60 s |
| After Phase 2 | ~8 | ≤ 2 | −30–60 s more |
| After Phase 3 | ~8 (judge calls ~5× faster) | ≤ 2 | −20–40 s more |
| **Target** | | | **~60–90 s** |
