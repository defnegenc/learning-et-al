# Paper Processor

## Project Overview
A research paper recommendation and synthesis system that finds, summarizes, and contrasts papers based on user interests. Users can ask questions about papers and build a personal knowledge vault.

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
| 2026-03-16 | Initial project setup | In Progress |
| 2026-03-16 | PRD written | Done |
| 2026-03-16 | Implementation plan written | Done |

## Mistakes Log
| Date | Mistake | Lesson |
|------|---------|--------|
| | | |
