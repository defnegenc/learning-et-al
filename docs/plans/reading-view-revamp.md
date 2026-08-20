# Reading view revamp, save NUX, and the librarian agent — plan

*Drafted 2026-08-19. Planning only — nothing here is built yet. Companion docs:
`docs/design-style.md` (the menu), `docs/algorithm.md` (pipeline),
`docs/design-decisions.md` (log decisions there once we commit).*

This covers four things:

1. **Save NUX** — teach a zero-saves user what saving does, before and after the act.
2. **Reading view revamp** — unbury it, add a tip, and add highlight-to-explain.
3. **Familiarity interleave** — one Likert question, asked at the explain moment.
4. **The librarian agent** — how taste gets defined, stored, and used; harness + model routing.

---

## 0 · Current state (what the code actually does)

Facts the plan is built on, with pointers:

- **Save is an unlabeled icon with three names.** The only save control is
  `BookmarkToggle` (`src/components/paper-card.tsx:40`) — a 16px lucide bookmark,
  icon-only except on foundational cards. The native tooltip says *"Save to your
  reading list"*, the foundational label says *"Save for later"*, and the vault
  empty state says *"Hit "Read later""* (`vault-page.tsx:66`). Three names, one action,
  none visible on the digest cards a logged-in user actually sees. This is the
  "I'm in production and I don't see save for later" bug — it exists, it's just mute.
- **Saving already triggers the agent.** On save, the card fires
  `POST /api/papers/[id]/companion` (walkthrough) and `/homework` (citing works),
  fire-and-forget, with **zero UI feedback** (`paper-card.tsx:53-81`). The most
  agentic thing in the product is completely invisible.
- **A save is a `feedback` row with `type:"star"`** (`schema.ts:155`). Saved count is
  derivable client-side for free: `bookmarkedIds.size` already lives in
  `today-page.tsx:282`.
- **The reading view is two clicks deep.** `ReadingPaperDetail`
  (`src/components/vault/reading-paper-detail.tsx`) is a full-screen portal overlay,
  reached via app-shell "vault" tab → "Saved papers" tab (vault **defaults to the
  Digests tab**, `vault-page.tsx:17`). Section order: gist → three beats →
  "Remember this" → glossary (collapsed) → "What's happened since"; **Ask this
  paper** lives in a sticky right rail that is *empty while the companion
  generates* and drops below everything on mobile.
- **Ask is a one-shot ledger, not a chat.** Each question is a single `aiComplete`
  call with no conversation history (`qa/route.ts:95`), persisted to `qaPairs`.
  Every 3rd question boosts interest keywords (+0.3, creates `source:"engagement"`).
- **There is no text-selection interaction anywhere** in the codebase, and
  "dig deeper" only survives in the legacy `?classic=1` digest view
  (`synthesis-banner.tsx`, gated off in the default `BriefDigest`). Its API,
  `/api/digest/chat`, persists nothing but an analytics event.
- **Taste is one scalar.** The pipeline reads *only* `interests.weight`
  (`digest.ts:457`). Saves nudge existing weights +0.1; the dislike endpoint has
  **no UI calling it**; `digestFeedback` (regenerate reasons) is **write-only** —
  nothing ever reads it. Saved papers as *documents* never re-enter the pipeline.
- **One AI entry point, no per-task routing.** `aiComplete(config, system, user)`
  (`provider.ts:43`) — non-streaming, single-turn, `max_tokens` 4096. Five routes
  copy-paste the same env-derived config. Insertion point for routing:
  a `aiConfigFor(task)` helper in `provider.ts`.
- **No tip/banner/coachmark pattern exists yet** — we'd establish the first one.
  Reusable bones: localStorage flag pattern (`use-session.ts:18`), `InkTip`,
  `NotepadFloat` (floating dismissible panel), design tokens in `design-system.tsx`.
- **Prototype harness exists**: `/prototype/reading-list` renders the real
  `ReadingPaperDetail` against fixtures — no DB, no model. Build the revamp there first.

