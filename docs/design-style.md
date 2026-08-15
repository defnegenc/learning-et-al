# Design system — the short menu

> **Paper is the source of truth.** The file is *Brilliant petal* → board
> **"Design system — the short menu"**, with **"The foundational lane"** and
> **"Interests panel — on the new system"** beside it, and **"Shipping the menu"**
> recording what was ambiguous and how it was resolved.
>
> This page is a reader's copy of the menu plus the things only code can say
> (which file holds what, which surfaces exist). If it disagrees with Paper,
> **Paper wins** — fix this page and the code, in that order.
>
> Everything in this file was rewritten from the Paper board on 2026-08-14. The
> previous version described the pre-menu product (four gradient palettes,
> 16 type styles, 7 shadows) and is gone.

## The menu, in one line

One card, one spectrum, one shadow. Mono is reserved for structure — eyebrows
and nav — and everything that names a thing goes back to the body face. Colour
is the thing worth keeping; everything structural gets cut.

**91 → 28.** 62 colours → 19 · 16 type styles → 5 · 4 borders → 2 · 7 shadows →
1 · 2 radii → 1.

---

## 1 · Colour

Values live in `@theme static` in `src/app/globals.css` and, for the TS side, at
the top of `src/components/design-system.tsx`. The two lists must match.

### Neutrals — six

| Token | Value | Where |
|---|---|---|
| `--color-ink` | `#1a1a1a` | text, borders, fills |
| `--color-dim` | `#444444` | bylines, secondary copy |
| `--color-muted` | `#888888` | every mono label |
| `--color-rule` | `#dddddd` | hairlines, idle borders |
| `--color-field` | `#e8e8e8` | the page behind cards |
| `--color-surface` | `#ffffff` | cards, panels |

Retired: `#333` · `#555` → `#444` · `#666` · `#999` · `#aaa` → `#888` ·
`#c2c2c2` · `#cbd5e1` · `#eee` → `#ddd` · `#f9fafb` → `#fff`.

### Acid — two, ink only, never a fill

`--color-acid-green` `#38b000` — confirmation that something stuck (the bookmark
fill, the tag check, "All changes saved").
`--color-acid-pink` `#ff007f` — anything that failed. It is also `--destructive`.

Retired: `#7700ff` purple (link hover became an ink underline), `#ffcc00`,
`#ff5500`. The chart ramp was the five acids; it now reads spectrum slots
00/02/04/06/08, which is hue-ordered and a better ramp.

### Spectrum — ten slots, ordered by hue

`--color-spectrum-00` … `-09`: `#fecaca` `#fed7aa` `#fde68a` `#d9f99d` `#bbf7d0`
`#99f6e4` `#bfdbfe` `#ddd6fe` `#f5d0fe` `#fbcfe8`.

**One vocabulary, three indexes. Never interchange them.**

| Index | Rule | Code |
|---|---|---|
| **Field identity** | one FIXED slot per domain, never moves | `FIELD_HIERARCHY[key].color`, `fieldColor()` |
| **Keyword tags** | slot by hash of the word, so the same concept is the same colour everywhere | `wordSlot(word)` |
| **Card washes** | slot by POSITION in the digest | `wash(index)` |

Field → slot: Medicine 00 · Physics & Engineering 01 · Business & Finance 02 ·
Education 03 · Biology 04 · Sustainability 05 · Computer Science 06 ·
Social Sciences 07 · Philosophy & Ethics 08 · Design & Art 09.

**The wash stride.** Card *i* takes slot `i×3` and the one next to it. Two
adjacent slots are analogous, so a card reads as one hue with variation;
stepping three puts the next card a third of the way round the wheel, so no two
cards on screen are close. Card 4 lands on 9+0. Hover darkens the same two hues
(`color-mix` 14% ink) — there is no second table.

The wash is **wayfinding, not identity**: it is what lets a highlighted paper
name in the synthesis match its card. Field-derived washes would give two
Biology papers in one digest the same wash and the highlights would stop
resolving. This one stride replaced `PALETTES`, `HOVER_PALETTES`,
`CARD_PALETTES`, `SOURCE_PALETTES` and `CATEGORY_PALETTES`.

### Gold — one

`--color-gold` `#c9a227`. The foundational frame and its reason rule, nothing
else. Outside the spectrum on purpose: the one card per digest that is not from
this decade should not look like it drew a slot. Retired: `#F7E38F`, `#8C6D1F`,
`#E6C34A`, `#F5D547` — a flat 2px gold border reads as gold at every size the
five-stop gradient did.

