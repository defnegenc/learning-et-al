# Learning et al. — Design System

> The canonical spec. `src/components/design-system.tsx` is the code half; this
> is the decision half. If the two disagree, fix the code.

## Philosophy
Brutalist research archive. Information-dense, no decoration for decoration's
sake. Personality comes from typography, hard edges and colour — never from
chrome, labels, or busywork around the content.

**The test for any element: would removing it lose information the reader
wants?** If not, remove it.

---

## Fonts

Four faces, each with one job. Reference them through the CSS variables, never
by name.

| Role | Variable | Face | Where |
|------|----------|------|-------|
| Body | (default, set on `body`) | **Apercu Pro** (self-hosted; Inter fallback) | All prose, bylines, list text, buttons' inner text |
| Display | `var(--font-display)` | **Cabinet Grotesk** (self-hosted, 400/500/700/800) | Headings, card titles, the big TLDR line, buttons |
| Logo | `var(--font-logo)` | **Space Grotesk** 700 | The wordmark only |
| Mono | `var(--font-mono)` | **IBM Plex Mono** | Rare. See "Where mono is allowed" below |

### Type scale

| Use | Font | Size | Weight | Case | Colour |
|-----|------|------|--------|------|--------|
| Page title | Display | 2rem | 800 | Sentence | `#1a1a1a` |
| Section heading | Display | 1.25rem | 800 | Sentence | `#1a1a1a` |
| Card title | Display | 1.15rem | 700 | Sentence | `#1a1a1a` |
| Hero / TLDR line | Display | 1.5rem | 700 | Sentence | `#1a1a1a` |
| Reading prose | Body | 1.05rem / 1.75 | 400 | Sentence | `#1a1a1a` |
| Body prose | Body | 0.95rem / 1.7 | 400 | Sentence | `#333` |
| Secondary (byline, meta) | Body | 0.8–0.88rem | 400 | Sentence | `#666` |
| Button | Display | 0.85–0.9rem | 700 | Sentence | ink or white |

Letter-spacing: `-0.02em` on display headings, `-0.03em` at 2rem+. Zero on body.
**Never positive tracking on body text.**

### Where mono is allowed

Mono uppercase is a *structural* signal, not a decorative one. Allowed in:
nav tabs, the digest date line, and code-ish values.

**Not allowed:** as an eyebrow above content, as a card's meta rail, as a label
on a section that already has a heading, or anywhere at `<0.7rem` in grey.

---

## Anti-patterns — the "AI slop" list

These are the things that make a UI look generated. None of them are allowed.

1. **Tiny faint uppercase labels.** `0.55–0.62rem`, `letter-spacing: 1–2px`,
   `color: #888/#999`, `text-transform: uppercase`, sitting above real content.
   They read as a template, they're hard to read, and they almost always label
   something that's obvious from the content underneath. If a section needs a
   name, give it a **display-font heading at a readable size**.
2. **Metadata rails on cards.** "Paper · 2024 · From 'theme' (date)" strips,
   source-type chips, "From: {digest}" attributions. A card is a title, who made
   it, and one action.
3. **Labelling the obvious.** Don't put "Abstract" over an abstract or "Title"
   over a title. Don't caption a list of citing papers as "Homework —
   what's happened since?" *and* head the section with the same words.
4. **Stacked wrappers.** A card inside a modal inside a dimmed backdrop. Pick
   one container. Full-screen beats a card for anything you actually read.
5. **Sections that exist because the data exists.** The reading view had did /
   found / caveats / remember / glossary / questions / homework because the
   model produced them, not because anyone read that far.
6. **Fake progress.** No bar that fills toward a percentage the code can't know.
7. **More than one loading indicator per wait.** See "Loading".

---

## Colour

- **Background:** `#fff`
- **Ink:** `#1a1a1a` — all borders, all body text, button fills
- **Greys:** `#666` secondary text · `#888` tertiary · `rgba(26,26,26,0.12)` hairline rules
- **Never** pure black `#000` or a grey outside that set.

### The palette (the "rainbow")

Four ordered pairs, cycled by index — `SOURCE_PALETTES` in
`src/components/today/palettes.ts`. Source 1 always gets pair 1, so a paper
keeps its colour across the digest.

