# Synthesis Generation — Design Decisions & Lessons

> Referenced from CLAUDE.md. Update this when changing synthesis prompts.

## What the Synthesis Does

The synthesis is a 5-8 sentence argument that threads 3 papers/articles together around a central question. It's the core value prop — the user reads it and either thinks "huh, interesting" or "what does this have to do with anything?"

## The North Star

**After reading the synthesis, the user should be able to bring this up in conversation and sound informed.** They shouldn't need to read any of the papers. The synthesis IS the product — not a teaser for the papers.

This means:
- Every paper gets enough context that you understand what was studied and what was found
- The connection between papers is spelled out, not implied
- Jargon is translated into things you already know
- The reader walks away with a "huh, I didn't know that" moment
- Concrete examples > abstract claims ("Nigerian banks absorbed fintech startups" > "financial institutions adapted")

## Current Approach

**System prompt**: Translate jargon into plain English and ground everything in real-world problems. Conversational means direct and specific, not repeated scripted openers such as "So", "Turns out", or "Here's the thing"; contractions are used when natural.

**Structure**: Make an ARGUMENT, not a book report. Papers are evidence, not the subject. Each paper adds something unique to the argument.

**Paper references**: Conversational names with colored background highlights. "the McKinsey fashion report" not "Fashion 2026". Hover shows paper summary tooltip. Click opens source.

**Bridge sentences**: Explicitly connect papers — "That same tension shows up in...", "This is basically the opposite of..."

**Closer**: Natural, varied — not always "The core tension is..." Can be a provocative question, implication, recommendation, or just a strong ending.

## Hard Rules

1. **No em dashes (—)** — use commas, periods, or "but" instead. Em dashes feel academic and formulaic.
2. **Name papers conversationally** — the way you'd refer to them in conversation. "the McKinsey fashion report" not "Fashion 2026". "a Nigerian banking study" not "Driving Sustainable Growth (2026)".
3. **Explain each paper enough** — the reader should understand what was studied, what was found, and why it matters. Not just "Paper X found Y" but "Paper X looked at Z, and discovered Y, which matters because W."
4. **Cocktail party knowledge** — could someone repeat this at dinner and sound smart? If not, it's too abstract.
5. **No academic language** — ban list: demonstrates, reveals, highlights, suggests, nuanced, multifaceted, fundamentally, inherently, arguably, "it's deeply about", "This kind of", "This shows how", "The real lesson." ESPECIALLY banned: "The question of whether X isn't just about Y — it's about Z" and any "isn't merely/just X — it's fundamentally Y" pattern. These sound like TED talks, not humans.
6. **No restating the theme** — don't start with "Today's question is..." or restate what was already in the title.
7. **One paragraph** — keep it tight. If it needs two paragraphs, the second should be very short.
8. **Include one specific number or finding** — concrete detail anchors the whole piece.
9. **Only discuss what's in the papers** — never hallucinate connections or bring up topics not covered.

## What Worked

1. **"Make an ARGUMENT" framing** — dramatically improved synthesis quality. Before: paper-by-paper summaries. After: flowing arguments with papers as evidence.
2. **Concrete BAD/GOOD examples in the prompt** — the AI follows examples much better than abstract rules.
3. **Banning specific words** — forced more specific, concrete language.
4. **"Translate jargon" instruction** — "photovoltaic shading devices" → "solar panel shades on buildings".
5. **Bridge sentences requirement** — explicitly connecting papers instead of hoping the reader sees the connection.
6. **Varied structure instruction** — "Don't start the same way every day" with example openers.
7. **Grounding in real-world problems** — "Making airplane wings is basically expensive guesswork" > "Composite laminate manufacturing faces optimization challenges."

## What Didn't Work

0. **The "guided digest" structure (May–June 2026, reverted)** — short answer + research context + reading map + four labelled sub-bullets per paper (If you want to understand / What it did / What it offers / Another lens) + "One thing to remember" + closing. Each idea was reasonable alone, but together they produced ~7 paragraphs where the reading map restated the per-paper blocks and the closing appeared twice. User verdict: "a fuck ton of text." Reverted to the compact structure (intro answering the question, one sentence per paper, bridges, closing). If a future change adds structure, check total length and redundancy across sections first.

1. **"Paper A / Paper B" labels** — AI kept using generic labels. Had to ban explicitly.
2. **"Today we're exploring:" prefix** — every synthesis started the same way.
3. **"The core tension is..." closer** — became formulaic.
4. **Paper-by-paper paragraph structure** — produced book reports, not arguments.
5. **"Start with paper [1]" instruction** — AI sometimes skipped paper 1.
6. **"Look into X" as abrupt pivot** — recommendations about topics not in the papers.
7. **Hallucinated connections** — AI making up things to fill gaps.

## Prompt Architecture (4-Stage Pipeline)

The synthesis uses a multi-stage pipeline (implemented, not future work):

```
Stage A: Metadata extraction (SYNTHESIS_SYSTEM)
  → Per-paper summaries, keywords, findings, keyConcepts

Stage B: Skeleton / argument structure (separate system prompt)
  → Cross-document relations (contradicts/agrees/extends)
  → Paper roles, core tension, argument arc
  → Tension hints from counter-query passed through

Stage C: Prose draft from skeleton (SYNTHESIS_PROSE_SYSTEM)
  → Full synthesis paragraph using skeleton as blueprint
  → Papers referenced by short names from skeleton

Stage D: Self-critique and revision (critique → revision)
  → Checks for: hallucinations, weak connections, missing papers
  → Revises the draft based on self-critique
```

Papers with `tensionHint` (from counter-query search) get `[HINT: ...]` annotations in the formatted listing, helping Stage B identify intended tensions.

## Key Metrics (subjective, from user feedback)

- Good synthesis: user says "that's interesting, I see how they connect"
- Bad synthesis: user says "I can't tell what the second paper has to do with this"
- The connection must be EXPLICIT, not implicit. Spell it out in one sentence.

## Ideas to Explore

1. **Adaptive length** — longer when papers connect well, shorter when the connection is a stretch. Don't pad weak connections.
2. **Hallucination detection** — check if bridge sentence keywords actually appear in the papers.
3. **Day-over-day variety** — pass previous syntheses so the AI doesn't repeat patterns/structures.
4. **"One thing to remember" line** — a single-sentence takeaway at the end, bold, that's the cocktail party line.

## Card vs Digest voice split (2026-07-19)

Two surfaces, two jobs (card renders FIRST in the brief view, synthesis prose underneath):
- **Card `summary`** = a plain, factual TL;DR of the study: what they did + what they found, 1-2 uncomplicated sentences, MAX 45 words, no jargon, no rhetorical questions. Starting "Researchers…/This paper…" is fine here — clarity over variety. Spec: SUMMARY RULES in prompts.ts.
- **Synthesis prose** = the conversational digest. The relatable "you know how…" hook lives HERE, not on the card. Spec: RELATABLE HOOK in SYNTHESIS_RULES.
- RELATABILITY guard (both the hook rule and the `relatability` critique dimension): a "you know how…" setup must name an experience people ACTUALLY have and would phrase that way. "you know how a night's sleep makes a problem obvious?" is BAD; "you know how you think more clearly after a good night's sleep?" is GOOD.
