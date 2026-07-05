# Features TODO

Running list of future features. Shipped items move to the "Shipped" section at the
bottom (dates live in `docs/changelog.md`).

## Open

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

### Research Deep Dive: Making Papers Conversational
**Core question:** How might we make it so the user doesn't have to read the paper at all
to feel like they've learned something? How can we make it so that short interaction is
enough to bring it up in conversation?

Needs a research deep dive in `docs/summarize-papers.md` — look at:
- Cognitive science of knowledge retention from summaries vs. full reads
- "Cocktail party knowledge" — what's the minimum viable understanding to discuss a topic?
- Spaced repetition / active recall techniques applied to paper digests
- How podcasts/newsletters achieve this (Morning Brew, TLDR, Huberman)
- The role of narrative + surprise + personal connection in memory formation

Note: the readability pass (A–E above) is the near-term surface fix; this is the deeper
"make it memorable" bet, to be done after.

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
- **Digest Readability & Curiosity Pass (A–E)** — zero-click header (domain chips + gist +
  curatorial framing), concrete-noun title rule, aggressive jargon capture for hover defs,
  and plain-language paper names on cards. Spec:
  `docs/superpowers/specs/2026-07-05-digest-header-gist-hook-design.md`. *(2026-07-05)*
