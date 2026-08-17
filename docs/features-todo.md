# Features TODO

Running list of future features. Shipped items move to the "Shipped" section at the
bottom (dates live in `docs/changelog.md`).

## Open

### Read a paper by section — UNDER EVALUATION, prototype only
`/prototype/reading-list` now has two tabs on the reading view: **Walkthrough**
(the five companion beats, shipped) and **By section** (fixed buttons that expand
into a summary of that part of the paper alone). Both run on fixture data. Pick one
before building the backend.

**What the measurement says.** Heading detection over five real arXiv extracts
(Attention, GPT-3, ResNet, chain-of-thought, BERT) found:

| | intro | related | methods | results | discussion | limitations | conclusion |
|---|---|---|---|---|---|---|---|
| hit rate | 5/5 | 4/5 | **3/5** | 5/5 | **1/5** | **1/5** | 3/5 |

ResNet calls its method "Deep Residual Learning" and BERT calls its "BERT", so no
list of canonical names will catch them. Most ML papers have no Discussion or
Limitations heading at all. GPT-3's results matched `2.4 Evaluation`, a subsection,
before the real results section — depth must be preferred, not just position.

**Therefore: fixed buttons, variable sources.** The buttons cannot be the paper's
table of contents, because the two parts a non-expert most wants are the two most
often missing. Each button is fixed and phrased for a reader; each records whether
its answer was read out of a real section or inferred from the whole paper, and
shows which. "Inferred from the whole paper" is a materially weaker claim.

**The pipeline this needs** (not built):
1. Regex sweeps candidate heading lines — 68–224 per paper, deterministic offsets,
   zero tokens.
2. One LLM call classifies just those lines (a few thousand tokens, not the paper)
   into the fixed slots, preferring top-level over subsection depth. Offsets stay
   exact because they came from step 1.
3. Per-section summary generated lazily on first expand, from that chunk alone, and
   cached on a new `papers.sections` column. Most readers won't open all four, so
   nothing is spent up front — and a summary that only ever saw its own section
   can't drift in material from elsewhere, which is the real argument for this view
   over the walkthrough.

**News stays on the walkthrough.** An article is not an experiment: it has no
methods and no limitations, so the tabs are suppressed for `source === "rss"`
regardless of what data exists. Worth noting separately that the companion prompt
says "this paper" throughout and produces awkward output for news — the digest card
already sidesteps this by relabelling Findings as "Key points" for `isNews`, and
the beats need the same treatment.

### Show whether the companion actually read the PDF
`pdfUrl` comes from OpenAlex `open_access.oa_url`, arXiv, or a Semantic Scholar
arXiv id. An open-access paper gets its real full text; a paywalled one silently
falls back to the abstract, and the two are indistinguishable in the reading view.
A companion built from 150 words of abstract should not look identical to one built
from the whole paper. Needs a provenance line, and probably a weaker set of beats
when it's abstract-only.

### Share Digest (partially shipped)
Public logged-out viewing already works via `public-digest.tsx` + the `/api/digest/[id]`
route. **Remaining:** a per-digest "copy share link" affordance so any digest can be
shared to social/Slack without the sign-in modal popping up.

### Consolidate to one digest UX (scrap the extra modes)
Brief is the default and the direction. The alternate modes — `?papers=1` (PapersMode),
`?papersog=1` (PapersModeOg), `?classic=1` (original synthesis + rail) — were comparison
variants. Once the readability pass lands and brief feels right, remove the unused modes and
their components to cut maintenance surface. Confirm none are linked/depended on before deleting.

### Dig Deeper Refresh
Rethink dig deeper to actually prompt the user to explore further. Current suggested
questions feel generic. Should feel like a curious friend pulling you in deeper.

### Conversational Papers — Build 2: the recall loop
**Core question:** How might we make it so the user doesn't have to read the paper at all
to feel like they've learned something, and *remember* it well enough to bring it up later?

Build 1 (The Takeaway) shipped 2026-07-05 — each paper now has a hook + stat + "say it like
this" line, surfaced on the card and detail overlay. Spec:
`docs/superpowers/specs/2026-07-05-conversational-papers-takeaway-design.md`.

