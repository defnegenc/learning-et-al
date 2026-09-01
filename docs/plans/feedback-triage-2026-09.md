# Feedback triage plan (Sep 1, 2026)

Source: `learningetal-feedback.md`, the cumulative external review log (deep audit Aug 26, security review Aug 26, prompt diagnosis Aug 28, UX review Aug 28, daily reviews Aug 26-31). This plan maps findings to root causes verified in the code and groups the remaining work into PR-sized workstreams.

## Decisions made (Sep 1)

- **suggestedQuestions stays.** Do not cut the field; a background use may come later. Rendering it on the shared page (UX review idea) is still an open product call.
- **seedInterests removed from the public payload.** Done in the security PR.
- **Stage A completeness gate is assigned to a separate agent** and is out of scope for this plan. That covers the skeleton-paper bug and the Aug 31 forced-regen regressions (`digest.ts:2252` empty-metadata fallback, `digest.ts:2579` per-item fallback).

## Done

### Security PR (Workstream B, shipped Sep 1)

- **Public payload whitelist.** `/api/public/digest` no longer spreads the digest row; it returns only id, date, theme, synthesisContent, gist, starred, createdAt, keyConcepts, suggestedQuestions, suggestedAnswers. Dropped: userId, notes, seedInterests, seedTopic, workingTheme, themeCandidates, framing, homeworkTopic, searchQueries, hidden. Paper columns were already whitelisted via `LIST_COLUMNS` and contain no private data.
- **Hidden digests excluded** from the public latest-digest and archive-list queries (a digest hidden mid-regeneration was previously servable). Direct `?digestId=` permalinks stay reachable on purpose.
- **Security headers** on every response via `next.config.ts` `headers()`: CSP (self plus Fontshare styles/fonts, googleusercontent avatars, unsafe-inline for Next's bootstrap and style attributes; frame-ancestors 'none'), X-Frame-Options DENY, nosniff, Referrer-Policy strict-origin-when-cross-origin, Permissions-Policy, HSTS with includeSubDomains. `poweredByHeader: false`.
- **`/api/papers/bookmarks` returns 401** without a session (all four callers already guard non-ok responses).
- **Sitemap `/vault` entry removed** (it 404s; vault is a client-side tab, not a route).
- Verified during the same pass: `/api/admin/check` already returns 403 anonymously (fixed since the Aug 26 review), and paper dedupe (audit #6) was already fixed upstream (dedupes all history by normalized title + OpenAlex ID, `digest.ts:728-737`).

### RSS feed (E9, shipped Sep 1)

- **`/feed.xml`** is an RSS 2.0 route over the public editions: the same non-hidden admin rows `/api/public/digests` serves, newest 20, with the central question as the item title, the gist as the summary, the paper titles the edition was built from, and a link to `/digest/<id>`. XML-escaped, HTML body in CDATA (the terminator is neutralised), missing theme falls back to "Learning et al., <date>". Cached `s-maxage=1800` like the other public endpoints, `dynamic = "force-dynamic"` so the build does not need the database. Autodiscovery via `alternates.types` in the root metadata. Verified end to end against a scratch SQLite database: hidden editions excluded, escaping correct, link tag rendered.

### Not done from the security review, deliberately

- **security.txt**: needs a contact address choice from Defne.
- **HSTS preload**: needs a long-term commitment; includeSubDomains shipped without it.
- **Active review of `validate-code`** (rate limiting, code entropy): the reviewer flagged it as the next probe target; needs explicit permission and its own pass.
- **CSP hardening with nonces** (dropping 'unsafe-inline' for scripts): possible later; low marginal value while there are no third-party scripts.

## Remaining work

### Workstream A: Pipeline trust

1. ~~Completeness gate~~ (separate agent, see decisions above).
2. **One edition per date.** `digest.ts:675` returns the existing digest unless `force`, but `force` appends a new row instead of replacing, and nothing locks concurrent runs (Aug 31 pair fired 2 minutes apart via the per-hour `/api/cron/digests/*` routes). Add a uniqueness guard on (userId, date), either a DB unique index or a claim-row at run start, and make `force` supersede the same-day digest instead of appending. Coordinate with the Stage A agent to avoid conflicting edits in `generateDigest`.
3. **Stat grounding.** Prompt: `takeaway.stat` may only contain numbers present verbatim in the provided abstract, else null; no unit or qualifier the abstract does not state. Code gate: reject any stat whose digits do not appear in the abstract (house rule: every copy rule gets a code enforcement layer, like `banned-words.ts`).

### Workstream C: Copy and format quality (prompt + code gates)

4. **Orphaned blockquotes** (27/30 editions). Prompt: transitions must be complete standalone sentences in plain paragraphs, no blockquote marker, no lowercase leading conjunction. Code gate: scrub or unwrap `> ` lines in synthesis before save, same layering as `stripBannedWords`.
5. **methodType closed vocabulary.** The prompt gives examples but allows "1-3 plain words". Switch to a closed enum plus a normalization map in code (Review paper/Literature review/Systematic review all map to Review, etc.).
6. **Formulaic gist openers.** Do NOT take the diagnosis's suggested fix of making all theme questions open-ended: the Aug 30 daily review found the opposite (the "what actually helps" question was the weak one; either/or tension questions produced the better gists). Keep tension questions; forbid verdict-word openers ("Yes", "Sort of:") in the prompt and add a cheap opener-variety check against recent digests.
7. **Dead fields.** Remove `dinnerLine`, `relatesLine`, `framing`, `homeworkTopic` from prompts, types, and payloads (schema columns can stay for legacy rows). `takeawayHook` vs `takeawayLine` near-duplication: pick one, cut the other from the prompt. `suggestedQuestions`/`suggestedAnswers` stay (see decisions).

### Workstream D: Source quality

8. **Publisher-level predatory matching.** SCIRP is already in `PREDATORY_VENUES` (`venue-quality.ts:74`) but the matcher checks the journal-name string, so publisher-owned journals like "Art and Design Review" evade it. Match against the OpenAlex host organization / publisher; add IJSRA, WJAETS, ShodhKosh entries; consider a hard gate at candidate-pool time rather than a score penalty. Separately investigate why 97% of papers arrive via Semantic Scholar when OpenAlex is the primary source.

### Workstream E: Distribution / SEO

9. ~~**RSS/Atom feed** at `/feed.xml` from the public digests.~~ Shipped Sep 1, see Done above.
10. **Server-render `/digest/[id]` + real sitemap.** The permalink page is `"use client"` + API fetch; convert to a server component that reads the DB directly (keep interactivity in client children), then emit per-edition sitemap entries.

### Workstream F: Shared-link UX (read the Paper design board first)

11. **The deck on the shared page.** Reuse the homepage one-paper-at-a-time deck (or add a progress rail) on `/digest/[id]`. The reviewer calls this the highest-leverage UX fix.
12. **No dead ends.** Prev/next edition navigation on `/digest/[id]` and an end-of-digest block: archive link plus sign-up CTA.
13. **Mobile ergonomics.** Tap targets to 44px (SHARE, Save, info icons); revisit the 390px header cramming.
14. **Verify anonymous Save.** Device-level saves exist (`shared-saves.ts`, `FirstSaveConfirmation`); confirm a logged-out visitor from a shared link does not hit a login wall.

## Product decisions still open

- **suggestedQuestions surface**: field stays; whether to render as tappable end-of-edition cards is undecided.
- **Theme question direction**: confirm keeping tension/either-or questions (per Aug 30 evidence) over the diagnosis's open-ended suggestion.

## Explicitly out of scope

- The theme-selection step (themeCandidates, cold-read, wouldWonder, stakes). The reviewer: "Themes are the product... don't touch it while fixing the rest."
- Stage A completeness gate (separate agent).
- Active security probing of the login flow (needs explicit permission).

## Suggested PR sequence for the remaining work

| # | Contents | Why this order |
|---|----------|----------------|
| 1 | A2 (idempotency) | Reader trust; coordinate with the Stage A agent's changes |
| 2 | A3 + C4 + C5 (stat gate, blockquote scrub, methodType enum) | All prompt-plus-code-gate changes to the same pipeline stage |
| 3 | C7 (dead fields) + C6 (gist variety) | Touches prompts and schema broadly; easier after 2 lands |
| 4 | D8 (venue matching) | Isolated in venue-quality.ts + fetcher ordering |
| ~~5~~ | ~~E9 (RSS)~~ | Shipped Sep 1 |
| 6 | E10 (SSR permalink + sitemap) | Bigger refactor of the permalink page |
| 7 | F11-F14 (shared-link UX) | Needs the Paper board and a design pass first |

Docs to update as these land: `docs/algorithm.md` (A, C, D), `docs/changelog.md` (all), `docs/design-decisions.md` (F), `src/components/first-run-tips.ts` if any user-facing surface changes.
