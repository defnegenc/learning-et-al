# Learning et al.

## Project Overview
Your AI research companion — a research paper recommendation and synthesis system that finds, summarizes, and contrasts papers based on user interests. Users can ask questions about papers and build a personal knowledge vault.

## Core Product Goal
**Foster curiosity. Surface unexpected things accessibly.**
- The user wants to learn something they didn't already know — not read papers they've already seen.
- A great digest feels like a curious friend explaining something over coffee, not an abstract delivery service.
- Accessible ≠ dumbed down. Define jargon, connect to intuition, respect the user's intelligence.

## THE CORE ALGORITHM SPIKE — DO NOT DEVIATE
Every digest is built around a single **central question** with wow factor.

1. **Central question first**: Before searching for a single paper, an LLM picks 1-3 of the user's interests and generates a catchy, surprising question. NOT "Recent AI advances" — YES "Can AI agents be fashionable?" or "What if buildings could sense your mood?"
2. **Cross-domain is the goal**: The best questions combine interests from different domains (AI agents + fashion, robotics + cooking). Same-domain interests can work too but the question must still have surprise value.
3. **Papers inform, not answer**: Papers don't have to answer the central question. They give the reader TOOLS TO THINK WITH in relation to it. A paper on AI bias can inform "Can AI be fashionable?" even if it's not about fashion.
4. **NO anchor paper, NO citation graph**: We search for papers using LLM-generated queries built around the central question. All papers are scored equally by embedding similarity to the question. There is no "anchor" or "recommendation graph."
5. **Synthesis = lenses, not sequential**: The synthesis frames each paper as a different angle on the central question, not as a linear story from paper A to B to C.

**Examples of great central questions:**
- "Can AI agents be fashionable?" (AI agents + fashion)
- "When will robots cook dinner?" (robotics + cooking)
- "Is code the new poetry?" (programming + creative writing)
- "What if buildings could sense your mood?" (architecture + psychology)
- "Can a machine develop taste?" (AI + aesthetics)

**ALWAYS reference `docs/algorithm.md` before modifying the digest pipeline.**

## Design Principles
- **Act as a UX expert** when designing flows — intuitive, minimal friction, delightful interactions
- **Brutalist research archive aesthetic**: thin 1.5px borders, no rounded corners, uppercase mono labels, crosshair cursor, #e8e8e8 bg, accent colors only in tags (acid-green, acid-pink, acid-purple, acid-blue, acid-orange)
- **Aura blobs only in synthesis/chat area** — everything else clean and readable
- **Synthesis must go deep, not just describe.** Find the tension between papers. Paper A says X works. Paper B found X breaks when Y. That matters because Z. End with a genuinely hard question.
- **Algorithm**: ALWAYS reference `docs/algorithm.md` before modifying the digest pipeline. Never include a paper just to fill a slot.
- **Use the best method, not the fastest to implement.** If a proper solution exists (e.g. embedding similarity instead of keyword counting, proper type filtering instead of heuristics), implement it. Inform the user of costs and trade-offs, but don't default to subpar approaches to save implementation time.
- **Never include news that isn't genuinely related to the research topic.** Better to have 2 good items than 3 with one garbage article. Fall back to a third paper if news search fails.
- MVP first, iterate fast
- Localhost for now, plan for deployment later

## Tech Decisions
- Paper source: Semantic Scholar + arXiv APIs (via OpenAlex primarily). News via Serper (Google) / DuckDuckGo web search, with RSS as fallback.
- Tech stack: Next.js, SQLite (Drizzle ORM), Tailwind + shadcn/ui
- **Relevance scoring: embedding-based** (`@xenova/transformers`, `all-MiniLM-L6-v2`, runs locally, no API key). Do NOT revert to keyword counting.
- Daily digest: Auto-generated at 5am user's local time
- Feedback: Users can dislike a paper with optional reason, no control over recommendations
- Auth: None for MVP, plan for Google login
- AI: User-provided API key, model-agnostic (Claude, GPT, etc.)

