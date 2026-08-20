# Interactive Brief — Design Spec

**Date:** 2026-06-09
**Status:** Approved by Defne (pending spec review)

## Problem

The retrieval pipeline (steps 1–5, theme-first) finds good papers, but the delivery — a long
synthesis paragraph plus free-text Q&A — doesn't work. Root diagnosis: the delivery is
**paper-indexed instead of answer-indexed**. The coverage gate, `[Source N]` mentions, and
one-bullet-block-per-paper structure all enforce "cover the papers," so every prompt-level fix
regresses to a book report. The central question is generated before retrieval and the papers
are "tools to think with," so nothing in the pipeline ever actually answers it; the Q&A chat
exists to outsource that job to the reader.

## The new delivery: an interactive brief

Retrieval (steps 1–5) is untouched. Everything after paper selection changes.

### Reading experience

Opening a digest shows, in order:

1. **Central question** — large Space Grotesk display, as today.
2. **Verdict** — 4–6 sentences that answer the question with a real position
   ("Mostly yes, but the mechanism isn't what you'd think"), citing papers inline via the
   existing colored/clickable `[Source N]` shortName convention. The only standing prose.
   No reading map, no per-paper blocks, no separate takeaway line — the verdict's last
   sentence is the takeaway.
3. **Seed threads** — 3–4 tappable questions in brutalist tag style. **Reused verbatim from
   the digest's existing `suggestedQuestions`** (the Stage A gap/tension generator) — no new
   generation, so the logged-out pre-generation path and cost stay identical. Nested
   follow-ups below the seeds are generated live by the agent (same gap heuristic, applied to
   what it just wrote plus any sources it found).

### Threads (full agentic, on-demand)

Tapping a seed expands a **trail** inline: a single downward-growing column per thread.

- An agent loop answers the question, grounded first in the papers' claims, and may call
  tools to go further. Tool activity renders live as IBM Plex Mono uppercase status lines
  (`SEARCHING OPENALEX: …`, `READING: Karpicke 2024`) — agent telemetry as brutalist
  theater, doubling as provenance.
- Prose streams at **reading speed** (~280 wpm word-by-word reveal). The client buffers
  real tokens and paces the reveal; eases faster when the buffer is deep; never reveals
  faster than generation. Status lines bypass pacing (they are the latency mask).
- Sources discovered mid-thread are cited inline with the colored-name treatment and
  **join the digest's source pool** — persisted, tappable, citable by later threads.
- Each expansion ends with **2–3 nested seeds** generated from what was just said.
  Depth is unbounded by design (capped by guardrails). **No free-text input anywhere** —
  the chat UI and `qa_pairs` retire.

### Paper cards: saved, repurposed

No standing paper-card grid. The blob-card design (white bg, colored blob pairs, hard
border, box shadow) lives on in three places:

1. **Inline source cards** — when a thread cites a paper (original or discovered), a compact
   blob card materializes in the trail at the citation point; tap opens detail.
2. **Sources coda** — collapsed `SOURCES (N)` section at the digest's bottom unfolds into
   the familiar card grid: original papers plus all thread discoveries.
3. **Color mapping stays load-bearing** — each source keeps its blob pair (pink+green,
   blue+yellow, purple+red, cycling for discoveries); cited names in prose are
   underlined/highlighted in that source's colors, tying name → card → detail.

Paper detail still opens in the canvas (modal on mobile).

### Logged-out experience

Visitors see the admin digest: verdict + **pre-generated level-1 expansions** (generated at
digest time, like today's `suggestedAnswers`), replayed with the same reading-speed
animation. No live agent, no depth beyond level 1.

## Architecture

### Pipeline changes (replaces synthesis Stages B–D)

- **Stage A′ — Claims extraction.** Per paper: 3–5 claims with evidence ("what did they
  find out"), extending the existing Stage A metadata call.
- **Stage B′ — Verdict.** One call answering the central question from the claims with
  inline `[Source N]` citations (highlight-mapping contract preserved), plus a single
  revise pass gated on "does it take a position?"
- **Stage C′ — Seed threads.** 3–4 questions from tensions/gaps between claims. For the
  admin digest only, also pre-generate level-1 expansions.

### Thread engine — `POST /api/thread` (streaming) — IMPLEMENTED

SSE over a ReadableStream; `maxDuration = 60`. Implemented in `src/lib/ai/agent.ts`
(`runThreadAgent`) + `src/app/api/thread/route.ts`.

- **Two phases:** (1) GATHER — a bounded tool-calling loop (OpenAI SDK `tools`/`tool_choice`,
  works against the Gemini/Anthropic OpenAI-compatible endpoints); the model answers from the
  digest's claims when it can, else calls a tool. (2) WRITE — a final structured call returns
  the cited answer + nested follow-ups as JSON.
- **Tools:** `search_papers` (OpenAlex→S2→arXiv fallback), `search_web` (Serper), `search_vault`
  (embed the query, cosine-rank the user's saved papers via `embedBatch`).
- **Context in:** central question, verdict (`synthesisContent`), per-paper claims
  (`keyFindings`), ancestor trail, tapped question.
- **Events out (SSE):** `status` (tool activity, live), `source` (new paper → inline card,
  live), `result` (final `{answer, seeds, sources}`). The answer carries `[N]` citation
  markers indexing the `sources` array; **the client paces the reveal** at reading speed
  (no server token streaming — the reveal animation already lives client-side).
- **Auth/config:** `getAuthUser` (live agent requires sign-in); use server
  `CRON_AI_*` configuration, mirroring `/api/digest/chat`.
- **Guardrails:** max 3 tool calls per expansion. Per-day budget + per-trail depth limits:
  deferred to wiring.

**Still to wire:** frontend consumption of the SSE stream (feed `status`→ThinkingTrace,
map `[N]`→sources, nested `seeds`→tappable threads); `threads` persistence table;
logged-out level-1 pre-generation.

### Data model

- New `threads` table: `id, digestId, userId, parentId, question, content, sources,
  createdAt`. Reopening a digest restores the tree instantly (no replay of pulled threads).
- Thread-discovered papers insert into `papers`, linked to the digest with a
  `discoveredVia` marker.
- `qa_pairs` and the chat UI retire (table kept for history; no new writes).

### Client

One `useThreadStream` hook owns the token buffer and pacing; trail components render
status lines, paced prose, inline cards, and nested seeds.

## Out of scope

- Retrieval/scoring changes (steps 1–5 untouched; THE CORE ALGORITHM stands).
- Email digest format (continues using verdict text; revisit later).
- Vault UI changes beyond `search_vault` read access.

## Doc updates required at implementation time

`docs/algorithm.md` (synthesis stages), `docs/design-decisions.md`, `docs/design-style.md`
(trail/status-line/inline-card specs), `docs/changelog.md`, CLAUDE.md gotchas
(`suggestedAnswers` note becomes level-1 pre-generation note).
