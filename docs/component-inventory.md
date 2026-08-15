# Component inventory

Every component, what surface it serves, and whether it's on the design system.
Rewritten 2026-08-14 when the short menu shipped across the product. Update the
status column when you touch one.

**Status key:** ✅ on-system · ⚠️ off-system, needs work · 💀 dead code ·
📋 has a brief

The menu itself lives in Paper (*Brilliant petal* → "Design system — the short
menu"). `docs/design-style.md` is the reader's copy. Neither this file nor that
one overrides Paper.

---

## Shared primitives — `src/components/design-system.tsx`

| Component | What it is | Status |
|-----------|-----------|--------|
| `SPECTRUM` / `wash` / `washSlots` / `wordSlot` | The ten slots and their three indexes — field (fixed), keyword (by hash), card (by position) | ✅ replaced 5 palette tables |
| `PageLoader` | The stamp: 30px square turning in 90° steps, shadow walking spectrum 0/3/6/9. The only page-level loader | ✅ |
| `SiteHeader` | The 52px bar — wordmark left, caller's controls right | ✅ |
| `Wordmark` | Display/SM at 0.12em tracking. A lockup, not a type style | ✅ Space Grotesk retired with it |
| `PageHeader` / `PageTitle` | Display/LG + one Body line | ✅ |
| `Label` | The mono eyebrow — one of two sanctioned mono uses | ✅ new |
| `SectionLabel` | Display/SM where a section needs a name | ✅ |
| `NavTab` | The other sanctioned mono use | ✅ |
| `ActionButton` | Display/SM upper. `primary` / `outline` / `plain` | ✅ folded Button/MD + Button/SM into one size |
| `Card` / `CardGrid` | 2px frame + `5px 5px 0`; `auto-fill minmax(260px, 1fr)` | ✅ |
| `Tag` | Body-face tag, `glass` (on a wash) \| `solid` (hashed slot on white) | ✅ new — replaced `GlassTag`, `KeywordTag`'s styling and the concept-tag lockup |
| `TopicChip` / `AddChip` | Interest-picker units. 2px borders, no radius, body face | ✅ the last rounded corners are gone |
| `Segmented` | The one "pick exactly one" shape | ✅ one size (md) |
| `InkTip` | The one dark tooltip — hard words, a paper's gist, the foundational eye | ✅ new |
| `TextInput` | The one input shape | ✅ new |

## The one paper card — `src/components/paper-card.tsx`

| Export | What it is | Status |
|---|---|---|
| `PaperCard` size `digest` | Title, byline, hero, then findings and takeaway side by side behind one 2px rule; `Read paper` bottom right. No expand control, no tiles | ✅ |
| `PaperCard` size `compact` | The same card smaller — title, byline, tags | ✅ what the rail, the vault and the permalink render |
| `FoundationalMark` (internal) | Gold frame, the label, the eye, the reason rule | ✅ |
| `paperByline` | authors — venue, year. One line, everywhere | ✅ |

## Today — the default (brief) reading path

| Component | Serves | Status |
|-----------|--------|--------|
| `today/today-page.tsx` | Orchestrator for brief + classic | ✅ `InkTitle` at Display/LG (1px stroke), notepad is square, rail renders `PaperCard` compact |
| `today/brief-digest.tsx` | The prose, the paper chips, the term chips | ✅ card extracted to `paper-card.tsx`; highlights are ink underlines |
| `today/digest-header.tsx` | The gist and the addable topic tags | ✅ its local `TopicChip` renamed `AddableTopic` and now uses `Tag` |
| `today/regenerate-cta.tsx` | End-of-digest "don't like this?" | ✅ |
| `today/palettes.ts` | Thin re-export of the design system's stride | ✅ four tables deleted |
| `today/synthesis-text.ts` | Pure parsing helpers, no styling | ✅ |

## Vault

| Component | Serves | Status |
|-----------|--------|--------|
| `vault/vault-page.tsx` | Shell + reading-list grid | ✅ renders `PaperCard` compact |
| `vault/digest-history.tsx` | Two-pane history | ✅ |
| `vault/reading-paper-detail.tsx` | The reading view | ✅ 680px, Display/LG title, `paperByline` |
| ~~`vault/reading-list-card.tsx`~~ | 💀 deleted — the vault renders the digest card |

## Shell, settings, onboarding

| Component | Serves | Status |
|-----------|--------|--------|
| `app-shell.tsx` | Signed-in chrome | ✅ |
| `providers.tsx` | SessionProvider with server-primed session | ✅ no styling |
| `noise-overlay.tsx` | Paper grain | ✅ no colour of its own |
| `settings-dialog.tsx` | Full-screen settings | ✅ Label eyebrow + Display/LG title, "All changes saved" in acid green, "Save interests" |
| `onboarding.tsx` | Interests setup | ✅ provider tabs are `Segmented`, inputs are `TextInput`, buttons are `ActionButton` |
| `interest-ledger.tsx` | The interests panel | ✅ matches the Paper board's vocabulary on the accordion |
| `keyword-tag.tsx` | A keyword anywhere on white | ✅ wraps `Tag` + `InkTip` |
| `admin-dashboard.tsx` | Admin only | ✅ on-system; event kinds take hashed slots rather than a colour table |

## Pages

| Route | Status |
|---|---|
| `app/page.tsx` | ✅ |
| `app/digest/[id]` | ✅ `SiteHeader` + `PaperCard` compact; its own `PaperSourceTab` and two colour tables deleted |
| `app/auth/error` | ✅ was raw monospace on a white page; now on the menu |
| `app/prototype/interests` | ✅ the only prototype left — a live harness for the shipping `InterestLedger`, so it can't drift. The two candidate pickers were deleted once their decisions landed |
| `app/opengraph-image.tsx` (+ `twitter-image`) | ✅ Satori limits documented in design-style.md §7 |

## Non-browser surfaces

| File | Status |
|---|---|
| `lib/email.ts` | ✅ the menu inlined as literals, with the fallbacks named. Must move when `globals.css` moves |

## Classic mode — the one surviving alternate

`?classic=1` → `synthesis-banner.tsx`, lazy-loaded. It stays because
`/digest/[id]` (public permalinks) renders the same `SynthesisBanner`, so the
code is on the critical path for shared links regardless. ✅ now on-system: paper
names are ink underlines, `[N]` citations take the cited card's wash slot,
concept tags are `Tag`, and the "Insight" star is gone (`#FFD700` was never in
the menu).

`?papers=1` and `?papersog=1` were deleted 2026-08-14 along with `papers-mode`,
`papers-mode-og`, `paper-detail`, `qa-thread` and `brief-threads`. Brief won.

## Dead code — deleted

Listed so the history is legible. `git log -S<name>` recovers any of them.

| File | Deleted | Note |
|------|---------|------|
| `today/source-card.tsx` | menu | "The rail card is gone" — the digest card renders smaller instead |
| `vault/reading-list-card.tsx` | menu | Same |
| `PaperSourceTab` (in `digest/[id]`) | menu | A fourth card that nobody knew existed |
| `today/palettes.ts` tables | menu | `SOURCE_PALETTES`, `CARD_PALETTES`, `dispersedWash`, `washStyle`, `hex2rgba` |
| `CATEGORY_PALETTES` | menu | Ten gradient pairs for ten fields that now have one slot each |
| `chipTint` | menu | Chips take the field's slot at full strength |
| `public-digest.tsx`, `today/knowledge-graph.tsx`, `today/synthesis-chat.tsx`, `today/paper-card.tsx` | 2026-08-14 | |
| `today/papers-mode, papers-mode-og, paper-detail, qa-thread, brief-threads` | 2026-08-14 | The `?papers` / `?papersog` experiments |
| `app/prototype/brief` | 2026-08-14 | Superseded prototype |
| `app/prototype/headline` | menu | Ink-fill won and shipped. A candidate picker outlives its use the day the candidate lands |
| `app/prototype/loaders` | menu | The stamp won and is `PageLoader`. Same reason |
| `ui/badge, card, input, scroll-area, separator, sonner, tabs, textarea` | 2026-08-14 | Unused shadcn scaffolding |
| `api/thread`, `api/papers/[id]/blurb`, `api/papers/[id]/related`, `api/email-preview` | 2026-08-14 | Served only the deleted views |
| `lib/ai/agent.ts` | 2026-08-14 | The thread engine behind `/api/thread` |
| Dead exports | 2026-08-14 | `digestPrompt`, `comparisonPrompt`, `getOpenAlexRelatedWorks`, `getS2Recommendations`, `institutionBoost`, `getActiveModel`, `topicColor` |
| Schema | 2026-08-14 | `threadCache`, `comparisons` — **tables still exist in prod**; a future `drizzle-kit push` would drop them |
| Deps | 2026-08-14 | `next-themes`, `node-cron`, `sonner`, `@types/node-cron`. **`shadcn` looks unused but is not** — `globals.css` imports `shadcn/tailwind.css` |

---

## Duplication worth fixing

1. ~~Two wash implementations~~ — fixed, then deleted entirely. One stride.
2. ~~Two `SiteHeader`s~~ — fixed. One primitive.
3. ~~Two `TopicChip`s~~ — fixed. `today/digest-header.tsx`'s is now
   `AddableTopic` and composes the shared `Tag`.
4. ~~Font constants re-declared per file~~ — fixed. `const MONO = …` is gone from
   every surface; they import from `design-system.tsx`.
5. **Two copies of the spectrum outside the system.** `lib/email.ts` and
   `opengraph-image.tsx` inline it, because neither can read a CSS variable.
   Both are commented; both must move when `globals.css` moves. There is no way
   to remove this one — it's a property of the renderers.
