# Digest Header + Gist Hook — Design Spec

**Date:** 2026-07-05
**Status:** Approved design, pending implementation plan
**Scope:** Readability & Curiosity Pass, part A/B/C (+ a small title-prompt tweak). Jargon
coverage (D) and paper naming (E) are a **separate, later spec** — explicitly out of scope here.

## Problem

The digest buries its payoff. Grounded in the current code:

1. **Gist is gated behind clicks.** `brief-digest.tsx` reveals one source at a time behind
   "Next source →", then "Compare the three", then dig deeper. The sharpest line (the answer)
   only appears after stepping through everything.
2. **Obscure titles.** The `theme` (rendered as `SweepTitle`) is optimized for punchy but not
   graspable. "When signals speak, do our models truly listen?" is all abstract nouns — you
   can't tell it's about reading emotion in text and brainwaves.
3. **No orientation.** Nothing tells the reader which of their interests seeded the digest or
   why it's worth attention before they dive in.

## Goal

Deliver the **payoff and orientation in zero clicks**, directly under the title, *above* the
existing source-by-source walk (which stays exactly as-is). Serve the core product goal:
foster curiosity, surface the unexpected accessibly.

## Solution overview

A new header block, rendered once, between the title and the synthesis component:

```
WHEN SIGNALS SPEAK, DO OUR MODELS TRULY LISTEN?   ← existing SweepTitle (theme)
[HCI] [NLP]                                        ← domain chips, colored by field
Models only sort of listen — they capture the      ← gist: the one-line answer (the hook)
signal but miss the meaning until forced to
look close-up and far out at once.
𝑖 Two ways of reading a signal — one from          ← framing: faint italic, curatorial
  language, one from the brain.
──────────────────────────────
[ Next source → ]                                  ← existing walk, untouched
```

## Data model

Three nullable columns added to the `digests` table (`src/lib/db/schema.ts`):

| Column | Type | Purpose |
|--------|------|---------|
| `seed_interests` | TEXT (JSON) | `[{ keyword, field }]` — the interests that seeded the digest. Drives the chips. |
| `gist` | TEXT | One-line answer to the central question. The zero-click hook. |
| `framing` | TEXT | The faint italic curatorial provenance line. |

**Migration:** simple column additions — the SQLite primary-key `drizzle-kit push` gotcha does
NOT apply. Run `sqlite3 paper-processor.db "ALTER TABLE digests ADD COLUMN seed_interests TEXT;"`
(and same for `gist`, `framing`) locally, then push schema to Turso prod separately.

All three are nullable so **existing digests degrade gracefully**: the header omits any piece
whose field is null; the title still renders.

## Generation (pipeline — `src/lib/pipeline/digest.ts`)

### `seed_interests` — free
The `selectedInterests` are already chosen in Step 1 (central-question generation). Persist them
alongside each keyword's `field` (from the `interests` table / `candidateInterests`). No new AI
call. Store as JSON.

### `gist` + `framing` — folded into the existing end-of-pipeline block
Generated in the **same block that already produces `suggestedAnswers`** (which already sees the
*final* synthesis, so the gist reflects the real stance rather than a pre-synthesis guess). One
extended prompt returns both:

- **gist:** "In one punchy sentence (≤25 words), answer the question '{theme}' the way the
  synthesis does — no jargon. Lead with the answer, even if it's 'sort of'."
- **framing:** curatorial one-liner (≤15 words) grounded in the actual papers — names the tension
  or the cross-domain pairing. Tone: intriguing, a curator's framing (e.g. "Two ways of reading a
  signal — one from language, one from the brain"). **Honesty guard:** grounded in the synthesis /
  papers only; no fabricated "frontier"/trend claims (per the "never invent relevance" principle).

Cost: negligible — extends one existing call.

**Consistency gotcha:** per CLAUDE.md, the logged-out experience pre-generates answers at the end
of the pipeline. `gist`/`framing` live in that same block, so both the logged-in and public paths
get them with no extra wiring — verify both render.

### Title-concreteness tweak — `hypothesisPrompt` (`digest.ts` ~line 262)
Add ONE rule to the existing theme rules, keeping all current punchiness/jargon rules:

> - The theme must contain at least ONE concrete, picturable noun — a real thing the reader can
>   see — not only abstractions.
>   BAD: "When signals speak, do our models truly listen?" (all abstractions — unclear it's about
>   text and brainwaves).
>   GOOD: "Can AI read emotion in text and brainwaves?" (same idea, graspable).

This is a light nudge, not a rewrite. The new header already grounds abstract titles; this just
trims the fully-abstract tail.

## Rendering (`src/components/today/today-page.tsx`)

- New `<DigestHeader>` component rendered in the shared `DigestTitleBlock`, immediately after
  `<SweepTitle text={displayTheme} …>` (currently `today-page.tsx:932`) and before the mode
  switch (BriefDigest / PapersMode / etc.). Placing it in the shared block means it appears in
  **all** digest modes, not just brief.
- **Chips:** map each `seed_interests` entry to `FIELD_HIERARCHY[field].color` and `.label`;
  reuse the existing brutalist keyword-tag style (solid pastel rect, black border).
- **Gist:** ~1.05rem, body font, not uppercase, prominent — the line that makes the reader care.
- **Framing:** small, faint (muted grey), italic.
- Props: pass `seedInterests`, `gist`, `framing` down from the digest object (thread through the
  same place `theme`/`keyConcepts` are already passed).

## Edge cases

- **Old digests (null fields):** header renders only the pieces it has; never errors.
- **Cross-domain:** chips naturally show two field colors (e.g. blue CS + green Biology).
- **Single interest:** one chip; fine.
- **Gist ↔ synthesis-opening overlap:** the synthesis often already opens with the answer. The
  gist is the standalone TL;DR; minor overlap is acceptable. If it reads repetitive after
  shipping, tune the synthesis intro prompt later (not in this spec).
- **Unknown/missing `field`:** fall back to a neutral chip color; never crash on a field not in
  `FIELD_HIERARCHY`.

## Verification (no automated test suite — manual via UI)

1. Generate a digest locally: `POST /api/digest/generate` with `{"force":true}` + a valid session
   cookie (or the admin Generate button).
2. In brief mode, confirm: chips render field-colored under the title; gist appears above the
   "Next source →" walk in zero clicks; framing is faint/italic and curatorial.
3. Confirm a **cross-domain** digest shows two chip colors.
4. Confirm an **old digest** (pre-migration) still renders the title with no header errors.
5. Confirm the **logged-out/public** view shows the same header (shared generation block).
6. Confirm generated titles now tend to include a concrete noun (spot-check a few generations).

## Out of scope (future specs)

- **D — Jargon coverage** (model names / technical terms beyond the `keyConcepts` whitelist).
- **E — Paper naming** (plain-language name alongside the academic title).
- **Homework Queue** (separate brainstorm).
- **Conversational Papers** research deep dive.
