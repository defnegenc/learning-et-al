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
| 2026-03-24 | DDG hardened: User-Agent rotation, 10s timeout, structured error logging | Done |
| 2026-03-24 | Dynamic RSS feeds: field-specific feeds + Google News RSS by topic | Done |
| 2026-03-24 | Richer feedback: events store paper category, source, year, keywords, cross-domain flag | Done |
| 2026-03-24 | Dynamic item count: paper:news ratio adapts to candidate quality (3+0 / 2+1 / 1+2) | Done |
| 2026-03-24 | Temporal awareness: trending headlines injected into theme generation prompt | Done |
| 2026-03-24 | Configurable embedding model via EMBEDDING_MODEL env var (bge-small-en-v1.5 available) | Done |
| 2026-03-24 | Prompt tightening: ban jargon in themes, dinner table test, anti-redundancy in selection | Done |
| 2026-03-24 | Selection skeleton: explicit "drop papers that agree" + staleness guard for >5yr papers | Done |
| 2026-03-24 | Re-ranking: expanded scoring rubric, penalizes redundancy and staleness | Done |
| 2026-03-24 | Stage B skeleton: redundancy detection, honest tension instruction | Done |
| 2026-03-24 | Full cross-audit: algorithm.md, synthesis.md, synthesis-review.md, algo-audit.md reconciled with actual code | Done |
| 2026-06-11 | Fix synthesis flattening: blank lines no longer detach bullet details (prod text-duplication bug) | Done |
| 2026-06-11 | Revert verbose "guided digest" synthesis structure to compact intro/bullet/closing format (too long, redundant) | Done |
| 2026-06-12 | Brief mode (?brief=1) restyled to match the /prototype/brief presentation: multi-paragraph answers with bold phrases, sentence-by-sentence reveal, replayed thinking trace, richer source cards | Done |
| 2026-06-12 | Brief mode preloads the first 3 seed threads on page load — agent runs while the reader reads the synthesis, so opening a thread is instant | Done |
| 2026-06-13 | Brief mode now renders the full dig-through experience (BriefDigest): scroll-revealed verdict, paper cards revealed inline on first mention, then agentic threads — replaces the normal synthesis + side rail when ?brief=1 | Done |
| 2026-06-13 | Extracted splitSynthesisTheme / flattenSynthesis / resolvePaperFromBold from SynthesisBanner so brief mode reuses the exact paper-matching (handles both [Source N] and fuzzy bold-name digest formats) | Done |
| 2026-06-13 | Fix daily cron starving users past the execution-time cutoff: set maxDuration, process most-stale-first, surface processed counts | Done |
| 2026-06-13 | Email only the admin from the cron (generation still runs for all); removed hardcoded test-email gate | Done |
| 2026-06-13 | Fix brief verdict reveal deadlock on short content (scroll-gated → timed sentence reveal) | Done |
| 2026-06-13 | Papers mode (?papers=1): paper-first experience — verdict + 3 cards (summary + "why it's here") you interrogate via the thread agent seeded with focusPaperId. Behind its own flag to compare against ?brief=1. Spec in docs/superpowers/specs/2026-06-13-papers-mode-design.md | Done |
| 2026-06-16 | Brief is now the DEFAULT experience (off the ?brief=1 flag): source-by-source reveal → compare the three (with generated "how they differ" contrast) → dig-deeper agentic threads with colour-coded papers + paper trail. ?classic=1 falls back to the original synthesis + paper-rail view; ?papers=1 / ?papersog=1 remain as comparison variants | Done |
| 2026-07-05 | Raised interest cap 20 → 30 (single MAX_INTERESTS constant) and added an at-max warning banner + dimmed/disabled unselected tags in the interest ledger, so hitting the cap gives feedback instead of failing silently. Applies to both settings and onboarding | Done |
