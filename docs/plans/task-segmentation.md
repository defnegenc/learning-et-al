# Segmenting easy from hard work, on one model

**Status:** plan only, nothing implemented. Written 2026-08-20, after phases 1 and 2 of
`digest-generation-speedup.md` landed.

**Why this exists.** Phase 3 of the speedup plan assumed there was a cheaper, faster tier
to move the pipeline's judgment calls down to. There isn't: production already runs a
flash-class model for everything, so `AI_MODEL_DIGEST_JUDGE` has nothing to point at and
stays unset. The plumbing is harmless and is a real lever the day the default model gets
heavier, but as a speedup it is dead.

The idea underneath it is not dead. Roughly half of `generateDigest`'s calls are cheap
questions about text we already have, and half write things a reader sees. Today they are
treated identically: same token ceiling, same prompt weight, same amount of thinking, same
share of the context budget. This plan segments them **without changing model** — by
asking the easy questions in a cheaper way rather than asking a cheaper model.

---

## 0. Measure before building any of this

Phases 1 and 2 left `[Digest][timing]` on every stage boundary. Before doing any of the
work below, pull one clean run's lines out of the Vercel logs and paste them here.

Everything in this plan is a guess about where the seconds are until that table exists.
The specific thing to look for: **the ratio of the six judge-shaped calls to the four
writing calls.** If the writing calls dominate the wall clock, section 1 is the only
section worth doing and the rest is busywork.

| Stage | Baseline (phase 1) | After phase 2 | Notes |
|---|---|---|---|
| _fill from logs_ | | | |

---

## 1. Thinking budget per task — the real version of "easy vs hard"

**This is the whole plan in one lever.** Modern flash models spend a variable, often
large, amount of latency on internal reasoning before the first output token. On a
question like "score these three papers 1-3 against this rubric" that reasoning is close
to wasted; on "write the synthesis" it is most of the value.

`aiChat` in `src/lib/ai/provider.ts` currently sends every call through one shape:

```ts
const response = await client.chat.completions.create({ model, messages, max_tokens: 4096 });
```

No temperature, no thinking control, no per-task anything.

**The change:** give `aiChat` an options argument carrying an effort level, and set it per
call site.

```ts
export type AIEffort = "minimal" | "normal" | "deep";

export async function aiChat(
  config: AIConfig,
  messages: AIMessage[],
  opts?: { effort?: AIEffort; maxTokens?: number },
): Promise<string>
```

**Before writing the mapping, verify what the live provider actually accepts.** This is
the one genuinely uncertain part of the plan and it must not be guessed:

- Gemini's OpenAI-compatibility endpoint (which is what `getClientConfig` points at) has
  historically accepted `reasoning_effort`, and separately a
  `extra_body.google.thinking_config.thinking_budget` integer. Whether both still work,
  and what values are legal for the deployed model, has to be confirmed against the live
  model with a throwaway request before any of this is wired in.
- Whatever the mechanism, the fallback must be silent: an unsupported parameter should
  degrade to today's behavior, never throw. `readableError` already turns a 400 into a
  readable message, which would be a very annoying way to take down digest generation over
  a tuning knob.

**Proposed mapping** (see the table in section 5 for the full call inventory):

- `minimal` — the cold reads, the Step 4b re-rank, the foundational gate, Stage A
  metadata, the gist. All of these return short structured JSON against an explicit
  rubric, and all of them already treat an absent or malformed answer as non-blocking.
- `normal` — the Step 1 hypothesis, the Step 5 headline pass and its repair, the Stage D
  critique, the final repair.
- `deep` — the wide-pool selection, the Stage B skeleton, the Stage C draft, the Stage D
  revision. The four calls where the product's actual quality is decided.

**Expected shape of the win:** this is the only item here that could plausibly halve the
judge calls' latency, because it removes work rather than moving it. It is also the only
item that can *hurt quality*, which is why the `deep` tier exists and why section 6's
rollout is one tier at a time.

---

## 2. Per-task output ceilings

Every call asks for `max_tokens: 4096`. The gist is capped at 25 words by its own prompt.
The re-rank returns three short objects. A cold read returns a handful of one-line fields.

A ceiling is not a target, so this is not automatically a latency win, and on most
providers an unused ceiling costs nothing. It is worth doing anyway for two smaller
reasons:

- It is a **correctness rail**. A judge call that starts rambling today can burn 4096
  tokens of latency before we throw its output away. A 300-token ceiling fails it fast.
- It documents intent at the call site, which is most of what makes the rest of this plan
  legible later.

Fold it into the same `opts` argument as section 1 so there is one change to `aiChat`, not
two.

---

## 3. Input dieting — send each call only what it needs

Latency scales with input as well as output, and several calls are carrying context they
demonstrably do not use. Current sizes, from the code:

| Call | Per-paper abstract budget | Is it justified? |
|---|---|---|
| Cold read | none (headlines only) | Already minimal. This is the model to copy. |
| Step 4b re-rank | 250 chars | Fine. |
| Foundational gate | 300 chars | Fine. |
| Selection (`selectionSkeletonPrompt`) | 1200 chars | Probably justified — real quality call. |
| Skeleton / draft | 1500 chars | Justified. |
| Step 5 headline | 900 chars | Justified — it must find the thread from evidence. |
| **Stage A metadata** | **2000 chars** (`formatPapers` default) | **Question this one.** |
| **Any news item, anywhere** | **6000 chars** (the `rss` branch in `formatPapers`) | **Question this one.** |

