# Learning et al.

## Project Overview
Your AI research companion — a research paper recommendation and synthesis system that finds, summarizes, and contrasts papers based on user interests. Users can ask questions about papers and build a personal knowledge vault. Live at **learningetal.com**.

## Commands
```bash
npm run dev          # Start dev server (Next.js 16 + Turbopack)
npm run build        # Production build
npm run lint         # ESLint
npx drizzle-kit push # Push schema changes to DB
npx drizzle-kit generate  # Generate migration files
```
No test suite yet — test manually via the UI.

## Environment
Copy `.env.example` to `.env.local`. Required variables:
- `TURSO_DATABASE_URL` — `file:paper-processor.db` for local dev, Turso URL for prod
- `TURSO_AUTH_TOKEN` — Turso auth token (prod only)
- `SERPER_API_KEY` — Google search API for news
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — Google OAuth
- `AUTH_SECRET` — NextAuth.js secret
- `ADMIN_USER_ID` — User ID whose digest is shown to logged-out visitors
- `CRON_AI_KEY` — API key used by cron for server-side digest generation
- `CRON_AI_PROVIDER` — Provider for cron (default: `gemini`)
- `CRON_AI_MODEL` — Model for cron (default: provider-appropriate)
- `RESEND_API_KEY` — Resend API key for digest emails
- `INVITE_CODE` — Optional invite code for gated access
- `EMBEDDING_MODEL` — Optional override (default: `all-MiniLM-L6-v2`, alt: `bge-small-en-v1.5`)

## Architecture
```
src/
├── app/                    # Next.js App Router
│   ├── page.tsx            # Main entry — renders today's digest or onboarding
│   ├── api/                # API routes (digest, feedback, qa, vault, setup, etc.)
│   └── auth/               # NextAuth catch-all — DO NOT add routes here
├── components/
│   ├── today/              # Digest view: synthesis, paper cards, dig deeper
│   ├── vault/              # Vault archive grid + sidebar
│   ├── onboarding.tsx      # API key + interest setup
│   ├── settings-dialog.tsx # Full-screen settings (API, interests, content mix)
│   └── ui/                 # shadcn/ui primitives
└── lib/
    ├── pipeline/           # Core digest generation (digest.ts is the main orchestrator)
    ├── ai/                 # AI provider abstraction (OpenAI/Anthropic/Gemini via OpenAI SDK)
    ├── fetchers/           # Paper sources (OpenAlex, Semantic Scholar, arXiv) + web search
    ├── db/                 # Drizzle schema + queries (schema.ts, queries.ts)
    ├── embeddings.ts       # Local embedding via @xenova/transformers (all-MiniLM-L6-v2)
    ├── bm25.ts             # BM25 + RRF scoring utilities
    ├── venue-quality.ts    # Venue/predatory journal filters and quality boosts
    ├── email.ts            # Digest email via Resend (daily/biweekly/weekly cadence)
    └── auth.ts             # NextAuth config with DrizzleAdapter
```

## Core Product Goal
**Foster curiosity. Surface unexpected things accessibly.**
- The user wants to learn something they didn't already know — not read papers they've already seen.
- A great digest feels like a curious friend explaining something over coffee, not an abstract delivery service.
- Accessible ≠ dumbed down. Define jargon, connect to intuition, respect the user's intelligence.

## THE CORE ALGORITHM — DO NOT DEVIATE
Theme-first, not paper-first. Every digest starts with a provocative **central question** (max 8 words) generated *before* any paper search. Papers are selected as "tools to think with" for that question, not answers to it. Cross-domain combinations are the goal. MMR ensures diversity. Multi-stage synthesis (skeleton → prose → critique → revision → coverage gate) produces arguments, not book reports.

**ALWAYS read `docs/algorithm.md` before modifying the digest pipeline.** It has the full spec, thresholds, and examples.

## Design Principles
- **Act as a UX expert** when designing flows — intuitive, minimal friction, delightful interactions
- **Brutalist research archive aesthetic**: hard borders, box shadows, uppercase mono labels, crosshair cursor, accent colors only in tags. See `docs/design-style.md` for full component specs.
- **Paper cards**: white bg with subtle colored blob pairs (pink+green, blue+yellow, purple+red)
- **Paper names in synthesis**: bold, underlined in blob colors, clickable to open detail
- **Keyword tags**: solid pastel rectangles with black borders (brutalist style)
- **Synthesis concept tags**: same brutalist style, display-only (no click action)
- **Paper detail**: opens inline in canvas (replaces synthesis area), modal on mobile
- **Synthesis must go deep, not just describe.** Find the tension between papers. See `docs/synthesis.md` for synthesis rules + prompt architecture.
- **Hard word hover definitions**: jargon in synthesis shows definitions on hover.
- **Use the best method, not the fastest to implement.** If a proper solution exists (e.g. embedding similarity instead of keyword counting), implement it. Inform the user of costs and trade-offs, but don't default to subpar approaches to save implementation time.
- **Never include news that isn't genuinely related to the research topic.** Better to have 2 good items than 3 with one garbage article. Fall back to a third paper if news search fails.
- MVP first, iterate fast

