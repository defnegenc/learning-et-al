# New-user experience: explain the product, land the first digest

*Planned 2026-08-19. Status: awaiting Defne's review — not yet implemented.*

## The problem

A first-time visitor gets no explanation of what Learning et al. is, at any
point in the funnel:

1. **Logged out** — they land directly on the admin's digest. It's a nice
   digest, but nothing says "this was generated from someone's interests, and
   you can have your own." The only CTA is a bare "Sign in" button in the
   header. The value prop is entirely implicit.
2. **Onboarding** — the interest step says "What are you curious about? / Pick
   at least 3 topics. We'll find papers and news that connect them." That's the
   only premise delivery in the whole flow. Nothing about the daily cadence,
   the vault, or saving papers.
3. **The CTA doesn't promise a digest** — the button says "Start exploring,"
   and digest generation fires silently in the background
   (`page.tsx onComplete`). The user is never told a digest is being made
   *for them, right now*.
4. **Post-onboarding landing is generic** — they arrive at "Today's digest is
   brewing / Check back soon. A fresh research digest is generated every day."
   plus a **"Generate today's digest" button that double-fires** the generation
   already running in the background. Nothing says "your first digest, from the
   topics you just picked, ~1–2 minutes."

## Proposed changes

### A. Logged out: a "What is this?" explainer popup

**Trigger.** A quiet text affordance next to the "Daily digest" eyebrow on the
logged-out today page (and/or beside Sign in in the header): body-face,
ink-underlined, reading **"What is Learning et al.?"**. Not a mono Label — it
names the thing, not the machinery.

**The popup.** Reuse the one dialog primitive (`ui/dialog.tsx`, as
settings-dialog does), framed as the standard Card object: 2px ink border,
`5px 5px 0` shadow, no radius, ~480px, full-width sheet below `md`. No new
hexes, sizes, or borders — everything comes from the menu.

**Content — three beats, each showing the real UI object as itself:**

1. **"Pick your interests."**
   Rendered as 3 actual `TopicChip`s in their *selected* state — real fields,
   real spectrum slots, solid ink border — e.g. `sleep science` (Medicine 00),
   `quantum computing` (CS 06), `behavioral economics` (Business 02). This is
   the "make it look like the interest tag in a selected one" ask: the chips in
   the popup are literally the shipping component, so what you see in the
   explainer is exactly what you'll touch in onboarding.

2. **"Get one idea every morning."**
   Copy (draft): *"Each day we find real papers that connect your interests
   and write a short argument around one question — a curious friend explaining
   something over coffee, not an abstract dump."*

3. **"Save what hooks you."**
   Copy (draft): *"Papers you save go to your vault and get a reading
   companion — a walkthrough, questions to ask it, and what's happened since —
   so you can dig deeper later."*

Close with: *"The digest behind this window is a live example."* and a primary
**Sign in to get yours** ActionButton.

**Auto-open?** Default: no. A modal that opens itself on first paint is the
opposite of the product's calm. The trigger sits right above the digest title
where a confused visitor's eye already is. (Open question 1 below if Defne
wants a once-per-visitor auto-open via localStorage.)