| # | Pair | Reads as |
|---|------|----------|
| 1 | `#6EE9A8` → `#D4F04A` | green → lime |
| 2 | `#FF85A8` → `#FFD020` | pink → yellow |
| 3 | `#60AAE8` → `#A878E8` | blue → purple |
| 4 | `#FFD020` → `#FF85A8` | yellow → pink |

Used for: card blob washes (`dispersedWash`, ~0.42 alpha), the sweep bar under
the digest title, takeaway tile fills, and the loader. Not for text, not for
borders, not for backgrounds of whole pages.

---

## Borders, shadows, spacing

- **Card border:** `2px solid #1a1a1a`. **Hairline rule:** `1px solid rgba(26,26,26,0.12)`.
- **No rounded corners** anywhere except `TopicChip` (6px — the one exception).
- **Hard shadows only**, no blur: `6px 6px 0 0 #1a1a1a` cards · `4px 4px` buttons ·
  `3px 3px` small/nested. Hover lifts by `translate(-2px,-2px)` and grows the shadow 2px.
- **Padding:** 26–28px in cards, 14–18px in small tiles.
- **Reading column:** max-width 680px. **Digest column:** 760px. **Grid page:** 1400px.
- **Cursor:** crosshair everywhere.

### What a card is

A card may contain, in this order: **title** (display 700), **one line of
attribution** (authors · journal · year, body 0.8rem `#666`), **one primary
action**. Everything else belongs in the view the card opens.

### Foundational card frame (the one exception to black borders)

