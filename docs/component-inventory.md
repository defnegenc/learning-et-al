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
| `Wordmark` | Space Grotesk lockup, the only logo treatment | ✅ |
| `ActionButton` | Display 700, sentence case, hard shadow. primary = ink fill / outline = white | ✅ |
| `PageTitle` | Display heading, sm/md/lg | ✅ |
| `SectionLabel` | Small section heading, Display 0.95rem sentence case | ✅ |
| `NavTab` | Mono uppercase tab with active underline — a sanctioned mono use | ✅ |
| `TopicChip` / `AddChip` / `chipTint` | Interest picker units. Mono uppercase + 6px radius — the last rounded, last mono-uppercase surface | 📋 `docs/briefs/interests-panel.md` |

## Today — the default (brief) reading path

| Component | Serves | Status |
|-----------|--------|--------|
| `today/today-page.tsx` | Orchestrator for all four modes | ✅ buttons now `ActionButton`; loader now `PageLoader` |
| `today/brief-digest.tsx` | The digest itself — prose, paper cards, term chips | ✅ tile headings, card name, "See more", "Read paper" and "Next source" all de-slopped |
| `today/digest-header.tsx` | Date + topic chips above the digest | ✅ keyword tags may stay mono uppercase (sanctioned); note it defines a **second local `TopicChip`** unrelated to the design-system one — rename |
| `today/regenerate-cta.tsx` | End-of-digest "don't like this?" | ✅ button now Display sentence case |
| `today/palettes.ts` | `SOURCE_PALETTES`, `hex2rgba`, `dispersedWash` | ✅ |
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
| `app-shell.tsx` | Signed-in chrome | ⚠️ header duplicates `page.tsx`'s `SiteHeader` geometry — extract one `SiteHeader` into `design-system.tsx` and use it in both |
| `providers.tsx` | SessionProvider with server-primed session | ✅ |
| `noise-overlay.tsx` | Paper grain | ✅ |
| `settings-dialog.tsx` | Full-screen settings | ⚠️ ~20 mono-uppercase micro-labels not yet audited |
| `onboarding.tsx` | Interests setup | ⚠️ same, plus it hosts `InterestLedger` |
| `interest-ledger.tsx` | The interests panel | 📋 `docs/briefs/interests-panel.md` |
| `keyword-tag.tsx` | Pastel keyword tag | ✅ tags are a sanctioned mono-uppercase use |
| `admin-dashboard.tsx` | Admin only | ⚠️ low priority — not user-facing |

## Flag-gated alternates (lazy-loaded, off the default path)

`?classic=1` → `synthesis-banner` → `source-card`; `?papers=1` → `papers-mode` →
`paper-detail` → `qa-thread`; `?papersog=1` → `papers-mode-og`. All ⚠️ — they
carry the old mono-uppercase styling throughout. **Decide whether these modes
still earn their keep before spending any restyle effort on them.** If they're
experiments that lost, deleting them removes ~1,900 lines and a lazy chunk.

## Dead code — DELETED 2026-08-14

All of the below are gone; listed so the history is legible. `git show HEAD~1`
recovers any of them.

| File | Note |
|------|------|
| `public-digest.tsx` | Superseded by `app/digest/[id]/page.tsx`, which builds its own view |
| `today/knowledge-graph.tsx` | The old node map, removed from the UI |
| `today/synthesis-chat.tsx` | Superseded by the reading companion |
| `today/paper-card.tsx` → `PaperCard` | **The component is unused**, but 14 files import the `PaperItem` *type* from it. Move `PaperItem` to `src/lib/types.ts`, then delete the component |
| `ui/badge, card, input, scroll-area, separator, sonner, tabs, textarea` | Unused shadcn scaffolding |

Not deleted — flagged for a decision, since a delete is easy to do and annoying
to undo.

---

## Duplication worth fixing

1. **Two wash implementations.** `dispersedWash` in `today/palettes.ts` and
   `washStyle` in `today/brief-threads.tsx` do the same job with different blob
   layouts. `reading-list-card` reaches into `brief-threads` for it, which is why
   a vault card depends on a Today module. Consolidate into `palettes.ts`.
2. **Two `SiteHeader`s.** `page.tsx` and `app-shell.tsx` each build the 52px
   bar with the wordmark. One primitive, two right-hand slots.
3. **Two `TopicChip`s.** `design-system.tsx` (interest picker) and
   `today/digest-header.tsx` (follow-this-topic). Different jobs, same name.
4. **Font constants re-declared per file.** `const MONO = "var(--font-mono)…"`
   appears in ~15 files. They're exported from `design-system.tsx` already.
