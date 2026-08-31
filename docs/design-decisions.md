# Learning et al. — Design Decisions

> Referenced from CLAUDE.md. Always update this when making UX/product decisions.

---

## 1. One Digest Per Day

We generate one digest per day per user. Regenerating creates a new one (old ones kept in history). This is intentional — daily cadence creates habit without overwhelm. Users who want more can regenerate, but the default experience is one curated digest per morning.

**Why not multiple per day?** The value is curation, not volume. One great digest > five mediocre ones.

---

## 2. Logged-Out Experience

Unauthenticated visitors see the admin user's latest digest (read-only). CTA to sign up. This lets people see the product before committing — they can read a real digest, explore papers, and understand the value before creating an account. Admin user ID is set via `ADMIN_USER_ID` env var.

---

## 3. Interests

Users pick from a category table (CS, Design, Biology, etc.) with subcategories. Each category has a BEG/INT/ADV expertise toggle that affects how papers are searched (beginner interests get "introduction overview applications" appended to queries). Custom topics can be added inline per category.

**Key decision: engagement doesn't create new interests.** Starring a paper or chatting only boosts existing interests — never creates new ones. This was a deliberate choice after "emoji communication" polluted the feed from a single starred paper.

Weight changes are tiny:
- +0.1 per star
- +0.05 per chat question
- -0.05 per dislike

---

## 4. Content Mix

Slider from "Just research" (0) to "Just news" (100). Maps to paper/news ratio:

| Slider value | Papers | News |
|-------------|--------|------|
| 0-20 | 3 | 0 |
| 21-50 | 2 | 1 |
| 51-80 | 1 | 2 |
| 81-100 | 0 | 3 |

Default is 33 (2 papers + 1 news, labeled "recommended"). This gives users control over how academic vs. accessible their digest feels, without exposing the underlying complexity.

---

## 5. Theme Generation

The pre-search model generates a working retrieval question. The displayed central question is generated AFTER the final sources are selected and ordered. Aim for 8 words, hard max 10. It must sound like something a real person would wonder about.

**Good**: "Can we wear our gut health?"
**Bad**: "Can bacteria become your stylist?"

The difference: the good one is something you'd actually text a friend. The bad one sounds like a BuzzFeed headline.

Cross-domain combos are encouraged but only if naturally connected. After sources are found, the editor derives their real shared thread, may remove generic adjacent filler, orders the remaining sources, and writes the displayed question from that evidence. The working question has no keep-by-default privilege.

---

## 6. Paper Selection

All papers scored against theme embedding. No hierarchy (no "anchor" paper). The anchor paper approach was tried and rejected — highly cited papers dominated and pulled in methodology papers from wrong fields.

Papers that the user has seen in the last 30 days are excluded (cross-digest dedup). Interest rotation penalizes recently-used topics (last 5 digests) so the same domain doesn't appear every day.

---

## 7. Synthesis Tone

Conversational means clear, specific, and comfortable to say aloud. It does not mean performing chatiness with repeated "So", "Turns out", "Here's the thing", or "It's kind of like" openers. Contractions are natural, not mandatory. Not dumbed down — just human.

- Paper names **bold** + colored underline (clickable to open detail)
- Paragraph breaks between papers
- Hard words get hover definitions from keyConcepts
- Each paper framed as a different lens on the central question, not a sequential story
- Key findings must be RESULTS, not methodology ("They found X" not "They used method Y")

**Banned words**: demonstrates, reveals, nuanced, multifaceted, elicits, "the question of whether", "it is increasingly", "a complex but", "this suggests that the intersection of". These were banned because the AI defaulted to them constantly, making every synthesis sound identical. Banning them forces more specific, concrete language.

---

## 8. UI Philosophy

Brutalist aesthetic — hard borders (1.5px), box shadows, crosshair cursor, uppercase mono labels. But with subtle color through blob pairs on paper cards (pink+green, blue+yellow, purple+red). Tags are solid pastel rectangles with black borders.

Paper detail replaces synthesis inline on desktop (not a modal). This keeps the user in context — they can see their paper list while reading detail. On mobile, it opens as a modal since screen space is limited.

Settings is full-screen with left sidebar nav (Interests / API tabs), not a small popup. Settings contain important configuration (API key, interests, content mix) that deserves proper space.

Typography (original): Apercu Pro for body text (warm, readable), Space Grotesk for display (bold, geometric), IBM Plex Mono for labels. Since revised twice: Cabinet Grotesk took display and Geist Mono took labels (see design-style.md), and on 2026-08-30 Hanken Grotesk replaced Apercu as the body face. The trigger was open-sourcing the repo: Apercu is commercially licensed and its files could not stay in a public repository, and Hanken Grotesk (OFL, variable) is the closest free match for its warmth while also cleaning up the 500-600 weight-range workaround Apercu's fixed weights required.

---

## 9. Auth

Google OAuth via Auth.js (next-auth v5) with DrizzleAdapter. Digest generation currently uses server-side `CRON_AI_*` environment variables, not a user-provided key during onboarding.

The AI provider layer supports OpenAI, Anthropic, Gemini-compatible, and custom OpenAI-compatible endpoints. Production's active provider/model are whatever Vercel has in `CRON_AI_PROVIDER`, `CRON_AI_MODEL`, and `CRON_AI_KEY`; masked Vercel values do not prove which provider is live. If `CRON_AI_PROVIDER` is missing, the current code falls back to `gemini`, but operational docs should not state "production uses Gemini" unless the Vercel env has been verified.

---

## 10. Deployment

Vercel + Turso (libsql). Local dev uses SQLite file. Production uses remote Turso DB. Embeddings run in-process via `@xenova/transformers` with `all-MiniLM-L6-v2` (no external API needed). This keeps embedding costs at zero and avoids external dependencies for the scoring pipeline.

Environment variables: TURSO_DATABASE_URL, TURSO_AUTH_TOKEN, SERPER_API_KEY, AUTH_SECRET, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, ADMIN_USER_ID, NEXTAUTH_URL, CRON_AI_PROVIDER, CRON_AI_MODEL, CRON_AI_KEY

---

## 11. Reading List + Digest History (2026-07-22)

**Bookmarking papers is the single save action.** Digest starring was removed as
confusing — two similar save affordances (star a digest, bookmark a paper) competed.
Digests aren't saved; they live permanently in Digest History (a chat-style two-pane
browser inside the vault). Best-of emails now just send the period's most recent digest.

**Hide/regenerate trigger moved to the end of the digest** and named after its reward:
"Don't like this digest? Regenerate." End-of-digest is the moment the reader actually
knows they didn't like it, and a button that yields a fresh digest gets clicked; a
complaint-shaped X in the header didn't.

**Paper insights are lazy and cached.** Jargon definitions generate on first detail
open; the ELI5 gist on button click — both cached on the papers row so tokens are
never spent on bookmarks nobody revisits.

**Study names in synthesis are plain language** ("the chatbot privacy study"), never
author surnames ("the Kwesi S&P controls study") — a reader who hasn't read the paper
must understand what a study is about from its name alone.