**Design-system note.** This is a new composed surface → per CLAUDE.md it gets
sketched on the Paper board ("Design system — the short menu" / "Shipping the
menu") before code. It introduces no new tokens, so the board work is
composition only. One rule to respect: the three chips are *interest tags
doing their real job*, not a swatch row — they carry words, so they don't
violate the "never a swatch" ban.

### B. Onboarding: deliver the value prop + promise the digest

- **Header subtitle** (step 2) becomes the premise in one line:
  *"Pick at least 3 topics. Every morning we'll connect a few of them into a
  short digest — and you can save any paper to dig deeper later."*
- **CTA text**: "Start exploring" → **"Create my first digest"** once ≥3
  topics are picked (the `Pick N more topics` disabled states stay as-is).
  This is the explicit prompt-to-create that's currently missing.
- Optionally, the same three-beat explainer content is reachable from
  onboarding via a small "What happens next?" text link in the footer — same
  popup component, zero new surface.

### C. First-digest brewing state (post-onboarding landing)

Make TodayPage's no-digest state first-run aware — and make the ~90-second
wait a small show, not a sentence.

**The dancing loader.** The stamp (`PageLoader`) is the one page-level loader;
today its shadow walks spectrum slots 0/3/6/9 in place. The first-run variant
lets it *travel*: the stamp steps across the column while its offset shadow
walks the full spectrum **in hue order, 0 → 9** — slot by slot, one hop per
step, `steps()` easing (mechanical, per the motion rules), looping. This is
exactly the "make it go 1, 2, 3, 4… dance across the screen with its colors"
ask, expressed in the menu's one sanctioned colour-beside-ink move: colour
falls *behind* the white ink-bordered object, never fills a bar. Sits directly
above the headline **"Your first digest is brewing."**

Constraints honoured: it's an *indeterminate* loop, not a progress bar — "no
fake progress" is binding, and we genuinely don't know the pipeline's
percent-done. One indicator per wait; it doesn't move between phases (when the
digest lands, the whole state is replaced, the loader doesn't morph). Honours
`prefers-reduced-motion` (falls back to the static stamp). New motion → Paper
board first.

**Feature tips while it brews.** Beneath the loader, one tip at a time —
mono `Label` eyebrow ("While it brews") over a Body-face line — rotating every
~7s with the standard `briefRise` entrance. Draft tip list (the things a new
user has no way to know):

1. *Save a paper and we start preparing its reading companion in the
   background — a plain-language walkthrough waiting in your vault.*
2. *Every paper in your vault can take questions — "Ask this paper" answers
   from the paper itself.*
3. *Dotted-underlined words in a digest are jargon — hover for a plain
   definition.*
4. *Paper names in the synthesis are clickable — they open that paper's card.*
5. *Don't like a digest? The regenerate button at the end takes a reason and
   tries again.*
6. *Digests can land in your inbox — daily, twice a week, or weekly, set in
   settings.*
7. *A gold-framed card is a foundational paper — an older classic the day's
   question stands on.*

**Tips are a maintained surface.** The list lives in one exported const
(`src/components/first-run-tips.ts`) with a header comment naming the rule,
and CLAUDE.md's Context Maintenance Rules gains a line: **"When a user-facing
feature majorly changes (added, removed, renamed), update the first-run tips
in `first-run-tips.ts`."** That makes the instruction durable for future
sessions, per Defne's ask.

**Everything else as before:**

- **Copy**: "Your first digest is brewing" / *"We're reading papers across
  your topics right now — it usually takes a minute or two. This page will
  update itself."* (Polling already exists: every 10s for 4 min.)
- **Hide the manual Generate button during the first-run wait** — generation
  is already in flight from `onComplete`; the button as-is invites a
  double-fire. It reappears only if polling times out (the 4-min deadline), as
  the recovery path, with copy "Try again."
- **Plumbing**: `page.tsx` knows the user just completed onboarding — pass a
  `justOnboarded` flag through the local session, cleared once a digest
  arrives, down to `TodayPage`. No API change needed.
- **When the digest lands, it shows immediately** — tips loop passively, so
  nothing blocks the reveal.

**Considered and dropped: per-interest expertise prompts during the wait.**
The idea — for each picked field, ask "how well do you know Computer
Science?" with the answer chips wearing that field's own spectrum slot and the
TopicChip shape — is charming, but it created a blocking mini-survey with a
race against generation (digest ready before the user finishes → hold the
reveal, handle abandonment, handle finishing early…), and its answers can't
inform the digest already generating anyway. Deferred, not killed: interests
already carry a `level` field (hardcoded `"beginner"` at setup), and expertise
would genuinely inform the *reading companion's* tone later. If revived, it
belongs in settings or the reading view as its own feature, not in this wait.

### D. Copy summary (all draft, Defne to tune the voice)

| Where | Copy |
|---|---|
| Explainer trigger | What is Learning et al.? |
| Beat 1 | **Pick your interests.** [3 selected TopicChips] |
| Beat 2 | **Get one idea every morning.** Each day we find real papers that connect your interests and write a short argument around one question. |
| Beat 3 | **Save what hooks you.** Saved papers get a reading companion so you can dig deeper later. |
| Explainer close | The digest behind this window is a live example. → *Sign in to get yours* |
| Onboarding subtitle | Pick at least 3 topics. Every morning we'll connect a few of them into a short digest. |
| Onboarding CTA | Create my first digest |
| First-run wait | Your first digest is brewing — a minute or two. This page updates itself. |
| Tips eyebrow | While it brews |
| Tips | See the numbered list in §C — single source of truth is `first-run-tips.ts` |

## Files touched

| File | Change |
|---|---|
| `src/components/what-is-this.tsx` *(new)* | Explainer popup + the three-beat content block |
| `src/components/first-run-tips.ts` *(new)* | The tip list — one exported const, with the update-on-feature-change rule in its header comment |
| `src/components/design-system.tsx` | First-run travelling variant of `PageLoader` (the stamp walking the column, shadow stepping spectrum 0→9) |
| `src/components/today/today-page.tsx` | Trigger next to "Daily digest" eyebrow (logged-out only); first-run brewing state (dancing loader + tips carousel, Generate button hidden until poll timeout) |
| `src/components/onboarding.tsx` | Subtitle copy; CTA "Create my first digest"; optional "What happens next?" link |
| `src/app/page.tsx` | `justOnboarded` flag through session |
| `CLAUDE.md` | Context Maintenance Rules: keep `first-run-tips.ts` current when features majorly change |
| Paper board | Sketch the popup composition + the travelling-stamp motion first |
| `docs/design-decisions.md`, `docs/component-inventory.md`, `docs/changelog.md` | After shipping |

## Parallel implementation split — 3 agents

Partitioned by file ownership so branches merge clean. **No agent depends on
another agent's code** — each workstream compiles and ships on its own. The
only shared file is `today-page.tsx`, touched by Agents 2 and 3 in disjoint
regions (details under "Merge notes").

Every agent, before writing code: read this plan top to bottom, read
`docs/design-style.md` (and the Paper board if reachable — Paper wins), and
follow the two absolutes: **no invented hexes/type sizes/borders/shadows**,
and reuse existing design-system components.

### Agent 1 — Onboarding promise

**Owns:** `src/components/onboarding.tsx`. Nothing else.

- Step-2 subtitle → the premise line: *"Pick at least 3 topics. Every morning
  we'll connect a few of them into a short digest — and you can save any paper
  to dig deeper later."*
- CTA when ≥3 topics picked: "Start exploring" → **"Create my first digest"**.
  The `Pick N more topics` disabled states stay exactly as they are.
- Do **not** add the "What happens next?" link (it would depend on Agent 2's
  component — deferred to a follow-up after both merge).
- Docs: one line in `docs/changelog.md` under 2026-08-19.

### Agent 2 — Logged-out explainer popup

**Owns:** `src/components/what-is-this.tsx` (new) and the trigger wiring in
`src/components/today/today-page.tsx` (the "Daily digest" eyebrow row region
only, logged-out only — do not touch the `!digest` early-return block or
`page.tsx`).

- Build the popup per §A: reuse `ui/dialog.tsx` (as settings-dialog does),
  Card frame (2px ink, `5px 5px 0`, no radius), ~480px / full-width sheet
  below `md`.
- Three beats with real components: 3 selected `TopicChip`s (real fields →
  real spectrum slots via `FIELD_HIERARCHY`), then beats 2–3 in Body face.
  Close: *"The digest behind this window is a live example."* + primary
  **Sign in to get yours** (`signIn("google")` comes in as a prop from
  today-page, which already has `onSignIn`).
- Trigger: body-face ink-underlined text "What is Learning et al.?", rendered
  only when `!session`, next to the "Daily digest" line. Click-only, no
  auto-open.
- Docs: `docs/component-inventory.md` entry + changelog line.

### Agent 3 — First-digest brewing state

**Owns:** `src/components/first-run-tips.ts` (new),
`src/components/design-system.tsx` (loader variant only),
`src/app/page.tsx`, the `!digest` early-return block in
`src/components/today/today-page.tsx`, and the CLAUDE.md rule.

- Travelling-stamp loader per §C: stamp walks the column, shadow steps
  spectrum 0→9 in hue order, `steps()` easing, loops, honours
  `prefers-reduced-motion` (falls back to the static stamp). Add as a variant/
  prop of `PageLoader`, not a second loader component.
- `first-run-tips.ts`: the 7 tips from §C as one exported const, header
  comment carrying the keep-current rule.
- Tips carousel under the loader: `Label` eyebrow "While it brews", one Body
  tip at a time, ~7s rotation, `briefRise` entrance.
- `page.tsx`: `justOnboarded` flag through the local session on
  `onComplete`, cleared when a digest arrives; passed to `TodayPage`.
- First-run no-digest state: new headline/copy per the copy table, Generate
  button hidden until the 4-min poll deadline passes, then "Try again."
  Non-first-run no-digest state keeps today's behaviour.
- CLAUDE.md: add to Context Maintenance Rules — *"When a user-facing feature
  majorly changes, update the first-run tips in
  `src/components/first-run-tips.ts`."*
- Docs: `docs/design-decisions.md` (loader + tips decisions) + changelog line.

### Merge notes

- Agents 1 and 2: fully disjoint from everything. Merge in any order.
- Agents 2 and 3 both edit `today-page.tsx`, in regions ~70 lines apart
  (eyebrow row vs. the `!digest` block) plus possibly the same import lines.
  Merge Agent 3 first (bigger diff), then Agent 2 — worst case is a one-line
  import conflict, resolved by keeping both.
- All three add a `docs/changelog.md` line under the same date — same trivial
  keep-both resolution.
- Follow-ups after all three merge (any single agent or by hand): the optional
  "What happens next?" link in onboarding reusing Agent 2's popup; syncing
  `docs/design-style.md` §5 with the loader variant.

## Open questions for Defne

1. **Auto-open** the explainer once for brand-new logged-out visitors
   (localStorage flag), or click-only? Plan defaults to click-only.
2. **Trigger placement**: above the digest title (planned), in the header next
   to Sign in, or both?
3. **CTA wording**: "Create my first digest" vs "Make my first digest" vs
   keeping "Start exploring" with a sub-line under the button.
4. Should the explainer also be reachable when logged in (e.g. from settings),
   or is it a logged-out-only surface?
