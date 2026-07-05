# Conversational Papers — The Takeaway (Build 1) — Design Spec

**Date:** 2026-07-05
**Status:** Approved design, pending implementation plan
**Scope:** Build 1 of Conversational Papers (features-todo #5). Turns each paper into a
memorable, repeatable "takeaway" and reshapes the per-paper card + detail overlay to show it.
The retention/recall loop (Build 2), homework UI, audio, and non-brief modes are **out of scope**.

## Problem

The digest explains well but isn't *memorable* or *repeatable*. Direct user signal this
session: the "Consumers and AI" per-paper summary "doesn't afford reading," the gist is "too
buried," and the reader "disengages." The goal isn't comprehension (the synthesis handles
that) — it's letting the reader **feel they learned something they could say out loud
tomorrow**, without reading the paper.

The A–E readability pass fixed *orientation* (what is this, why here). This is the *retention*
axis (will I remember it, can I repeat it). Summaries fail here because they're written to
inform, not to be remembered or restated.

## Goal

Each paper carries a **takeaway**: the one surprise, a concrete anchor, and a ready-to-say
line — in the reader's own casual voice. The card leads with it (so it pulls you in); the
detail overlay delivers the full unit (so the click earns something).

## The Takeaway unit

Three new distilled fields per paper, generated in Stage A metadata alongside `plainName`:

| Field | What | Notes |
|-------|------|-------|
| `takeaway_hook` | The ONE surprising sentence — the thing worth remembering. | Required. This is the card's new draw. |
| `takeaway_stat` | The concrete anchor: a number or vivid fact. | Nullable — not every paper has one; omit rather than invent. |
| `takeaway_line` | "Say it like this" — a ready-to-repeat sentence in casual, spoken voice. | Required. The conversational payload. |

Voice: all three obey the human-voice / no-AI-speak rules already in `prompts.ts`
(no "quietly", no em dashes, contractions, sound like a person). `takeaway_line` is
explicitly "the way you'd say it to a friend," e.g. *"you know sentiment analysis? turns out
sarcasm is the hard part."* Never fabricate a stat or a claim not in the paper.

## Data model (all additive — nullable, migration-safe)

`papers`:
- `takeaway_hook TEXT`
- `takeaway_stat TEXT`
- `takeaway_line TEXT`

`digests`:
- `homework_topic TEXT` — nullable; null = standing digest. The **only** homework concession
  now. When the homework UI ships, a homework-seeded digest sets this, and Build 2's recall
  loop can prioritize by it. Avoids a later migration.

Migration: `sqlite3 ... "ALTER TABLE papers ADD COLUMN takeaway_hook TEXT; …"` locally, then
`turso db shell learning-et-al "ALTER TABLE …"` for prod (same additive pattern used for the
A–E columns). `summary` STAYS — hover chips, compare view, and other modes still use it;
takeaway fields only change what the card/detail *display*.

## Generation (Stage A — `metadataPrompt` in `prompts.ts`)

Add `takeaway` to each item's JSON:
```
"takeaway": { "hook": "...", "stat": "..." | null, "line": "..." }
```
with rules:
- **hook**: the single most surprising or counterintuitive thing this paper shows, in one
  plain sentence a non-expert would repeat. Not a summary of the whole paper.
- **stat**: one concrete number or vivid fact from the paper that anchors the hook; null if
  the paper genuinely has none. Never invent one.
- **line**: how you'd bring it up in conversation — casual, contractions, spoken. Reuse the
  banned-word list; no AI-speak.

Wire into the item type (`DigestAIResponse.items`), the papers insert (fallback to null), and
the API routes pass them through via `...p` spread (plain strings — no parsing needed).

## Rendering (reshape existing per-paper — `brief-digest.tsx`)

**Card (`PaperBlobCard`):** keep the current look/layout. Replace the flat `summary` line with
`takeaway_hook` as the body draw; keep `plainName`, the academic title sub-line, and one
keyword. Fall back to `summary` when `takeaway_hook` is null (old digests).

**Detail overlay (`PaperDetailOverlay`):** extend the version shipped this session. Order:
1. ★ relates-to-theme sentence (`connectionReason`) — keep.
2. **hook** — the surprise, prominent.
3. **the number** — `takeaway_stat`, styled as a small stat callout; omit if null.
4. **"say it like this"** — `takeaway_line`, styled as a quote/callout (the conversational payload).
5. Abstract — expandable (Show more/less), as shipped.
6. VIEW STUDY ↗.

## Edge cases

- **Old digests / null fields:** card falls back to `summary`; detail omits any missing
  takeaway block. Never errors — same graceful degradation as the A–E header.
- **No stat:** the stat block is omitted (common and fine).
- **Other modes** (`?papers`, `?papersog`, `?classic`): unchanged; they keep using `summary`.

## Out of scope (fast-follows, not this build)

- **Recall loop** (Build 2): spaced-repetition resurfacing of past takeaways.
- **Homework UI**: only the `homework_topic` column lands now.
- **Audio / narrated brief.**
- **Non-brief modes.**

## Verification (no automated tests — manual)

Same method proven this session: seed a digest with `takeaway_*` fields into local SQLite,
run `npm run dev`, view the logged-out public path, screenshot the card, then drive a real
click (playwright-core against system Chrome) into the detail overlay. Confirm: card leads with
the hook; detail shows hook → stat → say-it-like-this → expandable abstract → link; old digest
(null fields) degrades to `summary` with no error.