---

## 2 · Type — five styles, three faces

| Style | Face | Size | Weight | Tracking | Case | Where |
|---|---|---|---|---|---|---|
| Display/LG | Cabinet Grotesk | 32 / 40 | 700 | −0.02em | sentence | the digest's question, page titles, a card's hero |
| Display/SM | Cabinet Grotesk | 16 / 20 | 700 | −0.01em | **upper** | card titles, lens labels, **every button** |
| Label | Geist Mono | 12 / 16 | 700 | 0.12em | upper | section eyebrows and nav tabs — nothing else |
| Body | Apercu Pro | 15 / 24 | 400 | 0 | sentence | prose |
| Body/SM | Apercu Pro | 13 / 20 | 400 | 0 | sentence | tags, chips, bylines |

Weight 600 (tags, chips) and italic (bylines) are **modifiers, not extra
styles**. Apercu ships no 600, so `@font-face` gives Medium the range `500 600`
— otherwise the browser rounds up to Bold.

**Never positive tracking on body text.**

**If it names a thing rather than the machinery, it is not a Label.** That single
rule is what moved tags, chips and the venue line out of mono uppercase and into
body-face sentence case — the largest visual change in the set. The product used
to shout eleven small things per card; it shouts two.

Three faces: Cabinet Grotesk (700 only), Apercu Pro, Geist Mono. Geist Mono
replaced IBM Plex Mono. Space Grotesk left with the retired *Wordmark* style —
the wordmark is a **lockup**, Display/SM with the label's 0.12em tracking.

The font variables are set on `<html>`, not `<body>`: `globals.css` composes
`--font-body` and `--font-mono` out of them at `:root`, and a custom property on
`:root` can only see other properties on the same element.

---

## 3 · Geometry — two borders, one shadow, no radius

- **1px** — rules, tags. **2px** — everything structural. Retired: 1.5px, 3px.
- **`5px 5px 0`** — anything that lifts. Retired: 2px/3px/4px/8px offsets, the
  soft `0 1px 4px` card lift, the 12px gold glow.
- **Radius 0, without exception.** The 6px on `TopicChip` and `AddChip` was the
  last rounded corner in the product; the notepad's 999px pill went with it.
- **Hover** can't grow a second shadow, so `.ds-lift` slides the object 2px into
  its own shadow and the shadow reaches 7px. Honour `prefers-reduced-motion`.

---

## 4 · What a card is

**Title, byline, tags.** In that order, with nothing above the title.

- **Title** — Display/SM, upper. The first thing read.
- **Byline** — Body/SM italic `--color-dim`: authors, venue and year on one line.
  "Paper · 2026" was never information anyone needed as a heading; the year
  belongs with the journal and the source type is carried by the venue name.
