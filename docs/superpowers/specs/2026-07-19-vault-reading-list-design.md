# Vault → Reading List + Digest History

**Date:** 2026-07-19
**Status:** Approved design, pending implementation plan

## Overview

The vault stops being an all-papers archive with compare tools and becomes two things:
a **Reading List** (your bookmarked papers, each with a rich detail view) and a
**Digest History** (a two-pane browser of every past digest). Digest starring is
removed entirely — papers are the only thing you save. The undiscoverable
hide/regenerate flow moves to a big end-of-digest CTA.

Nav stays: **Today's Digest / Vault**. The vault page's default view is the Reading
List; a **"Digest History"** button top-right switches to the history view.

## 1. Reading List (vault default view)

- Shows **only bookmarked papers** — the existing `feedback.type="star"` rows. No
  migration needed; current bookmarks appear as-is.
- **Removed:** the all-papers archive, domain/theme filters, the "starred digests"
  filter, and the Compare feature (`compare-view.tsx`, `/api/vault/compare`). The
  `comparisons` table stays in the DB (harmless).
- Card click opens a **paper detail** view:
  - Fuller metadata: title, authors, venue, date, external link.
  - The **abstract, with jargon terms dotted-underlined** — hover (desktop) or click
    (mobile) shows a plain-language definition. Same interaction pattern as the
    synthesis hard-word hover defs.
  - Below the abstract, an **"Explain like I'm 5"** button. Click generates a short
    plain-language gist of the abstract. Once generated, the gist renders in place of
    the button and persists.

### Generation mechanics (lazy, cached)

- **Jargon extraction:** runs the first time a paper's detail view is opened, via a
  new API route. Results (terms + definitions) cached in the DB so subsequent opens
  are instant and cost nothing.
- **ELI5 gist:** generated on button click, cached the same way.
- Storage: new nullable text columns on `papers` (JSON for annotations, text for
  gist). Column additions via manual `sqlite3 ALTER TABLE` locally + push to Turso
  (per the drizzle-kit SQLite gotcha).
- Uses the same AI provider resolution as the rest of the app (server-side
  `CRON_AI_*` for signed-in users, BYOK if configured).

## 2. Digest History

- Entered via a **"Digest History"** button at the top right of the Reading List.
- **Two-pane layout, like a chat app:** left rail lists all digests (date + theme,
  newest first, from `/api/digest?all=true`); clicking one renders that digest on the
  right (papers via `/api/digest?id=`).
- No archiving concept — it's simply the full history. Mobile: rail collapses to a
  list; tapping a digest navigates to it full-screen with a back affordance.

## 3. Digest starring removed — bookmark is the only save

The old confusion: "star" on digests, "save" on papers, similar icons. Resolution:
digest-level saving goes away entirely.

- **Remove** the "Save/Saved" digest button from the today page and delete the
  `/api/digest/star` route. The `digests.starred` column stays in the schema
  (no destructive migration) but nothing writes to it.
- **Email best-of** (`cron/route.ts`): drop the starred-digest preference — best is
  simply the most recent digest of the period (the existing fallback).
- Papers keep the **bookmark** icon, top right of each card, as the single save
  affordance. `paper-card.tsx`'s local-state-only bookmark must be wired to persist
  via `/api/papers/[id]/feedback` like `source-card.tsx` already does.

## 4. "Don't like this digest? Regenerate." (end-of-digest CTA)

- **Remove** the hide (X) control from the top bar.
- After the last source card, add a large centered CTA: dark grey text
  **"Don't like this digest? Regenerate."** with an X icon — dark grey, larger than
  the old top-bar X. Styled to sit like the paper cards, but text-only/ghost (no
  card chrome).
- Click reveals an inline reason input ("Want a different one? Tell us why…") and a
  Regenerate button — reusing the existing `HiddenDigestState` flow: POST
  `/api/digest/hide` with `{digestId, reason}`, then force-generate.
- Rationale: end-of-digest is the moment the user actually knows they didn't like
  it, and the button is named after its reward (a fresh digest), not the complaint.

## 5. Out of scope / later

- Renaming the `/vault` URL (label-level rename only, if any label says "vault" it
  may stay — user doesn't mind the name).
- Inline "not your day?" nudge if the user scrolls through without bookmarking —
  hold unless the CTA underperforms.
- Dropping the `digests.starred` or `comparisons` schema — no destructive
  migrations.

## Error handling

- Jargon/ELI5 generation failures: show a small retry state in the detail view;
  never block rendering the abstract itself.
- Digest History with zero digests: empty state prompting to generate today's
  digest.
- Reading List with zero bookmarks: empty state explaining the bookmark icon on
  paper cards.

## Testing

No test suite — manual QA via the UI: bookmark/unbookmark round-trip, detail view
jargon hover on desktop + tap on mobile, ELI5 generate + cached reopen, history
two-pane navigation, best-of email falls back to most recent digest (verify via
cron route logic), end-of-digest regenerate flow with reason.
