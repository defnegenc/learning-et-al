# Brief — bring the interests panel onto the design system

> **Resolved 2026-08-14.** Shipped as a rebuild rather than a restyle: the chip
> decision went to **A** (body face, sentence case) and the "optional and
> separate" layout question was answered by collapsing fields instead of a card
> grid. The cap is 30, not 15.
>
> **Superseded the same day** by the short menu. Three things this brief settled
> have since changed: the 6px radius is gone (radius is 0 without exception),
> `chipTint` is gone (a selected chip takes its field's spectrum slot at full
> strength, not a 45% mix), and the ten field colours are now ten distinguishable
> hue-ordered slots rather than five colours shared between ten fields. The live
> spec is the Paper board and `docs/design-style.md` §6. What follows is the
> original brief, kept for the reasoning.

**File:** `src/components/interest-ledger.tsx` (258 lines)
**Appears in:** Settings → "Curate your feed", and step 2 of Onboarding
**Read first:** `docs/design-style.md` — especially "The page template",
"Anti-patterns", and the type scale. This brief only lists what's off-system;
the spec is the authority on what to replace it with.

Don't change behaviour. The props (`selected`, `custom`, `onToggle`,
`onAddCustom`, `onRemoveCustom`, `maxSelected`), the `FIELD_HIERARCHY` source,
the 15-interest cap, and the field colours all stay exactly as they are. This is
a restyle.

---

## What's off-system today

| # | Where | Now | Should be |
|---|-------|-----|-----------|
| 1 | Inline "add topic" input (~line 68) | Mono, `fontSize: 10`, `letter-spacing: 1.2`, `background: rgba(255,255,255,0.55)`, `backdrop-filter: blur(6px)`, `border-radius: 6` | Body face, `0.9rem`, solid white, `2px solid #1a1a1a`, no radius, no blur. **Glass/blur appears nowhere else in the product** — it's the last survivor of an older look. |
| 2 | "Maximum reached" banner (~line 118) | Mono `11px`, `letter-spacing: 0.4`, on `#FFE89A` | Keep the yellow card and the hard shadow; set the text in body face at `0.9rem`. It's a sentence, not a label. |
| 3 | Panel frame (~line 132) | `1px solid #1a1a1a`, rows divided by `1px` | `2px` outer border to match every other card; keep `1px` row dividers but use the hairline `rgba(26,26,26,0.12)` |
| 4 | Category name (~line 155) | Display 18px, `letter-spacing: -0.5` | Correct face — just express it in rem (`1.15rem`, `-0.01em`) so it sits on the type scale |
| 5 | Row padding | `22px 24px`, `gap: 20`, 160px label column | Fine. Leave it. |
| 6 | Topic chips | `TopicChip` from `design-system.tsx` — mono, `11px`, `letter-spacing: 1.2`, uppercase, `6px` radius | See below — this one is a real decision, not a cleanup |

## The chip decision

`TopicChip` is currently the only rounded element in the entire product and one
of the few remaining mono-uppercase surfaces. Two coherent options; pick one and
apply it to `TopicChip` in `design-system.tsx` so Settings and Onboarding move
together:

**A — bring chips onto the system.** Body face, `0.85rem`, sentence case, square
corners, `2px` ink border when selected / `1.5px` dashed grey when not, field
colour as the fill (`chipTint`). Consistent with everything else; loses the
"control panel" texture that arguably suits a picker.

**B — declare chips a deliberate exception.** Keep mono and the 6px radius, but
raise the size to `0.75rem` and drop tracking to `0.5px` so they're legible, and
document the exception in `design-style.md` under "Where mono is allowed".

I'd take **A**. The panel is a form, and forms should read like the rest of the
product. But it's a taste call and B is defensible if you want the picker to feel
like an instrument.

## Layout

The panel is a 15-row list inside one frame, which is why it reads as dense and
unlike the rest of the product. If you want it to match the loaders-page
language, the move is `CardGrid` + one `Card` per field — category name as the
card title, chips in the card body. That's a bigger change than a restyle, so
treat it as optional and separate.

## Definition of done

- No `backdrop-filter`, no `border-radius` except whatever the chip decision
  keeps, no `fontSize` under `0.75rem`, no positive letter-spacing on anything
  that is a sentence.
- Sizes in `rem`, not raw numbers.
- Settings and Onboarding both still render it correctly — it's the same
  component in both, at different widths.
- `npm run build` and `npx tsc --noEmit` clean; `npm run lint` no worse than
  its current baseline (36 problems, 9 errors — all pre-existing).
