# Component inventory

Every component, what surface it serves, and whether it's on the design system.
Audited 2026-08-14. Update the status column when you touch one.

**Status key:** ✅ on-system · ⚠️ off-system, needs work · 💀 dead code ·
📋 has a brief

---

## Shared primitives — `src/components/design-system.tsx`

| Component | What it is | Status |
|-----------|-----------|--------|
| `PageLoader` | The stamp: 30px square turning in 90° steps, shadow cycling the four palette colours. The only page-level loader | ✅ |
| `PageHeader` | Page title (Display 800 2rem) + one plain intro line + optional action | ✅ |
| `Card` | The frame: 2px ink border, `6px 6px 0` hard shadow, optional flush media region | ✅ |
| `CardGrid` | `auto-fill minmax(260px, 1fr)`, gap 24 | ✅ |
| `SiteHeader` | The 52px top bar — wordmark left, caller's controls right. Used by the signed-out page, the loading state and the app shell | ✅ |
| `Wordmark` | Space Grotesk lockup, the only logo treatment | ✅ |
| `ActionButton` | Display 700, sentence case, hard shadow. primary = ink fill / outline = white | ✅ |
| `PageTitle` | Display heading, sm/md/lg | ✅ |
| `SectionLabel` | Small section heading, Display 0.95rem sentence case | ✅ |
| `NavTab` | Mono uppercase tab with active underline — a sanctioned mono use | ✅ |
| `TopicChip` / `AddChip` / `chipTint` | Interest picker units. Mono uppercase + 6px radius — the last rounded, last mono-uppercase surface | 📋 `docs/briefs/interests-panel.md` |

## Today — the default (brief) reading path

| Component | Serves | Status |
|-----------|--------|--------|
| `today/today-page.tsx` | Orchestrator for brief + classic | ✅ buttons now `ActionButton`; loader now `PageLoader` |
| `today/brief-digest.tsx` | The digest itself — prose, paper cards, term chips | ✅ tile headings, card name, "See more", "Read paper" and "Next source" all de-slopped |
| `today/digest-header.tsx` | Date + topic chips above the digest | ✅ keyword tags may stay mono uppercase (sanctioned); note it defines a **second local `TopicChip`** unrelated to the design-system one — rename |
| `today/regenerate-cta.tsx` | End-of-digest "don't like this?" | ✅ button now Display sentence case |
| `today/palettes.ts` | `SOURCE_PALETTES` (saturated), `CARD_PALETTES` (pastel), `hex2rgba`, `dispersedWash`, `washStyle` — the single source for card colour | ✅ |
| `today/synthesis-text.ts` | Pure parsing helpers | ✅ |

## Vault

| Component | Serves | Status |
|-----------|--------|--------|
| `vault/vault-page.tsx` | Shell + reading-list grid | ✅ uses `PageHeader`, `PageLoader` |
| `vault/digest-history.tsx` | Two-pane history | ✅ one loader, dates legible, back control matches the reading view |
| `vault/reading-list-card.tsx` | Bookmarked paper card | ✅ title + attribution + bookmark, nothing else |
| `vault/reading-paper-detail.tsx` | The reading view | ✅ full-screen, gist + what's happened since |

## Shell, settings, onboarding

| Component | Serves | Status |
|-----------|--------|--------|
| `app-shell.tsx` | Signed-in chrome | ✅ uses the shared `SiteHeader` |
| `providers.tsx` | SessionProvider with server-primed session | ✅ |
| `noise-overlay.tsx` | Paper grain | ✅ |
| `settings-dialog.tsx` | Full-screen settings | ✅ uses the shared `SiteHeader`; "Hide" / "Clear all" / cadence tiles now Display sentence case; every hairline is `rgba(26,26,26,0.12)` |
| `onboarding.tsx` | Interests setup | ✅ frame down to 2px/6px shadow, title on the page scale, provider tabs and both footer buttons Display sentence case. Still hosts `InterestLedger` — see its brief |
| `interest-ledger.tsx` | The interests panel | 📋 `docs/briefs/interests-panel.md` |
| `keyword-tag.tsx` | Pastel keyword tag | ✅ tags are a sanctioned mono-uppercase use |
| `admin-dashboard.tsx` | Admin only | ⚠️ low priority — not user-facing |

## Classic mode — the one surviving alternate

`?classic=1` → `synthesis-banner` → `source-card`, lazy-loaded. It stays because
`/digest/[id]` (public permalinks) renders the same `SynthesisBanner`, so the
code is on the critical path for shared links regardless. Both still carry the
old mono-uppercase styling — ⚠️ if you ever restyle, do it for the permalink's
sake, not for the flag.

`?papers=1` and `?papersog=1` were deleted 2026-08-14 along with `papers-mode`,
`papers-mode-og`, `paper-detail`, `qa-thread` and `brief-threads`. Brief won.

## Dead code — DELETED 2026-08-14

All of the below are gone; listed so the history is legible. `git show HEAD~1`
recovers any of them.

| File | Note |
|------|------|
| `public-digest.tsx` | Superseded by `app/digest/[id]/page.tsx`, which builds its own view |
| `today/knowledge-graph.tsx` | The old node map, removed from the UI |
| `today/synthesis-chat.tsx` | Superseded by the reading companion |
| `today/paper-card.tsx` | The component was unused; `PaperItem` moved to `src/lib/types.ts` first, where the 14 importers now point |
| `today/papers-mode, papers-mode-og, paper-detail, qa-thread, brief-threads` | The `?papers` / `?papersog` experiments |
| `app/prototype/brief` | Superseded prototype |
| `ui/badge, card, input, scroll-area, separator, sonner, tabs, textarea` | Unused shadcn scaffolding |
| `api/thread`, `api/papers/[id]/blurb`, `api/papers/[id]/related`, `api/email-preview` | Served only the deleted views |
| `lib/ai/agent.ts` | The thread engine behind `/api/thread` |
| Dead exports | `digestPrompt`, `comparisonPrompt`, `getOpenAlexRelatedWorks`, `getS2Recommendations`, `institutionBoost`, `getActiveModel`, `topicColor` |
| Schema | `threadCache`, `comparisons` — **tables still exist in prod**; a future `drizzle-kit push` would drop them |
| Deps | `next-themes`, `node-cron`, `sonner`, `@types/node-cron`. **`shadcn` looks unused but is not** — `globals.css` imports `shadcn/tailwind.css` |

---

## Duplication worth fixing

1. ~~Two wash implementations~~ — fixed. `CARD_PALETTES` + `washStyle` live in
   `palettes.ts`; the vault card no longer reaches into a Today module.
2. ~~Two `SiteHeader`s~~ — fixed. One primitive in `design-system.tsx`.
3. **Two `TopicChip`s.** `design-system.tsx` (interest picker) and
   `today/digest-header.tsx` (follow-this-topic). Different jobs, same name.
4. **Font constants re-declared per file.** `const MONO = "var(--font-mono)…"`
   appears in ~15 files. They're exported from `design-system.tsx` already.
