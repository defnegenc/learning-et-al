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