**One place per source, no clicked-into view (2026-07-23).** Everything about a
source lives on its inline card: the See-more tiles answer the four questions a
reader actually has — what IS this (method category + how they did it), what are
they arguing (the claim), what did they find (findings bullets), and what should
I remember (the takeaway, in the card's loudest solid color, one sentence max).
The PaperDetailOverlay modal was removed; a modal on top of a card duplicated
the card's content and broke reading flow. Tile headers adapt to news sources
("News feature", "Key points") so news never wears a fake lab coat.

**Cards state facts, the intro makes the argument (2026-07-24).** The synthesis
bullet prose read badly inside cards — a bridge fragment ran headless into the
bullet ("...side of the table the valuation methods study found..."). Cards now
pair the big TLDR with a factual context line composed from methodType +
methodFacts + year: "This was a 2026 interview study: they interviewed ten
founders..." Composed client-side, so every past digest gets it too; the
digest's connective argument now lives only in the intro answer paragraph and
the closing line.

## 2026-07-24: Vault = history-first; reading list is the workbench

The vault opens on **digest history** (the archive is the main draw); the
reading list sits behind a top-right button rather than a symmetric toggle.
Reading-list cards reuse the digest paper-card anatomy (wash background, hard
border + shadow, mono underlined plain name) but lead with the paper's actual
title — the list is a library, not a feed — and carry a "From: {digest}" line.

**Bookmarking = intent to read.** Starring a paper triggers background prep:
a reading companion generated from the FULL TEXT (gist / what they did / what
they found / where it's shaky / remember this, glossary hover-chips, starter
questions) plus a homework rail of recent works citing the paper (OpenAlex).
The reading view is where questions live now — "Ask this paper" answers from
the full text and persists the thread. Digest-level Q&A (BriefThreads, Dig
Deeper) was removed entirely: asking happens where reading happens.

---

## 2026-08-14: One loader, and the reading view is a page not a card

**One page-level loading indicator.** Entering the site used to show two spinners back to back: a spinning square centered on an otherwise blank screen while auth resolved, then a circular `Loader2` under the header while the digest fetched. Two shapes, two positions, one after the other — it read as two separate waits. Now there's a single `PageLoader` primitive, the header paints immediately during the auth phase, and the loader occupies the same spot across both phases. The vault had the same pattern (digest-list spinner handing off to a reading-pane spinner) and got the same fix.

**Don't add another page-level spinner shape.** Inline spinners inside buttons are fine; a second full-page loading style is not.

**The reading view is a full-screen page.** It was a modal card — palette wash, hard border, box shadow, dimmed backdrop, its own scroll container inside the page's scroll container (which is what made mobile scrolling feel wrong). Now: white, full-screen, own scroll, body scroll locked, `← Back` instead of `✕ Close`.

What it shows, in order: title, byline, **the gist**, "Read the full paper", then **What's happened since** (a real display-font heading, not a mono label) over a plain hairline list of citing works. What it deliberately no longer shows: the metadata tag line at the top, the what-they-did / what-they-found / where-it's-shaky / remember-this sections, and the "Ask this paper" Q&A. The bet is that a reading view earns its keep by being short enough to actually read — one clear takeaway plus where the field went next.

**Payload discipline.** List endpoints select explicit columns and never ship `full_text`, `companion`, `homework`, `abstract_jargon`, or `eli5` — a three-paper digest response went from ~390 KB to ~27 KB. Anything large and generated that lands on `papers` belongs in `LIST_COLUMNS` (`src/lib/db/paper-payload.ts`) and gets fetched on demand by the view that needs it.

---

## 2026-08-14: What actually makes the first load slow

Measured against production (learningetal.com) rather than guessed:

| Step | Cost |
|------|------|
| HTML | 13.4 KB raw / 3.4 KB wire, TTFB ~190ms (CDN) |
| JS before anything can paint | **932 KB raw / 283 KB wire across 11 chunks** |
| `/api/public/digest` | 19.6 KB raw / 6.4 KB wire — TTFB 0.17–0.26s warm, **1.9s cold** |

The payload was never the bottleneck on the public path; **JS and cold starts are**. Rules that follow from this:

- **The digest response is not where the time goes.** A fresh digest stores `fullText = abstract`, so trimming columns only moves the public digest from ~19.6 KB to ~15 KB. It matters enormously in the *vault*, because the companion and Q&A routes write the real PDF text (50–200 KB) plus companion/homework JSON onto every paper you bookmark — so the reading list was shipping all of it on every open.
- **Anything behind a URL flag must be `next/dynamic`.** Classic mode's banner alone pulled react-markdown + micromark — a 132 KB chunk — into every visitor's first load, for a view almost nobody opens. Same for the paper-first variants.
- **Don't import helpers from a component module.** Brief mode imported three pure functions from `synthesis-banner.tsx` and inherited the entire banner. Pure text helpers live in `synthesis-text.ts`, palettes in `palettes.ts`; components import from those, never the reverse.
- **Public endpoints get CDN cache headers.** The logged-out digest is identical for everyone; served from the edge it skips the cold function entirely. Per-user endpoints get a short `private` cache, and any request that's polling for or confirming new data passes `cache: "no-store"`.

**Still open:** server-rendering the initial digest. It's the only thing that removes "download and hydrate the bundle before the first fetch leaves" from the critical path, and it's worth the most to logged-out first-time visitors — who also happen to be the ones search engines and social previews see.

---

## 2026-08-14: One line under the TLDR, and the answer moves to the top

**A card gets one hero line, then one affordance.** The digest paper card was saying the same thing twice: a big bold TLDR ("Researchers ran a two-week trial…"), then a smaller composed sentence right under it ("This was a 2026 lab experiment: they…"). Both answer *what is this study*, so the second one just added weight the eye has to travel through before reaching the expand control. The study-context line is gone. `methodType` / `methodFacts` stay in the pipeline and the DB — nothing about the algorithm changed, they're simply not rendered.

**The affordance names its contents.** "See more ↓" is a control that tells you nothing; "See the Claim, the Findings, and the Takeaway ↓" tells you the shape of what's behind it, which is exactly the decision a reader is making at that moment. It's built from the tiles that actually exist on that paper, so a source missing a claim doesn't promise one, and news reads "Key Points". Tile headings capitalise alike now — **The Claim**, **Findings**, **Takeaway** — because the expand line quotes them back and the mismatch was visible.

**The gist is back under the headline.** It was hidden during the dead-simple pass, but `flattenSynthesis` still drops the synthesis intro paragraph on the premise that "the gist already hooks the reader" — so with the gist off, the digest opened straight onto a source and the actual answer to the central question only arrived in the closing line. Putting it back restores the intended read: question → one-sentence answer → the sources that earn it. Behind `SHOW_GIST` in `digest-header.tsx` if it needs to come off again.
---

## 2026-08-14: The interest picker shows one field at a time, and nothing else

Eighty topics under ten headings, rendered flat, is a wall, and it was the first
thing a new user met at onboarding step 2. The fix wasn't a restyle:

- **Collapse the fields.** A field opens if it holds something you picked;
  otherwise the first one opens so it doesn't read as ten locked drawers. A
  closed row previews its contents, so closing something never hides what's in
  it.
- **The row header's geometry is fixed.** Swatch, name and chevron share one
  line of constant height. The first build let a per-field count and a preview
  change that line's height, so opening a field made the swatch and the count
  jump. On a phone that reads as a bug, not as an animation.
- **Cut the search box, the All/Selected filter and the capacity meter.** All
  three shipped in the first version and all three came out. The accordion is
  browsable enough that a search box was one more thing to look past; the filter
  duplicated what the row previews already say; and "21 of 30 topics · across 6
  fields" was a number nobody was deciding anything with. The cap now speaks
  only when it binds.
- **"+ Add" went back to being per field**, at the end of its chips. The
  objection to it originally was ten of them stacked down the page — but with
  fields collapsed, only the open one shows a button.

**Why chips stopped being mono uppercase:** at 11px with 1.2px tracking a chip
is legible on its own and pure texture in bulk, and bulk is the only way this
screen is ever seen. Sentence case in the body face, 0.85rem. They keep their
6px radius, still the one rounded element in the product.

**The general rule this leaves:** every control on a picker has to earn its
place against the list itself. Search, filters and counters all look like
features in a spec and like clutter on the screen.

---

## 2026-08-14: Questions start from a rotating research neighborhood

The question generator used to receive five bare interest strings and invent all
specificity itself. That made the papers reasonably relevant but made the daily
question depend on the model's modal ideas of what sounds interesting. The source
of variation is now the OpenAlex taxonomy: one real Topic, rotated before the
hypothesis call, supplies a concrete research neighborhood and vocabulary.

**Hierarchy depth follows the user's input.** A broad field such as Computer
Science takes one extra sampled step through a subfield before choosing a topic;
an HCI-sized subfield goes straight to its topics; a free-form idea such as
microbiome searches topics by relevance. The app does not ask the model to invent
subdomains, and it does not jump uniformly across the taxonomy.

**The seed is a constraint, not copy.** The question should expose the human
tension or consequence inside the topic, not turn an OpenAlex label into a title.
Weak-search retries change the angle and literal query vocabulary while keeping
the topic. Otherwise a hard interest such as philosophy would still drift back to
an easier AI digest under pressure.

**The preferred headline is direct, consequential, and open.** User-approved
examples such as “Does AI help students learn or cheat?” matter more than generic
prompt-writing folklore. A recognizable subject and a real unresolved tension are
the bar; physical-object specificity is useful when the research provides it, but
whimsy and fake paradox are not substitutes for stakes.

---

## 2026-08-15: The model writes queries; OpenAlex owns their scope

`focusFields` looked structured but was still model-authored free text. A naming
variation could silently miss an OpenAlex concept, and assigning separate fields
to the three queries made their relationship to the day's actual research seed
arbitrary. The hypothesis model now supplies words only: question, queries, news
terms, and selected interests. Retrieval scope is copied from the sampled
OpenAlex Topic.

The widening order is deliberate. The core query starts at the seed as a paper's
primary topic; the other two accept papers where it is any topic, which is the
cross-domain lane. If either slice is thin, its good results are retained while
the remainder is filled from the seed's primary subfield and then an unscoped
search. This is a precision-to-recall ladder, not an all-or-nothing filter. Only
if OpenAlex produces nothing does Semantic Scholar receive a field, and that
field comes from the user's configured seed interest rather than the model.

---

## 2026-08-15: Search asks the first question; the papers earn the final one

The question generated before search is now explicitly a working retrieval
question. It is useful for finding and scoring papers, but it has no editorial
right to become the page headline. The displayed question is written only after
the final sources survive selection, fills, and re-ranking. That pass must state
their shared thread and explain what each source contributes before its headline
can ship.

**Examples teach the voice; a format menu does not.** A menu of "definition plus
consequence," "capability check," and similar forms would become a new
monoculture. The prompt instead uses user-approved questions as taste examples:
"Can a headset replace being in the room?", "Virtual classrooms feel real. Does
that help?", and "We built the virtual classroom. Can students use it?" The
vague "Does feeling present mean learning more?" is shown as a failure because
it hides the virtual-classroom setting. The model is warned not to treat any
example as a fill-in-the-blank template.

**Two coherent sources beat three with filler.** The re-ranker now drops a weak
adjacent source when no replacement exists and two good sources remain. The
final editor gets a second coherence veto: it may exclude a source that belongs
only under a generic umbrella, but not one that merely disagrees. This directly
targets sets such as two dark-pattern papers plus an unrelated general review of
pleasant financial-app design.

**Order is part of the argument.** The editor returns a source permutation along
with the thread. When valid, that order becomes the cards, metadata, synthesis,
and stored source indices. Explanation can precede evidence, which can precede a
complication or consequence, but there is no mandatory three-act template. The
set decides. Foundational context stays additive at the end.

**Eight words is a target, not damage we do to a sentence.** Hard maximum is now
ten. Several approved questions naturally need nine or ten words; shortening
them mechanically would optimize a counter instead of the reader.

## 2026-08-14: Settings is a full-screen sheet on a phone, and delivery lives with the account

Two separate problems, one cause — the desktop layout was being shrunk instead
of rethought:

- Tabs sat in the header as 10px mono words. On a phone "Account" was a corner
  of a corner, which is why **Regenerate digest** was effectively unfindable.
  Tabs are now a full-width segmented bar under the header, and Regenerate has a
  heading and a sentence saying what it does.
- The Interests tab opened with delivery cadence and an email toggle, so
  picking topics on a phone began with two screens of preferences. Cadence and
  email moved to Account — which is what they are.
- Save only appeared once you had a topic selected, and only on Interests. It's
  now one sticky footer shared by both tabs, above the home indicator.

The rule that generalises: **a dialog below `md` is a full-screen sheet.** Not a
90vh box inset by a rem, with its own scrollbar inside the page's scrollbar.

---

## 2026-08-14: The digest headline fills with ink

Seven candidates went up at `/prototype/headline` (since deleted — a candidate
picker outlives its use the day the candidate lands) — the existing sweep, three
built from ideas about colour and tumbling cards, and three of mine. **Ink-fill
won**: the question arrives as hollow outline type and floods with ink one word
at a time. It's the poster language the rest of the site already uses, applied
to the one line that earns it.

**No colour.** The version that shipped drops the palette rule the prototype
ended on. The headline is the only thing on the page with nothing competing
against it, and every colour candidate — highlighter marks, tumbling card
tiles, a gradient rule — spent that quiet to say nothing in particular. Colour
on this product means *a source*: card washes, takeaway tiles, the loader. The
question isn't a source.

**The animation must leave nothing behind.** First cut kept a fixed 1.5px
stroke so the outline had something to draw with, which made the resting
headline permanently heavier than before. That's the wrong trade: you watch the
animation for half a second and read the result for ten minutes. The stroke now
animates to 0 as the fill arrives, so the headline you sit with is exactly the
old one. Any future headline treatment should pass the same test — **what does
this look like after it finishes?**

**The share card is now the only place the sweep survives.** A static OG image
has no animation to carry, and a white card with plain black type says nothing,
so it keeps its gradient bars. The doc used to claim the card mirrors the
digest headline; it doesn't any more, and that's a deliberate divergence rather
than drift. Worth revisiting if the card gets another pass.

---

## 2026-08-14: Saving a paper says "Read later"

The vault had no door. `SourceCard` carried the only bookmark in the product and
it renders in the "Referenced sources" rail, which is gated on `!focusMode` —
so once the brief digest became the default view, the save control existed only
at `?classic=1`. The API, the preloaded bookmark ids and the vault query all
worked the whole time. Worth remembering as a class of bug: **a feature can die
by having its entry point moved out from under it**, with every test of the
feature itself still passing.

**The bookmark carries a word.** Three options were on the table — a bare icon
top-right, a named button inside the expanded card next to "Read paper ↗", and
an end-of-digest "keeping anything?" step. The pick was the top-right position
of the first with the explicitness of the second: glyph plus a mono "Read
later". A bare bookmark on a card whose whole design thesis is one enormous bold
line reads as decoration, and the icon alone doesn't answer *what does saving
do* — "Read later" does, in two words, and it names the vault's purpose rather
than its mechanism.

**Saved state is a label change, not just a fill.** The control flips to
"Saved". The filled glyph alone is the kind of state you have to look for; the
word is the kind you notice.

**Saving prefetches.** Clicking it fires the companion and homework calls in the
background, same as the old source card, so the reading view opens ready instead
of spinning. That's the actual argument for saving being a deliberate act rather
than a stray tap — each save costs two model calls.

**The end-of-digest keep step is still open.** It reads as the better ritual —
you decide what to keep after you've read, not while you're reading — but it's
a new surface. Revisit once there's data on how often the card control gets used.

## 2026-08-14: The vault is two shelves, not a page with a trapdoor

Digest history was the vault's home and the reading list hid behind a
bookmark-icon `ActionButton` in the top-right corner. Two things were wrong.
A bookmark icon on a button means *save this* everywhere else in the product,
so the corner of the vault looked like it was offering to save the page. And
the reading list is not a sub-view of digest history — they're the two things
the vault holds.

Now: one "Vault" title, two `NavTab`s below it (DIGESTS / SAVED PAPERS), the
same mono-uppercase-underline the app shell uses for TODAY / VAULT. Both
subtitle lines came out. "Every digest you've been sent, newest first." is a
caption for a list that is visibly a list of digests in date order.

**"Reading list" became "Saved papers"** in the UI. Reading list describes an
intention the product doesn't track; saved papers describes what's in there.
## 2026-08-14: The short menu — one design system across every surface

Paper is now the source of truth for the design system (*Brilliant petal* →
"Design system — the short menu"). `docs/design-style.md` was rewritten from it
and is a reader's copy; the old version described the pre-menu product and is
gone. Where the two ever disagree, Paper wins.

**91 → 28.** 62 colours → 19, 16 type styles → 5, 4 borders → 2, 7 shadows → 1,
2 radii → 1. The four decisions with the most consequence:

- **Ten fields got ten colours.** The old set gave ten fields five
  distinguishable hexes — Biology and Sustainability were the identical hex, and
  Medicine, Business and Education were three versions of the same yellow. The
  spectrum is ten hue-ordered slots, and it is now the *only* colour vocabulary:
  fields read a fixed slot, keyword tags read a slot by hash of the word (so the
  same concept is the same colour everywhere), and card washes read a slot by
  position in the digest. Five palette tables collapsed into one stride,
  `wash(i) = slots i×3 and i×3+1`.
- **The rail card is gone.** `SourceCard`, `ReadingListCard` and the permalink's
  `PaperSourceTab` are deleted, not restyled — "Referenced sources", the vault
  and the permalink render the digest card at a compact size. That removed three
  components, four palettes, a 1.5px border, a soft shadow and a glass-tag
  variant in one move, and it is why the wash index can no longer drift between
  two files.
- **Content left the label tier.** Tags, chips and the venue line stopped being
  mono uppercase and became body-face sentence case. Mono is now *structure
  only* — section eyebrows and nav tabs. The rule that decides it: **if it names
  a thing rather than the machinery, it is not a Label.** This is the largest
  visual change in the set; a card used to shout eleven small things and now
  shouts two.
- **Buttons folded into Display/SM.** One button size, 16px upper, no tracking
  of its own. Bigger and blunter, which suits the register.

Three were flagged as *calls* rather than conclusions and confirmed the same
day. They're on the Paper board "Shipping the menu":

- **The digest's question dropped from 44–64px to a fixed 32px.** Display/LG is
  32px and its sample text in the menu is literally "What the digest argues".
  The old fluid clamp isn't in the retired list because Display/LG is what
  replaced it. **Confirmed:** the hero shrinking is the price of keeping the
  count at five, and that's the trade the menu is making everywhere else too.
- **Space Grotesk left the product.** The menu retires *Wordmark* as a type
  style; a lockup is a composition of an existing style, so the wordmark
  rebuilds on Display/SM at the label's tracking. **Confirmed:** three faces.
- **Where §4 and §1 disagree, the colour menu wins.** §4 gives the foundational
  eye `#8C6D1F`, which §1 retires into the one gold; §4's mock draws a 3px gold
  rule under the label, which §4's own prose retires and geometry forbids.
  **Confirmed:** the eye is `#C9A227` at rest and ink on hover, and there is no
  underline. The reason rule keeps gold at 2px, because that one is the payload.

**Still open:** the empty foundational case. §4 names it — most days the lane
returns nothing, so the common layout is three cards and the rare one is four,
which changes the whole page rhythm on the days it fires. Shipped as-is (the
lane simply doesn't render) because inventing a slot shape would put a component
in the menu that the menu didn't order. Worth designing rather than deciding.

**Where a design system can't reach.** Two surfaces render outside the browser
and can't read a token: the share card (Satori — no `filter: blur()`, no woff2)
and the digest email (no web fonts, no CSS variables, no `radial-gradient`).
Both inline the menu as literals with the fallbacks named in a comment, and both
have to be edited when `globals.css` is. That duplication isn't fixable; it's a
property of the renderers, so the honest move is to name it rather than pretend
one import solves it.

**One rule keeps it short:** no surface may invent a hex, a type size, a border
width or a shadow offset. If you need one, it goes in Paper first, then
`globals.css` and `design-system.tsx`, then the surface.

### Where the menu met the day's other three changes

The short menu and three main-line changes (the ink-fill headline, the picker
cut back to ten rows, the settings nav rail) were built the same day against the
same files. Reconciling them settled a rule worth keeping:

**The design system governs style, not what's on screen.** The Paper board's
interests panel draws a per-row count ("3 / 10"); the picker rebuild
deliberately cut every counter, on the grounds that nobody was deciding anything
with the number. The count stays cut. The board decides how a field row *looks* —
swatch in the field's own slot, name at Display/SM, preview in Body/SM — and the
product decision decides what the row *contains*. When a board and a later
product decision disagree about information rather than about style, the product
decision wins and the board should be redrawn.

Two smaller reconciliations followed the same logic. InkTitle keeps its ink-fill
but is set in Display/LG, and its stroke drops from 1.5px to 1px — the menu
halved the headline, and 1.5px on 32px type is a heavier outline than the same
value was on 64px. The em-dash rule reaches `paperByline`, which is exactly the
separator change the now-deleted SourceCard had made.

---

## The card opens

*2026-08-15.* The digest card lost its expand control and its tiles. It is now
title, byline, hero, and then two columns behind one 2px rule: findings on the
left, takeaway on the right, `Read paper` at the bottom right.

The complaint that started it was that the findings and the takeaway were hard
to read, and the diagnosis was structural rather than typographic. Both were
Body/SM 13, set in a bordered tile inside the bordered card — three frames deep
— under a mono grey eyebrow, with the takeaway on a full-strength spectrum fill.
Ten candidates ran at `/prototype/cards` over three rounds. What survived:

- **Reading size.** Both columns are Body 15 at a 26px line. This was most of
  the fix on its own, and it is what made deleting the expand control possible:
  "See more" was hiding two short lists and a button, and the reason to hide
  them was that they were unpleasant to read.
- **Headings in the display face.** Cabinet Grotesk at Display/SM in ink, not a
  mono grey eyebrow. Mono is structure — a section heading inside a card names
  a part of the card, and it should read as a heading, not as a caption for the
  machinery.
- **Two marks, two jobs.** Emphasis inside a finding is an ink underline;
  weight was doing nothing, because half of every finding comes back bold and
  emphasis that covers half a sentence stops marking anything. The takeaway's
  claim wears a highlight in the card's own wash hue — the one place colour
  lands on type. It follows the card, not a fixed colour: the mark is
  wayfinding, and it should match the card it belongs to.
- **Evidence left, conclusion right.** Reading left to right, the card argues
  toward its conclusion rather than stating it and then showing its work.

Rejected along the way, and why: the takeaway as a filled band (200px of solid
colour to emphasise one sentence); the takeaway promoted to the hero (it reads
well, but the title has to lead); `takeawayStat` as a display number (a figure
with no sentence around it says nothing); findings as headline-and-deck (the
qualification in each finding is the part worth keeping); a hero at Display/LG
32 (five lines on a long summary, and the TL;DR eats the card).

---

## 2026-08-15: Define the doorway; put the field on the shelf label

A plain-English answer can still be cognitively hostile when its first word is
"It" and the headline introduced two terms the reader only half knows. The gist
now treats an unfamiliar headline contrast as a doorway: define both sides in
parallel, then explain the finding. Matching definitions already extracted into
`keyConcepts` are passed into the call, so the explanation is grounded rather
than improvised. This case may use two short sentences and 35 words; the normal
one-sentence, 25-word limit remains.

That doorway is for contrasts, not every technical noun. A yes/no headline with
one specialist term should still read question -> answer, not question ->
glossary -> answer. The term is already underlined with a tooltip, so the gist
leads with the verdict and folds in only a tiny clarification when needed.

The small "Daily digest" line is content, not machinery. It therefore leaves the
grey uppercase mono Label style and uses sentence-case black Display type. The
right side of that same row shows unique seeded fields such as Education as
colored category chips. Keywords and extra topics stay out of this row: the chip
answers the quick orientation question — *what shelf am I on?* — without turning
the headline area back into a tag cloud.

Glossary underlines belong at the doorway too, not only deep in the synthesis.
The first matching term in the gist and later argument is dotted and exposes its
existing `keyConcepts` definition on hover, focus, or tap. The definition tip is
rendered into the document body and positioned against the viewport. It is not
owned by the line or card containing the term, because those containers may clip
overflow; at an edge it flips or shifts, and a long definition scrolls inside the
viewport instead of disappearing beyond it.

---

## 2026-08-17: The reading list is a reading list, not a list of titles

The saved-papers shelf was a grid of titles and bylines, and the reading view
behind it showed a gist and a list of citing work. Both were thinner than the
data we already had: the companion generated at bookmark time has always
returned five parts — the gist, what they did, what they found, where it's
shaky, and the one line worth remembering a month from now — plus a glossary and
three questions a curious reader would want answered. Four of those seven fields
were generated, stored, paid for, and never rendered.

**A shelf card carries the "remember" line.** Not the abstract and not the gist:
the one sentence the companion picked as the thing worth keeping. It is the only
line that tells you whether tonight is the night for this paper. `/api/vault`
parses the companion server-side and ships that one string — the blob itself
stays out of list payloads, which is the whole point of `LIST_COLUMNS`. Below it,
the digest question the paper was saved from, so the shelf keeps its provenance.

**Prep resolves in place.** Bookmarking fires companion and homework generation
in the background and it takes a while, so a freshly saved paper has no line yet.
Rather than showing an empty card until the next navigation, it says "Reading it
for you…" and the page polls every 10 seconds until every card has its line, then
stops. The list fills in while you're looking at it.

**The reading view is one continuous walkthrough, not five boxes.** Gist, then
three hairline-separated beats. Hard words are chipped at first use with one
shared "already defined" set across the whole page — a term explained in the gist
is not explained again in the caveats, because it is one read. The glossary at
the foot is a collapsed reference for the terms the companion flagged but never
used in its own copy.

**"Remember this" gets the page's biggest voice.** Display/LG inside the one
framed shape in the product. No new token: it is a hero line, and Display/LG is
what a hero line is set in. The alternative — a spectrum highlight like the
digest card's takeaway — was wrong here, because the wash index is by position in
a digest and this page has no position.

**The three suggested questions are live.** They were being generated and thrown
away. They now render as rows in the same idiom as the citing work — one thing
per hairline-separated row, click to get it — and post to `/api/papers/[id]/qa`,
which reads the full text rather than the abstract. The thread persists per user,
so a paper you come back to still has what you asked it. A free-text box sits
underneath for the question the companion didn't think of. This is the answer to
"can I get the companion without reading the paper": you get the walkthrough, and
then you can interrogate it.

**Revised the same day, after review.**

*The page wears the paper's colour.* The reading view was monochrome, so nothing
connected it to the card you opened it from. Hard words now highlight in that
card's hue — `washSlots(index)[0]`, or `GOLD` if the paper is foundational — and
the "Remember this" block takes the card's full frame and wash. This is a new
place for colour to land on type, and it needs to go into Paper. The
justification is the existing one: the wash is wayfinding. Inside a paper's own
page every term belongs to that paper, so a hue says *which paper you are in*,
which is exactly what the mark on a card's takeaway does. The synthesis keeps the
dotted grey rule and does not take a tint, because a paragraph there carries
terms from three different papers and a hue would claim each for the wrong card
— `DefinitionTerm` takes `tint` as an opt-in for that reason.

*The chat is a rail, not a section.* "Ask this paper" moved out of the column and
into a 372px sticky panel on the right, with the thread scrolling inside its own
frame so the composer never leaves the viewport. As a section it sat below a long
walkthrough, which is the one place you have already stopped having questions. In
the rail it is visible the whole way down. Below 1060px it drops under the
walkthrough and above the citing work. The container widens from 680 to 1240; the
reading column keeps its measure because the rail takes the extra width.

*"Every hard word, defined" is just the Glossary.* The longer label was
explaining a word that needed no explaining.

*The source link is the top right, not the foot.* Below the walkthrough it read
as the end of the page rather than the way into the paper, and it competed with
"Remember this" — the two strongest objects in the column were adjacent. It now
sits opposite Back in a top bar: out on the left, in on the right.

**Second review pass — two bugs and a token rule.**

*Gold is a line colour, never a mark.* The foundational card's takeaway
highlight, and then the hard-word highlights in the reading view, were filled
`#c9a227`. Too dark to read a word through, and it made a foundational paper's
marks look like a different species from every other paper's pastels. Both now
use `foundationalSlots()[0]` — slot 02, the light gold the card is already washed
in — which is precisely what `washSlots(index)[0]` does for every other paper.
This did not loosen the menu; it enforced it. `design-style.md` already said gold
was "the foundational frame and its reason rule, nothing else", and the marks
were the thing violating it. The frame, its shadow, the reason rule and the eye
stay `#c9a227`, because a 2px rule has to read as a line.

*Every tooltip in the product was ink on ink.* `InkTip` set `background: INK`
and `color: SURFACE`, then spread `...BODY_SM` after them — and every type style
in `design-system.tsx` carries its own colour, `BODY_SM`'s being `INK`. The
spread overwrote the white, so the one object that explains hard words, a paper's
gist and the foundational eye rendered as a black box with invisible text. The
type style is now spread first and the colour set after it. Any inverted surface
added to that file has to do the same.

*`.ds-lift` had no touch state, and its shadow half never worked.* A touch screen
has no hover, so every card on a phone was inert — there is now a press, moving
the object into its shadow rather than away from it, with the tap highlight
suppressed so the press is the only feedback. The `box-shadow: 7px` on `:hover`
is deleted rather than fixed: every lifting object sets `boxShadow` as an inline
style and an inline declaration beats a stylesheet rule at any specificity, so it
had never applied — and it was a second shadow offset, which the menu does not
have. The motion is transform only, which also means it works on the gold-shadowed
foundational card instead of flipping it to ink.

*`/api/logout` assumed production.* It redirected to a hardcoded
`learningetal.com` and set `secure: true` unconditionally, which http silently
ignores — so a local logout bounced you to prod and left the cookie in place.
Both now come from the request. This matters beyond dev: a session encrypted with
a secret the server no longer has makes `auth()` throw `JWTSessionError` on every
render, and since the cookie is HttpOnly this route is the only thing that can
clear it.

**The paper is read whole, and the bibliography is not read at all.**

Findings go back to bold weight — that is what shipped and what reads. The ink
underline experiment lived on the branch and never reached prod.

The companion truncated a paper at 30,000 characters and Q&A at 15,000, both from
the FRONT. Two things were wrong with that. The obvious one is that it wasn't the
whole paper. The subtle one is which end got dropped: the discussion and the
limitations are the last sections before the references, so "Where it's shaky"
was being written without the authors' own account of where it was shaky, and a
question about a result was answered out of the introduction.

The fix is not simply a bigger number. `textForPrompt` in `lib/fetchers/pdf.ts`
drops back matter first — the bibliography is roughly a quarter of a typical
extract ("Attention Is All You Need" is 39,642 characters, of which 9,458 are
references) and a list of other papers' titles is the single most misleading thing
you can hand a summariser. Only a `References` / `Bibliography` heading in the
back half is trusted, because front matter routinely lists section names and a
body match would amputate the paper. An appendix after the references goes with
it; that is the intended trade, since appendices are mostly tables while the
discussion sits before the references.

What remains is a rail, not a budget: `FULL_TEXT_CAP` is 400,000 characters, which
passes every real paper whole and only stops a mis-parsed PDF that came back as a
megabyte of ligature soup. It caps what enters the row as well as what enters a
prompt — there is no reason for that soup to live in Turso forever. Both routes
move to `maxDuration = 300`, matching the digest routes, because at 60 a
review-length paper would time out mid-generation and cache nothing.

Still open, and NOT fixed here: whether the companion read the PDF at all is
invisible on screen. `pdfUrl` comes from OpenAlex `open_access.oa_url`, arXiv, or
a Semantic Scholar arXiv id, so an open-access paper gets its full text and a
paywalled one silently gets the abstract, and the two look identical in the
reading view. The rail's subtitle was changed from "read out of the full text, not
the abstract" to "from the paper itself, not from the digest" because the original
claim could be false.

---

## 2026-08-17: Shared digests stay canonical; signed-out saves wait on the device

The permanent unit of sharing is the existing `/digest/[id]` row. Share never
creates a snapshot or a second paper collection: it opens the native share sheet
(with a copy fallback) around that canonical URL. The permalink gets its title
and description from the digest, but keeps the product's one generic share-card
image.

Saving a paper from somebody else's digest adds a `saved_digests` relationship
to the reader's Vault history. It does not copy the digest or change its owner.
That makes the paper's digest attribution, the public link, and any cached
reading companion all refer to the same ids. Removing the paper later does not
remove the digest from history; those are two different promises once the
digest has been imported.

A signed-out reader has no server identity to attach a history row to. Their
bookmark therefore lands in local storage together with the parent digest id,
and the page says exactly that it is saved on this device. A provider-level
bridge replays pending saves after any later sign-in. The ordinary bookmark
endpoint is idempotent and creates the history relationship, so a refresh or an
OAuth retry cannot duplicate either effect. This is deliberately not an
anonymous-account system: cross-device persistence begins when the reader signs
in.

---

## 2026-08-19: The first wait is a show, not a sentence

A new user's first digest takes ~90 seconds and the landing they got for it was
"Today's digest is brewing / Check back soon. A fresh research digest is
generated every day." — generic, addressed to nobody, and sitting above a
**"Generate today's digest" button that double-fired the run already in flight**
from onboarding's `onComplete`. The one moment where somebody has just told us
what they're curious about and is actively waiting on us was the emptiest screen
in the product.

`justOnboarded` (set in `page.tsx`, cleared by `TodayPage` when a digest lands,
persisted in the local session so a refresh mid-wait doesn't drop back to the
generic copy) splits that state in two. The first-run branch says *"Your first
digest is brewing"* and that we're reading papers across **their** topics right
now. The non-first-run branch is untouched — a returning reader whose cron run
hasn't landed genuinely should just check back.

**The travelling stamp.** `PageLoader` gains its one variant. The shipped stamp
turns 90° in place while its shadow steps four spectrum slots; the travelling
one walks a 269px track, one 26px hop per step, its shadow stepping the **full
spectrum in hue order 00 → 09**. Rotating 90° per hop lands on 900° at the wrap,
which for a square is the same face as 0°, so the turn reads continuous across
the carriage return back to the left. The loop is meant to be visible as a loop.

It stays honest: ten hops are ten hops, not ten percent each — the pipeline's
percent-done is genuinely unknown, and "no fake progress" is binding. One
indicator for one wait; it doesn't morph when the digest arrives, the whole
state is replaced. `steps(1, end)`, 2s, inside the menu's 1.5–2s loop range.
`prefers-reduced-motion` falls back to the static stamp on slot 00.

This introduces **no new tokens** — 2px ink border, the one 5px offset, ten
existing spectrum slots, white surface. It is the sanctioned colour-beside-ink
move (colour falls behind a white ink-bordered object) and not a swatch: the
slots appear one at a time, as one object's shadow, never as a row. The Paper
board carries the values but has no motion or components section, so there was
nothing to sketch there; motion lives in `design-style.md` §8.

**Tips while it brews.** Under the loader, a `Label` eyebrow "While it brews"
over one Body-face tip, rotating every 7s with the `briefRise` entrance. They
teach the things a brand-new reader has no way to discover — that saving a
paper starts its reading companion, that jargon is hoverable, that paper names
in the synthesis are clickable. The line reserves its height so the copy above
doesn't jump on rotation, and the loop is passive: when the digest lands nothing
has to finish first.

The list is a **maintained surface** (`src/components/first-run-tips.ts`), with
the keep-current rule in its header comment and in CLAUDE.md's Context
Maintenance Rules. A tip pointing at a feature that no longer ships is worse
than no tip — the rule earned itself on the merge that introduced it: the Save
NUX landing in parallel renamed the saved-papers surface to **your library** and
its agent to **your librarian**, and added highlight-to-dig-deeper, so two tips
were already stale and one feature was missing before this ever shipped. The
tips also deliberately avoid restating `SaveTipStrip`'s copy, which appears on
the very digest they are the wait for.

**The Generate button is hidden during the first-run wait.** Generation is
already running; the button only invited a double-fire. It returns as "Try
again" when the existing 4-minute poll deadline passes (`pollTimedOut`) or the
manual generate errors — the recovery path, not the default.

**Considered and dropped: per-interest expertise prompts during the wait.**
Asking "how well do you know Computer Science?" per picked field, with answer
chips in that field's spectrum slot, is charming but makes the wait a blocking
mini-survey racing generation (digest ready before they finish → hold the
reveal? handle abandonment?) — and the answers can't inform the digest already
being written. Interests already carry a `level` field; expertise would inform
the reading companion's tone. If revived it belongs in settings or the reading
view, as its own feature.

---

## 2026-08-19: Saving has one name, and it says what it starts

Saving is the most agentic thing in this product — it fires the companion
walkthrough and the citing-work scout — and it did all of that behind an
unlabelled 16px bookmark with three different names for one action ("Save to
your reading list" in the tooltip, "Save for later" on foundational cards,
"Read later" in the vault's empty state) and zero feedback of any kind. That is
why the feature read as missing in production: it was mute, not absent.

One name: **Save** / **Saved**, landing in **your library**. The word renders
beside the icon on every digest and shelf card, in Body/SM — it names a thing
rather than the machinery, so it is not a Label and it is not a button voice.

Two teaching moments, neither anchored to a control. A dismissible **strip**
above the digest while a reader has nothing saved, which self-retires on the
first save because saving *is* the dismissal. A **confirmation panel** on the
first-ever save, which is the higher-leverage half: it explains the feature at
the moment the reader acted, and it is the only thing that has ever mentioned
the background prep. An anchored coachmark on the bookmark itself was
considered and dropped — it teaches the control best and misfires worst, and it
would have fought the foundational card's own tooltip.

---

## 2026-08-19: The reading view is a page, not an overlay

`ReadingPaperDetail` was a portal overlay the vault handed a paper object to.
It had no URL, so nothing could link to it: not a digest email, not a share, not
the first-save confirmation. Refresh lost it and back didn't close it, and it
sat two clicks deep behind a Vault that opened on the digest archive.

It is now `/library/[paperId]`, a real route, and the vault navigates there.
There is deliberately **no intercepted route**: the view was always full-bleed,
so the overlay was never buying a layered presentation over the shelf — it was
only costing the URL. An intercept would also have to fight the fact that the
"vault" is a client-side tab inside `/` rather than a route of its own.

The Vault now opens on **Saved papers** for anyone who has any. Once a reader
has a library, that is what "vault" means to them.

---

## 2026-08-19: Highlight to dig deeper — green marks the selection, not the answer

The reader's problem is not that they can't ask; it's that formulating the
question is the work. Highlighting a passage removes that entirely, and it gives
the model the precise sentences plus the beat they came from instead of a vague
question, so answers get better for free. It is also the richest taste signal in
the product: the exact sentences somebody found confusing or exciting beat any
thumbs-up.

**Green lives in the highlight, not the panel.** The live selection is acid
green (`SELECTION_FILL`, the one sanctioned acid fill — see `design-style.md`)
for the seconds between selecting and firing. The answer panel is the paper's
own wash; the only other green is ink on the confirmation. Anything more and the
acid stops meaning "this is the thing I am acting on".

**Anchored to text and section, not to DOM offsets.** What is stored is the
quoted passage and which beat it came from (`gist` / `did` / `found` /
`caveats` / `remember`), so a panel survives a re-render, a refresh, and a
companion regenerated in between. A selection spanning two beats gets no menu —
one passage, one section, or nothing.

**Desktop selects; touch taps.** Touch text selection loses to the native
selection callout, so on narrow screens each beat carries its own "¶ Dig deeper
on this" affordance and digs on the whole passage.

**One store, one thread model.** Ask-this-paper and dig-deeper are the same
object once a dig can be followed up, so both live in `qa_pairs` with a
`thread_id`. A dig thread renders inline under its beat; a typed thread renders
in the rail. "Ask about this" drops the quoted passage into the composer as
context and posts *without* a section, so it stays in the rail where it was
typed. Prior turns of a thread go to the model — every question in this product
used to be answered blind.

Answers **stream**, because the confirmation promises the reader they can keep
reading and it will be below. The row is written only when the stream
completes, so a dropped connection leaves no half-answer in the thread.

---

## 2026-08-20: One explanation of the product, reachable from three places

Nothing in the logged-out funnel ever said what Learning et al. is. A stranger
landed directly on the admin's digest — a good digest, with no indication that
it was generated from somebody's interests or that they could have their own —
and the only call to action in the whole experience was a bare **Sign in** in
the header. The value proposition was entirely implicit, inferred or not at all.

`what-is-this.tsx` is the answer, and it is deliberately **one** surface. Three
beats: *Pick your interests*, *Get one idea every morning*, *Save what hooks
you* — the product's three verbs, in the order a reader meets them.

**The first beat is the interest picker's own chips**, not a description of it.
Three real selected `TopicChip`s, so what the explainer promises is literally
the component the reader will touch a minute later and the two cannot drift.
They carry words, so this is not the banned swatch row: the colour is identity,
the same identity those fields wear everywhere else. Their fills are read from
`FIELD_HIERARCHY` rather than written into this file — the plan had assigned
quantum computing to Computer Science and behavioral economics to Business, and
the hierarchy files them under Physics & Engineering and Social Sciences. A
surface is not allowed to have an opinion about a field's fixed slot, so the
code takes the slot and the wrong hexes never existed.

**Click-only, no auto-open.** A modal that opens itself on first paint is the
opposite of this product's calm, and it would meet a reader before the digest
has had a chance to be interesting on its own. A once-per-visitor
`localStorage` auto-open was considered and dropped for that reason; it is a
one-line change if the click-through rate says otherwise.

**The trigger is an `i`, and it travels with Share.** It shipped first as an
ink-underlined line of body copy beside the "Daily digest" eyebrow, on the
theory that the explainer should sit where a confused visitor is already
looking. That was the wrong read: it put a second sentence directly above the
question and made the reader choose between them before they had finished
either, so the surface that exists to reduce confusion added some. As an icon in
the actions cluster it asks for nothing. It is the same plain, frameless, 15px
control Share already is, and it takes **ink at rest** for that reason — muted
at 15px reads as disabled beside Share's ink, and a pair has to match to be a
pair.

**Two placements, both beside Share.** Today's eyebrow row, and the shared
permalink's header cluster — where it lands next to Sign in as well, which is
the other place it belongs. A shared link is most people's first contact with
this product, so an explainer that only existed on the home page missed the
majority of first impressions. Today's **no-digest state** deliberately has
none: an `i` is legible as an action inside a cluster and cryptic as a lone
glyph under a sentence, and that state has no cluster. The case is rare (the
admin's digest is almost always there), and a bare icon would explain less than
nothing.

**Onboarding reaches the same popup** through a quiet "What happens next?" in
the footer, rather than a second explanation that would drift. Only the trigger
words and the closing line change by variant: the public one can point at the
digest behind the window and offer Sign in, while the onboarding one has a
signed-in reader about to press a button, so it says the first digest takes a
minute or two — which hands off directly to the travelling stamp and the tips.
The subtitle above it now carries the third verb too ("Save any paper to dig
deeper later"); the premise line had promised a digest and stopped, leaving a
third of the product unmentioned at the one step that exists to explain it.

**Not reachable when logged in**, beyond onboarding. A reader inside the product
is being taught by the product — the tip strip, the first-save confirmation, the
brewing tips all do this in place and at the moment it matters. An explainer in
settings would be a worse version of all three.

Composition only: the Card frame on the existing `ui/dialog` primitive, four of
the five type styles, no invented hex, size, border or shadow. Copy avoids em
dashes, which `design-style.md` §6 bans in static copy on the Today surface and
which the drafted beats had used.

**On the board.** The menu board has sections for colour, type, geometry and
cost, and no components or motion section — which is why the travelling stamp
had nothing to sketch there and lives in `design-style.md` §8 instead. A
composed *surface* is different: the file already keeps "Interests panel — on
the new system" and "The foundational lane" as their own boards beside the menu,
so the explainer is now **"Explainer — what is this?"** on the same pattern — the
popup at its real 480px, the trigger in its eyebrow row, and the four calls
above in a notes column. It introduces no tokens, so nothing upstream moved.

---

## 2026-08-20: Familiarity is a visible presentation control, never a taste signal

The natural moment to ask how much background somebody has is after they ask
the librarian to dig: the answer is already arriving, and the question has a
clear benefit. The interleave is therefore one compact 1–5 row inside that dig
panel, always with **Skip**. Its budget is server-side and reserved before the
row paints: one topic once, and at most one topic per reader-local day across
devices. A skipped topic counts as asked. This is product restraint, not a
device NUX flag.

The rating changes presentation only. It can change prose depth, jargon density,
analogies, and how far an answer skips into the method. It cannot change paper
retrieval, selection, ranking, or interest weights. A low rating means “explain
this field to me,” not “show me less of this field.” The system never infers a
replacement rating from behavior; correction is explicit.

The glossary is generated once as a tiered superset and filtered when rendered:
levels 1–2 see basic, working, and deep terms; level 3 sees working and deep;
levels 4–5 see deep terms. Optional analogies appear only at levels 1–2. Missing
tiers on older companions mean “show it,” so the migration cannot hide existing
definitions. This render-time choice is what lets one correction re-tune every
already-cached paper without regeneration.

Every actual use is disclosed. `PITCHED FOR YOU` is a mono structural eyebrow;
the sentence below it is body face and names the topic, rating, and consequence.
The line is parsed out of generated text into UI rather than left for markdown
or later model passes to swallow. Tapping it opens the same scale pre-filled at
the stored value, so disclosure and correction are one control rather than a
new settings screen.

---

## 2026-08-20: On the reading page, a fill means the selection

Hard words in the walkthrough wore the paper's own wash hue. The argument for
it was good at the time: inside a paper's own page every hard word belongs to
that paper, so the fill was wayfinding rather than decoration, and it matched
the card the reader had opened.

Highlight-to-dig-deeper broke that argument. Selecting a passage fills it with
acid green, and it is the one thing on the page that has to be unmistakable —
it is the reader's own gesture, mid-gesture. A page already speckled with filled
words makes their selection just one more coloured patch, which is exactly the
confusion the fill exists to prevent.

So the terms go back to the **dotted rule**, the same one the synthesis uses,
and `DefinitionTerm`'s `tint` opt-in is now unused on this surface. Fill on the
reading page means a passage you chose: acid green while you are choosing it,
the paper's own hue once you have dug into it (see the next entry). Nothing
else on the page is filled.

The glossary's disclosure also becomes the chevron the interests accordion uses.
It was already collapsible and closed by default, but a bare `+` / `–` was
carrying the whole signal and read as punctuation rather than a control.

---

## 2026-08-20: Ask is a paper-plus-web comparison

“Ask this paper” should not behave like search inside a PDF. The paper remains
the primary object in the reading view, but each question now triggers a general
web search using the question, its immediate thread context, and the paper title.
The answer must keep the two bodies of evidence distinct and state whether the
outside material agrees, disagrees, or adds later context. Naming the online
source is part of that contract; a generic “other research says” is not.

Search snippets are supporting evidence, not authoritative full text. They are
bounded before entering the model, explicitly marked as untrusted data, and the
prompt forbids claims beyond what a snippet supports. An empty or failed search
does not block the paper answer, but the answer must disclose that the online
check was inconclusive. This preserves a useful failure mode without silently
falling back to the old paper-only behavior.

The web fetcher keeps news as its default because the digest pipeline depends on
that vertical. Reading Q&A opts into Serper's general-search endpoint explicitly,
with the existing broad DuckDuckGo fallback. The rail says what it does in one
Body/SM line and adds no new component or visual token.

---

## 2026-08-20: A dig is an aside, not a document

Digging into a passage produced a washed, bordered, shadowed panel that
reprinted the passage at the top and then answered it. Three things were wrong
with that at once. It was a second frame in the middle of a page that already
has real frames, so a detour looked heavier than the read it interrupted. It
said the same thing twice: the sentence you highlighted was still sitting in the
paragraph above, with a copy of it below. And it never went away, so three digs
under one beat buried the beat.

**The passage stays marked where it is.** `annotateBeat` finds each dug
selection in the beat's own text and wraps it in the paper's first wash hue, so
the paragraph itself shows which of its sentences you have already pulled on.
That is what the panel's quote block was for, and the original does it better,
because it keeps the sentence in its sentence. Matching is first-exact-occurrence
and non-overlapping; a selection that no longer appears (a regenerated
companion) simply doesn't mark, and the thread is still anchored to its section
either way.

**The panel is an indent behind one 2px ink rule.** No wash, no border box, no
shadow — the aside shape, which the menu already has. It is **collapsible and
open on arrival**: you want the answer the moment it lands and you want the beat
back once you have read it. Collapsed, the header carries the passage it came
from, so two digs under one beat stay distinguishable — the only place the quote
is repeated, and only when the answer isn't visible to identify itself.

**The menu leads with a question box.** "Ask about this" used to throw the
passage across the page into the rail's composer, which made asking about a
sentence a journey; a question about a sentence belongs at the sentence. Typing
in the menu posts inline under the same beat a dig lands in, so passage,
question and answer stay in one place. The watcher had to learn to ignore events
originating inside the menu: focusing an input necessarily collapses the DOM
selection, and without that the menu closed the instant it was clicked into.
The passage is already in state by then, so nothing is lost.

**The glossary moves to the rail.** In series with the walkthrough it read as a
sixth beat and put a closed drawer between "Remember this" and what has happened
since. A glossary is a thing you look across at, not a thing you read through;
in a 372px rail its rows stack term-over-definition rather than running a 150px
term column beside a 200px gutter.

This is the first half of a larger move — the rail is meant to go entirely, or
to become half the screen while a passage is selected. The inline question box
is what makes that possible: it is now the only thing you need the rail for.

---

## 2026-08-20: The dig is a fold, and the wait is where the questions live

Three things were wrong with the dig-deeper panel the first time, and they were
all the same mistake: the panel was treated as a document rather than as an
answer to something you can still see.

**The passage is not quoted back.** The panel lands directly under the paragraph
the highlight came from, so printing the sentence again inside it was the same
words twice, two inches apart. The position is the citation.

**Digs fold.** Four digs down one walkthrough buried the paper under the
reader's own back-catalogue. A closed dig is one line — the mono `Deeper`
eyebrow, the glossary's chevron, and the first clause of the answer clamped to
the line. Digs
made in this session open; digs rehydrated from the thread store on load start
folded, because on the second visit the paper is the thing you came back for.

**The wait is a surface, not a gap.** The interleave used to sit inside the
answer panel as a bordered block with a heading, a caption and a footnote — a
survey card dropped into the middle of a paper, which is exactly how it read.
Now: while a dig is running there is **no box at all**. A loader, and under it
one thing at a time — the familiarity question if it is owed, then, only if the
reader answers it and the dig is still going, how much they liked the paper,
then a rotating tip. If the answer lands first, none of it was ever in the way.
Both questions are the same object (`ScaleRow`): one sentence, five boxes, a
label at each end, a skip. Two arrangements of one idea is what "busy" was.

**The one-question-a-day budget is not spent on a wait nobody saw.** The offer
is reserved 1.2 seconds into a dig, not at its start, and only if the dig is
still running. A fast answer costs the reader nothing.

**Paper ratings go in `events`, not `feedback`.** `feedback` is a two-value enum
that the interest weights read directly, and a five-point opinion is not a save:
somebody can rate a paper 2/5 and still have been right to be sent it. As an
event it reaches the taste ledger without changing what a star means.

---

## 2026-08-20: The librarian keeps a note, and the reader gets to read it

The digest finder stays a pipeline. It is deterministic, it is tuned, and every
attempt to make it "learn" by adding signals to the scoring chain has moved
outcomes less than it has cost. The librarian is a separate thing that owns
everything after a paper enters the reader's orbit, and its memory is a **taste
dossier**: ~300 words of prose rewritten from what the reader saves, walks past,
asks about and complains about.

**Why prose and not a feature vector.** Three reasons, in order of how much they
mattered. It can be shown to the reader, which is the whole trust argument
below. It is the form the LLM selection step can actually use — that step is
where the real quality call is made, and it takes an argument, not a number. And
it survives schema changes: a vector of hand-tuned features rots the moment the
features change, a paragraph does not.

**Two places, and no others.** The dossier goes into the Step 3b selection
prompt. The centroids become a ≤0.02 nudge on `score` in Step 3. Taste never
touches search, never touches `relSim`, and never touches the thresholds — an
on-taste paper that is off-theme is still out. This is the "upstream scoring is
a filter, not a ranker" rule from CLAUDE.md, respected rather than argued with:
the filter stays exactly as strict, and taste only reorders what already passed.

**Shown in settings, on purpose.** A taste model nobody can inspect is one
nobody can correct, and a wrong one is invisible until the digests have been
quietly bad for a month. `Settings → Librarian` renders the note verbatim, with
its cluster labels and how many signals it was written from. Read-only for now:
the way to change it is to save, skip and complain, which is also the way it was
built. An editable dossier is a different feature and would need to answer what
happens when the reader's account of themselves and their behaviour disagree.

**Dislike endpoint: kept, still no UI.** It has no caller, but it is now a
ledger input rather than a dead route, which is the condition the plan set for
keeping it. If nothing has wired a UI to it by the time the next reading-view
pass lands, delete it instead of letting it rot further.

**`digest_feedback` is finally read.** Rows have gone in since it shipped and
nothing has ever read one. Somebody typing why a digest was wrong is the
strongest negative signal in the product, so it now forces a rewrite on its own
rather than waiting for the five-signal threshold.

**The scout builds a shelf, not a list.** "What's happened since" used to be up
to four works that cite the paper, ranked by date. It is now at most three
standing in different relations to what you just read — one that came after, one
arguing from somewhere else on the same ground, one it was built on — each with
a one-line "why for you". Three papers you can tell apart beat four you can't.

---

## 2026-08-20: One bar over the selection, no label over the answer

Four small things in the reading companion, all the same complaint: the page was
naming its own machinery.

**The selection menu is one text bar.** It offered "Ask" and "Dig deeper" as two
controls and nobody could say what the difference was — they land in the same
place, under the same beat, and produce the same shape of answer. There is now
one field over the selection: leave it empty and the button digs, type a
question and the same button asks it. The button's own word swaps ("Dig deeper"
at rest, "Ask" once you have typed), so the default is taught without a second
control to weigh against.

**The highlight survives the click into that bar.** Focusing an input
necessarily collapses the DOM selection, which took the acid green with it and
left the reader typing a question about a sentence they could no longer see. The
page now draws the passage itself — `annotateBeat` takes marks with their own
fill, so a passage already dug into wears the paper's hue and the passage being
selected right now wears `SELECTION_FILL`. It is drawn only once the browser's
own selection has gone (tracked via `selectionchange`), so the two greens never
stack on the same words and the colour never changes under you.

**The dig aside loses its "Deeper" label.** An indented aside hanging off the
sentence you just highlighted, in a page whose every other block is a beat with
a Display/SM heading, does not need a mono eyebrow to announce what it is. This
retires the eyebrow the fold decision above still describes as part of a closed
dig: folded, the row is now the passage and the chevron, and the passage is the
only thing there that tells one dig from another when the answer is hidden.

**"Pitched for you" becomes a callout in the paper's hue, outside the aside.**
It was a mono eyebrow over a sentence that already says what it is ("You rated
yourself 3/5 on…"), sitting *inside* the dig, which made a disclosure about the
writing look like part of the answer. It is now one hairline-bordered block
filled with the paper's first wash hue — a blue paper gets a blue callout — and
it sits above the aside, not in it. The wash does the work the label was doing.

---

## 2026-08-20: The highlight is a handoff, and there is one verb

Three settled changes and one open question in the reading view.

**Black while you choose, the paper's colour once you have chosen.** The acid
green selection is gone. Two problems with it, and neither was the shade. Green
is this product's word for *that worked* — the bookmark fill, the tag check,
"All changes saved" — and it was being said about a passage that nothing had yet
happened to. And it was the same green on every paper, on the one surface whose
entire colour scheme is the single hue that paper owns.

The interaction is now a handoff between two highlights the system already has.
While the mouse is down the drag wears the ordinary ink `::selection` from
`globals.css`, exactly like every other selectable surface in the product. The
moment it is released, `useSelectionPick` collapses the range on purpose and the
page redraws those same words as a `<mark>` in the paper's wash hue. The colour
arriving *is* the confirmation that the passage has been taken.

The cost is real and worth naming: a released selection can no longer be copied,
because there is no longer a selection to copy. Keyboard selections are exempt
(they are still being made, so they are never collapsed out from under you), and
a highlight under `MIN_SELECTION` is left alone, so ordinary word-level copying
is untouched.

`SELECTION_FILL` is deleted from the design system and the acid rule is absolute
again: acid is ink, never a fill.

**One verb.** "Dig deeper" is out of the interface entirely. It was never
distinguishable from "Ask" — same landing place, same shape of answer — and the
last version papered over that by swapping the button's word, which taught the
distinction it was trying to remove. The button always reads "Ask". Pressing it
with an empty field sends `DEFAULT_QUESTION`, "What does this mean?", which is
what the placeholder quotes, what the model is asked, and what is *stored* as
the turn's question. The old stored value was `DIG_INTENT`, "Dig deeper on this
passage." — a sentence no reader ever wrote, sitting in their own thread.

The dig prompt (`DIG_SYSTEM`) is unchanged: it still tells the model to unpack
the mechanism rather than restate the passage. That was always the good part of
"dig deeper", and it is a prompt, not a label.

**The wait is the stamp.** Inline waits were reaching for a lucide spinner
pinned to the left of a line of text, where it reads as a bullet on the
paragraph above. `PageLoader` gains `inline`: the same square, the same 90°
steps, the same spectrum shadow, centred in whatever box it is dropped into.
The answer wait is that, centred, over "Re-reading the paper for that…". Not a
second loader shape — the same one, unpinned.

**The open question: what an answer looks like.** The shipped answer is an
indent behind one 2px ink rule with no caption on it, so a folded answer is a
bare chevron hanging off a paragraph. `/prototype/highlight-ask` puts six models
side by side, each fully interactive against canned text, each varying three
things at once: where the bar appears, where the answer lands, and what the
answer looks like folded.

| | Bar | Answer | Folded |
|---|---|---|---|
| **Caption band** | Floats under the selection | Indent behind the 2px rule, unchanged | A head in the paper's hue carrying the question |
| **Margin notes** | A single square at the end of the passage, opening a composer in the margin | A numbered note in the margin, level with its own line | Numeral and question, one line |
| **Pinned cards** | A card holding the quoted passage above the field | A full card in the rail, hover lights its mark | The card's hue header alone |
| **Command bar** | Docked to the bottom of the window, ink reversed, passage as a chip | Full-width band ruled top and bottom, question as a caption column | The caption column alone |
| **Ledger** | Floats under the selection | A numbered row in a ledger at the foot of the page | A row: numeral, question, its passage |
| **Unfurl in place** | Floats under the selection | Opens inside the paragraph, at the end of the passage | A chip sitting inline in the sentence |

The axis they actually disagree on is whether an answer is allowed to move the
text you were reading. Caption band, command bar and unfurl say yes; margin
notes, pinned cards and the ledger say no, and pay for it in distance between
the passage and its answer. Nothing is decided until one is picked.

**Round two, same day.** Two survived, the ledger by a clear margin, and the
reasons given are now the rules the surface is designed against:

1. **The read is never cut.** An answer may not push the paragraph you are
   reading down the page. Beside the text, under it, or over it. Never inside.
2. **The passage comes back in colour.** Every answer repeats the passage it
   came from, filled in the paper's hue. This is what makes an answer findable
   from a distance, and it is why the ledger works at all.
3. **Unobtrusive until wanted.** At rest, an answered passage is a coloured mark
   and at most a small numeral.
4. **Friendly, not system software.** The bottom-docked command bar was rejected
   outright ("hideous"). The thing answering has read the paper and is sitting
   next to you; it is not a command palette.

The kept two were tuned rather than left alone. The **ledger** is two-way now: a
stamp takes you down to its row, a row's passage takes you back up to the
sentence and blinks it once, and a small runner rides the bottom corner while an
answer is being written, because the ledger's one real flaw is that the answer
arrives a long way from your eyes. **Pinned cards** now tie card and mark in both
directions (hover either, the other responds) and the card's header carries the
passage rather than the question, because the passage is what you recognise.

Four replacements, all obeying the rules above: **the spine** (a ruled edge with
one tick per question at the height of its own line; point at a tick and the
answer swings out, nothing at rest), **the companion** (a friendly panel in the
bottom corner that takes the passage as a chip, the honest replacement for the
command bar, and the only shape that survives a phone), **the drawer** (the
ledger fixed to the bottom of the reading column so you never travel to it), and
**the whisper** (no furniture at all: point at a coloured sentence and its answer
appears in the ink tooltip, click to keep it).

---

## 2026-08-20: Teaching the highlight, in the paper's own colour

Highlight-to-ask is invisible. Nothing about a paragraph says a sentence is a
thing you can pull on, and a reader who never drags across a line never learns
that the product has this in it. What ships is a line of small grey text saying
so, which asks the reader to take a caption's word for it.

Three alternatives, on `/prototype/highlight-ask` as a second axis (any first-run
option can sit on any answer shape), all of which say it **in the paper's own hue
and inside the text**, because that is the only place the gesture exists. All
three retire on the reader's first question.

- **One lit sentence.** The most interesting sentence in the gist arrives already
  highlighted, with one line above the read saying so. A worked example, not an
  instruction: this is what a passage you have pulled on looks like. Clicking it
  asks the default question. The quietest, and the only one that puts no decision
  in front of a reader who just wants to read.
- **Three invitations.** Three short phrases lit across the paper, each carrying
  a question mark and, on hover, the question it would ask. Deliberately three
  different kinds of question: a mechanism, a number, a limit. It teaches the
  gesture and its range at once, which one example cannot.
- **The demo.** Nothing pre-lit. A highlight paints itself across a sentence, the
  bar appears under it with the default question in it, and both clear. The only
  one that teaches the *drag* rather than its result. Runs once, replayable,
  never loops, because a loop is an advertisement.

The trade is between the first two and the third: pre-lighting shows the reader
the outcome and gives them something to click, but it is a state they will never
see again and it slightly implies the product picked those sentences as the
important ones. The demo has no such implication and no clickable payoff.

**Decided, same day: none of them.** All three were built and all three are out.
The first run is one line above the read and nothing else:

> **Tip:** highlight part of the text to ask more about it and dig deeper.

A bolded sentence-case lead-in, not the mono eyebrow it used to wear, and it
retires on the reader's first question. The objection to pre-lighting was the
one the trade above already named and underrated: it puts the product's hand on
which sentences matter before the reader has read any of them.

---

## 2026-08-20: A multi-line drag has to work, and it did not

The bug that made the whole interaction feel broken, in one line of code:

```js
const host = range.commonAncestorContainer.closest("[data-section]")
```

Drag across three lines and release a few pixels past the end of the last one
and the selection has taken the gap under the paragraph with it. The common
ancestor is then the `<section>` or the reading column, and `closest` searches
*upwards* from there, so it never finds the `[data-section]` paragraph sitting
below it. The highlight looked perfect and produced nothing at all. The same
line killed any drag that ran from one beat into the next, which the old comment
described as intended behaviour ("one passage, one section, or nothing") when it
was really the same defect wearing a rule.

Two helpers replace it, in the reading view and in the prototype both:

- **`beatFor(range, scope)`** takes the beat the drag *started* in, falling back
  to the first beat the range actually intersects. A drag that runs off the end
  of a paragraph, or into the next one, now resolves to a real beat.
- **`clipToBeat(range, beat)`** intersects the selection with that beat, because
  everything downstream finds a passage by `indexOf` in the beat's own text: a
  selection carrying the gap, or half of the next beat, would never be found in
  the string it is supposed to be part of, and the mark would silently not draw.

Also: the anchor rect now skips zero-width rects. A multi-line range has them at
its ends, and anchoring the bar to one put it at the left margin of a line the
reader never touched.

**Shipped: pinned cards.** The prototype's second tab is now the reading view.
`DigPanel`, the indent behind a 2px rule sitting under the beat, is gone, and
with it the two complaints that started this: an answer arriving pushed the
paragraph you were reading down the page, and folded it was a bare chevron with
nothing on it to say what it was.

What replaces it, in `DigCard`:

- **A card in the rail**, full frame and the one shadow, **headed by its passage
  filled in the paper's hue**. That header is the whole reason this works at a
  distance: you never have to hold in your head which highlight a card was, so
  it does not need to sit next to the sentence to be findable. Folded, the
  passage clamps to two lines; open, it is the whole sentence.
- **A numeral, both ways.** The passage in the prose takes a superscript number
  (`user-select: none`, or it lands inside the next selection that crosses it
  and stops the passage matching). Hover a card and its sentence takes the ink
  underline; hover a sentence and its card lifts 2px; click either and you are
  taken to the other. Numbering comes from `digThreads()`, one list, so the
  number over the sentence and the number on the card cannot drift.
- **The rail is one scroll region now**, sticky and scrolling inside itself:
  cards, then glossary, then Ask. It used to be the thread alone that scrolled
  in its own frame, which only worked while nothing sat above it. A new answer
  scrolls its own card into view, since it lands at the bottom of a stack that
  may already be taller than the screen.
- The wait, the interleaved questions, the follow-up composer and the "pitched
  for you" disclosure all moved inside the card. The disclosure still waits for
  the answer: the wait is a loader and one question, and a framed callout is
  neither.

The cost, stated plainly: on a narrow screen the rail is below the read, so an
answer is a scroll away from its sentence. The numeral and "take me back to this
sentence" are what pay for that, and the alternative (an answer that cuts the
column) is the thing being fixed.

**Round three of the prototype, same day.** The whisper and the pinned cards win
over the ledger, and they are one thing, so the merge is now the first tab.
Every answer keeps a card in the rail, folded: a numeral and its passage in the
paper's hue, which is a list of what you asked and nothing more. The reading
stays a whisper, so pointing at a coloured sentence gives you the first breath of
its answer over the page and adds nothing to the column. Click a sentence or its
strip and that one card unfolds, alone. Each half fixes the other's flaw: the
whisper's is that nothing says you asked anything, the rail's is that four open
cards is too much furniture.

---

## 2026-08-20: The reading view holds the paper, your answers, and two corners

Four things left the page, all of them the product talking about itself or about
its own furniture in the middle of someone else's paper.

**"Pulled in for X because you follow Y"** is gone. It was defensible when the
library was new and a saved paper needed a reason to exist, but the reader
opened this page on purpose, from a card they recognised. A line explaining why
it is in front of them is the product needing to be thanked.

**"You rated yourself 3/5 on…"** is gone with it, and `PitchedForYouLine` is
deleted. It was a disclosure about how the writing was pitched, sitting above
the writing. The familiarity level still does its work (it tiers the glossary
and pitches the companion); it simply stops announcing itself.

**The glossary left the rail** for a menu in the top right, next to "Read the
full paper". It is reference material, and it was sitting in the same column as
the answers the reader made themselves, at the same weight. A corner is the
right weight for a word list you open twice.

**Asking left the rail too**, and became the shape the prototype's companion
was: a 52px square in the bottom corner, present on every paper at every scroll
position, unfolding into a panel with the thread, the three suggested questions
and a composer. It holds the questions that are not about any one sentence.
Questions anchored to a highlighted passage stay cards in the rail, because
those have a place in the paper to belong to and these do not.

What is left: the paper in the left column, your answers in the right, the
glossary in one corner and asking in the other.

**The interleaved question now outlives the wait.** It used to live inside
`DigWait`, so the answer arriving replaced it: a question you were half a second
slow to reach for disappeared under the thing you were waiting for, and the
rating we most want is the one asked while someone is still in the paper. It is
its own component now (`InterleaveQuestion`), pinned above the answer inside the
card, staying until it is answered or waved off. Its lead changes when the
answer lands, because "while I read" stops being true.

**One more, quietly load-bearing:** a `fixture` now seeds `ReadingPaperDetail`'s
state synchronously rather than through an effect. The prototype stops flashing
"Reading the paper…" for a frame, and the whole surface becomes
server-renderable, which is how this round was verified without a browser.

---

## 2026-08-20: One conversation, and a second verb for words

The rail was a stack of answer cards and the corner was a chat panel, which is
two places to look for one conversation, split by whether a question happened to
start from a highlight. A reader does not hold that distinction. So there is one
panel now, `Conversation`, filling a 420px rail at viewport height: a header, a
log that scrolls, a composer that never moves.

Everything lands in it, in the order it happened. A question that started from a
passage carries that passage at the top of its block, in the paper's hue, with
the numeral it wears in the prose.

**The two-way tie is the feature.** Click a highlighted sentence in the paper and
the conversation scrolls to what was said about it and lights that block for a
beat. Click the passage in the conversation and the read scrolls back to the
sentence. That is what lets the talk live in a column of its own instead of
being wedged under the paragraph: you can always get from one to the other in
one click, from either end.

**Typing continues the conversation** rather than starting a new thread. Highlight
to change the subject, type to keep pulling on the one you are on. This is what
makes it a chat rather than a list of question-and-answer pairs, and it is why
the per-thread "+ Follow up" control is gone.

**The glossary comes back to the rail**, folded, above the conversation. It spent
a few hours as a menu in the top right; both are out of the read, but the rail is
where the other thing you accumulate as you read already lives, and a fold takes
one click instead of one click plus aim.

### A second verb, and why it is not "Dig deeper" again

Highlighting now offers **+ Glossary** as well as Ask. This is not a repeat of
the pair that was cut: "Ask" and "Dig deeper" landed in the same place and
produced the same shape of thing, and nobody could say what the difference was.
A word and a passage are different objects with different fates. A word is
something you look up and keep; the answer belongs in a list you can scan later.
A passage is something you ask about; the answer belongs in the conversation.

`POST /api/papers/[id]/glossary` defines the term **against the paper's own
text**, so it is defined the way this paper uses it, then appends it to the
cached companion. It shows in the glossary immediately as "Looking it up…", it
becomes a chip in the prose like any generated term, and it survives a reload.
The route de-duplicates before and after the model call, so highlighting the same
word twice costs one definition.

### What if someone highlights a really long section

Three different answers, because it is three different questions.

- **The glossary control simply is not offered.** `looksLikeTerm()` gates it:
  under 60 characters, five words or fewer, no sentence punctuation inside it.
  Anything longer is a passage, and a passage is a thing you ask about. This is
  better than defining a paragraph badly.
- **Asking still works, at any length**, and the selection is already clipped to
  one beat (`clipToBeat`), so the ceiling is one paragraph rather than the whole
  page. The API caps the stored passage at 1200 characters.
- **The display clamps, the anchor does not.** The passage at the top of a
  conversation block shows three lines and then an ellipsis. Reprinting half a
  beat above its own answer is exactly what the old inline panel did wrong. The
  whole passage stays the anchor and stays marked in the paper, and the chip is
  the way back to reading it there.

### Three corrections, same evening

**Flat colour, not the wash.** The conversation's header wore the card wash, a
three-blob radial gradient, which at 420px behind a 20px heading reads as a
smudge rather than as a colour. It is the paper's flat hue now, the same fill the
passages below it wear. One column, one way of saying one thing. (`Remember
this` keeps the wash: it is the object the page opened from, and its background
has to stay light enough to read a hue-marked passage through.)

**Nothing moves on hover.** A hovered block used to slide right behind an inset
ink rule, which put a second vertical line beside an answer that already has one,
and shifted the text under the cursor. The lit state is now an ink underline on
the passage chip: the same signal a marked passage wears in the prose, at both
ends of the tie, with no movement at all.

**Folded by default.** The glossary folds and the conversation did not, which
made the one thing the reader has not used yet the loudest thing in the column.
It opens the moment a question is asked from anywhere, and until then it is a bar
saying what it is for.

---

## 2026-08-26: Highlighting puts the passage in the conversation

The floating bar over the selection is gone. Highlighting now does one thing:
the passage arrives in the conversation, the panel opens, and the cursor is in
the field. This is the prototype's companion gesture, and it is better than a
bar for a reason worth writing down: what you are about to ask about stays
legible, in the paper's colour, in the place the answer will appear, while you
type the question. A bar floating over the sentence covered the thing it was
about.

The passage is **held state** now, not the live selection. It stays until it is
asked about or dropped with the ×, and the ordinary ink selection is collapsed
the moment it is taken, so the words are marked in the paper's hue rather than
by the browser.

**This is also the fix for "highlighting stopped working after the first time",
which was two bugs.** The passage used to live in a `pick` state cleared by a
document-wide capture-phase `scroll` listener, so anything that scrolled between
the release and the question threw it away, and the rail scrolls itself. And
`ask()` opened with `if (streamingTurn) return`, so a second question asked
while a five-second answer was still streaming did nothing at all, silently.
Questions **queue** now: asked while another is being written, they run in order,
and the log says how many are in line. The wait tip has said "highlight anything
else while you wait" this whole time, which was a promise the code did not keep.

`MIN_SELECTION` drops from 16 to 3. Sixteen characters was defensible when a
highlight could only start a conversation, but a word is now something you can
do something with: double-click "criterion" and the panel offers to define it
and keep it.

### Flatter, wider, and the questions are centred

- **No numerals.** The tie between a passage and its block is the passage
  itself, in colour, at both ends. A numbered square inside a filled chip inside
  a block above an answer behind a rule is four frames deep for one answer.
- **No rule down the answer** either. Passage in colour, question in bold,
  answer in plain text.
- **480px, not 372.** It is a conversation, not a stack of notes.
- **Bottom-aligned.** Folded, the glossary and the conversation sit in the
  bottom right corner of the screen instead of floating at the top of a column
  of nothing. Open, the conversation grows upward into the space above them.
- **The interleaved question has no rule above it and is centred** in its own
  block, skip underneath. It is a question being asked *of* the reader, not
  another section of the answer, and a left-aligned scale under a left-aligned
  answer read as one more paragraph.
- **The suggested questions are gone.** Three model-written questions sitting in
  the panel before the reader has asked anything is the product filling its own
  silence.

---

## 2026-08-29: One column and one sheet. The rail is gone

Two problems, one cause.

**It was clunky.** The count of furniture around the paper had crept back up:
a 480px rail holding a folded glossary bar above a folded conversation bar,
bottom-aligned, each with its own chevron, beside a column of prose. Three
things to fold and unfold before you have read a sentence.

**Mobile was broken, and not in a small way.** Below 1060px the rail dropped
underneath the whole article. Highlighting a sentence on a phone opened a panel
three screens down, so the gesture appeared to do nothing at all. That is not a
media query that needs tuning; it is a layout that only ever existed on a
laptop.

So: **no rail.** The paper is one centred 720px column at every width, and
everything that is not the paper lives in **one sheet docked to the foot of the
viewport** — the same object, in the same place, on a phone and on a laptop.
One implementation, no responsive divergence, nothing beside the read.

The sheet has two states and two halves:

- **Folded** it is a bar: what it is for, how many questions are in it, and the
  stamp turning if an answer is being written while it is shut.
- **Open** it is a body and a composer, capped at two thirds of the screen so
  the sentence you highlighted stays visible behind it.
- The body is **the conversation or the glossary**, chosen with a `Segmented`.
  They are the only two things this page accumulates as you read, so they are
  two halves of one control rather than two stacked panels in a column of their
  own. Adding a word with `+ Glossary` switches to that half; asking anything
  switches back.

Everything else about the interaction is unchanged: highlight and the passage is
held in the composer in the paper's colour, the sentence is marked in the same
colour, the passage in a block is the way back to the sentence and the sentence
is the way back to the block.

Touch gets one more path: `touchend` now reports a selection where the browser
allows one, and the per-beat affordance below 720px stays, because touch
selection loses to the native callout often enough that it cannot be the only
way in.

On a phone the sheet goes full-bleed, loses its side borders and its shadow, and
takes `env(safe-area-inset-bottom)` so the composer is not under the home bar.

---

## 2026-08-29 (later): the answer is a footnote, not a place

Every arrangement before this one put the answer somewhere else and then built
machinery to get back: a panel under the beat, a card in a rail, a chat in the
corner, a sheet at the foot of the page. Each needed a numeral to tie the two
ends together, a hover link, a scroll-to, a two-way jump. That machinery is the
clunkiness. It was all paying for a decision nobody asked for, which was that
the answer lives away from the sentence.

So the answer tags onto the passage.

- **Highlight** and the passage fills with the paper's colour. An input opens in
  the flow directly under it, indented behind one ink rule, in exactly the place
  the answer will appear. Nothing floats over the sentence, nothing docks, and
  what you are asking about is the coloured words an inch above the field.
- **Ask** and the answer streams into that same block.
- **Closed**, the whole thing is **one ink square with a number in it**, sitting
  at the end of the passage like a footnote marker. Click it to open, click it
  again to close. A paper you have asked four things about is the paper, with
  four small squares in it.

Numbering counts questions, not positions: the first thing you asked is 1
wherever in the paper it is. Fresh answers open as they arrive; ones rehydrated
on load stay squares, so re-opening a paper shows you the paper rather than your
own back-catalogue.

The two things that genuinely have nowhere else to be are sections at the foot
of the read, in the column, in normal flow: **Ask this paper** (a field, and
whatever it has been asked) and **Glossary** (folded). Neither is a panel over
the page.

**There is no fixed, floating, sticky or docked furniture left in the reading
view, and no rail.** That is what makes it identical on a phone and a laptop:
the whole surface is one 720px column of ordinary flow, so an answer opening on
a phone happens where the reader is looking, not three screens away.

For the record, the shapes tried and dropped, in order: inline `DigPanel` under
the beat · `DigCard` stack in a rail · floating `SelectionMenu` over the
selection · `AskCompanion` in the corner · `Conversation` filling a 480px rail ·
`TalkSheet` docked to the viewport. Six. The last one is the first that does not
need to explain where the answer went.

### The margin, and how it comes and goes

Two corrections to the footnote version, same day.

**The answer opens on the right.** A block unfolding inside the paragraph pushed
the rest of the sentence down the page every time, which is the thing that has
been wrong with every inline arrangement here. So on a wide screen the square
stays in the sentence and the answer opens in the **margin beside it**, level
with the line it belongs to. Answers stack downward only far enough to clear
each other.

**The margin does not exist until something opens into it.** No reserved column
of nothing, no empty rail. The read is a centred 720px column; open a square and
the page widens to 1140 with a 380px margin, and the read keeps its measure, so
the words move but never reflow. Close the last one and the margin is gone and
the column recentres. The transition is on `max-width`, so it slides.

Below 1080px there is no margin to open into, so the answer opens in the flow
under the passage, which is the phone behaviour and the only place an inline
block is the right answer. Same component in both columns; the only difference
is which one it is rendered into.

### Three corrections

**The composer was level with the wrong line.** The margin's positions are
measured against the passage in the read, and the read was a *fractional*
column: `minmax(0, 1fr)` inside a container animating from 720px to 1140px. Mid
animation the column was squeezed to about 300px, every line in the paper
rewrapped, and the measurement landed on where the passage used to be. The read
is a **fixed 720px in both states** now, so opening the margin slides the column
sideways and reflows nothing, and a `ResizeObserver` re-measures anyway when the
window, the fonts or the container change under it. The breakpoint moves to
1220px, which is where 1140 of shell plus the page's own padding actually fits.

**The paper rating is gone.** "How much did you like this paper?" queued up
behind the familiarity question and interrupted an answer to run a survey. The
familiarity one stays: it changes what the reader is handed next, which is a
fair trade for the interruption, and a five-point opinion about the paper is not.
The `/api/papers/[id]/rating` route is untouched and unused, so this is one line
to put back if it turns out to be wanted.

**A word the reader adds is never filtered out again.** `glossaryForLevel` drops
basic terms for a reader who says they are expert in the topic, which is right
for what the companion volunteers and wrong for what was explicitly asked for:
an expert adding a word would have watched it vanish on the next render. Entries
from `+ Glossary` carry `added: true` and skip the filter.

### The wait says what it is doing, and there is one field per place

**The tip in the wait is gone.** It was a mono `Tip` row naming features
underneath the loader, which is the product using the reader's dead air to
advertise to itself. What replaces it is a rotating line about what is actually
happening, allowed to be dry about it: the honest content of this pause is that
something is reading a paper carefully on request, which is a slightly absurd
thing to be doing.

Rules for `WAIT_LINES`, since it is a content surface people will add to:

- It must be **true of this moment**: the model is reading the paper's own text
  and checking it against the web. Not "did you know", not a feature tour.
- Under about **eight words**, or it wraps in a 380px margin.
- **Dry, not cute.** No exclamation marks, no "hang tight", nothing that
  congratulates the reader for waiting.
- **The first line is never a joke.** Whatever else the voice is doing, the
  reader is owed a plain statement of what is happening before it starts.

The line has a minimum height so a short line after a long one does not shift
the answer that is about to land in its place.

**Two identical fields, stacked.** "Ask this paper" had a per-thread "Follow
up…" row *and* its own composer at the foot, so a reader was looking at two
identical inputs with two identical Ask buttons on top of each other and had to
guess which one meant what. There is one field now, at the foot, and it
continues the conversation. Highlighting is how you change the subject; this
field is how you keep pulling on the current one. An answer opened in the margin
keeps its own follow-up field, because that one is beside a passage rather than
stacked under another field.

### Closing from the margin

An answer opened in the margin could only be closed by finding its square back
in the paragraph, which on a wide screen is a 18px box somewhere up the page.
Two ways out now, both from where the reader already is:

- a **×** on the answer itself, sitting on its first question rather than in a
  header bar of its own, so it costs no extra furniture;
- **Escape**, which puts everything down at once: the question being typed and
  every open answer. Since the margin only exists while something is open, one
  key clears the page back to the paper.

### One text bar, and it moves

There were three fields on the page at once: one hanging off a fresh highlight,
one inside every open answer, and one at the foot of the read. A reader looking
at two identical inputs stacked on each other has to work out which of them means
what, and the honest answer was "whichever one you are nearest".

So there is **one bar, and it goes where you are**:

- highlight a passage and it is under that passage;
- tap an answer you opened earlier and it moves into that answer;
- touch neither and it waits at the foot, under "Ask this paper".

Whatever it is currently inside is what the next thing you type is about, which
is why it does not have to say so. When it has gone up into the paper, the foot
of the read says where it went rather than growing a second field.

An answer in the margin now wears **the same numbered square as its passage**,
before the question. Out there it is the only thing saying which highlight this
answer belongs to.

**"¶ Ask about this paragraph" is deleted.** It was the touch fallback for a
beat, it only ever appeared below 720px, and it did nothing a reader could see.
Touch selection reports through `touchend` now, which is the same path as a
mouse; if that turns out to be unreliable on a given phone, the fix is to make
selection work there, not to hang a second control off every paragraph.

## 2026-08-25: "Quietly" and "silently" are banned words, with a mechanism

The ban was already given, verbally, more than once. It shipped anyway: "Will
advertisers quietly corrupt how AI guides us?" ran as the 2026-08-25 headline.

Reading the code explains why. "Quietly" appeared in four prompt bodies as one
item in a long AI-tell list ("no quietly, seamlessly, notably, delve, leverage,
underscore, landscape, realm"), which is a taste hint, not a rule: a model
weighing fourteen soft preferences will trade one away for a sentence it likes.
"Silently" was in none of them. And `THEME_TASTE_RULES`, the block that governs
the headline, carried no word list at all, so the one line every reader sees
first was the least protected string in the product.

A verbal rule that lives only in a prompt is a preference. The em-dash ban had
already established the shape a real rule takes here, so this one copies it:

1. **One place.** `src/lib/ai/banned-words.ts` owns `BANNED_WORDS` and the
   `BANNED_WORDS_RULE` prompt text. Every prompt that writes reader-facing copy
   interpolates the rule instead of restating it, which is what stopped the
   old list from drifting into four versions.
2. **A gate on the headline.** `themeProblemsWithoutSources` rejects a candidate
   containing a banned word, so the existing repair path rewrites it before the
   cold reader ever sees it. Deterministic, no extra model call.
3. **A scrub on the way to the database.** `stripBannedWords` runs over the
   theme, the gist, the synthesis, the key concepts and every per-paper field at
   the insert in `digest.ts`, plus the companion's parsed fields. Deleting an
   adverb always leaves a grammatical sentence, which is what makes a mechanical
   last resort safe (an em dash needs a judgement call about what replaces it;
   "quietly" does not).

**Where the scrub deliberately is not:** `aiChat`. Putting it at the provider
choke point would strip the word from the critique's own `bannedPhrasesFound`
array, so the revision prompt would list an empty bullet and the sentence would
survive. The scrub belongs where text is known to be reader-facing.

The one surface still on prompt-only enforcement is a streamed Ask or Explain
answer, because the reader watches the tokens arrive and there is nothing to
scrub before they see them.

## 2026-08-31: The page is the paper

Three deletions and one promotion, all the same move: the reading view should
contain the paper and the reader's own marks on it, and as little else as can be
managed.

**"Ask this paper" is gone.** With it goes the only question on the page that
was not about a passage, and the only field that existed when the reader had not
touched anything. The bar's resting state is now *no bar*: a paper you are
reading has no input on it. Highlight something and the bar is there; press
Escape and it is not. Legacy threads with no section (typed questions asked
before this) no longer render anywhere; they are still stored, so this is
reversible.

**"Remember this" is a highlight, not a box.** It was a framed, washed, shadowed
panel, which made the last thing on the page the loudest thing on it. It is a
beat like the others now, with the sentence itself filled in the paper's colour.
One consequence had to be handled: a passage highlighted *inside* that line
cannot be filled in the same colour or it disappears, so marks in this beat wear
the ink underline instead of a fill.

**Citing works are paper cards.** "What's happened since" was a hairline
separated list with a bookmark on the right, which is a second way of drawing
the one object this product already has a card for. They are `PaperCard`
compact now, in the same two-up grid the shelf uses. The card's own bookmark is
not used, because a citing work has no row yet and has to go through
`save-external`; the save lives in the card's `footnote`, which is the one place
a compact card lets its caller put a control.

### Two corrections

**The citing works go back to a list.** Cards were tried there and are too much
object for a list of things you have not read, at the foot of a page whose whole
argument is that the paper is the only thing on it. One hairline-separated row
per paper with a save on the right.

**The glossary moves to the top right and travels with the reader.** At the foot
of the read it was a folded panel you had to reach the end of the paper to use,
which is exactly the wrong place for the thing you want in the middle of a
sentence. It is a control in the page's own bar now, and that bar is sticky
under the site header, so it is in the same corner at every scroll position.
Adding a word with `+ Glossary` opens it; Escape closes it along with everything
else.
