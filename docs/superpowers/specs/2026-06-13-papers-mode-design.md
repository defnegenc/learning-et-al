# Papers mode (`?papers=1`) — design

A paper-first reading experience to compare against the brief dig-through (`?brief=1`).
Where the brief reveals papers *inside* a synthesized argument, papers mode makes the
three papers the **main menu**: the reader skims them and interrogates the one that hooks them.

## Decisions (from brainstorming)
- **Opening view:** question → short verdict (1–2 sentences) → the 3 paper cards.
- **Chat scope:** paper-first, can expand — answers primarily from the clicked paper, but the
  agent may pull in the other digest papers or a web/vault search when it genuinely helps.
- **Rollout:** separate flag `?papers=1`, compared live against `?brief=1`. Default untouched.
- **Paper hook:** each card shows the plain summary **plus** a "Why it's here" relevance line.

## Flow
1. **Question** — rendered by today-page's existing sweep title (shared with all modes).
2. **Short verdict** — `verdictLead()` takes the first 1–2 sentences of the synthesis body,
   stripped of `**` and `[Source N]` markers. No new generation.
3. **Three paper cards** — title, authors · venue · year, summary, and `connectionReason`
   as the "Why it's here" hook (already populated on ~97% of papers). One card is expanded
   at a time; the others collapse to slim rows. "Next paper →" advances.
4. **Per-paper conversation** — starter questions ("What did it actually find?", "How strong
   is the evidence?", "How does this answer <the question>?"), then free follow-ups + an
   ask-your-own input. Each turn streams from `/api/thread` with `focusPaperId` set.
5. **Sources coda** — discovered sources collected across turns.

## What changed
- **Backend:** `runThreadAgent` takes an optional `focusPaperId`; when set, both the gather
  and write prompts lead with that paper ("answer PRIMARILY from it; expand only when it
  sharpens the answer"). `/api/thread` accepts `focusPaperId` and folds it into the cache key
  (`focus:<id>|<trail>`) so paper-first answers cache separately. No new tables, no pipeline
  changes.
- **Frontend:** new `papers-mode.tsx`. Reuses the agent-answer primitives exported from
  `brief-threads.tsx` (`streamThread`, `toLines`, `LineReveal`, `ThinkingTrace`, `washStyle`,
  `PALETTES`) so citation chips, the thinking trace, and discovered-source cards render
  identically to the brief. `today-page.tsx` renders `PapersMode` when `?papers=1`; both flags
  share a `focusMode` single-column layout that hides the side rail.

## Out of scope (YAGNI)
- No DB or synthesis-pipeline changes.
- Starter questions are templated, not generated.
- All behind `?papers=1`; `?brief=1` and the default are untouched.
