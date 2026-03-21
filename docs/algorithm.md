# Learning et al. — Digest Algorithm

> Referenced from CLAUDE.md. Always consult this when modifying the digest pipeline.

## Core Philosophy

Every digest is built around a **central question with wow factor**, not around a "best paper."

The question comes first. Papers are found to inform that question — not to answer it. A paper on AI bias can inform "Can AI be fashionable?" even if it doesn't mention fashion once. The synthesis frames everything as different lenses on the same question.

**The old approach (WRONG):** Find an anchor paper → derive theme from anchor → find papers related to anchor
**The current approach (RIGHT):** Generate a surprising central question from user interests → search for papers that give us tools to think about that question

---

## How it works

### Step 1: Generate central question
- Pass the user's top 5 interests (sorted by weight) to an LLM.
- LLM picks 1-3 interests and generates a catchy central question with "wow factor."
- Cross-domain combos produce the best questions: "AI agents + fashion" → "Can AI agents be fashionable?"
- For beginner interests: concrete and real-world, avoid pure theory.
- LLM also returns: `searchQueries` (3 queries for paper search), `newsQuery` (for news), `focusField` (academic domain).
- Fallback: if LLM fails, use the top interest keyword as the theme.

### Step 2: Search for papers
- Run all 3 LLM-generated search queries against OpenAlex → S2 → arXiv (in that priority order).
- For beginner interests: append "introduction overview applications" to each query.
- Collect all results, deduplicate by title.
- Apply cross-digest dedup: skip papers the user has seen in the last 30 days.

### Step 3: Score + select papers
- Embed the central question (`themeEmb`).
- Embed all candidate papers (title + first 500 chars of abstract).
- Score each candidate by cosine similarity to `themeEmb`.
- Pick the top 2 papers above `SIM_ONTOPIC` threshold (0.25).
- If fewer than 2 pass, fall back to `SIM_FALLBACK` (0.15) — never fail completely on threshold alone.

### Step 4: Find the third item (news or paper)
- **Content mix ≥15 (mixed/news mode):** Web search using `newsQuery + focusInterest + year`
  - News validation: ≥40% of interest words must appear in title+snippet
  - Listicle filter: reject "Top N+", "Best N+", known SEO domains
  - Fallback: RSS feeds (2 interest words + 2 theme words)
  - Last resort: a third paper (same scoring as Step 3)
- **Content mix <15 (all-research mode):** Third paper using the third search query, same scoring.

### Step 5: Synthesize
- Pass all items + central question as the theme.
- ONE AI call for: summaries, key findings, narrative synthesis, keyConcepts.
- Synthesis frames each item as a LENS on the central question, not a sequential story.
- Ends with a specific "where to go deeper" pointer.

## Total AI calls: 2
1. Step 1: Generate central question + search queries
2. Step 5: Synthesize all items

---

## Validation gates

| Gate | Threshold | Applied at |
|------|-----------|-----------|
| Theme similarity | cosine > 0.25 (SIM_ONTOPIC) | Step 3 paper selection |
| Theme similarity fallback | cosine > 0.15 (SIM_FALLBACK) | Step 3 if no papers pass primary threshold |
| News interest match | ≥40% of interest words in title+snippet | Step 4 web results |
| News RSS | 2 interest words + 2 theme words | Step 4 RSS fallback |
| Cross-digest dedup | last 30 days only | Step 2 candidate filtering |

---

## `searchPapers()` — source priority

1. **OpenAlex with field filter** — 250M papers, no rate limits. Preferred.
2. **OpenAlex without field filter** — retry if field filter returns 0 (concept taxonomy mismatch).
3. **Semantic Scholar** — rate-limited at 1 req/sec on free tier.
4. **arXiv** — last resort, no field filter.

---

## Learning system

Interests have a `weight` field (default 1.0). Weights affect how often an interest is selected:

| Signal | Effect | Cap |
|--------|--------|-----|
| Star on paper | +0.5 to paper's keywords as interests | 3.0 |
| Dislike on paper | -0.2 to paper's keywords | floor 0 |
| Q&A question (per 3) | +0.3 to paper's keywords | 3.0 |
| Synthesis chat question | +0.15 to best-matching interest | 3.0 |
| Daily decay | ×0.95 applied each digest generation | — |

---

## Cross-digest deduplication

At the start of each generation, paper titles from the last 30 days of digests are loaded into `seenPaperTitles`. Any candidate paper already seen is skipped. Time limit of 30 days prevents pool exhaustion for long-term users.

---

## Web search for news
- Primary: Serper.dev (Google news search, free tier 2500 queries/month). Set `SERPER_API_KEY` env var.
- Fallback: DuckDuckGo HTML search (no key, less reliable)
- Further fallback: RSS feeds (TechCrunch, Ars Technica, Wired)
- Last resort: substitute a third academic paper

---

## Synthesis tone
- Today's central question is the spine. Every paper is a lens on that question.
- Papers don't answer the question — they give us tools to think about it.
- Define jargon immediately when first used.
- ALWAYS mention the year each paper was published.
- End with a specific "go look into X — that's where Y" pointer. Not generic.
- NO em dashes, NO filler phrases ("so basically", "what's wild is", "demonstrates", "reveals").

---

## Known limitations

1. **LLM determinism**: The central question generation may produce different themes on regeneration for the same user on the same day (LLM is not deterministic). This is acceptable — regeneration is an explicit user action.
2. **Single-word interests**: "robotics" or "cooking" alone produce a weaker theme than cross-domain combos. The LLM handles this by finding surprising angles within the single domain.
3. **SIM_ONTOPIC threshold**: 0.25 is relatively loose (all-MiniLM-L6-v2 scores). If theme is very abstract ("Can AI be fashionable?"), many tangentially related papers may pass. The synthesis prompt compensates by framing papers as lenses rather than direct answers.
4. **News validation is weaker than paper validation**: Snippets are short and may not contain domain terms. The 40% threshold helps but isn't perfect.
