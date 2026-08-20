# Handoff — reading-view revamp, phases 3 and 4

*Written 2026-08-20. Phases 1 and 2 are merged to `main` (PR #73). This is the
brief for the two that aren't. The full spec is `docs/plans/reading-view-revamp.md`
— read §3 and §4 there; this file is what changed under them, what the seams
are, and what "done" means.*

---

## 0 · Before anything: the migration phase 2 left behind

Three nullable columns, not yet applied to Turso prod:

```sql
ALTER TABLE qa_pairs ADD COLUMN thread_id TEXT;
ALTER TABLE qa_pairs ADD COLUMN selection TEXT;
ALTER TABLE qa_pairs ADD COLUMN section_key TEXT;
```

They are already in `src/lib/db/schema.ts`. Until they exist in the database,
`/api/papers/[id]/qa` returns 500 on read and Ask / dig-deeper are broken. The
reading view itself still renders. `drizzle-kit push` handles plain column adds;
the PK gotcha in CLAUDE.md doesn't apply here.

**Phase 3 adds a `familiarity` table** and phase 4 adds dossier storage. Same
rule: schema first, then push, then deploy — never the other way round.

---

## 1 · What's already built, and the seams to use

Don't re-invent these. All of them exist on `main` now.

| Seam | Where | What it's for |
|---|---|---|
| `aiConfigFor(task)` | `src/lib/ai/provider.ts` | The only place server AI credentials are read. Tasks: `digest \| companion \| dig \| chat \| metadata \| healthcheck`, each overridable by `AI_MODEL_*`. **Phase 4 adds `dossier` and `interleave` here** — two entries in `AITask` + `TASK_ENV`, nothing else. |
| `aiChat(config, messages)` / `aiChatStream` | same file | Conversation with history; the streaming variant is what dig-deeper uses. `aiComplete` is now the two-message case of `aiChat`. |
| `qa_pairs` as the engagement ledger | `src/lib/db/schema.ts`, `src/lib/reading-thread.ts` | Every typed question AND every highlighted passage, threaded. This is §4a's "Engagement" row and it is **already accumulating** — the passages a reader highlights are the richest taste signal in the product and phase 4 should read them first. |
| `COMPANION_SYSTEM` | `src/app/api/papers/[id]/companion/route.ts` | The walkthrough + glossary prompt. Phase 3's tiered glossary is a change to its `glossary` contract plus a `tier` field, and to `parseCompanion` below it. |
| `ASK_SYSTEM` / `DIG_SYSTEM` | `src/app/api/papers/[id]/qa/route.ts` | The two answer voices. Phase 3's familiarity line goes in both, and the visible-use contract's strip-and-render belongs in this route next to `persist()`. |
| `annotateText` / `Glossary` | `src/components/vault/reading-paper-detail.tsx` | Where glossary terms get chipped into prose and listed at the foot. Phase 3's **render-time tier filter** goes here — that's the whole point of tiering, see below. |
| `DigPanel` | same file | The dig confirmation. Phase 3's Likert moment fires from here; it already knows when a dig landed and has the paper. |
| `nuxSeen` / `markNuxSeen` | `src/lib/nux.ts` | First-visit flags, per device. Fine for tips. **Not** fine for the interleaver's annoyance budget — that needs to be server-side, see §2. |
| `SELECTION_FILL` | `src/components/design-system.tsx` | The one sanctioned acid-green fill. Recorded in `docs/design-style.md`. Don't add a second. |

---

## 2 · Phase 3 — the familiarity interleave

Spec: `docs/plans/reading-view-revamp.md` §3. Concretely:

### 3a · The table

New `familiarity` table: `{userId, topicId, topicName, level 1–5, source, createdAt}`.
Deliberately **not** `interests.level` — that's a 3-value enum set once at
onboarding and never read; this is per-subtopic, 5-point, and time-stamped so it
can be re-asked after ~6 months.

The subtopic comes from the paper's OpenAlex topic. `digests.seedTopic` already
persists `{id, name, subfield, subfieldId}`; resolve the per-paper topic at
companion-generation time and cache it on the companion blob. Fall back to the
matched interest keyword.

### 3b · The Likert moment

Fires on the dig confirmation, at most once. One row: `new to it · 1 2 3 4 5 ·
I work on this`, with a visible **skip**, and answering is optimistic — no
spinner, no blocking the answer that's still streaming in behind it.

**Rules that are build requirements, not polish:** never re-ask a subtopic; at
most one ask per day *across the whole product*; always skippable. That budget
has to be server-side — a localStorage counter is per-device and the whole point
is that the product doesn't feel like a survey.

### 3c · The tiered glossary — the part worth getting right

Today the companion generates one fixed glossary and nothing about the reader
conditions it. Make it adapt **without regenerating cached companions**:

1. **Generate a generous superset, once.** Every glossary term carries a
   `tier`: `basic` (anyone outside the field), `working` (practitioners know
   it), `deep` (specialists only). Stored on `papers.companion` exactly as
   today, just with the extra field. Optionally a `analogy` field too.
2. **Filter at render, by the reader's level for that subtopic.** 1–2/5 → all
   three tiers; 3/5 → `working` + `deep`; 4–5/5 → `deep` only. Show the
   `analogy` only at 1–2.

Filtering at render is what makes changing your level **re-tune every
already-saved paper instantly** — no regeneration, no cache invalidation,
retroactive. Companions generated before tiers existed keep their prose and
degrade to "no tier = show it", which is the safe default.

Prose depth (gist/beats tone, dig-deeper answer depth) is baked in at generation
time, so those consume the level in the prompt instead.

### 3d · The visible-use contract — the hard requirement

Whenever a stored level shapes an output, the agent **says so, every time**:

> *Pitched for you: you rated yourself 2/5 on social computing, so I'm defining
> terms as I go.*

- Mono `PITCHED FOR YOU` eyebrow + one body sentence naming the subtopic, the
  level, and the consequence. Top of any companion, dig panel, or Ask answer
  whose prompt consumed a level. If the level wasn't used, the line must not
  appear.
- **Enforce it like the `[Source N]` rule**: the prompt requires the line in a
  fixed format, and the route strips it out of the body and renders it as
  structured UI, so no later step can eat it.
- **The line is the correction affordance.** Tapping it opens the same Likert
  row pre-filled at the stored value. That is the entire settings UI for
  familiarity — no separate page.

### 3e · The separation that must not blur

- **Familiarity ≠ interest.** A 2/5 must never lower how often that topic is
  *selected*. Familiarity is consumed **only at presentation time** — tone,
  jargon density, dig depth. It never touches the pipeline's selection or
  scoring chain. (Same reasoning as the `focusLevel` gotcha in CLAUDE.md.)
- **Self-reported and correctable, never inferred.** The agent doesn't silently
  revise someone's self-rating from their behaviour. At most it re-asks after
  ~6 months, through the interleaver's normal budget.

### Done means

A reader digs → is asked once about that subtopic → answers → and the *next*
thing the librarian writes for them visibly says it remembered, and their
glossary chips change density immediately on every paper they've already saved.

---

## 3 · Phase 4 — the librarian proper

Spec: `docs/plans/reading-view-revamp.md` §4. The framing that matters:
**the digest finder stays a pipeline.** It's deterministic and tuned and
`docs/algorithm.md` says don't deviate. The librarian is a separate, per-user,
event-driven agent owning everything *after* a paper enters the reader's orbit.
It feeds the pipeline at exactly two sanctioned points and adds no new scoring
signals — see the "upstream scoring is a filter" gotcha.

### 4a · Taste, as two layers

1. **A taste dossier** — a maintained ~300-word natural-language document the
   librarian rewrites weekly from the ledger: what they save vs. skip, what they
   highlight (read `qa_pairs.selection` — it's been accumulating since phase 2),
   the familiarity map, what they complained about in regenerate reasons.
   Cheap, inspectable, LLM-native. **Fed into `selectionSkeletonPrompt`** — the
   LLM selection step, which CLAUDE.md says is where the real quality call
   happens. Also fed to companion/synthesis for tone.
2. **Embedding centroids of saved papers** — we already embed everything with
   MiniLM. One centroid **per field cluster**, not one global: somebody who
   saves both HCI and metabolism papers is not the midpoint. Used **only** as a
   soft MMR/rerank prior inside the existing filter.

### 4b · The sub-agents

| Sub-agent | Trigger | Status today |
|---|---|---|
| Companion writer | on save | ✅ `/companion` — personalise it |
| Scout | on save | ◑ `/homework` returns citing works; upgrade to a 3-item shelf: one citing, one contrasting, one foundational, each with a one-line *why for you* |
| Answerer | on dig/ask | ✅ threaded + streaming as of phase 2 |
| Dossier keeper | weekly cron + every ~5 signals | ✖ new |
| Interleaver | on dig-deeper | ✖ new — phase 3 is its v1; it owns the annoyance budget |

Event-driven jobs, not a resident process: each is a route + the existing cron,
state in the DB. Vercel Hobby allows one cron a day — see how
`digest_jobs` / `/api/cron/digests/{hour}` already works around that before
inventing a scheduler.

### 4c · Housekeeping this phase owns

- **`digestFeedback` is write-only.** Nothing has ever read the regenerate
  reasons. Make the dossier keeper read them, or delete the table.
- **The dislike endpoint has no UI.** Keep it as a ledger input for the dossier
  keeper; if it still has no caller by the end of this phase, delete it rather
  than let it rot further.
- **The dossier gets a settings surface** — "what your librarian thinks you
  like". Read-only first. It's the cheapest way to debug taste and the most
  trust-building screen in the product.

### Done means

The dossier exists, is visible in settings, is rewritten on a schedule, and is
reaching `selectionSkeletonPrompt`; the centroid prior nudges MMR; the scout
returns three annotated items instead of a citing-works list; and nothing that
was write-only still is.

---

## 4 · Rules neither phase may break

- **The core algorithm.** Read `docs/algorithm.md` before touching the pipeline.
  Theme-first, papers as tools to think with, no new heavy scoring signals.
- **The menu is short.** No new hex, type size, border width or shadow offset.
  Paper board first (*Brilliant petal* → "Design system — the short menu"), then
  `globals.css` + `design-system.tsx`, then the surface. Acid green already
  spent its one fill exemption on `SELECTION_FILL`.
- **Mono is structure only.** `PITCHED FOR YOU` is an eyebrow, so mono is right;
  the sentence after it is body face.
- **One paper card.** `src/components/paper-card.tsx`, two sizes. Don't add a second.
- **One name for save.** "Save" / "Saved" / "your library". A fourth string
  re-creates the bug phase 1 fixed.
- **Update the docs.** `algorithm.md` for pipeline changes, `design-decisions.md`
  for UX calls, `changelog.md` with dates, `component-inventory.md` for new
  components.
