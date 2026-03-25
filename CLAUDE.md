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
    └── auth.ts             # NextAuth config with DrizzleAdapter
```

## Core Product Goal
**Foster curiosity. Surface unexpected things accessibly.**
- The user wants to learn something they didn't already know — not read papers they've already seen.
- A great digest feels like a curious friend explaining something over coffee, not an abstract delivery service.
- Accessible ≠ dumbed down. Define jargon, connect to intuition, respect the user's intelligence.

## THE CORE ALGORITHM SPIKE — DO NOT DEVIATE
Every digest is built around a single **central question** with wow factor (max 8 words, enforced).

1. **Central question first**: Before searching for a single paper, an LLM picks 1-3 of the user's interests and generates a catchy, surprising question. NOT "Recent AI advances" — YES "Can AI agents be fashionable?" or "What if buildings could sense your mood?"
2. **Cross-domain is the goal**: The best questions combine interests from different domains (AI agents + fashion, robotics + cooking). Queries are distributed across `focusFields[]` so the secondary domain's papers are actually found.
3. **Papers inform, not answer**: Papers don't have to answer the central question. They give the reader TOOLS TO THINK WITH in relation to it. An LLM re-ranking step scores papers on "tool to think with" quality, not just topical similarity.
4. **Tension over agreement**: Paper 2 is found via a counter-query that seeks papers contradicting or complicating paper 1. This creates genuine intellectual tension for synthesis.
5. **Diversity over redundancy**: Papers are selected via MMR (Maximal Marginal Relevance) — balancing theme relevance against inter-paper diversity. No two papers from the same lab/method.
6. **Synthesis = lenses, not sequential**: The synthesis frames each paper as a different angle on the central question, not as a linear story from paper A to B to C.
7. **Theme revision**: After papers are found, the LLM revises the central question to better thread the actual papers together. Theme novelty scoring prevents repetitive patterns across days.

**Examples of great central questions:**
- "Can AI agents be fashionable?" (AI agents + fashion)
- "When will robots cook dinner?" (robotics + cooking)
- "Is code the new poetry?" (programming + creative writing)
- "What if buildings could sense your mood?" (architecture + psychology)
- "Can a machine develop taste?" (AI + aesthetics)

**ALWAYS reference `docs/algorithm.md` before modifying the digest pipeline.**

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
- Daily digest: Auto-generated at 5am user's local time (cron not yet implemented — manual "Generate" button)
- Feedback: Users can dislike a paper with optional reason, no control over recommendations
- Auth: Google OAuth via Auth.js (next-auth v5) with DrizzleAdapter. Public logged-out experience showing admin's digest.
- AI: User-provided API key, model-agnostic (Claude, GPT, Gemini, etc.)
- Deployment: Vercel, learningetal.com domain
- **Not yet implemented**: cron scheduler (5am auto-generation), content mix slider (stored in DB but hardcoded to 2 papers + 1 news), dynamic item count, temporal awareness in themes

## Gotchas
- **NEVER create routes inside `/api/auth/`** — the `[...nextauth]` catch-all owns that entire path. Put custom auth-adjacent routes elsewhere (e.g. `/api/logout`).
- **HttpOnly cookies CANNOT be cleared from JavaScript.** Always use a server-side route.
- **Default model must match provider.** When returning config from env vars, validate consistency (e.g. don't return a gemini model with anthropic provider).
- **Only call `res.json()` once** per request — second call gets empty body.
- **When adding a new option** (provider, feature flag, etc.), grep for ALL places it needs to appear — config, UI, types.
- **`pdf-parse` is broken with Turbopack** — use `unpdf` instead.

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
