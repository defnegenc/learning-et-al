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

Body text is Hanken Grotesk (OFL) via `next/font`; labels are Geist Mono. The
display face, Cabinet Grotesk, is free from Fontshare but its license forbids
redistributing the files, so they are not in the repo: the app builds and runs
with system fallbacks without them, and deploys fetch them from a private
`FONTS_BASE_URL`. See `public/fonts/README.md`.

## License

The code is MIT (see `LICENSE`). The fonts are not: Cabinet Grotesk is not in
the repo and may not be redistributed, and the committed Hanken Grotesk file
carries its own SIL Open Font License. See `public/fonts/README.md`.
