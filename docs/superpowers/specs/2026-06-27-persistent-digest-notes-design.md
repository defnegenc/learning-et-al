# Persistent Digest Notes — Design

**Date:** 2026-06-27
**Status:** Awaiting review

## Problem

While reading a digest, the user jots down genuinely interesting points, but those
notes are lost. Today they save only to `localStorage`, so they are trapped in one
browser, vanish in incognito, and are invisible from any other device. The user
wants their "paper trail" stored in the database, attached to each digest's
permanent history, surviving reloads and regeneration.

## Goals

- Notes persist server-side, tied to a specific digest, visible from any device.
- Notes are part of a digest's permanent history (every digest already has a stable
  UUID and old digests are never deleted — regeneration inserts a new row).
- No existing locally-stored notes are lost in the transition.

## Non-Goals (this pass)

- **Per-paper notes** (the box inside each paper's detail view) stay on
  `localStorage` for now. Persisting those is a fast follow, not part of this change.
- No notes UI for logged-out viewers (notes require an authenticated owner).
- No rich text, tagging, or cross-digest notes aggregation. Plain text only.

## Current State (as built)

- **Two** digest-level note widgets, both `localStorage`-only, sharing key
  `digest_notes_${digestId}`:
  - Floating notepad, bottom-right — `src/components/today/today-page.tsx:423`
    (`NotepadFloat`).
  - Inline sidebar "Notes" box — `src/components/today/synthesis-banner.tsx:96`
    (`DigestNotes`).
- Per-paper notes box — `src/components/today/paper-detail.tsx:80`, key
  `paper_notes_${paper.id}` (out of scope here).
- `digests` table — `src/lib/db/schema.ts:54`. PK is `id` (UUID). No per-day
  uniqueness; regeneration inserts a new row, preserving history.
- Reference pattern for mutable per-digest data: the `starred` boolean, written via
  `POST /api/digest/star` (`src/app/api/digest/star/route.ts`) which verifies
  ownership then `db.update(digests).set({ starred }).where(eq(digests.id, id))`.

## Design

### 1. Database

Add a nullable `notes` TEXT column to the `digests` table in
`src/lib/db/schema.ts`:

```ts
notes: text("notes"),
```

Migration (per CLAUDE.md gotcha — `drizzle-kit push` is unreliable for some SQLite
changes; a plain column add is safe but we apply it explicitly):

- Local dev: `sqlite3 paper-processor.db "ALTER TABLE digests ADD COLUMN notes TEXT;"`
- Prod (Turso): push the schema change separately to Turso.

### 2. API — `POST /api/digest/notes`

New route `src/app/api/digest/notes/route.ts`, mirroring `digest/star`:

- Auth via `getAuthUser(req)`; `401` if unauthenticated.
- Body: `{ digestId: string, notes: string }`.
- Verify the digest exists and belongs to the user; `404` otherwise.
- `db.update(digests).set({ notes }).where(eq(digests.id, digestId))`.
- Track event (`save_digest_notes`) consistent with the star route.
- Response: `{ ok: true }`.

Notes are stored verbatim (trimmed of trailing whitespace only). Empty string is a
valid value (clears the notes).

### 3. Load path

Include `notes` in the digest payload returned by `GET /api/digest`
(`src/app/api/digest/route.ts`) so the widget hydrates from the DB on every load,
on any device.

### 4. Frontend — consolidate to one notes box

The user chose to consolidate the two widgets into one.

- **Keep** the inline "Notes" box (`DigestNotes`) — it is visible by default and is
  where the user already writes. **Remove** the floating `NotepadFloat`.
  - *Reviewer decision point:* if you'd rather keep the floating notepad instead,
    say so and we swap which one survives — the persistence wiring is identical.
- Lift notes state to a single owner (`today-page`) and pass it to the surviving
  box, so there is one source of truth (no more two boxes silently disagreeing).
- Initialize from the `notes` value in the digest payload.
- Save on blur **and** debounced autosave (~800ms after typing stops) via
  `POST /api/digest/notes`. Keep the existing "saved ✓" affordance.
- Disable / hide the box for logged-out viewers (no owner to attach notes to).

### 5. No-loss migration from localStorage

On first mount of the notes box for a given digest: if `localStorage` has notes
under `digest_notes_${digestId}` and the DB `notes` value is empty, POST the
localStorage content once to seed the DB, then treat the DB as the source of truth.
This guarantees nothing already written is lost. After a successful upload the
localStorage key may be left in place (harmless) or cleared.

## Data Flow

1. `GET /api/digest` → digest payload now includes `notes`.
2. Notes box hydrates from `notes` (falling back to a one-time localStorage upload if
   DB empty but localStorage has content).
3. User types → debounced autosave + save-on-blur → `POST /api/digest/notes`.
4. Server updates the `digests` row by `id`. Notes are now part of that digest's
   permanent history and load identically on any device.

## Error Handling

- Save failure (network / `500`): keep the text in the box, surface a quiet
  "couldn't save" state rather than a "saved ✓"; retry on next blur/debounce. Do not
  clear the user's text on failure.
- `401` (session expired): same as logged-out — stop trying to save, keep text local.
- Ownership mismatch (`404`): should not happen for the owner; log and no-op.

## Testing (manual, per project convention)

- Type notes, reload the page → notes persist.
- Type notes, open the same digest in a different browser/device while signed in →
  notes appear.
- Open an old digest from history → its own notes load (not today's).
- Pre-seed `localStorage` notes, load with empty DB → notes migrate up once, then
  persist via DB.
- Logged-out admin-digest view → notes box hidden/disabled, no errors.
- Clear notes to empty and reload → stays empty (empty is a valid saved value).