---

## 1 · Save NUX (zero saved papers)

**Trigger**: logged in ∧ `bookmarkedIds.size === 0` ∧ not dismissed. Dismissal in
localStorage (`nux_save_tip` via the `use-session` pattern); the tip also
self-retires permanently the moment the first save lands — saving *is* dismissal.

**Core copy** (draft, tune later):

> **Tip:** Save a paper and your librarian starts reading it: a guided
> walkthrough, key terms, and what's been published since, waiting in your
> library.

⚠️ **Two copy rules for everything in this plan (Defne, 2026-08-20):**
1. **No mono eyebrows, no all-caps little labels, anywhere.** Every lead-in
   ("Tip:", "Pitched for you:") is **bolded body face, sentence case**. Where
   earlier drafts of this doc said "mono `TIP` eyebrow," read this instead.
2. **No em dashes in any user-visible text** (see the global copy rule section
   below). Lead-ins end in a colon, not a dash; drafted copy in this doc has
   been rewritten accordingly and new copy must comply.

Short variant for tight surfaces: *"Save a paper — your librarian will prep it
and find related work for you to browse later."*

### Design directions (pick at prototype time)

**A. The strip** *(recommended as the "before" half)*
A full-width band above the digest header: hard border, surface white, a bolded
body-face **"Tip:"** lead-in, one sentence, `×` to dismiss. It's the calmest
option, reads as part of the archive furniture, and doesn't chase the user
around. Nothing new enters the menu — it's `BORDER` + `BODY_STYLE`.

**B. The coachmark**
An `InkTip`-styled ink tooltip anchored to the *first card's actual bookmark
icon* — teaches the control itself, not the concept. Strongest pedagogy, but
fragile: it fights scroll, competes with the foundational eye's tooltip, and
anchored coachmarks are the most annoying NUX pattern when they misfire.
Keep as fallback if the strip doesn't convert.

**C. The confirmation moment** *(recommended as the "after" half)*
On the **first-ever save**, a small fixed panel bottom-right (the `NotepadFloat`
pattern): *"Saved ✓. Your librarian is reading it now: a walkthrough and
related work will be in your library in a minute or two."* with a **"Go to
library →"** link. Acid-green is allowed here as ink (the ✓ and "Saved"), never
as the panel fill. This is the highest-leverage piece: it explains the feature
at the exact moment the user acted, *and* it papers over the currently-invisible
companion/homework background generation.

**Recommendation: A + C.** The strip teaches before, the confirmation teaches
after, and neither needs anchoring. Skip B.

### Do alongside (the actual bug fix — in scope, phase 1)

**One name: "Save." One destination: "your library."** Every string that names
this action, exhaustively (grep `bookmark|reading list|read later|save` before
shipping in case more have appeared):

| Where | Today | Becomes |
|---|---|---|
| `paper-card.tsx:86-87` tooltip/aria | "Save to your reading list" / "Remove from your reading list" | "Save to your library" / "Remove from your library" |
| `paper-card.tsx:265` foundational label | "Save for later" → "Saved for later" | "Save" → "Saved" |
| `vault-page.tsx:66-71` empty state | "Hit "Read later" on any paper…" | "Hit "Save" on any paper in a digest and it lands here." |
| Vault tab label (`vault-page.tsx:55`) | "Saved papers" | keep — consistent with "Saved" |
| NUX strip + confirmation (§1) | — | written with "Save"/"library" from day one |

**And make the control visible**: render the `Save`/`Saved` text label next to
the bookmark icon on digest and compact cards, not just foundational ones —
`BookmarkToggle` already supports `label` (`paper-card.tsx:104`), so this is
passing a prop, plus a Paper-board check that the label sits in Body/SM. An
icon-only bookmark is why the feature reads as missing in production.

---

## 2 · Reading view revamp

### 2a · Are we showing the right things?

