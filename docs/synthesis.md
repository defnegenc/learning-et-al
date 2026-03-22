# Synthesis Generation — Design Decisions & Lessons

> Referenced from CLAUDE.md. Update this when changing synthesis prompts.

## What the Synthesis Does

The synthesis is a 5-8 sentence argument that threads 3 papers/articles together around a central question. It's the core value prop — the user reads it and either thinks "huh, interesting" or "what does this have to do with anything?"

## Current Approach

**System prompt**: "Translate jargon into plain English. Ground everything in real-world problems. Contractions and casual language."

**Structure**: Make an ARGUMENT, not a book report. Papers are evidence, not the subject. Each paper adds something unique to the argument.

**Paper references**: Short conversational names (2-5 words) with colored background highlights. Hover shows paper summary tooltip. Click opens paper detail.

**Bridge sentences**: Explicitly connect papers — "That same tension shows up in...", "This is basically the opposite of..."

**Closer**: Natural, varied — not always "The core tension is..." Can be a provocative question, implication, recommendation, or just a strong ending.

## What Worked

1. **"Make an ARGUMENT" framing** — dramatically improved synthesis quality. Before: paper-by-paper summaries. After: flowing arguments with papers as evidence.

2. **Concrete BAD/GOOD examples in the prompt** — the AI follows examples much better than abstract rules. Showing "this is boring, don't do this" + "this is what we want" works.

3. **Banning specific words** — "demonstrates", "reveals", "nuanced", "multifaceted", "the question of whether" — forced the AI to use more specific, concrete language.

4. **"Translate jargon" instruction** — "photovoltaic shading devices" → "solar panel shades on buildings" made synthesis dramatically more readable.

5. **Bridge sentences requirement** — explicitly connecting papers ("That same tension shows up in...") instead of hoping the reader sees the connection.

6. **Varied structure instruction** — "Don't start the same way every day" with 5 example openers prevented formulaic output.

7. **Grounding in real-world problems** — "Making airplane wings is basically expensive guesswork right now" is infinitely better than "Composite laminate manufacturing faces optimization challenges."

## What Didn't Work

1. **"Paper A / Paper B" labels** — AI kept using generic labels instead of actual titles. Had to ban them explicitly.

2. **"Today we're exploring:" prefix** — every synthesis started the same way. Had to ban it.

3. **"The core tension is..." closer** — became a formulaic template. AI used it every single time until banned.

4. **Paper-by-paper paragraph structure** — telling the AI "paragraph 1 about paper 1, paragraph 2 about paper 2" produced book reports, not arguments. The "3 facets" approach (mechanism/evidence/implication) was better but still formulaic. Best: just say "make an argument" with a good example.

5. **"Start with paper [1]" instruction** — AI sometimes skipped paper 1 entirely. The structural requirement helped but wasn't foolproof. The current approach (GOOD example that naturally includes all papers) works better than rigid structure.

6. **"Look into X" as abrupt pivot** — "Look into blockchain" when no paper mentioned blockchain. Fixed by requiring recommendations to be grounded in the actual papers.

7. **Hallucinated connections** — AI would make up things not in the papers to fill gaps. Fixed with "Only reference what's in the papers. If the connection is weak, be honest."

## Prompt Architecture

```
SYSTEM: Translate jargon. Plain English. Contractions. No academic language.

USER:
  [Paper summaries + abstracts]
  [Synthesis rules with BAD/GOOD examples]
  [Bridge sentence requirement]
  [Varied structure instruction]
  [Closer rules]
  [Banned words list]
```

## Key Metrics (subjective, from user feedback)

- Good synthesis: user says "that's interesting, I see how they connect"
- Bad synthesis: user says "I can't tell what the second paper has to do with this"
- The connection must be EXPLICIT, not implicit. Spell it out in one sentence.

## Open Questions

1. Should synthesis be longer when papers naturally connect well, shorter when the connection is a stretch?
2. Should we detect when the AI is hallucinating connections (no overlapping keywords between the "bridge" sentence and the actual papers)?
3. Would it help to pass the synthesis from previous days so the AI doesn't repeat patterns?
