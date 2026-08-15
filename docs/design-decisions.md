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

Central question generated BEFORE paper search. Max 8 words. Must sound like something a real person would wonder about.

**Good**: "Can we wear our gut health?"
**Bad**: "Can bacteria become your stylist?"

The difference: the good one is something you'd actually text a friend. The bad one sounds like a BuzzFeed headline.

Cross-domain combos are encouraged but only if naturally connected. After papers are found, the theme is always revised to better thread them (we tried letting the AI decide whether to revise — it always said "no change needed", so now revision is mandatory).

---

## 6. Paper Selection

All papers scored against theme embedding. No hierarchy (no "anchor" paper). The anchor paper approach was tried and rejected — highly cited papers dominated and pulled in methodology papers from wrong fields.

Papers that the user has seen in the last 30 days are excluded (cross-digest dedup). Interest rotation penalizes recently-used topics (last 5 digests) so the same domain doesn't appear every day.

---

## 7. Synthesis Tone

Conversational, like texting a group chat. Contractions, casual transitions. Not dumbed down — just human.

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

Google OAuth via Auth.js (next-auth v5) with DrizzleAdapter. BYOK (bring your own API key) model — users provide their own Anthropic/OpenAI/Gemini key.

Keys stored in localStorage (client-side), never sent to our DB. This means:
- We never see or store user API keys
- Users control their own AI costs
- No server-side key management or billing
- Switching providers clears the API key field (keys aren't interchangeable)

---

## 10. Deployment

Vercel + Turso (libsql). Local dev uses SQLite file. Production uses remote Turso DB. Embeddings run in-process via `@xenova/transformers` with `all-MiniLM-L6-v2` (no external API needed). This keeps embedding costs at zero and avoids external dependencies for the scoring pipeline.

Environment variables: TURSO_DATABASE_URL, TURSO_AUTH_TOKEN, SERPER_API_KEY, AUTH_SECRET, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, ADMIN_USER_ID, NEXTAUTH_URL

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
