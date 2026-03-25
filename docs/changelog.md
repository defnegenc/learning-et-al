# Feature Log

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
| 2026-03-19 | Citation floor for candidates (>=2 citations) | Done |
| 2026-03-19 | Domain guard via OA primary_topic.domain | Done |
| 2026-03-19 | ArXiv source label detection from OA landing URL | Done |
| 2026-03-19 | Weighted interest rotation (weight-proportional, deterministic seed) | Done |
| 2026-03-19 | Synthesis chat engagement tracking (+0.15 to best-matching interest) | Done |
| 2026-03-19 | Theme-first algorithm: central question before paper search, no anchor paper | Done |
| 2026-03-19 | Cross-domain interest combination for "wow factor" central questions | Done |
| 2026-03-19 | Paper detail redesigned as modal overlay with gradient left panel + notes right panel | Done |
| 2026-03-21 | Theme revision step (LLM revises theme after finding papers) | Done |
| 2026-03-21 | Paper detail as inline canvas view (replaces synthesis area, modal on mobile) | Done |
| 2026-03-21 | Apercu Pro font integration (body), Space Grotesk (display), IBM Plex Mono (labels) | Done |
| 2026-03-21 | Shared PaperCard component (home + vault) | Done |
| 2026-03-21 | Digest starring (gold star, persisted in DB) | Done |
| 2026-03-21 | Paper bookmarks on cards | Done |
| 2026-03-21 | Interest rotation with penalty for recently-used interests | Done |
| 2026-03-21 | Content mix slider (0-100, "Just research" to "Just news", maps to paper/news ratio) | Done |
| 2026-03-21 | Google OAuth via Auth.js (next-auth v5) + public logged-out digest | Done |
| 2026-03-21 | Turso (libsql) for production DB + Vercel deployment | Done |
| 2026-03-21 | News embedding validation (similarity to theme + listicle filter) | Done |
| 2026-03-21 | Dynamic dig deeper questions (brutalist question buttons in black header) | Done |
| 2026-03-21 | Hard word hover definitions in synthesis | Done |
| 2026-03-24 | Algorithm audit: comprehensive review of paper/news sourcing pipeline (docs/algo-audit.md) | Done |
| 2026-03-24 | Fix: fallback papers no longer mislabeled as "news" | Done |
| 2026-03-24 | Fix: dynamic year tokens in news search (was hardcoded 2025/2026) | Done |
| 2026-03-24 | Fix: interest decay only applies once per day (prevents double-decay on regen) | Done |
| 2026-03-24 | Fix: citation floor (>=2) now enforced in OpenAlex queries | Done |
| 2026-03-24 | Fix: ONNX fallback returns 0.1 (was 0.3), adds `isEmbeddingDegraded()` flag | Done |
| 2026-03-24 | Improved article extraction: paragraph density scoring + paywall detection | Done |
| 2026-03-24 | Academic domain filter: 20+ publisher domains excluded from news results | Done |
| 2026-03-24 | Recency penalty now tracks actual paper keywords, not just theme words | Done |
| 2026-03-24 | Multi-field search: `focusFields[]` distributes queries across domains | Done |
| 2026-03-24 | MMR diversity: papers selected by Maximal Marginal Relevance (λ=0.6) | Done |
| 2026-03-24 | Theme validation: max 8 words enforced with LLM retry | Done |
| 2026-03-24 | Theme novelty: rejects themes >0.7 similarity to recent themes | Done |
| 2026-03-24 | Counter-query for tension: LLM generates queries to find contradicting papers | Done |
| 2026-03-24 | LLM re-ranking: shortlisted papers scored 1-5 on "tool to think with" quality | Done |
| 2026-03-24 | Theme revision abstracts extended to 600 chars (was 300) | Done |
