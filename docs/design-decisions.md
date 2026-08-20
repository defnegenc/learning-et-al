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

Typography: Apercu Pro for body text (warm, readable), Space Grotesk for display (bold, geometric), IBM Plex Mono for labels.

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
reading page means one thing: what you are highlighting right now. The paper's
hue is not gone — it still carries the dig panels and the `Remember this` frame,
where nothing competes with it.

The glossary's disclosure also becomes the chevron the interests accordion uses.
It was already collapsible and closed by default, but a bare `+` / `–` was
carrying the whole signal and read as punctuation rather than a control.