Two specific things to look at:

- **Stage A takes the largest per-paper budget in the pipeline** and is an extraction
  task. It plausibly needs the most text of anything. But it is also the biggest single
  input in the run, so if the timing table shows it as a slow stage, this is the first
  knob.
- **`formatPapers` gives any `source: "rss"` item 6000 characters regardless of the
  caller's `maxChars`.** That is deliberate — a news article has no abstract, so the
  fetched body text is all there is. But it means one news item can be 4× the size of
  every paper in the same prompt, in *every* prompt, including calls that only need to
  know roughly what the article says. Worth checking whether the smaller-budget callers
  should cap it.

Do not cut anything here on instinct. Each cut is a quality risk and should be justified
by a slow stage in the timing table.

---

## 4. Batch more of the easy questions

Phase 2 already did this once: Step 1 went from up to four serial theme-repair calls to
one batched cold read over three candidates, and `coldRead()` has always taken an array.

Remaining candidates for the same treatment, in rough order of appeal:

- **The Step 4b re-rank and the foundational gate** both run over the same item set,
  within a second or two of each other, and both return small structured verdicts. They
  ask different questions, but a single "judge this shortlist" call returning both
  verdicts is not obviously worse, and it removes a round-trip from the critical path.
  The catch: Step 4b's result can *change* the item set (it swaps and drops papers), and
  the foundational lane reads that set. Merging them means the gate judges a pre-swap
  shortlist. That may be fine — the lane is additive and its own bars are unchanged — but
  it is a real behavior change, not a free one.
- **The Step 5 repair's cold re-read** is a single-headline call that fires only after a
  repair. Hard to batch (it is inherently sequential), but worth noting it is the cheapest
  call in the pipeline and probably not worth optimizing.

---

## 5. Call inventory

Kept here so the tiers in section 1 have something concrete to attach to. "Writes prose"
means a reader sees the output; "judges" means structured JSON consumed by code.

| Call | Kind | Fallback if it fails | Proposed effort |
|---|---|---|---|
| Step 1 hypothesis (3 candidates) | writes | falls back to bare topic name | normal |
| Step 1 cold read | judges | deterministic checks stay in charge | minimal |
| Step 1 re-angle | writes | keeps the least-broken candidate | normal |
| Theme retry (too few papers) | writes | keeps current theme | normal |
| Wide-pool selection | judges, but it is *the* quality call | top-N by score | **deep** |
| Step 4b re-rank | judges | keeps embedding order | minimal |
| Foundational tier-2 naming | writes (needs real knowledge) | lane returns null | normal |
| Foundational gate | judges | null, the expected outcome | minimal |
| Step 5 headline pass | writes | keeps working theme | normal |
| Step 5 headline cold read | judges | deterministic checks only | minimal |
| Step 5 repair + its cold read | writes / judges | keeps unrepaired headline | normal / minimal |
| Stage A metadata | extracts | empty defaults + abstract-lead summaries | minimal |
| Stage B skeleton | plans the argument | simple role fallback | **deep** |
| Stage C draft | writes the product | none — this is the digest | **deep** |
| Stage D critique + fact check | judges | keeps draft | normal |
| Stage D revision | writes the product | keeps draft | **deep** |
| Final repair | writes the product | keeps synthesis as-is | normal |
| Gist | writes, but 25 words from a finished synthesis | ships without a gist | minimal |

---

## 6. Rollout

One tier at a time, because unlike phases 1 and 2 this **can** change output quality:

1. Land the `aiChat` options plumbing with every call site on today's behavior. Provably a
   no-op, same as `judgeConfigFrom` was.
2. Move the six `minimal` calls only. Compare timings and check the four things that
   phase 2 verification already checks: headline quality, `[Source N]` coverage, bullet
   structure, foundational card. If a judge call degrades, its own fallback fires and the
   logs say so.
3. Only then consider `deep`, and treat it as a **quality** experiment rather than a speed
   one. It will make those calls slower.

An env var per tier (or one `AI_EFFORT_PROFILE=off|judges|full`) keeps every step a Vercel
toggle rather than a deploy, and keeps the rollback instant. Same pattern as
`AI_MODEL_DIGEST_JUDGE`.

---

## 7. The inverse question, which may matter more

Everything above assumes flash-for-everything is the right default and the job is to stop
wasting it on easy work. The opposite framing is worth a separate look:

**Four calls decide whether the product is good** — wide-pool selection, the Stage B
skeleton, the Stage C draft, and the Stage D revision. Those are exactly the calls
CLAUDE.md protects by name ("the LLM in `selectionSkeletonPrompt` makes the real quality
call"), and they are currently answered by a model chosen for speed.

The per-task override infrastructure for this **already exists** and needs no new code:
`AI_MODEL_DIGEST` in `aiConfigFor()`. What does not exist is a way to raise *only those
four calls* — `judgeConfigFrom` was built to push a subset down, and the mirror of it
would push a subset up.

That is a cost and quality question, not a latency one, and it is worth deciding
deliberately rather than inheriting. CLAUDE.md's own principle is "use the best method,
not the fastest to implement." A digest that generates in 60 seconds and reads like a book
report is not the goal.

**Suggested experiment**, cheap to run: generate the same day's digest twice, once as-is
and once with the four quality calls on a stronger model, and read them side by side. If
the difference is invisible, flash is genuinely the right call everywhere and this section
closes for good. If it is not invisible, the speed work in phases 1 and 2 is what bought
the room to pay for it.