**Build 2 (next):** the retention layer — spaced-repetition / active-recall resurfacing of past
takeaways ("remember Tuesday's paper?") inside a new digest, so knowledge persists. The
`homework_topic` column already exists so the recall loop can prioritize homework topics when
the homework queue lands. Still worth a research pass in `docs/summarize-papers.md`:
- Cognitive science of retention from summaries vs. full reads; "cocktail party knowledge"
- Spaced repetition / active recall applied to digests
- How podcasts/newsletters make things stick (Morning Brew, TLDR, Huberman): narrative + surprise + personal connection

Later builds: conversational rehearsal ("how would I bring this up?"), narrated/audio brief.

### Reading List — Agentic Paper Walkthrough
**Core idea:** "Add to reading list" button (top-right of each paper card, bookmark
icon) saves the paper to a persistent reading list. The reading list is a top-level
nav item (alongside Today / Vault, or replaces Vault). Each saved paper opens as its
own chat — the agent fetches the full PDF, walks through it, highlights jargon with
ELI5 definitions, and gives section-by-section plain-language summaries. The user can
ask follow-up questions mid-read ("wait, what does this mean?").

**UX flow:**
1. User sees a paper in the digest → taps "Add to reading list" (bookmark icon, top-right)
2. Button animates briefly ("Adding…" → "Done ✓"), paper is saved
3. User navigates to Reading List tab — sees their saved papers as a list/grid
4. Tapping a paper opens a chat view: the agent has already (or begins to) analyze it
5. Chat is persistent — user can return to it, ask more questions, pick up where they left

**What the agent does per paper:**
- Fetches the full PDF (via `unpdf`)
- Walks section by section: for each, produces a 2-3 sentence plain summary + annotates
  jargon with ELI5 hover definitions (same dotted-underline pattern as the synthesis)
- Streams results section-by-section so the user can start reading immediately
- Keeps full-paper context so follow-up questions ("how does section 3 relate to the
  intro?") work

**Open questions:**
- Replace the Vault with Reading List, or add as a third tab? Vault has compare mode +
  domain filters that reading list doesn't need — maybe reading list IS the vault, with
  an "Analyze" action per paper that opens the chat.
- Cost control: full-paper LLM analysis is expensive (long context). Cache per paper?
  Limit to N papers/day? Use a cheaper model for section summaries, expensive model only
  for follow-ups?
- Storage: chat history per paper needs a new table (reading_list_messages or similar).
  The paper row already has the PDF URL; store the analysis output so re-opening is instant.
- Should the analysis happen eagerly (on add) or lazily (on first open)?
- Mobile: chat view needs to work well on small screens — probably a full-page takeover.

### Homework Queue
Let the user assign the agent "homework" — a personal queue of topics/areas they want
explored (e.g. "generative UI", "ubiquitous computing in the 21st century", "surveillance
capitalism"). The user adds items to the list; the digest pipeline pulls from this queue
to seed the central question/theme, instead of (or alongside) the user's standing interests.
- **UX:** A floating "Give me homework" button, top-right of the digest, opens an input to add a topic to the queue.
- **Behavior:** Queue-like — the pipeline picks an item (FIFO or weighted) to drive that day's theme. Decide whether items are consumed once or recur.
- **Open questions:** Does a homework item override the normal interest-based theme for that digest, or just bias it? How do consumed items get surfaced back ("here's what I found on X")? Should the user see/reorder/delete the queue?
- **Differs from interests:** Interests are a standing profile; homework is a directed, ephemeral request — "go look into *this* next."
- Slated for a dedicated brainstorm after the readability pass.

## Shipped (see `docs/changelog.md` for dates)

- **Working cron** — daily auto-generation for all users via `vercel.json` crons +
  `/api/cron` (processes most-stale-first, surfaces processed counts). *(was #2)*
- **Delivery cadence** — daily / bi-weekly (Tue & Fri) / weekly (Sunday recap), with
  cadence-aware "best-of" email selection via Resend. *(was #4)*
- **Reading List + Digest History** — vault rebuilt around bookmarked papers (single
  save action, digest starring removed) with jargon-annotated abstracts + ELI5 gists,
  a two-pane digest history, and an end-of-digest "Don't like this digest? Regenerate."
  CTA. Spec: `docs/superpowers/specs/2026-07-19-vault-reading-list-design.md`. *(2026-07-22)*
- **Digest Readability & Curiosity Pass (A–E)** — zero-click header (domain chips + gist +
  curatorial framing), concrete-noun title rule, aggressive jargon capture for hover defs,
  and plain-language paper names on cards. Spec:
  `docs/superpowers/specs/2026-07-05-digest-header-gist-hook-design.md`. *(2026-07-05)*