## Tech Decisions
- Paper source: OpenAlex (primary) → Semantic Scholar → arXiv (fallback chain). News via Serper (Google) / DuckDuckGo web search, with RSS as fallback.
- Tech stack: Next.js 16, Turso (libsql) for prod DB, local SQLite for dev, Drizzle ORM, Tailwind + shadcn/ui
- **Relevance scoring: embedding + LLM hybrid** (`@xenova/transformers` all-MiniLM-L6-v2 for recall, LLM re-ranking for precision). Embeddings find candidates, LLM scores "tool to think with" quality. Do NOT revert to keyword counting.
- **Typography**: Apercu Pro for body text, Space Grotesk for display, IBM Plex Mono for labels
- Daily digest: Vercel Cron at 4am UTC (`vercel.json`), generates for all users + emails based on cadence (daily/biweekly/weekly). Manual "Generate" button for admin.
- Email: Resend integration, cadence-aware (daily = every digest, biweekly = best-of Tue+Fri, weekly = best-of Sunday). "Best" = most recent digest of the period (digest starring was removed).
- Feedback: Users can dislike a paper with optional reason, no control over recommendations. Digest-level feedback via the end-of-digest "Don't like this digest? Regenerate." CTA (reason → hide → force-regenerate).
- Auth: Google OAuth via Auth.js (next-auth v5) with DrizzleAdapter. Public logged-out experience showing admin's digest with pre-generated Q&A.
- AI: Signed-in users generate without entering an API key (server-side `CRON_AI_*` used). BYOK still supported in settings for power users.
- Deployment: Vercel, learningetal.com domain

## Gotchas
- **NEVER create routes inside `/api/auth/`** — the `[...nextauth]` catch-all owns that entire path. Put custom auth-adjacent routes elsewhere (e.g. `/api/logout`).
- **`shortName` rules live in TWO places** — `selectionSkeletonPrompt` AND `skeletonPrompt` in `src/lib/ai/prompts.ts`. If you change one, change the other. They must require plain-language topic names a non-reader instantly understands (no author surnames, acronyms, or title jargon), distinct per paper.
- **`focusLevel` belongs in synthesis, not retrieval.** It's passed via `synthesisCtx` to affect tone and keyword jargon. Do NOT use it to modify search queries — that biases paper type rather than letting the LLM selection decide.
- **Upstream scoring is a filter, not a ranker.** The LLM in `selectionSkeletonPrompt` makes the real quality call. Embedding threshold + MMR just need to deliver a diverse on-topic pool of 6. Don't add heavy signals (institution prestige, topic-trending context) to the scoring chain — they don't move outcomes.
- **HttpOnly cookies CANNOT be cleared from JavaScript.** Always use a server-side route.
- **Default model must match provider.** When returning config from env vars, validate consistency (e.g. don't return a gemini model with anthropic provider).
- **Only call `res.json()` once** per request — second call gets empty body.
- **When adding a new option** (provider, feature flag, etc.), grep for ALL places it needs to appear — config, UI, types.
- **`pdf-parse` is broken with Turbopack** — use `unpdf` instead.
- **Synthesis must use `[Source N]` prefix in bold paper names** — e.g. `**[Source 1] the polyphenols study**`. The frontend relies on this prefix to map highlights to the correct paper. If a pipeline step (especially revision) drops the prefix, highlights break on the site. The coverage gate enforces this.
- **`drizzle-kit push` fails on SQLite schema changes involving primary keys** — SQLite can't ALTER TABLE to drop/recreate PKs. For simple column additions, run `sqlite3 paper-processor.db "ALTER TABLE X ADD COLUMN Y TEXT;"` manually, then push schema to Turso prod separately.
- **Pre-generated answers for logged-out experience** — `suggestedAnswers` are generated at the end of the digest pipeline. If you modify the chat system prompt, also update the answer-generation block in `digest.ts` to stay consistent.
- **To manually trigger a digest locally**: POST `/api/digest/generate` with `{"force":true}` and a valid session cookie, or use the Generate button in the admin UI.

## Docs Reference
| Doc | When to read | When to update |
|-----|-------------|----------------|
| `docs/algorithm.md` | Before modifying the digest pipeline | After any pipeline change |
| `docs/synthesis.md` | Before changing synthesis prompts or tone | After prompt/tone changes |
| `docs/design-decisions.md` | Before making UX/product decisions | After any UX decision |
| `docs/design-style.md` | Before building/modifying UI components | After visual changes |
| `docs/features-todo.md` | When user asks "what's next" or during downtime | When features are added/completed |
| `docs/algo-audit.md` | Before working on algorithm improvements | After fixing audited issues |
| `docs/synthesis-review.md` | Before working on synthesis quality | After synthesis improvements |
| `docs/recsys-literature.md` | When considering recommendation algorithm changes | After new literature review |
| `docs/changelog.md` | For project history reference | After shipping any feature |
| `docs/plans/PRD.md` | For original product requirements | Rarely |

## Feature Planning Process
- Maintain `docs/features-todo.md` as the running list of future features
- Before implementing a feature, plan the best approach — consider UX, architecture, and trade-offs
- Interview the user for ideas: ask clarifying questions, propose 2-3 approaches, get feedback before building
- When there's downtime or the user asks "what's next", reference the features-todo list
- Always think product-first: what makes the user's experience better?

## Context Maintenance Rules
- Always update `docs/algorithm.md` when changing the digest pipeline
- Always update `docs/design-decisions.md` when making UX/product decisions
- Keep a rolling "Top 3 Ideas to Improve" list in `docs/algorithm.md`
- Log what worked AND what didn't work in the relevant docs
- Update `docs/changelog.md` with dates for every new feature