A paper with `category: "foundational"` keeps its normal pastel wash but the FRAME goes gold:
- Border: 3px, shiny gradient via `border-image: linear-gradient(135deg, #F7E38F, #C9A227, #8C6D1F, #E6C34A, #F7E38F) 1` (light→deep gold reads as metallic sheen)
- Shadow: hard gold offset (`3px 3px 0 0 #C9A227`) + soft glow (`0 0 10px rgba(201,162,39,0.45)`)
- Badge: small ★ FOUNDATIONAL chip — mono uppercase, `#F5D547` background, 1px black border (the one sanctioned mono uppercase micro-label, because it's a rare award, not a section eyebrow)
- Below the citation line: the one-sentence `foundationalReason` in italic with a 3px gold left bar

Max one per digest, rare by design — the gold means something because most digests don't have it.

---

## The page template

`/prototype/loaders` is the reference page. Every full page should read like it:
a big sentence-case title, one plain line of explanation, then bordered cards on
a white field. Nothing else. Use the primitives — `PageHeader`, `Card`,
`CardGrid` in `design-system.tsx` — rather than rebuilding the geometry.

| Element | Spec |
|---------|------|
| Page padding | `48px 24px 80px` |
| Page width | 880px for card pages · 680px reading · 760px digest · 1400px dense grids |
| Title | Display 800, `2rem`, `-0.03em`, sentence case, `0 0 8px` |
| Intro line | Body `1rem`, `#666`, `line-height 1.6`, `max-width 560px` |
| Title → content gap | 40px |
| Card grid | `repeat(auto-fill, minmax(260px, 1fr))`, gap 24px |
| Card frame | `2px solid #1a1a1a`, `box-shadow: 6px 6px 0 0 #1a1a1a`, white |
| Card media region | flush, `borderBottom: 2px solid`, contents centred |
| Card body | padding `16px 18px` — title Display 700 `1.05rem`, note body `0.85rem` `#666` |

What makes it work, and what to preserve when applying it elsewhere:

- **No rule under the page title.** The whitespace separates; a border adds noise.
- **Sentence case everywhere**, including buttons and card titles.
- **Exactly two type sizes per card** — the title and the note. No third tier.
- **One colour of secondary text** (`#666`). Not `#888` *and* `#999` *and* `#aaa`.
- **Colour appears in the content, not the chrome.** The frame is always black on
  white; the palette lives inside the card.
- **Generous vertical rhythm** — 24px between cards, 40px under the header. The
  density belongs in the digest, not in the surfaces around it.

## Loading

One primitive: `PageLoader` in `design-system.tsx`. Rules:

1. **At most one loading indicator per wait.** If two things load in sequence,
   the first must render the page chrome and hand off to the second *in the same
   position*, so it reads as one wait. (Fixed 2026-08-14: auth showed a spinning
   square on a blank screen, then the digest fetch showed a circle somewhere
   else.)
2. **Never move the indicator** between phases, and never change its shape. It
   is `fixed inset-0` and centred in the *viewport*, not padded down from the
   top of whatever container renders it — every caller renders it as the sole
   page content, so viewport centring is what keeps rule 1 true across a
   handoff regardless of how tall each page is. (Fixed 2026-08-14: `py-20`
   parked the stamp just under the header on tall screens.)
3. **No fake progress.**
4. Inline spinners inside buttons are fine and separate from this.
5. Honour `prefers-reduced-motion` — animation off, mark still visible.

Candidates for a custom loader live at `/prototype/loaders`.

---

## The share card (OG image)

`src/app/opengraph-image.tsx` — the 1200×630 thumbnail iMessage, Slack and
Twitter render. `twitter-image.tsx` re-exports it, so there is one card.

It follows the page template, not a poster language: white field, ink frame,
wordmark top-left, hero, one line at `#666`, the address. The hero is the
**sweep** — two phrases in Cabinet Grotesk 700 `-0.04em`, each with the
gradient bar from `SOURCE_PALETTES[0]` and `[1]` under it, exactly as
`SweepTitle` draws it on the digest. Colour appears only in those two bars.

Two constraints, both from Satori (the renderer behind `next/og`):

- **No `filter: blur()`.** It rasterises as hard-edged rectangles, not soft
  blobs. Washes must be `linear-gradient` / `radial-gradient`.
- **No woff2.** Only ttf/otf/woff. Cabinet Grotesk ships as woff2, so a
  decompressed `CabinetGrotesk-Bold.ttf` lives in `public/fonts` purely for
  this route (`fonttools`: open the woff2, clear `flavor`, save as `.ttf`).
  Apercu is already `.otf` and Space Grotesk already `.ttf`.

Satori has no inline layout — a background under a run of text has to be a
sibling `<div>` pulled up with a negative margin, and the phrase column needs
`alignSelf: flex-start` or the bar stretches the full width.

---

## Motion

- **No animation library.** Framer Motion (~120 KB) and Lottie (~250 KB) both
  cost more than the thing they animate. CSS `@keyframes`, declared in a
  `<style>` block in the component that uses them.
- Durations: 120–150ms for hover/state, 400–520ms for entrances, 1.5–2s for
  loops.
- Entrances rise 6px and fade (`briefRise`). Mechanical loops use
  `steps()`, not easing.
- Custom art arrives as **SVG** (square viewBox, strokes left as strokes, no
  masks or filters, named layers), inlined as a component and animated in CSS.
  Not GIF, not Lottie.

---

## Shared components (`src/components/design-system.tsx`)

One file exports the primitives every surface composes. The Today page is the
reference look; Vault, Settings, and Onboarding must use these instead of
restyling their own. Added 2026-07-19.

| Component | What it is | Used in |
|-----------|-----------|---------|
| `PageLoader` | The stamp — the ONE page-level loader | Home (auth), Today (digest fetch), Vault, Digest history |
| `PageHeader` | Page title + one intro line + optional action | Vault; the template for every full page |
| `Card` | The frame — 2px border, hard shadow, optional media region | Loader prototype; use for any new card surface |
| `CardGrid` | `auto-fill minmax(260px, 1fr)`, gap 24 | Same |
| `Wordmark` | "Learning et al." lockup — Space Grotesk 700, 0.2em tracking | App-shell header, Settings dialog header |
| `NavTab` | Mono uppercase tab, active underline | App-shell nav (today/vault/admin), Settings tabs, Vault filter bar (By Digest / By Domain / Starred / Bookmarked / Compare) |
| `SectionLabel` | Mono uppercase eyebrow, 2px tracking, #888 | Settings "Delivery cadence" / "Email digests", Vault drawer title |
| `PageTitle` | Cabinet Grotesk heading, 700, -0.02em (sm/md/lg) | Settings "Curate your feed" / "Account", Vault "Vault" |
| `ActionButton` | Brutalist button (2px ink border, hard shadow; primary = ink fill, outline = white; sm/md) | Settings Save / Regenerate / Sign out, Vault pagination + Compare CTA (same voice as Today's "Next source") |
| `TopicChip` | Interest chip — idle: white + dashed grey border; selected: soft field tint (`chipTint`, pastel mixed 45% into white) + solid border; 6px radius (the only rounded element) | InterestLedger (Settings + Onboarding) |
| `AddChip` | "+ Add" chip — dashed ink border, bold | InterestLedger row adder |
| `SourceCard` (`today/source-card.tsx`) | The paper/news card: blob wash, mono venue line, display title, glass tags; optional compare-select mode | Today source grid, Vault grid (identical card in both) |

Chip palette follows the 2026-07-19 reference mock (soft solid tints, not gradients).
The old gradient `GlassTag` is gone; `CATEGORY_PALETTES` remains only for
synthesis concept tags.

## Legacy component notes (some predate the white-background redesign)

### Header
- Horizontal line with centered bordered title box: "LEARNING ET AL."
- Tab buttons below: TODAY / VAULT
- Settings gear icon right-aligned

### Paper Card (sidebar)
- **Purpose:** Show a paper at a glance. Title, source, summary, tags.
- **Appearance:** 1.5px bordered box, #e8e8e8 bg
- **Content:** Source label (mono, small), title (uppercase bold), authors (italic small), abstract (line-clamp-3), keyword tags (pastel colored boxes with black text and 1px black border)
- **Hover:** translateY(-2px), bg lightens to #f0f0f0
- **Interactions:** Click to open detail. Star/dislike appear on hover.

### Synthesis Panel (top of canvas area)
- **Purpose:** Brief the user on today's digest. Theme + conversational summary.
- **Appearance:** Clean text area, 40px padding, max-width 700px
- **Content:** Header with pulsing green dot + "DAILY_SYNTHESIS_SUMMARY", then synthesis text at 1.1rem
- **Tags:** Concept tags below synthesis, pastel colored boxes
- **NO blobs, NO decorative elements.** Just text.

### Knowledge Graph / Node Map (bottom of canvas area)
- **Purpose:** Quick visual showing how today's topics connect. User glances at it to see relationships. NOT a feature — a minimap.
- **Appearance:** Small bordered container (320x240px), positioned bottom-right of visual workspace, with subtle box-shadow
- **Content:**
  - Keyword nodes: small bordered labels (0.55rem, uppercase, letter-spacing 1px, bg #e8e8e8, 1px solid border)
  - Connection lines: solid 1.5px lines between related nodes, opacity 0.8
  - That's it. No circles, no dots, no blobs inside the container.
- **Blobs:** 2-3 large blurred accent-colored circles in the VISUAL WORKSPACE (parent area), NOT inside the node container. They provide ambient color to the workspace background.
- **Behavior:** Clicking a node highlights related papers in the sidebar.

### Paper Detail View
- **Purpose:** Full view of a paper with AI summary and Q&A.
- **Back button:** "← BACK" mono uppercase, no chrome
- **Layout:** Source label, title, authors, keyword tags, separator, AI summary, separator, Q&A thread
- **Style:** Same borders/typography as everything else

### Q&A Thread
- **Purpose:** Ask questions about a paper, see saved Q&A history.
- **Appearance:** Each QA pair is a bordered box. Question bold, answer below. Click to expand/collapse.
- **Input:** Plain bordered textarea + "ASK" button

### Vault Page (archive grid)
- **Purpose:** Browse all past papers/articles.
- **Layout:** Grid of square (1:1) cards + right sidebar with timeline
- **Cards:** aspect-ratio 1/1, small accent aura blob in top-right, REP_XXX number, category tag, title
- **Grid:** repeat(auto-fill, minmax(240px, 1fr))
- **Hover:** translateY(-2px), bg goes white
- **Compare mode:** Select 2-3, acid-pink border on selected

### Onboarding
- **Purpose:** Get API key + interests with field/level.
- **Step 1:** Provider selector + API key input
- **Step 2:** Interest cards (keyword + field + level) + content mix slider
- **Style:** Centered bordered card, same brutalist treatment

### Settings Dialog
- **Purpose:** Change API key/provider anytime.
- **Style:** Same brutalist inputs and buttons. Test connection button.

### Tags/Badges (universal)
- Pastel background (from palette above), assigned by index % 5
- Black text (#1a1a1a)
- 1px solid #1a1a1a border
- No rounded corners
- Padding: 2px 8px
- Font: 0.6rem, uppercase

### Noise Overlay
- Fixed, full-screen, pointer-events none
- SVG fractalNoise texture at 0.08 opacity
- Always present for texture