- **Tags** — `Tag` in the body face, sentence case, 1px, no shadow.
  `glass` on a wash (the wash already carries the colour), `solid` on white
  (fill = the keyword's hashed spectrum slot).

`PaperCard` in `src/components/paper-card.tsx` is the **only** paper card, in two
sizes. `digest` adds the hero line and the tiles behind one expand control;
`compact` is the same card smaller and is what "Referenced sources", the vault
and the permalink render. `SourceCard`, `ReadingListCard` and the permalink's
`PaperSourceTab` are deleted, not restyled — that removed three components, four
palettes, a 1.5px border, a soft shadow and a glass-tag variant, and it is why
the wash index can no longer drift between two files.

### The foundational card

`category: "foundational"` — at most one per digest, most days none.

- **Frame:** 2px `#C9A227` with a `5px 5px 0` gold shadow. One gold moment.
- **Wash:** fixed at slots 02 + 01 rather than taking a position stride — it
  isn't competing for wayfinding, the gold already says which card it is.
- **Order:** label, title, byline, reason. The reason closes the card behind a
  2px gold rule.
- **The eye:** 15px, gold at rest, ink on hover, opening the same ink tooltip
  used for hard-word definitions. The label stays constant so the lane is
  recognisable the third time; the eye carries the explanation the first.

---

## 5 · Shared components — `src/components/design-system.tsx`

| Component | What it is |
|---|---|
| `PageLoader` | The stamp — the ONE page-level loader. Shadow walks spectrum 0/3/6/9 |
| `SiteHeader` | The 52px bar: wordmark left, caller's controls right |
| `Wordmark` | Display/SM at 0.12em tracking. A lockup, not a style |
| `PageHeader` / `PageTitle` | Display/LG title + one Body line. No eyebrow above, no rule under |
| `Label` | The mono eyebrow. Name the machinery, never the content |
| `SectionLabel` | Display/SM — where a section genuinely needs a name |
| `NavTab` | The other sanctioned mono use; active gets a 2px ink underline |
| `ActionButton` | Display/SM upper. `primary` ink fill · `outline` white · `plain` frameless for the quiet third action |
| `Card` / `CardGrid` | The frame (2px + `5px 5px 0`) and the standard shelf |
| `Tag` | Body-face tag, `glass` \| `solid` |
| `TopicChip` / `AddChip` | Interest-picker units. Idle white + 2px dashed rule; selected = the field's slot behind a solid ink border |
| `Segmented` | The one "pick exactly one" shape |
| `InkTip` | The one dark tooltip — hard words, a paper's gist, the foundational eye |
| `TextInput` | The one input shape |
| `wash` / `washSlots` / `wordSlot` / `SPECTRUM` | The three spectrum indexes |

Loading rules are unchanged and still binding: **at most one indicator per
wait**, never move it between phases, no fake progress, inline button spinners
are separate, honour `prefers-reduced-motion`.

---

## 6 · Surfaces

| Surface | Notes |
|---|---|
| Today (`today/`) | Digest column 760px. Question at Display/LG with the sweep (spectrum 0+1 and 3+4, 7px bar). `PaperCard` size `digest` |
| Classic (`?classic=1`) | `synthesis-banner.tsx`. Paper names are ink underlines, not coloured highlights; `[N]` citations take the cited card's wash slot |
| Vault | Digest history (rail + pane) and the reading list — `PaperCard` size `compact` |
| Reading detail | 680px column. Title, byline, gist, then what's happened since |
| Settings / Onboarding | Full-screen sheet below `md`. `InterestLedger` for both |
| `/prototype/*` | `interests`, `loaders`, `headline`. Live, unauthenticated, rendering the shipping components |
| Permalink `/digest/[id]` | `SiteHeader` + synthesis + compact cards |
| Share card | `opengraph-image.tsx`. No `filter: blur()` and no woff2 — Satori limits. See §7 |
| Email | `src/lib/email.ts`. See §7 |

### The interest picker

Ten fields, ~80 topics. Fields collapse: a field opens if it holds something you
picked, else the first opens so it doesn't read as ten locked drawers. Collapsed
rows preview their contents. One search box does two jobs — filter everything at
once, and a phrase that matches nothing becomes the custom-topic adder. The
capacity meter is `N of 30 topics · across K of 10 fields` over a 10px bar whose
segments are the field slots; no bar at zero.

Row vocabulary comes from the Paper board: swatch (the field's fixed slot),
field name at Display/SM, count as the row's one mono Label. The board draws all
ten fields open in a 1280px panel; the accordion stays because the settings
sheet is 880px and a phone is 375px.

---

## 7 · The two surfaces that can't load the system

**The share card** (`opengraph-image.tsx`) renders through Satori: no
`filter: blur()` (it rasterises as hard rectangles) and no woff2. Cabinet
Grotesk ships as woff2, so a decompressed `CabinetGrotesk-Bold.ttf` lives in
`public/fonts` purely for this route. Satori has no inline layout — a background
under a run of text has to be a sibling `<div>` pulled up with a negative margin.
The sweep hues are inlined and must move when `washSlots` moves.

**Email** (`src/lib/email.ts`) can't load web fonts, CSS variables or
`radial-gradient`. The display face falls back to the system grotesque and the
label face to a monospace stack; the card's wash becomes a flat 6px band of its
two hues across the top. Every other value is a literal at the top of the file
and must move when `globals.css` moves.

---

## 8 · Motion

No animation library. CSS `@keyframes` in the component that uses them.
Durations: 120–150ms hover/state, 400–520ms entrances, 1.5–2s loops. Entrances
rise 6px and fade (`briefRise`); mechanical loops use `steps()`, not easing.
Custom art arrives as SVG (square viewBox, strokes left as strokes, no masks or
filters, named layers), inlined and animated in CSS — not GIF, not Lottie.

---

## 9 · The test

**Would removing it lose information the reader wants?** If not, remove it.

And the one that keeps the menu short: **no surface may invent a hex, a type
size, a border width or a shadow offset.** If you need one, it goes in Paper
first, then `globals.css` and `design-system.tsx`, then the surface.
