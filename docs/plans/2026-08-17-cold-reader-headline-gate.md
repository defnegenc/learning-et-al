# Plan: cold-reader gate so only good headlines ship

**Confirmed against prod data (2026-08-17).** Of 17 recent headlines, 15 pass
the user's taste and 2 fail:

- **"Is one museum exhibit ever enough to teach anything?"** — the question is
  warped around the papers' study design. Museum-learning studies evaluate one
  exhibit at a time; the editor imported that unit of analysis into the
  reader's question. Nobody wonders about learning *per exhibit* — the human
  question is "are museums actually good at teaching us?". The intensifier
  stack ("ever enough … anything") compounds it: it reads as dismissive
  rhetoric, not curiosity.
- **"Are incubators and TTOs choosing startup survivors?"** — "TTOs"
  (technology transfer offices) is an insider acronym a smart non-expert
  cannot expand. It passes `themeNamesAThing` because the sources use it, which
  is exactly backwards: source vocabulary is evidence of grounding, not of
  legibility.

Both sailed through `themeProblems()` (src/lib/pipeline/digest.ts:267): under
10 words, concrete grounded subjects, no negative constructions. The pattern
across both failures: **every existing check is generation-side** — regexes
plus rules inside the prompt that wrote the line. The "dinner table test" is
self-certified by a model that already knows what it meant, so it can't hear
how the line lands on someone who doesn't.

The good 15 calibrate the bar: "AI" and "VC" are acceptable acronyms; one
"actually" is fine; two-sentence forms work ("Bank tellers didn't disappear—
they got harder jobs"). The gate must not flatten these.

## Fix

### 1. Cold-reader gate (the core change)

After Step 5 collects its unique candidate themes (digest.ts:1520-1527), add
ONE extra LLM call with **no digest context** — no sources, no thread, no
working question. Input: the bare candidate headlines. For each it returns:

```json
{ "guess": "one sentence: what a digest with this headline is about",
  "unknownTerms": ["words/acronyms a smart non-expert couldn't define"],
  "wouldWonder": true/false,
  "why": "if false: what makes it sound contorted — study-shaped framing, rhetoric, misparse" }
```

`wouldWonder` is the museum catcher: "does this sound like a question a
curious person would genuinely ask out loud, or like a question
reverse-engineered from academic studies?" `unknownTerms` is the TTOs catcher.
`guess` is the self-containedness measure.

Selection becomes deterministic, in candidate order:

- passes `themeProblems` (existing checks + the new tells below),
- `unknownTerms` empty and `wouldWonder` true,
- `guess` embedding-matches the editorial `thread` (local MiniLM via
  `src/lib/embeddings.ts`; log similarity for a few days before enforcing a
  hard threshold, ~0.5 to start).

If no candidate survives, feed the cold reader's specific objections into the
existing repair loop (digest.ts:1571-1576) — "a reader with no context said X"
— and re-check the repaired line once. A digest never ships a flagged headline
while any passing candidate exists.

Cost: +1 small completion per digest (+1 on repair) + a few local embeddings.

### 2. New deterministic tells in `themeProblems`

Cheap, zero-LLM, catch the confirmed failures even if the judge is down:

- **Insider acronym:** any all-caps token of 2–5 letters not in a small
  household allowlist (`AI`, `VC`, `GPS`, `DNA`, `CEO`, `NASA`-tier) fails
  with "spell out the human meaning."
- **Intensifier stacking:** more than one of
  `ever / actually / truly / really / any(thing) / always / never` in one
  headline fails with "pick one intensifier or none — stacked intensifiers
  read as rhetoric, not curiosity." (One is explicitly fine — the approved set
  uses single "actually".)

### 3. Name both failures in the prompts

Add to BOTH the Step-1 `hypothesisPrompt` and the Step-5 `revisePrompt`,
alongside the existing paraphrased-jargon rule:

> DON'T IMPORT THE STUDY DESIGN. Papers examine one exhibit, one classroom,
> one app — because that's how studies work, not because that's the question.
> "Is one museum exhibit ever enough to teach anything?" is a study talking;
> "Are museums actually good at teaching us?" is a person talking. Import the
> subject, never the unit of analysis — unless the number itself is the
> surprise.

> NO INSIDER ACRONYMS. If a smart non-expert can't expand it at the dinner
> table, spell out what it does in human terms: "TTOs" → "the university
> offices that decide which inventions become startups." AI and VC pass;
> TTO, HCI, RCT do not. Appearing in the sources does not make an acronym
> legible.

### 4. Stop the taste rules from drifting across retry paths

Five prompts produce or rewrite a theme: Step-1 hypothesis, the shortener
(digest.ts:643), the novelty retry (digest.ts:670), the not-enough-papers
reframe (digest.ts:724), and Step 5 + its repair. The novelty retry and the
reframe carry almost none of the taste rules — a mangled working theme from
those paths degrades retrieval too. Extract the shared taste block
(dinner-table test, name-the-object, study-design rule, acronym rule,
placeholder ban) into one constant interpolated into all five, the same way
`MAX_THEME_WORDS` already is. (Same class of gotcha as the `shortName` rules
living in two places.)

### 5. Persist what the editor considered

Only the final `theme` is stored today, which is why diagnosing the museum
headline required memory + a manual DB trawl. Add nullable debug columns
`working_theme` and `theme_candidates` (JSON, including the cold reader's
verdicts) so the next weird headline is diagnosable from its row alone.
Column additions go through the existing idempotent micro-migration path
(note the `drizzle-kit push` PK gotcha does not apply to plain ADD COLUMN).

## Non-issue closed out

A disliked digest that the reader regenerates is set `hidden=true`
(src/app/api/digest/hide/route.ts) — the row stays in the table but drops out
of hidden-filtered queries. That is why Kenny's digest looked missing a day
later.

## Docs to update after implementing

- `docs/algorithm.md` (pipeline change + gate)
- `docs/changelog.md`
