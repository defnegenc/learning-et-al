# Design system — the short menu

> **Paper is the source of truth.** The file is *Brilliant petal* → board
> **"Design system — the short menu"**, with **"The foundational lane"**,
> **"Interests panel — on the new system"** and **"Explainer — what is this?"**
> beside it, and **"Shipping the menu"** recording what was ambiguous and how it
> was resolved. The menu board carries values; a composed product surface gets
> its own board next to it, which is what the last three are.
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

**One amendment, 2026-08-19: `SELECTION_FILL`.** Acid green gains exactly one
sanctioned fill use — the live dig-deeper selection in the reading view
(`::selection` inside `[data-section]`, at
`color-mix(in oklab, #38b000 30%, transparent)`). It marks the passage the agent
is about to act on for the seconds between selecting text and the dig firing,
and it collapses the moment the answer starts arriving. Alpha, not the flat hex,
because a marker stroke you can't read the sentence through isn't a marker.

It must not leak. The dig-deeper answer panel is the **paper's wash**, not green;
the only other green in the interaction is ink — the confirmation tick and the
word "Saved". Panels, chips and washes are unchanged.

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
else. **Gold is a line colour and never a mark.** A foundational paper marks type
with `foundationalSlots()[0]` — slot 02, the light gold its card is already
washed in. Behind a word, `#c9a227` is too dark to read the word through, and it
made a foundational paper's highlights look like a different species from every
other paper's pastel ones. The frame stays dark because a 2px rule has to read as
a line. Outside the spectrum on purpose: the one card per digest that is not from
this decade should not look like it drew a slot. Retired: `#F7E38F`, `#8C6D1F`,
`#E6C34A`, `#F5D547` — a flat 2px gold border reads as gold at every size the
five-stop gradient did.

### Two things colour may never be

**Never a swatch.** A row or grid of colour-filled squares — the spectrum shown
as itself, a band strip, a legend of slots — is banned everywhere in the
product, marketing surfaces included. The spectrum is a wayfinding index, not an
ornament; the moment it is displayed as a set of chips it stops naming anything
and becomes decoration. The one sanctioned way to put colour beside ink is the
**loader's move**: a white object with an ink border and a spectrum *offset
shadow*, or a sweep bar under a line of type. Colour falls behind things. It
does not fill them.

**Never a fake record.** Numbered boxes, issue stamps, `NO. 214`, `PAPER · 2026`
and any other invented catalogue metadata are out. The archive aesthetic comes
from the geometry — hard borders, one shadow, no radius — not from cosplaying a
library card with numbers that mean nothing. If a number is on screen it has to
be true and it has to matter.

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
sizes. `digest` adds the hero line and then splits: findings on the left,
takeaway on the right, one 2px rule between them, `Read paper` at the bottom
right. There is no expand control and there are no tiles — emphasis inside a
finding is an ink underline, not weight, and the takeaway's claim wears a mark
in the card's own wash hue. Both columns are Body 15 and stack below 720px;
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
| `PageLoader` | The stamp — the ONE page-level loader. Shadow walks spectrum 0/3/6/9. `travelling` is its one variant (see §8) |
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
| `Segmented` | The one "pick exactly one" shape. Settings navigation is the nav rail, not this — a segmented control reads as a toggle, which is exactly why the vault's Digests / Saved papers switch *is* one |
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
| Today (`today/`) | Digest column 760px. Question at Display/LG, ink-fill (see §8) — no colour. `PaperCard` size `digest`. No em dashes in static copy on this surface, and `METADATA_RULES` bans them in generated copy. Logged out, the eyebrow row's actions cluster carries the `WhatIsThis` `i` beside Share |
| Classic (`?classic=1`) | `synthesis-banner.tsx`. Paper names are ink underlines, not coloured highlights; `[N]` citations take the cited card's wash slot |
| Vault | Digest history (rail + pane) and the reading list — `PaperCard` size `compact` |
| Reading detail | 680px column. Title, byline, gist, then what's happened since. Hard words are the dotted rule, never a fill: on this page fill means the reader's own selection (`SELECTION_FILL`) and nothing else. The paper's hue stays on the dig panels and the `Remember this` frame |
| Settings / Onboarding | Full-screen sheet below `md`, nav rail above it. `InterestLedger` for both. Onboarding's footer reaches the same `WhatIsThis` popup as the logged-out surfaces, in its `onboarding` variant |
| `/prototype/interests` | Live, unauthenticated, rendering the shipping `InterestLedger` at full width and in a 375px phone frame, so it can't drift from what ships. A harness, not a candidate picker — it stays |
| Permalink `/digest/[id]` | `SiteHeader` + synthesis + compact cards. Header carries the `WhatIsThis` `i` plus Share plus Sign in/Open app; bookmarks save to the account or wait on-device until sign-in. A shared link is most readers' first contact with the product, which is why the explainer is in that cluster |
| Share card | `opengraph-image.tsx`. No `filter: blur()` and no woff2 — Satori limits. See §7 |
| Email | `src/lib/email.ts`. See §7 |

### The interest picker

Ten fields, ~80 topics, **ten collapsing rows and nothing else**. A field opens
if it holds something you picked, else the first opens so it doesn't read as ten
locked drawers; a closed row previews what's inside it. No search box, no
All/Selected filter, no capacity meter — all three shipped and all three came
out. The cap speaks only when it binds. "+ Add" is per field, at the end of its
chips: the original objection was ten of them stacked down the page, but with
fields collapsed only the open one shows a button.

