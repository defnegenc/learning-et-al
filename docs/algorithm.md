# Learning et al. — Digest Algorithm

> Referenced from CLAUDE.md. Always consult this before modifying the digest pipeline.

## Core Philosophy

Every digest is built around a **central question with wow factor** (max 8 words), not around a "best paper."

The question comes first. Papers are found to inform that question — not to answer it. A paper on AI bias can inform "Can AI be fashionable?" even if it doesn't mention fashion once. The synthesis frames everything as different lenses on the same question.

**The old approach (WRONG):** Find an anchor paper -> derive theme from anchor -> find papers related to anchor
**The current approach (RIGHT):** Generate a surprising central question from user interests -> search for papers that give us tools to think about that question -> revise theme to thread the actual papers together

---

## The Full Pipeline (step by step)

### Step 1: Interest Selection

Weighted random sampling with penalty for recently-used interests (last 5 digests).

- **1 random primary interest** selected via weighted sampling (higher weight = more likely).
- **4 top-weight fill interests** added alongside the primary.
- Interests come from user settings (category-level expertise: BEG/INT/ADV).
- Recently-used interests are penalized so the same topics don't dominate every digest. The system tracks which interests were used in recent digests and deprioritizes them during selection.

### Step 2: Central Question Generation (AI call 1 — hypothesis)

LLM picks 1-3 of the user's interests and generates a catchy central question.

- **Max 8 words.** Must sound like something a real person would wonder about.
- Cross-domain combos encouraged but **only combine interests that naturally connect**. "AI agents + fashion" works. "Quantum physics + knitting" does not.
- Single-interest questions get an **unexpected angle within the domain** instead.
- For beginner interests: concrete and real-world, avoid pure theory.
- LLM also returns:
  - `searchQueries` (3 queries for paper search)
  - `newsQuery` (for news search)
  - `focusField` (academic domain for OpenAlex filtering)
- Fallback: if LLM fails, use the top interest keyword as the theme.

### Step 3: Paper Search

3 queries searched via the source priority chain: **OpenAlex -> Semantic Scholar -> arXiv fallback**.

- For beginner interests: `"introduction overview applications"` appended to each query.
- All results deduplicated by title.
- Cross-digest dedup: skip papers the user has seen in the last 30 days (includes same-day regenerations).

**`searchPapers()` source priority:**
1. **OpenAlex with field filter** — 250M papers, no rate limits. Preferred.
2. **OpenAlex without field filter** — retry if field filter returns 0 (concept taxonomy mismatch).
3. **Semantic Scholar** — rate-limited at 1 req/sec on free tier.
4. **arXiv** — last resort, no field filter.

### Step 4: Paper Scoring

Embed the central question + all candidates with `all-MiniLM-L6-v2` (local, no API key).

- Embed the central question as `themeEmb`.
- Embed all candidate papers (title + first 500 chars of abstract).
- Score each candidate by **cosine similarity** to `themeEmb`.
- Pick the top N papers above `SIM_ONTOPIC` threshold (0.25).
- If fewer pass, fall back to `SIM_FALLBACK` (0.15) — never fail completely on threshold alone.

**N = targetPapers, determined by the content mix slider:**

| Slider value | targetPapers | News slots |
|-------------|--------------|------------|
| 0-20 ("Just research") | 3 | 0 |
| 21-50 | 2 | 1 |
| 51-80 | 1 | 2 |
| 81-100 ("Just news") | 0 | 3 |

### Step 5: News Search

Number of news items = 3 - targetPapers. When news slots are needed:

- Web search via Serper (Google news) / DuckDuckGo fallback using `newsQuery + focusInterest + year`.
- Scored by **embedding similarity to theme** (same model as paper scoring).
- **Listicle filter**: reject "Top N+", "Best N+" patterns and known SEO domains via regex + domain blocklist.
- Article text fetched (up to 10000 chars) for content extraction.
- RSS fallback (2 interest words + 2 theme words from TechCrunch, Ars Technica, Wired).
- Last resort: substitute an academic paper.

### Step 6: Theme Revision (AI call 2 — revision)

LLM sees the actual papers found and revises the central question to better thread them.

- Max 8 words.
- Must connect ALL papers found.
- Must sound natural, not goofy.
- This keeps the theme grounded in what was found while preserving the surprise factor.

### Step 7: Synthesis (AI call 3 — synthesis)

LLM generates a JSON response containing: summaries, key findings, synthesis narrative, keyConcepts.

- **Conversational tone** ("Today I found..."). Contractions, casual transitions.
- Paper names in **bold**. Paragraph breaks between papers.
- Must include ALL papers/items in the digest.
- Key findings must be **RESULTS, not methodology** ("They found X" not "They used method Y").
- Each item framed as a different **lens** on the central question, not a sequential story.
- Ends with a specific "where to go deeper" pointer.
- Define jargon immediately when first used. Hard words become keyConcepts with hover definitions.
- ALWAYS mention the year each paper was published.
- **Banned words**: demonstrates, reveals, nuanced, multifaceted, elicits, "the question of whether".
- NO em dashes, NO filler phrases ("so basically", "what's wild is").

