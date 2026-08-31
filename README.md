# Learning et al.

Your AI research companion: a research paper recommendation and synthesis
system that finds, summarizes, and contrasts papers around your interests.
Every digest starts from a provocative central question, then selects papers as
tools to think with, and writes an argument rather than a book report. Live at
[learningetal.com](https://learningetal.com).

## How it works

- **Theme-first pipeline**: a central question is generated before any paper
  search; papers from OpenAlex, Semantic Scholar, and arXiv are scored by an
  embedding + LLM hybrid and diversified with MMR. See `docs/algorithm.md`.
- **Multi-stage synthesis**: skeleton, prose, critique, revision, coverage
  gate. See `docs/synthesis.md`.
- **A personal vault**: save papers, get a full-text reading walkthrough, ask
  questions, and dig into citing work.
- **Daily digests** by cron, with cadence-aware email via Resend.

## Stack

Next.js 16, Turso (libsql) in production and local SQLite in dev, Drizzle ORM,
Tailwind + shadcn/ui, local embeddings via `@xenova/transformers`, and a
provider-agnostic AI layer (Anthropic, OpenAI, or Gemini-compatible chat
completions).

## Getting started

```bash
npm install
cp .env.example .env.local   # then fill in the variables
npm run dev
```

The required environment variables are documented in `CLAUDE.md` under
"Environment". The short version: `TURSO_DATABASE_URL=file:paper-processor.db`
for local dev, Google OAuth credentials, an `AUTH_SECRET`, a `SERPER_API_KEY`
for news search, and a `CRON_AI_*` provider/model/key trio for server-side
generation.

Push the schema to your local database with `npx drizzle-kit push`.

## Fonts

The two licensed faces (Apercu Pro and Cabinet Grotesk) are not in the repo
and are not covered by the MIT license. The app builds and runs with system
fallbacks without them; see `public/fonts/README.md` for how deploys fetch
them and what to swap in if you fork without an Apercu license.

## License

MIT, except the fonts as noted above. See `LICENSE`.