Mostly yes — gist → what they did / found / where it's shaky → remember this →
glossary → what's happened since is a genuinely good walkthrough arc. The
problems are hierarchy and dead air, not content:

- **The Ask rail is structurally cursed** — empty while the companion
  generates, below everything on mobile. Resolved by removing it entirely:
  §2c replaces it with a left outline and moves questions into the document.
- **No error surface** — if companion generation fails, sections silently vanish.
  Add a retry row.
- **It's two clicks deep.** Fixes: (1) **give it a real URL** —
  `/library/[paperId]` replaces the portal overlay as the canonical reading
  view *(decided 2026-08-19, in scope for phase 2)*. Everything becomes
  linkable: digest emails ("your walkthrough is ready →"), the NUX confirmation
  panel, shared links. The overlay component becomes the route's page body;
  opening from the vault can still animate as an overlay but pushes the URL
  (Next.js parallel/intercepted route, same pattern as modern photo-modal
  routing) so back-button and refresh both work. (2) Vault defaults to the
  **Saved papers** tab when the user has saves and no unread digest history.
  (3) After saving, the card's bookmark area gains an **"Open →"** affordance
  linking to `/library/[paperId]`.
- **What's missing content-wise**: a one-line *"why you're reading this"* — which
  digest/question surfaced it and which of the user's interests it fed. Cheap
  (we have `digests.seedInterests` + the paper's digest), and it's the seed of
  the librarian's voice.

**Making the walkthrough scannable** *(decided 2026-08-20)*. The did/found/shaky
structure and names stay — the top does **not** become "Summary," and the gist
stays unlabeled (it's the lede). The problem is that the page is four
same-weight paragraphs; fixes:

- **The key-numbers table.** Not a giant display number — a table. New
  companion field `keyStats: [{metric, value, note?}]` (2–4 rows max, only
  numbers that carry the finding; omit the field entirely if the paper isn't
  quantitative — an empty table is worse than none). Rendered between "What
  they did" and "What they found" as hairline rows — metric name in body face
  left, value bold right, optional note in `DIM` — **tinted in the paper's wash**
  (same third-index hue as the card and the explain panels, so the page's color
  says "this is yours/this paper," consistently). Genuinely useful, not
  decorative: it's the row you screenshot.
- **The lede gets weight.** The gist paragraph is set heavier/larger than body,
  and the closing "Remember this" line gets the same bolder treatment — the
  page opens and closes with emphasis. ⚠️ The menu has exactly five type styles
  and none is a lede; this is a Paper-board addition first (e.g. one "Body/Lede"
  style — heavier weight, maybe a step up in size), then `globals.css` +
  `design-system.tsx`, then here.
- **Each beat opens with a bolded first clause** — a prompt contract ("open
  each section with a ≤6-word bolded claim"): *"**They followed 400 nurses for
  a year.** Each was randomly…"*. Bold-within-body, costs nothing.
- **"Where it's shaky" is set in `DIM`** — the one section that's a caution
  reads visually as an aside, lower confidence.
- **No mono eyebrows on any of this** (see §1) — beat headings stay Display/SM
  plain-language, lead-ins are bolded body face.

### 2b · Highlight-to-explain — the core feature

*(Named **"Explain"** — decided 2026-08-20. Earlier drafts said "dig deeper";
that name survives only for the legacy digest-level feature in §0.)*

**Verdict: yes, build it.** It's the right interaction for three reasons:
(1) zero-typing curiosity — the friction of formulating a question is exactly
what stops people from asking; (2) it's *anchored* — the model gets the precise
passage plus surrounding context instead of a vague question, so answers get
better for free; (3) it's the richest taste signal in the product — the exact
sentences a user finds confusing or exciting beat any thumbs-up. Honest risks:
mobile text selection fights the native selection menu (ship desktop-first,
mobile gets a per-paragraph "¶ Explain" affordance instead); and selections
need anchoring to survive re-render (store the quoted text + section key, not
DOM offsets).

**Interaction spec** (prototype in `/prototype/reading-list` first):

1. **The tip.** One line under the byline, first-visit only (same localStorage
   pattern as §1): bolded body-face **"Tip:"** + *"highlight any passage and
   the agent will explain it, or answer a question about it."* Retires after
   the first successful explain.
2. **Select.** User selects text inside gist/beats/remember. The selection
   tints **acid green** — the marker stroke, the one moment of "the agent is
   about to act on exactly this." *(Decided 2026-08-19; this is a menu
   amendment — acid green is currently ink-only. Record in Paper first: acid
   green gains exactly one sanctioned fill use, the live explain selection.
   Probably at reduced alpha over text so ink stays legible. It must not leak
   anywhere else — panels, chips, and washes stay as they are.)* Once the
   explain fires, the green mark collapses; the passage reappears quoted inside
   the wash section below.
3. **The button.** A small floating pair near the selection endpoint, hard
   border + the one shadow: **Explain** · **Ask about this**. "Explain" fires
   immediately with a canned intent; "Ask about this" opens a one-line composer
   anchored to the same selection (there is no rail composer anymore, §2c) —
   the typed question plus the quoted passage produce the same kind of section.
4. **Confirmation.** The button collapses into an inline chip:
   *"Explaining ✓. Keep reading, it'll be waiting below."* Check and text in
   acid-green **ink**. (The section itself is NOT green — green lives only in
   the selection highlight and confirmation ink. The section is the paper's wash.)
5. **The section.** The answer arrives as its **own collapsible section**
   rendered inline directly after the beat the highlight came from (fallback:
   above the glossary). Same +/− toggle idiom as the glossary; **open when
   fresh, collapsed on return visits** so a much-questioned paper stays
   readable. Wash-filled, hard border. Header: the quoted passage (italic,
   truncated when collapsed). Body: the answer + a follow-up composer scoped to
   that thread. Multiple explains stack in reading order.
6. **Persistence.** Extend `qaPairs` with nullable `selection` (quoted text),
   `sectionKey`, and `threadId` — one table keeps typed questions and explains
   unified, and the reading view rehydrates the sections on reopen.

**API**: new `POST /api/papers/[id]/explain` (or a mode on `/qa`): payload
`{selection, sectionKey, question?, threadId?}`; server builds the prompt from
selection + surrounding section + companion + `fullText`, reusing the qa
route's PDF self-heal. Should stream (see §4 model notes).

### 2c · No chat rail — the document is the interface

**Decided 2026-08-20: the Ask rail is gone. There is no chat pane anywhere in
the reading view.** Every exchange becomes part of the document — marginalia,
not conversation. A paper you interrogated last month comes back *richer*:
annotated, questioned, explained. Chat logs are exhaust; an archive annotates
its documents.

- **Everything is a collapsible section.** Explains land anchored after the
  beat they came from (§2b.5). Typed questions land at the **end of the
  document**: one composer under the walkthrough — *"Still curious? Ask."* —
  and each answer appends as its own collapsible section ("You asked: …").
  The companion's three starter questions are rows above that composer;
  clicking one appends the same way. One idiom (+/− toggle, wash fill, hard
  border) for every annotation on the page.
- **The outline lives on the LEFT.** The old right rail becomes a left column:
  the beats, the key-numbers table, each explain (by its quoted passage), each
  question — jump links into the document. It exists the instant the page
  loads (no empty state while the companion generates), shows at a glance how
  much you've worked this paper, and collapses to a disclosure on mobile. Grid
  flips from `minmax(0,1fr) 372px` to roughly `240px minmax(0,1fr)`.
- **Threading is scoped, not global.** Follow-ups live inside their section's
  composer and continue that thread only. The *model* is still conversational:
  teach `aiComplete` (or a sibling `aiChat`) to accept a messages array and
  stream — small, overdue change. Keep answers short by default (the digest
  chat's "3-4 sentences max" trick); the follow-up composer is where depth
  happens.
- **The honest trade-off**, accepted: free-form multi-turn exploration ("help
  me brainstorm applications") fits a chat pane better than marginalia. It's
  rare enough here to live inside a section's follow-up thread.

---

## 3 · Familiarity interleave (the Likert moment)

When the user asks for an explain (§2b step 4), the confirmation chip is a
natural pause — the agent is "off working." Use it, at most once, to ask:

> *While I work on that: how familiar are you with **social computing**?*
> `new to it · 1 2 3 4 5 · I work on this`
> *This helps me pitch future reading companions.* — with a visible **skip**.

**Where the subtopic comes from**: the paper's OpenAlex topic/subfield (the
pipeline already persists `digests.seedTopic` `{id, name, subfield, subfieldId}`;
papers carry OpenAlex ids — resolve per-paper topic at companion-generation time
and cache it on the companion). Fallback: the matched interest keyword.

**Storage**: new `familiarity` table `{userId, topicId, topicName, level 1–5,
source: "interleave", createdAt}`. Deliberately *not* the existing
`interests.level` — that's a 3-value enum set once at onboarding and never read;
familiarity is per-subtopic, 5-point, and time-stamped (re-ask after ~6 months).

**Rules so it never gets annoying**: never re-ask a subtopic; at most one ask
per day across the whole product; always skippable; answering is optimistic
(no spinner). **Consumption**: companion + explain + question prompts get a
`familiarity` line ("user rates themselves 2/5 on social computing — define
terms, use analogies" / "4/5 — skip the basics, go to method details"). Later,
the digest `focusLevel` can derive from the familiarity map instead of one
global setting — synthesis-side only, per the focusLevel gotcha.

### Wiring familiarity into what actually gets defined

Answering the direct question — *does familiarity change how many terms get
defined and which ones?* Today, **no**: the companion prompt generates one
fixed glossary per paper, `annotateText` chips every glossary term it finds,
and nothing about the user conditions it. The plan makes it adapt, without
regenerating cached companions:

- **Generate a tiered superset, filter at render.** The companion prompt asks
  for a *generous* glossary where every term carries a tier:
  `basic` (anyone outside the field needs it), `working` (practitioners know
  it), `deep` (specialists only). Stored once on `papers.companion` as today,
  just with a `tier` field per term.
- **Render-time filter by familiarity level** for the paper's subtopic:
  1–2/5 → chip all three tiers; 3/5 → `working` + `deep`; 4–5/5 → `deep` only.
  Because filtering happens at render, **changing your level via the disclosure
  line re-tunes the glossary instantly** — no regeneration, no cache
  invalidation, works retroactively on every already-saved paper.
- **Prose depth adapts at generation time.** Gist/beats tone and explain
  answer depth are baked in when generated, so those consume the familiarity
  level in the prompt (§ above). Companions generated *before* a level existed
  keep their prose but still get the adaptive glossary; regeneration only on
  explicit user request ("re-pitch this for me" — later, optional).
- **Definition style can adapt cheaply too**: the tooltip definition text is
  part of the glossary entry, so low familiarity can also mean *longer,
  analogy-first definitions* — ask the prompt for a one-line definition plus an
  optional `analogy` field, show the analogy only at levels 1–2.

### The visible-use contract (hard requirement, not a nice-to-have)

Whenever a stored familiarity level shapes an output, the agent **must say so,
in one line, every time that subtopic comes up again**. Not silently adapt —
disclose:

> *Pitched for you: you rated yourself 2/5 on social computing, so I'm defining
> terms as I go.*
> *Pitched for you: you're 4/5 on social computing, so I'm skipping the basics
> and going straight to the method.*

Spec:

- **Placement**: one line at the top of any companion, explain section, or
  answer whose prompt consumed a familiarity level. Bolded body-face
  **"Pitched for you:"** lead-in, sentence case — **no mono, no all-caps**
  (§1 rule) — naming the subtopic, the level, and the consequence.
- **Enforcement**: this is a prompt contract like the `[Source N]` rule — the
  generating prompt requires the line in a fixed format, and the route strips it
  out of the body and renders it as structured UI (so revision/critique steps
  can't eat it). If the level wasn't used, the line must not appear.
- **The line is also the correction affordance.** Tapping it opens the same
  Likert row pre-filled at the stored value: *"Not right anymore? Adjust."*
  Updating re-stamps `familiarity.createdAt` and takes effect on the next
  generation. This is the entire "settings UI" for familiarity — no separate
  page needed.

**What if the user doesn't like the adapted output?** Resolved: that's fine,
and the design must keep two things separate —

- **Familiarity ≠ interest.** A 2/5 on social computing must never lower how
  often social computing is *selected*. Familiarity is consumed **only at
  presentation time** (companion tone, jargon density, explain depth), never
  by the pipeline's selection/scoring chain. Disliking how a topic was explained
  doesn't mean the user stopped loving the topic.
- **Familiarity is self-reported and correctable, not inferred and sticky.**
  If the user dislikes the pitch, the remedy is one tap on the disclosure line
  to change the level — not a hidden model update. The agent never silently
  revises a user's self-rating based on behavior; at most it may *re-ask* after
  ~6 months or heavy engagement ("you've read 6 papers on this since — still
  2/5?"), through the Interleaver's normal budget.

---

## 4 · The librarian agent

Framing: **the digest finder stays a pipeline** (it's deterministic, tuned, and
the algorithm doc says don't deviate). The librarian is a *separate, per-user,
event-driven agent* that owns everything after a paper enters the user's orbit:
prepping saved papers, answering explains, maintaining taste, and deciding what
question to ask the user next. The pipeline consumes the librarian's outputs at
exactly two sanctioned points (below) — it does not get new scoring signals,
per the "upstream scoring is a filter" gotcha.

### 4a · Defining taste

Taste = four signal classes, kept as a ledger (most already exist as rows):

| Class | Signal | Status |
|---|---|---|
| **Exemplars** | saved papers (positive) vs. shown-but-never-saved papers (soft negative — we store every shown paper for dedup already) | data exists, unused as documents |
| **Engagement** | questions asked (`qaPairs`), highlighted passages + explain topics (new, §2b), legacy dig_deeper events | partly exists |
| **Stated** | interests + weights, familiarity map (§3), focus level | exists / new |
| **Negative** | regenerate reasons (`digestFeedback` — currently write-only!), dislikes (endpoint has **no UI**; either add a UI or drop the endpoint) | rotting |

**Representation — two layers, used in different places:**

1. **A taste dossier** — a maintained natural-language document (~300 words)
   the librarian rewrites weekly from the ledger: what they save vs. skip, what
   they highlight, familiarity map, what they complained about in regenerate
   reasons. Cheap, inspectable (could even be shown in settings — "what your
   librarian thinks you like" is a delightful, trust-building surface), and
   LLM-native. **Fed into the `selectionSkeletonPrompt`** — the LLM selection
   step, which CLAUDE.md says is where the real quality call happens. Also fed
   to companion/synthesis for tone.
2. **Embedding centroids of saved papers** (we already embed everything with
   MiniLM) — one centroid per field cluster, not one global (a person who saves
   both HCI and metabolism papers isn't the midpoint). Used **only as a soft
   MMR/rerank prior** in candidate pooling — a nudge inside the existing
   filter, never a new heavy scoring signal.

The feedback loop the user described — "papers they save vs. don't, plus their
questions" — is exactly these two, and both consume data we already have.

### 4b · Harness: sub-agents and triggers

Event-driven jobs, not a resident process. Vercel-friendly: each is a route +
queue (or the existing cron), state in the DB.

| Sub-agent | Trigger | Does | Exists today? |
|---|---|---|---|
| **Companion writer** | on save | walkthrough, glossary, remember-this — now conditioned on dossier + familiarity | ✅ `/companion` (personalize it) |
| **Scout** | on save | today: citing works (`/homework`). Upgrade: a 3-item "shelf" — one citing, one contrasting, one foundational, each with a one-line *why for you* | ◑ |
| **Answerer** | on explain/ask | threaded answers with selection context (§2b/2c) | ◑ `/qa` (make threaded) |
| **Dossier keeper** | weekly cron + after every ~5 signals | rewrites the taste dossier from the ledger; recomputes centroids | ✖ new |
| **Interleaver** | after an explain | picks *whether and what* one question to ask (familiarity first; later: "you saved 3 papers on X — want it as a standing interest?") — owns the annoyance budget | ✖ new (§3 is its v1) |

### 4c · Model routing

Add `aiConfigFor(task)` in `provider.ts` (replaces the five copy-pasted config
blocks — do this refactor regardless). Route by shape of work, not brand
loyalty; env-overridable per task (`AI_MODEL_QA=…`) so we can A/B harnesses:

- **Fast tier** (Gemini Flash-class / Claude Haiku-class): metadata extraction,
  glossary, homework annotation, dossier rewrites, interleaver decisions,
  embedding-adjacent chores. High volume, low stakes, latency-sensitive.
- **Deep tier** (Gemini Pro-class / Claude Sonnet/Opus-class): synthesis stages,
  companion walkthrough, explain answers. These are the product's voice —
  don't cheap out on them.
- **Explain specifically wants streaming** — the "keep reading, it'll be
  below" promise works best if the section fills in as you arrive at it.
  `aiComplete` is non-streaming; the `aiChat` addition (§2c) should stream.
- Digest generation moving to Gemini Flash is being handled in a separate
  workstream — this plan only needs the routing seam to exist so that swap is
  one env var, not a code change.

### 4d · The familiarity caution, stated plainly

Good idea, right moment, **one caution that is a build requirement, not a
footnote**: interleaved questions burn trust fast if they feel like a survey —
i.e. if the user answers and nothing visibly changes. So the deal the product
makes is explicit: *you tell me your level once, and every time this subtopic
comes back I'll show you that I remembered and tell you what I did about it.*
That's the visible-use contract in §3 — the disclosure line is mandatory
whenever the level is consumed, and it doubles as the correction control.
The Interleaver enforces the other half (≤1 question/day, never repeat, always
skippable). A signal the user can see being used is a signal they'll keep
giving; a signal that disappears into a black box is the last one they'll give.

And the failure case is already handled by the separation of concerns: if the
user dislikes the adapted explanation, their *interest* in the topic and its
selection weight are untouched — they just tap the disclosure line and reset
their level. Nothing about what the librarian *finds* for them changes; only
how it *talks* to them.

---

## Global copy rule: no em dashes

*(Defne, 2026-08-20. Project-wide, not just the reading view. Also recorded in
`CLAUDE.md` so every agent inherits it.)*

The em dash (`—`) never appears in **user-visible text**: UI strings, AI-generated
content, digest emails, OG images. Rewrite with a period, comma, colon, or
parentheses. En dashes in numeric ranges (2019–2024) are fine; this rule is
about the em dash as a rhetorical connector. Code comments and internal docs
are out of scope (they're not user-visible).

Three layers, all small:

1. **Sweep the static strings.** ~490 raw `—` matches in `src/` (many are
   comments; the user-facing subset is UI string literals plus `src/lib/email.ts`
   and `src/app/opengraph-image.tsx`). One pass, rewrite each. The NUX/reading
   copy in this plan is already em-dash-free.
2. **Stop the model from producing them.** LLMs adore em dashes, so two guards:
   (a) add "Never use em dashes; use a period, comma, or colon instead" to every
   prompt builder in `src/lib/ai/prompts.ts` plus the inlined `COMPANION_SYSTEM`
   and the qa/chat prompts; (b) the guarantee: a sanitizer at the single choke
   point, `aiComplete`'s return in `provider.ts`, that normalizes any surviving
   em dash (` — ` and `—` become `, `; leading/trailing cases become a period or
   nothing). Prompt reduces weirdness, sanitizer makes it a hard invariant, and
   it covers every current and future route for free. Safe on JSON outputs
   (replacement happens inside string content).
3. **Keep them out.** An ESLint `no-restricted-syntax` rule flagging `—` in
   string literals and JSX text (comments exempt), so new copy can't reintroduce
   them.

## 5 · Sequencing

1. **Phase 1 — name the thing** (small): unify "Save" naming (string table in
   §1), visible label on the digest-card bookmark, NUX strip (§1A) +
   first-save confirmation (§1C). Paper board first for the label + strip.
   **Parallel to phase 1, its own branch: the em-dash rule** (sweep + prompt
   guard + sanitizer + lint) — it touches many files shallowly, so land it
   separately to keep merge conflicts away from the feature branches.
2. **Phase 2 — the reading view** (the meat): `/library/[paperId]` route
   (overlay becomes the page; intercepted route for in-app opens); left outline
   column, chat rail removed; green highlight (Paper amendment first) →
   Explain → collapsible wash sections with scoped threads; end-of-document
   composer + starter-question rows; key-numbers table + lede/closing type
   (Paper first); reading tip; `aiChat` with history + streaming; `qaPairs`
   extension; error states; vault default-tab fix. Prototype at
   `/prototype/reading-list`.
3. **Phase 3 — the interleave**: familiarity table, the Likert moment, tiered
   glossary + render-time filter, disclosure line ("pitched for you") with
   inline correction, companion/QA prompts consume the level.
4. **Phase 4 — the librarian proper**: `aiConfigFor` refactor, dossier keeper +
   ledger, dossier into `selectionSkeletonPrompt`, centroid prior in MMR,
   scout's 3-item shelf. Decide fate of the dislike endpoint and start
   *reading* `digestFeedback`.

**Decisions** *(discussed with Defne 2026-08-19/20)*

- **The feature is called "Explain"**, not "dig deeper" — the button, the API,
  the copy. "Dig deeper" survives only as the legacy digest-level feature's name.
- **The chat rail is dead.** Marginalia model: every explain and every typed
  question is its own collapsible section *in* the document; end-of-document
  composer; outline column on the **left** (§2c).
- **Green lives in the highlight, not the panel.** The explain *selection
  highlight* is acid green — a menu amendment (acid gains exactly one fill use,
  the live selection; record in Paper first, §2b.2). The answer section is the
  paper's wash; the confirmation ✓ is green ink. Green appears nowhere else.
- **No mono eyebrows, no all-caps labels, anywhere in this work** — every
  lead-in ("Tip:", "Pitched for you:") is bolded body face, sentence case (§1).
- **No em dashes in user-visible text, project-wide** — sweep + prompt guard +
  `aiComplete` sanitizer + lint rule (see the global copy rule section).
- **Numbers get a table, not display type.** `keyStats` rows (metric · value ·
  note), wash-tinted, between did and found; omitted for non-quantitative
  papers (§2a).
- **The gist and the closing get weight** — a lede treatment heavier/larger
  than body, added to the menu in Paper first (§2a).
- **The reading view gets a real URL**: `/library/[paperId]`, in phase 2
  (§2a). Digest emails, shared links, and the NUX confirmation all deep-link
  into it; overlay presentation preserved via an intercepted route.
- **Familiarity wires into the glossary**, not just tone: tiered glossary
  generated once, filtered at render by level, so adjusting the level re-tunes
  every saved paper instantly (§3).
- **The save-naming cleanup is in scope, phase 1** — string table in §1.
- **Taste dossier gets a surface in settings** ("what your librarian thinks you
  like") in phase 4 — inspectable, trust-building, and the cheapest way to debug
  taste. Read-only first; editing can come later.
- **Dislike endpoint: keep, don't build UI yet.** It becomes a ledger input for
  the dossier keeper in phase 4; if we haven't wired a UI to it by then, delete
  it rather than let it rot further.
