# Learning et al.

## Project Overview
Your AI research companion — a research paper recommendation and synthesis system that finds, summarizes, and contrasts papers based on user interests. Users can ask questions about papers and build a personal knowledge vault.

## Design Principles
- **Act as a UX expert** when designing flows — intuitive, minimal friction, delightful interactions
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
