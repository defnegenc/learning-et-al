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
| 2026-07-05 | UX audit fixes: (1) card shows the takeaway (hook + stat) instead of repeating the synthesis's 40-word summary, with a PAPER/NEWS/ARXIV venue label; (2) never narrate irrelevance — re-rank now DROPS a genuinely off-topic paper (relevance=1) when no replacement exists and ≥2 sources remain, and the synthesis/critique prompts ban "doesn't weigh in on the theme"; (3) per-source synthesis bullets capped at 3 sentences; (4) intro no longer restates the gist (leads with the surprise, since the gist already answers above); (5) banned "Researchers…/This study…/A tech outlet…" template openers in summaries + takeaways | Done |
| 2026-07-05 | Cut the compare view from brief mode: removed the "Compare the three" step, the "How they differ" contrast, and the "Three lenses, side by side" cards — didn't fit the conversational-paper direction. Source walk now goes straight into dig deeper | Done |
| 2026-07-05 | Fix manual Generate timing out as "Network error — couldn't reach the server": /api/digest/generate had no maxDuration, so the long pipeline inherited the platform default and got its connection cut. Set maxDuration=300 to match cron | Done |
| 2026-07-05 | Conversational Papers, Build 1 (The Takeaway): each paper now gets a hook (the one surprise), a stat (concrete anchor, nullable), and a "say it like this" line (casual, repeatable) generated in Stage A. Card leads with the hook instead of the flat summary; the detail overlay shows hook → stat → say-it-like-this → expandable abstract. New papers columns takeaway_hook/stat/line; digests.homework_topic added as a nullable hook for the future homework queue. Recall loop / homework UI / audio are separate builds. Spec: docs/superpowers/specs/2026-07-05-conversational-papers-takeaway-design.md | Done |
| 2026-07-05 | Paper detail overlay stopped repeating the card summary: shows a star-marked how-it-relates-to-theme sentence + the expandable abstract, and fixed the color mismatch on agent-found papers (index by id, not reference) | Done |
| 2026-07-05 | Digest readability pass (A–E): zero-click DigestHeader under the title — domain chips (seed interests, colored via field-hierarchy), a one-line gist answer, and a faint curatorial framing line; concrete-noun rule added to the theme prompt; keyConcepts now aggressively captures model names/jargon (RoBERTa, subword tokenization) for hover defs; plain-language paper names shown on cards above the academic title. New digest columns seed_interests/gist/framing + papers.plain_name; gist/framing generated in one call over the final synthesis. Spec: docs/superpowers/specs/2026-07-05-digest-header-gist-hook-design.md | Done |
| 2026-07-18 | Removed the "I pulled N sources" framing line from the digest header — too distracting. DigestHeader now shows chips + gist only; the header AI call is gist-only; digests.framing column kept for old rows but no longer written or rendered | Done |
| 2026-07-19 | Design-system pass: shared primitives in design-system.tsx (Wordmark, NavTab, SectionLabel, PageTitle, ActionButton, TopicChip, AddChip) + extracted SourceCard shared by Today and Vault. Settings header now uses the same Space Grotesk wordmark as the landing header; vault/settings tabs, titles, and buttons unified; interest chips restyled to the soft-tint mock (dashed idle, field-tint selected). Component map in docs/design-style.md | Done |
| 2026-07-19 | Admin: per-user auto-digest pause. users.digest_paused column, cron skips paused users, PATCH /api/admin toggles it, Auto-Digest column with On/Paused toggle in the admin users table. Prod Turso needs: ALTER TABLE users ADD COLUMN digest_paused INTEGER DEFAULT 0 | Done |
| 2026-07-19 | Digest language overhaul: paper card summary rewritten as the reader's main explanation — conversational shape (familiar setup → what they found → why it matters for today's question), MAX 50 words, in SUMMARY RULES (prompts.ts, both digestPrompt and metadataPrompt templates). Brief view now renders the paper card FIRST with its prose paragraph underneath. Cards carry only title+authors+summary; keyword tags (+ add-to-interests) live in the detail overlay | Done |
| 2026-07-19 | Digest readability round 2: (1) inline paper mentions no longer underlined — plain bold, hover-dims, still clickable. (2) Synthesis prose renderer now supports *italics* and, in marker-era digests, treats non-[Source N] bold as strategic emphasis (not a fuzzy paper link). (3) Detail-overlay "how it relates" one-liner hidden (SHOW_RELATES flag, kept as fallback when a paper has no takeaway line). (4) New "relatability" critique dimension in synthesisCritiquePrompt — caps score when a sentence needs a second read or a "you know how..." setup describes an experience people don't actually have; feeds the existing critique→revision pass. SUMMARY RULES relatability note added | Done |
| 2026-07-19 | Card/digest voice split: card summary is now a plain factual TL;DR (what they did + found, MAX 45 words, no rhetorical questions); the conversational "you know how…" hook moved into the synthesis prose via a new RELATABLE HOOK rule. Both bounded by the relatability guard (hooks must be experiences people actually have). Reverts the earlier conversational-card experiment | Done |
| 2026-07-22 | Vault → Reading List + Digest History: vault now shows only bookmarked papers (single save action); paper detail overlay with jargon-annotated abstract (hover defs, cached in papers.abstract_jargon) + on-demand "Explain like I'm five" gist (papers.eli5) via new /api/papers/[id]/insights; two-pane Digest History (chat-style rail + fully-revealed BriefDigest via revealAll); Compare feature and all-papers archive removed; digest starring removed end-to-end (UI, /api/digest/star, email best-of now = most recent); hide/regenerate moved from top-bar X to end-of-digest "Don't like this digest? Regenerate." CTA (reason → feedback + hide → force-regenerate); synthesis shortNames switched to plain-language topic names (no author surnames). Prod Turso needs: ALTER TABLE papers ADD COLUMN abstract_jargon TEXT; ALTER TABLE papers ADD COLUMN eli5 TEXT | Done |
| 2026-07-22 | Answer-first brief digest: synthesis now opens with a 2-3 sentence paragraph that answers the central question (no paper refs; revision prompt updated to preserve it), and the brief view shows only that intro first — "Reveal first source →" then "Next source →" paces the studies. Old digests without an intro behave as before | Done |
| 2026-07-22 | Brief paper card redesign: "Study N" chip replaced by the paper's plain name (small, underlined, clickable → detail) with faint authors underneath; summary capped at two sentences (first big bold hero, second normal weight); takeaway stat + key findings moved behind a "See more" toggle as stat chunks with the number pulled out big | Done |
| 2026-07-22 | Brief card v3 (TLDR-only): card shows just the underlined paper name + faint authors, the one big bold TLDR sentence, and the digest prose; the rest of the summary + "The numbers" stat-chunk breakdown moved into the detail overlay the card opens. Inline "See more" removed | Done |
| 2026-07-23 | Brief card v4: authors line gains the year (authors · 2024); "See more ↓" back on the card, revealing up to 4 metric tiles tinted in the card's own palette colors (big pulled-out number + short context text with in-text numbers bolded) plus a "Read paper ↗" button. Detail overlay breakdown unchanged | Done |
| 2026-07-23 | Sourcing quality overhaul (algo-audit Part 6): OpenAlex recent-mode now sorts by relevance_score within the 2-year window (was publication_year — discarded relevance entirely); candidates scored against max(theme, originating-search-query) embedding + BM25 over theme+queries (fixes headline-vs-abstract vocabulary mismatch); cross-digest dedup is now ID-based (papers.open_alex_id) + normalized-title and covers ALL past digests (was exact-title, 30 days); query memory (digests.search_queries) feeds last ~12 queries into the hypothesis prompt to prevent re-searching the same ground; broad fill query varied with theme words (was bare interest = fixed result set); isNewsRelevant word guard now applied to the primary web-news path and the broad news fill (floor raised 0.10 → 0.15); brief card dedupes stat chunks repeating the same headline number. Prod Turso needs: ALTER TABLE digests ADD COLUMN search_queries TEXT; ALTER TABLE papers ADD COLUMN open_alex_id TEXT | Done |
