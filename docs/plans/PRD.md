# Paper Processor — PRD

## Vision
A personal research assistant that finds, synthesizes, and contrasts research papers and news articles based on your evolving interests. No reading required — the AI does the heavy lifting.

## Users
- Primary: 1 power user (you)
- Scale target: 20-100 casual users
- Auth: Session-based for MVP, Google login P2

---

## MVP Features

### 1. Onboarding
- **API key entry** — front and center on first visit, persists for session
- **Seed interests** — user enters 3-5 short strings (3-5 words each) describing current interests
- No account creation needed for MVP

### 2. Daily Digest (auto-generated at 5am user-local time)
- **3 research papers** (arXiv) + **3 news articles** (RSS: TechCrunch, Ars Technica, etc.)
- Papers selected to show **contrasting perspectives** on user's interests
- Full PDF downloaded and parsed — text stored in DB
- AI synthesis pre-computed in a **single API call** (all summaries, keywords, synthesis at once):
  - Summary of each paper/article (2-3 sentences)
  - Keywords per paper (3-5 topics)
  - **Conversational synthesis**: starts with a theme line ("Today's theme: can agents think for themselves?"), then 4-6 casual sentences briefing the user like a smart friend. Opinionated, not academic.
  - **Key concepts extracted as clickable tags** — rectangular bordered tags using accent colors, clicking filters/highlights related cards
- **UI**: Brutalist research archive aesthetic — sidebar (33%) with paper cards, canvas area (66%) with knowledge graph (45%) and synthesis panel (55%)

### 3. Paper/Article Detail View
- Full AI synthesis displayed
- **Star button** — signals "dig deeper in this topic"
- **Dislike button** — opens a small "why?" text input, shows "Thanks, we'll consider this"
- **Q&A chat interface**:
  - User asks questions about the paper
  - AI responds with full paper text as context
  - Q&A pairs saved and displayed in collapsible thread UI
  - Visible when user returns to that paper later

### 4. Vault (formerly "Learn")
- All past papers and articles accumulated over time
- **UI**: Card thumbnails with pagination, browsable/searchable
- **Compare mode**: Select 2-3 items → AI generates on-demand comparison
  - Highlights agreements, disagreements, complementary findings
  - ~15-30 sec generation time with loading state

### 5. Interest Engine
- Weighted keyword list stored per user
- **Boost signals**:
  - Star a paper → extract top keywords, increase weight
  - High Q&A engagement (many questions) → same boost, scaled by question count
- **Dampen signals**:
  - Dislike with reason → slight negative weight on paper's keywords
- **Decay**: Older signals fade over time so feed evolves
- Daily search queries built from top-N weighted keywords

---

### 6. Knowledge Graph Visualization
- Small interactive node graph on the Today page
- **Nodes** = keywords/topics from your interest profile
- **Edges** = connections between topics (shared across papers)
- Grows over time as you engage — visual representation of what you've learned
- Color-coded by source type (arXiv vs RSS)
- Clicking a node highlights related cards
- ~250x250px widget, top-right of Today page
- Library: something lightweight like react-force-graph or d3-force

---

## UI/UX Principles
- **Thumbnails everywhere** — cards with paper title, source icon, 1-line summary
- **Pagination** — small page nav for both daily digest and vault
- **No friction** — API key → interests → done, see your first digest
- **Collapsible Q&A** — intuitive accordion/thread UI that persists
- **Feedback is soft** — dislike never removes content, just says "thanks"

---

## Data Model

### Users
- id, created_at, api_key (encrypted), ai_provider, timezone

### Interests
- id, user_id, keyword, weight, source (seed | star | engagement | dislike), created_at, updated_at

### Digests
- id, user_id, date, created_at

### Papers
- id, digest_id, title, authors, abstract, full_text, source (arxiv | rss), source_url, pdf_url, thumbnail_url, created_at

### Syntheses
- id, digest_id, content (the AI-generated contrast/summary), created_at

### QAPairs
- id, paper_id, user_id, question, answer, created_at

### Feedback
- id, paper_id, user_id, type (star | dislike), reason (nullable), created_at

### Comparisons
- id, user_id, paper_ids (JSON array), content, created_at

---

## Technical Architecture

### Stack
- Next.js 14+ (App Router)
- SQLite + Drizzle ORM
- Tailwind CSS + shadcn/ui
- PDF parsing: pdf-parse
- arXiv: REST API
- RSS: rss-parser
- AI: OpenAI SDK (works with Claude/GPT via base URL swap)

### Cron / Scheduling
- MVP: node-cron or similar in-process scheduler
- Runs at 5am user-local time
- Pipeline: fetch → download PDFs → parse → synthesize → store

### API Key Handling
- MVP: stored in localStorage, sent with each request
- P2: stored encrypted in DB per user after login

---

## P2 Features (Post-MVP)
- Google login
- News API integration (broader article sources)
- Email digest notifications
- Export/share comparisons
- Interest profile visualization
- Collaborative vaults
