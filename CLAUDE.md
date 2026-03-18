# Learning et al.

## Project Overview
Your AI research companion — a research paper recommendation and synthesis system that finds, summarizes, and contrasts papers based on user interests. Users can ask questions about papers and build a personal knowledge vault.

## Design Principles
- **Act as a UX expert** when designing flows — intuitive, minimal friction, delightful interactions
- **Brutalist research archive aesthetic**: thin 1.5px borders, no rounded corners, uppercase mono labels, crosshair cursor, #e8e8e8 bg, accent colors only in tags (acid-green, acid-pink, acid-purple, acid-blue, acid-orange)
- **Aura blobs only in knowledge graph** — everything else clean and readable
- **Synthesis tone is conversational** — like briefing a smart friend over coffee, not academic. Theme line + 4-6 casual sentences. Opinionated.
- **Algorithm**: ALWAYS reference `docs/algorithm.md` before modifying the digest pipeline. Search first, theme second. Validate every item for relevance. Never include a paper just to fill a slot.
- MVP first, iterate fast
- Localhost for now, plan for deployment later

## Tech Decisions
- Paper source: arXiv API + RSS feeds (TechCrunch etc.) for MVP, News API as P2
- Tech stack: Next.js, SQLite (Drizzle ORM), Tailwind + shadcn/ui
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

## Not Yet Implemented
- Cron scheduler (5am auto-generation) — currently manual "Generate" button only
- Google login (P2)
- News API integration (P2)

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
