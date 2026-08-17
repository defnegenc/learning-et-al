# Plan: cold-reader comprehension gate for digest headlines

**Trigger case (2026-08-16, Kenny's digest):** headline read roughly as
"Can used museum exhibits effectively teach?" — a garden-path phrase ("used
museum exhibits" parses as *second-hand exhibits*, when the source material was
about the *use of* museum exhibits in teaching). The reader had to decode it;
the intended question was the plain "Are museums actually good at teaching us?"

## Why every existing gate passed it

`themeProblems()` (src/lib/pipeline/digest.ts:267) checks three things:

1. Word count ≤ 10 — passes (6 words).
2. `themeNamesAThing` — passes: "museum", "exhibits" are concrete, grounded in
   the sources, not in `PLACEHOLDER_NOUNS`, and not in subject position as
   placeholders.
3. `PARAPHRASED_JARGON` regexes — passes: no negative construction.

The comment above `PLACEHOLDER_NOUNS` (digest.ts:178) says the coherence guard
"tests whether the theme parses, not whether it says anything" — and the
vagueness guards test whether it *says something*, not whether it *parses
cleanly on first read*. A garden-path headline is the hole between the two
guards. No regex will close it: "used/left/raised/found + noun" is sometimes
fine ("found objects") and the ambiguity is contextual. This is a judgment
call, and right now the only judge is the same completion that wrote the line —
the "dinner table test" is self-certified by the generator, which already knows
what it meant, so it cannot notice a misread.

## Fix

### 1. Cold-reader gate (the core change)

After Step 5 collects its unique candidate themes (digest.ts:1520-1527), add
ONE extra LLM call with **no digest context** — no sources, no thread, no
working question. Input: the bare candidate headlines. For each, it returns:

```json
{ "guess": "one sentence: what a digest with this headline is about",
  "misread": true/false,
  "why": "the specific phrase that misparses (garden path, ambiguous modifier, unidiomatic compression)" }
```

Selection then becomes deterministic, in order of candidates:

- must pass `themeProblems` (existing),
- must have `misread === false`,
- the cold reader's `guess` must match the editorial `thread` — checked with
  the local embedder we already ship (`src/lib/embeddings.ts`), similarity
  above a threshold to be tuned (~0.5 with all-MiniLM-L6-v2; log it for a few
  days before enforcing hard). This makes SELF-CONTAINED a measured property
  instead of a prompt aspiration: if a context-free reader can't guess the
  digest's subject from the headline, it is not self-contained, whatever the
  generator claims.

If no candidate survives, feed the cold reader's misreadings into the existing
repair loop (digest.ts:1571-1576) as concrete evidence: "a reader with no
context thought this meant X because of Y" — then re-check the repaired line
once. Never ship a `misread: true` line when any passing candidate exists.

Cost: +1 small completion per digest (+1 on repair), + a few local embeddings.
Negligible next to the existing pipeline.

### 2. Name the failure in the prompts

Add one rule + example to BOTH the Step-1 `hypothesisPrompt` and the Step-5
`revisePrompt` (mirroring the existing paraphrased-jargon rule):

> BEWARE THE GARDEN PATH: a verb-derived word before a noun makes the reader
> parse the wrong sentence. "Can used museum exhibits teach?" reads as
> *second-hand* exhibits. If the line contains "used / left / raised / found /
> increased + noun", say who does what instead: "Are museums actually good at
> teaching?"

### 3. Stop the taste rules from drifting across retry paths

Five prompts currently produce or rewrite a theme: Step-1 hypothesis, the
shortener (digest.ts:643), the novelty retry (digest.ts:670), the
not-enough-papers reframe (digest.ts:724), and Step 5 + its repair. The novelty
retry and the reframe carry almost none of the taste rules — a mangled working
theme from those paths also degrades retrieval, not just the headline. Extract
the shared taste block (dinner-table test, name-the-object, garden-path rule,
placeholder ban) into one constant and interpolate it into all five, the same
way `MAX_THEME_WORDS` already is. (Same class of gotcha as the `shortName`
rules living in two places.)

## Verify against Kenny's row first

Before building, confirm which step emitted the phrasing (Step 1, shortener,
novelty retry, or Step 5) from the prod DB:

```sql
SELECT d.date, d.theme, d.seed_topic, d.search_queries
FROM digests d JOIN users u ON u.id = d.user_id
WHERE (u.name LIKE '%kenny%' COLLATE NOCASE OR u.email LIKE '%kenny%' COLLATE NOCASE)
ORDER BY d.created_at DESC LIMIT 3;
```

`theme` holds the displayed headline; if `seed_topic` is a museum-education
OpenAlex topic whose description says "the use of museum exhibits…", that
confirms the compression path. (Only the final theme is stored — the working
theme and candidates aren't persisted. Worth adding a `working_theme` /
`theme_candidates` debug column while in here, so the next weird headline is
diagnosable from the row alone.)

## Docs to update after implementing

- `docs/algorithm.md` (pipeline change)
- `docs/changelog.md`
