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
| `PageLoader` | The stamp: 30px square turning in 90° steps, shadow walking spectrum 0/3/6/9. The only page-level loader. `travelling` is its one variant — walks a 269px track, shadow stepping the full spectrum 00 → 09, for the first-digest wait | ✅ |
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

## Save NUX — `src/components/save-nux.tsx`

| Component | What it is | Status |
|-----------|-----------|--------|
| `SaveTipStrip` | The band above the digest while a reader has nothing saved. Mono `Tip` eyebrow, one Body sentence, `×`. Self-retires on the first save | ✅ new — nothing new in the menu |
| `FirstSaveConfirmation` | The first-ever save, confirmed, bottom-left: what the librarian is doing and "Go to library →". Mounted on `app-shell` and on `/digest/[id]` | ✅ new — acid green as ink only |
| `useOpenLibrary` | Claims the "go to library" event; unclaimed, it falls back to a real navigation | ✅ |

---

## The one paper card — `src/components/paper-card.tsx`

| Export | What it is | Status |
|---|---|---|
| `PaperCard` size `digest` | Title, byline, hero, then findings and takeaway side by side behind one 2px rule; `Read paper` bottom right. No expand control, no tiles | ✅ |
| `PaperCard` size `compact` | The same card smaller — title, byline, and optionally `preview` (one line of substance, clamped to 3) and `footnote` | ✅ what the rail, the vault and the permalink render; the vault passes the companion's "remember" as `preview` |
| `FoundationalMark` (internal) | Gold frame, the label, the eye, the reason rule | ✅ |
| `paperByline` | authors — venue, year. One line, everywhere | ✅ |

## Today — the default (brief) reading path

| Component | Serves | Status |
|-----------|--------|--------|
| `today/today-page.tsx` | Orchestrator for brief + classic | ✅ `InkTitle` at Display/LG (1px stroke), notepad is square, rail renders `PaperCard` compact; local `BrewingTips` + the first-run no-digest state |
| `first-run-tips.ts` | The eight tips shown while a new user's first digest generates. **Not a component — a maintained content surface**: update it whenever a user-facing feature is added, removed or renamed (rule is in CLAUDE.md too) | ✅ new |
| `today/brief-digest.tsx` | The prose, the paper chips, the term chips | ✅ card extracted to `paper-card.tsx`; highlights are ink underlines |
| `today/digest-header.tsx` | The gist and the addable topic tags | ✅ its local `TopicChip` renamed `AddableTopic` and now uses `Tag` |
| `today/regenerate-cta.tsx` | End-of-digest "don't like this?" | ✅ |
| `today/share-digest-button.tsx` | Native share sheet with clipboard fallback for the canonical digest URL | ✅ |
| `today/palettes.ts` | Thin re-export of the design system's stride | ✅ four tables deleted |
| `today/synthesis-text.ts` | Pure parsing helpers, no styling | ✅ |

## Vault

| Component | Serves | Status |
|-----------|--------|--------|
| `vault/vault-page.tsx` | Shell + library grid | ✅ renders `PaperCard` compact with the companion's "remember" as `preview` and a `ShelfFootnote`; polls while prep is still running; opens on Saved papers when the reader has any, and navigates to `/library/[paperId]` rather than covering itself |
| `vault/digest-history.tsx` | Two-pane history | ✅ |
| `vault/reading-paper-detail.tsx` | The reading view — the body of `/library/[paperId]` | ✅ 1240px two-column, a page rather than a portal overlay. Left: title, the why-you're-reading-this line, five companion beats each selectable for a dig, inline `DigPanel`s, the `Remember this` card frame, `Glossary`, the citing work. Right: `AskThread` in a sticky rail, with a pending state instead of dead air. `Read the full paper` sits opposite Back in a top bar. Takes `index` for the paper's hue |
| `SelectionMenu` / `DigPanel` / `DigThisBeat` (internal to `reading-paper-detail.tsx`) | Highlight to dig deeper: the floating **Dig deeper** · **Ask about this** pair, the wash panel the streamed answer lands in under its beat, and the per-beat touch affordance | ✅ new — the selection is the one sanctioned acid fill (`SELECTION_FILL`); the panel is the paper's wash |
| `FamiliarityScale` / `PitchedForYouLine` (internal to `reading-paper-detail.tsx`) | The skippable 1–5 interleave inside a dig and the tappable structured disclosure/correction control on personalized companion and Q&A output | ✅ composes existing Body/SM, Label, border and ink tokens; no new visual primitive |
| `AskThread` (internal to `reading-paper-detail.tsx`) | The Q&A thread — a 372px framed rail: companion starters as rows, scrolling threads with follow-ups, composer pinned to the foot. Persisted per user, threaded, streamed | ✅ the only typed Q&A surface; digest-level Q&A is gone |
| `Glossary` (internal to `reading-paper-detail.tsx`) | Collapsed `dl` of the companion's hard words | ✅ |
| ~~`vault/reading-list-card.tsx`~~ | 💀 deleted — the vault renders the digest card |

## Shell, settings, onboarding

| Component | Serves | Status |
|-----------|--------|--------|
| `app-shell.tsx` | Signed-in chrome | ✅ |
| `providers.tsx` | SessionProvider with server-primed session; flushes device-backed shared saves after sign-in | ✅ no styling |
| `pending-shared-saves.tsx` | Invisible post-sign-in bridge from local shared saves to account bookmarks/history | ✅ no styling |
| `noise-overlay.tsx` | Paper grain | ✅ no colour of its own |
| `settings-dialog.tsx` | Full-screen settings | ✅ Label eyebrow + Display/LG title, "All changes saved" in acid green, "Save interests" |
| `onboarding.tsx` | Interests setup | ✅ provider tabs are `Segmented`, inputs are `TextInput`, buttons are `ActionButton`; the subtitle carries all three verbs and the footer reaches `WhatIsThis` |
| `interest-ledger.tsx` | The interests panel | ✅ matches the Paper board's vocabulary on the accordion |
| `keyword-tag.tsx` | A keyword anywhere on white | ✅ wraps `Tag` + `InkTip` |
| `what-is-this.tsx` | The one explainer — trigger plus popup, three beats. Two variants: `public` is an `i` icon beside Share (Today's eyebrow row and the permalink header, logged out only) closing on Sign in; `onboarding` is a text "What happens next?" in the interest-step footer, closing on how long the first digest takes. Same three beats either way | ✅ composition only, no new tokens: the Card frame on `ui/dialog`, Display/LG title, Display/SM beats, and real selected `TopicChip`s taking their fill from `FIELD_HIERARCHY` |
| `admin-dashboard.tsx` | Admin only | ✅ on-system; event kinds take hashed slots rather than a colour table |

## Pages

| Route | Status |
|---|---|
| `app/page.tsx` | ✅ |
| `app/digest/[id]` | ✅ `SiteHeader` + `PaperCard` compact; Share + Sign in/Open app actions; account or device-backed bookmarks; digest-specific social metadata |
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