The row header's geometry is fixed — swatch, name and chevron share one line and
the preview hangs below, so nothing whose position depends on `isOpen` sits on
that line and opening a field can't shift the swatch or the title.

Row vocabulary is the Paper board's: swatch in the field's own fixed slot, name
at Display/SM, preview in Body/SM. **The board also draws a per-row count and
that stays cut** — the board decides how a row looks, the product decision
decides what it contains. Same reason the board draws all ten fields open in a
1280px panel and the accordion stays: the settings sheet is 880px and a phone is
375px.

### Settings

A 190px nav rail on the left, the section on the right, the active row marked by
a 2px ink left bar. Below `md` the rail becomes a full-width underlined tab
strip — the segmented control it replaced read as a toggle rather than as
navigation. The footer rule is 1px so the panel's top and bottom lines match.
Initial focus lands on the panel, not on "Done", which was otherwise opening
inside a focus ring that read as a border.

---

## 7 · The two surfaces that can't load the system

**The share card** (`opengraph-image.tsx`) renders through Satori: no
`filter: blur()` (it rasterises as hard rectangles) and no woff2. Cabinet
Grotesk ships as woff2, so a decompressed `CabinetGrotesk-Bold.ttf` lives in
`public/fonts` purely for this route. Satori has no inline layout — a background
under a run of text has to be a sibling `<div>` pulled up with a negative margin,
and the phrase column needs `alignSelf: flex-start` or the bar stretches full
width.

**What the card is** (rebuilt 2026-08-15): white ground, no outer frame, and one
object — the wordmark boxed in a 5px ink border and tipped −2.5°, with the line
*"Color me curious."* under it in the body face. That's the whole card. The
previous version carried two swept phrases and a paragraph of body copy; at the
width iOS actually renders a Messages bubble (260pt) the paragraph was a five-
pixel grey smear, and iMessage prints the description under the image anyway, so
it was saying the same thing twice. **Design the card at bubble size, not at
1200×630.**

The outer ink frame is gone for the same reason — at that scale it reads as a
hairline artefact rather than a border. The slab keeps its own border, and that
is what stops the card dissolving on the white grounds Slack and Twitter render
previews on. Any future version needs *something* holding an edge.

**The ring shadow.** The card's one shadow sits at one depth, with the ten
spectrum slots running round the object's perimeter — bottom-left corner, right
along the bottom, then up the right edge — in lengths proportional to the path.
It is the loader held still: `PageLoader` steps its single shadow through four
slots over time, and a static image can't step, so it shows the cycle at once.
Colour still only falls behind ink. It is not a swatch, and the ten slots are not
ten stacked shadows — one depth, recoloured along its length, which is an
extension of the `5px 5px 0` rule rather than an exception to it.

Because CSS cannot recolour a `box-shadow` across its own length, the ring is a
**layer**: absolutely positioned, first child, inside a `position: relative`
wrapper, with the object's width and height passed in explicitly so the path can
be measured. If the slab is resized, `SLAB` must be resized with it — the shadow
cannot infer content width.

The `openGraph.title` and `twitter.title` in `layout.tsx` carry the same line as
the card. iMessage prints that title directly beneath the image, so the two
saying different things reads as a mismatch — move them together.

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

**The digest headline is `InkTitle`** (`today-page.tsx`): Display/LG as hollow
outline type, filling with ink one word at a time, 0.4s per word on a 0.1s
stagger. The stroke animates to 0 as the fill lands, so the resting headline is
plain Display/LG — the animation leaves nothing behind, which is the test any
future headline treatment has to pass: *what does this look like after it
finishes?* No colour; every candidate that ended on a palette rule was rejected,
because colour on this product means **a source** and the question isn't one.
The stroke is 1px, not the 1.5px the prototype ended on — the menu halved the
headline, and 1.5px on 32px type is a heavier outline than the same value was on
64px. The seven candidates it was chosen from are in the history, not on a
route: `/prototype/headline` was deleted once the decision was made.

**The travelling stamp** (`PageLoader travelling`) is the loader's one variant,
for the one wait long enough to deserve a show: a new user's first digest. Same
30px square, same 90° turn, but it walks a 269px track — one 26px hop per step,
just under its own width, so it reads as walking rather than jumping — while the
shadow steps the **full spectrum in hue order 00 → 09**, one slot per hop. At
the end it snaps back to the left; the loop is meant to be visible as a loop.
Rotating 90° per hop lands on 900° at the wrap, which for a square is the same
face as 0°, so the turn reads continuous across the carriage return. 2s,
`steps(1, end)`, inline rather than fixed because it sits above a headline
instead of owning the page. It is still **indeterminate** — ten hops are ten
hops, not ten percent each — and `prefers-reduced-motion` gets the static stamp
on slot 00. No new tokens: the sanctioned colour-beside-ink move, one slot at a
time behind one white ink-bordered object, which is why ten slots on screen over
2s is not a swatch.

---

## 9 · The test

**Would removing it lose information the reader wants?** If not, remove it.

And the one that keeps the menu short: **no surface may invent a hex, a type
size, a border width or a shadow offset.** If you need one, it goes in Paper
first, then `globals.css` and `design-system.tsx`, then the surface.