## Feature Log
| Date | Feature | Status |
|------|---------|--------|
| 2026-03-16 | Initial project setup | Done |
| 2026-03-16 | PRD written | Done |
| 2026-03-16 | Implementation plan written | Done |
| 2026-03-16 | DB schema + Drizzle ORM | Done |
| 2026-03-16 | AI provider abstraction (OpenAI/Anthropic/custom) | Done |
| 2026-03-16 | Fetcher pipeline (arXiv + RSS + PDF parsing) | Done |
| 2026-03-16 | All API routes (setup, digest, Q&A, feedback, vault, compare) | Done |
| 2026-03-16 | Onboarding UI (API key + interests) | Done |
| 2026-03-16 | Today page (cards, synthesis banner, knowledge graph) | Done |
| 2026-03-16 | Paper detail view + Q&A thread | Done |
| 2026-03-16 | Vault page + compare mode | Done |
| 2026-03-16 | Engagement-based interest boosting | Done |
| 2026-03-16 | Interest decay (5% daily) | Done |
| 2026-03-16 | Synthesis markdown rendering | Done |
| 2026-03-16 | Gemini as first-class provider | Done |
| 2026-03-16 | Settings dialog (change API key/provider anytime) | Done |
| 2026-03-16 | Fixed PDF parsing (swapped pdf-parse for unpdf) | Done |
| 2026-03-16 | Single AI call digest pipeline (was 7 calls, now 1) | Done |
| 2026-03-16 | Conversational synthesis tone with theme line | Done |
| 2026-03-16 | Brutalist research archive UI restyle | Done |
| 2026-03-16 | Vault archive grid with 1:1 cards and sidebar | Done |
| 2026-03-17 | Deep cleanup: remove dead code, unused CSS, unused prompts | Done |
| 2026-03-17 | Synthesis prompt rewritten for depth (tension, not description) | Done |
| 2026-03-17 | Paper names in synthesis styled as inline tags (mono, uppercase, bordered) | Done |
| 2026-03-17 | Web search (Serper/DDG) replacing RSS as primary news source | Done |
| 2026-03-17 | Fall-back-to-third-paper strategy when no relevant news found | Done |
| 2026-03-17 | News validation: must match domain-specific interest terms | Done |
| 2026-03-19 | Embedding-based relevance (all-MiniLM-L6-v2, local, no API key) | Done |
| 2026-03-19 | Semantic interest clustering: pick 2-3 related interests daily, not 1 + arbitrary siblings | Done |
| 2026-03-19 | OpenAlex type filter (article/preprint only, excludes dissertations) | Done |
| 2026-03-19 | Citation floor for candidates (≥2 citations) | Done |
| 2026-03-19 | Domain guard via OA primary_topic.domain | Done |
| 2026-03-19 | ArXiv source label detection from OA landing URL | Done |
| 2026-03-19 | Weighted interest rotation (weight-proportional, deterministic seed) | Done |
| 2026-03-19 | Synthesis chat engagement tracking (+0.15 to best-matching interest) | Done |
| 2026-03-19 | Theme-first algorithm: central question before paper search, no anchor paper | Done |
| 2026-03-19 | Cross-domain interest combination for "wow factor" central questions | Done |
| 2026-03-19 | Paper detail redesigned as modal overlay with gradient left panel + notes right panel | Done |

## Not Yet Implemented
- Cron scheduler (5am auto-generation) — currently manual "Generate" button only
- Google login (P2)

## Mistakes Log
| Date | Mistake | Lesson |
|------|---------|--------|
| 2026-03-16 | QA API returned `qaPairs`/`qaPair` but client read `data.qa` | Always verify API response field names match client expectations |
| 2026-03-16 | Synthesis banner rendered markdown as plain text | AI-generated content needs a markdown renderer, not raw `<p>` tags |
| 2026-03-16 | Vault star/dislike were no-op empty functions | When reusing components across pages, wire up all handlers |
| 2026-03-16 | Interest decay was specified in PRD but not implemented | Cross-check PRD features against actual implementation before calling done |
| 2026-03-16 | No way to change API key after onboarding | Always provide a settings escape hatch for credentials |
| 2026-03-16 | pdf-parse broken with Turbopack (worker module missing) | Use unpdf instead — works with modern bundlers |
| 2026-03-16 | Gemini wasn't a provider option, user had to figure out base URL | Add common providers as first-class options, don't make users configure URLs |
| 2026-03-16 | Gemini added to provider config but button never rendered in onboarding UI | When adding a new option, grep for ALL places it needs to appear — config, UI, types |
| 2026-03-16 | Double res.json() call in onboarding — second call got empty body | Only call res.json() once, store the result |