### Step 8: Storage

- Digest saved with: theme, synthesis narrative, keyConcepts, starred flag.
- Papers saved with: summaries, keywords, key findings.
- All linked to the user and dated.

---

## Total AI Calls Per Digest: 3

| Call | Step | Input tokens (approx) | Output tokens (approx) |
|------|------|-----------------------|------------------------|
| 1. Hypothesis generation | Step 2 | ~800 | ~100 |
| 2. Theme revision | Step 6 | ~2500 | ~50 |
| 3. Synthesis | Step 7 | ~8000-15000 | ~800 |

**Total: ~10000-18000 tokens per digest.**

---

## Validation Gates

| Gate | Threshold | Applied at |
|------|-----------|-----------|
| SIM_ONTOPIC | cosine > 0.25 | Step 4 paper selection |
| SIM_FALLBACK | cosine > 0.15 | Step 4 if no papers pass primary threshold |
| News embedding similarity | cosine > 0.15 | Step 5 web results |
| Listicle filter | regex + domain blocklist | Step 5 web results |
| Cross-digest dedup | last 30 days (includes same-day regenerations) | Step 3 candidate filtering |

---

## Learning System

Engagement only boosts **existing** interests (does not create new ones). Weight changes are intentionally tiny.

Interests have a `weight` field (default 1.0). Weights affect how often an interest is selected:

| Signal | Effect | Cap |
|--------|--------|-----|
| Star on paper | +0.1 to best-matching interest | 3.0 |
| Dislike on paper | -0.2 to paper's keywords | floor 0 |
| Synthesis chat question | +0.05 to best-matching interest | 3.0 |
| Daily decay | x0.95 applied each digest generation | — |

---

## Cross-Digest Deduplication

At the start of each generation, paper titles from the last 30 days of digests are loaded into `seenPaperTitles`. Any candidate paper already seen is skipped. This includes same-day regenerations (so regenerating gives fresh papers). Time limit of 30 days prevents pool exhaustion for long-term users.

---

## Known Limitations

1. **LLM determinism**: The central question generation may produce different themes on regeneration for the same user on the same day (LLM is not deterministic). This is acceptable — regeneration is an explicit user action.
2. **Single-word interests**: "robotics" or "cooking" alone produce a weaker theme than cross-domain combos. The LLM handles this by finding surprising angles within the single domain.
3. **SIM_ONTOPIC threshold**: 0.25 is relatively loose (all-MiniLM-L6-v2 scores). If theme is very abstract ("Can AI be fashionable?"), many tangentially related papers may pass. The synthesis prompt compensates by framing papers as lenses rather than direct answers.
4. **News validation**: Embedding similarity is better than keyword matching but short snippets may still produce false positives. The listicle filter helps catch the worst offenders.

---

## What Worked

- **Theme-first approach** produces genuinely interesting cross-domain questions
- **Embedding-based scoring** is far better than keyword matching
- **Theme revision step** catches bad themes that don't fit the actual papers
- **Interest rotation** prevents same-topic digests every day
- **"Max 8 words" rule** makes themes punchy
- **Conversational synthesis tone** with concrete examples in prompt
- **Banning specific AI-speak words** ("demonstrates", "nuanced", "elicits") dramatically improves output

## What Didn't Work

- **Anchor paper approach**: highly cited papers dominated, pulled in methodology papers from wrong fields
- **Citation graph** (OA related_works, S2 recommendations): cross-field contamination, PRISMA showing up in AI digests
- **Domain guard**: too strict filtered good papers; too loose let garbage through
- **Keyword matching for relevance**: terrible. "AI" + "agents" matched customer service bot articles
- **Auto-creating interests from engagement**: "emoji communication" polluted the feed after one starred paper
- **Weight boost of +0.5 per star**: too aggressive, one star dominated all future digests
- **"Paper A" / "Paper B" labels in synthesis**: AI kept using them instead of actual titles
- **Letting AI decide whether to revise theme** ("changed: true/false"): it always said false. Now we always revise.
- **Pink (#ff007f) as highlight color**: felt out of place with the brutalist aesthetic. Switched to neutral black.

---

## Top 3 Ideas to Improve (rolling)

1. **Forward citation lookup**: find papers that cite the same foundational work but disagree with each other. Would create real intellectual tension.
2. **SPECTER2 embeddings**: purpose-built for academic paper similarity (~110MB model). Would improve paper scoring over general-purpose MiniLM.
3. **User digest feedback loop**: after reading a digest, user rates it 1-5. Use this to fine-tune interest weights and theme quality over time.
