# Vault → Reading List + Digest History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the vault as a Reading List of bookmarked papers (with jargon-annotated abstracts + cached ELI5 gists) plus a two-pane Digest History; remove digest starring; move the hide/regenerate flow to an end-of-digest CTA.

**Architecture:** The vault page becomes a two-view container (Reading List default, Digest History via top-right button). Paper insights (jargon terms + ELI5) are generated lazily by a new API route and cached in new nullable columns on `papers`, following the existing `blurb` route pattern. Digest starring is deleted end-to-end (UI, API route, cron/email preference). The regenerate CTA lives at the end of the brief digest and reuses the existing `/api/digest/feedback` + `/api/digest/hide` + force-generate plumbing.

**Tech Stack:** Next.js 16 App Router, Drizzle ORM + SQLite/Turso, `aiComplete` from `@/lib/ai/provider`, existing brutalist component styles.

**Spec:** `docs/superpowers/specs/2026-07-19-vault-reading-list-design.md`

## Global Constraints

- No test suite exists — every task verifies via `npm run build` (must pass) and a manual UI check listed in the task. Dev server: `npm run dev`.
- SQLite columns are added with `sqlite3 paper-processor.db "ALTER TABLE …"` locally, NOT `drizzle-kit push` (PK-related push failures — see CLAUDE.md). Prod Turso gets the same ALTER separately at deploy time.
- Do NOT drop the `digests.starred` column or the `comparisons` table — leave schema rows dormant.
- Keep the nav label "Vault" (user decision) — the Reading List is the vault's default view.
- All new UI follows the brutalist style: hard borders (`2px solid #1a1a1a`), box shadows (`4px 4px 0 0 rgba(0,0,0,1)`), mono uppercase labels (`var(--font-mono)`), display font `var(--font-display)`.
- AI config for new server routes copies the pattern in `src/app/api/papers/[id]/blurb/route.ts:27-32` (CRON_AI_* env vars).
- Commit after every task with the trailer `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

---

### Task 1: Schema columns for paper insights

**Files:**
- Modify: `src/lib/db/schema.ts` (papers table, after `relatesLine` ~line 96)
- Local DB: `paper-processor.db`

**Interfaces:**
- Produces: `papers.abstractJargon` (text, JSON `[{term, def}]`), `papers.eli5` (text) — read/written by Task 2's route.

- [ ] **Step 1: Add columns to schema.ts**

In `src/lib/db/schema.ts`, inside the `papers` table, after the `relatesLine` line:

```ts
  abstractJargon: text("abstract_jargon"), // JSON [{term, def}] — hover defs for the abstract, generated on first detail open
  eli5: text("eli5"), // plain-language "explain like I'm five" gist of the abstract, generated on button click
```

- [ ] **Step 2: Add columns to the local SQLite DB**

```bash
sqlite3 paper-processor.db "ALTER TABLE papers ADD COLUMN abstract_jargon TEXT;"
sqlite3 paper-processor.db "ALTER TABLE papers ADD COLUMN eli5 TEXT;"
sqlite3 paper-processor.db "PRAGMA table_info(papers);" | grep -E "abstract_jargon|eli5"
```

Expected: both columns listed.

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/lib/db/schema.ts
git commit -m "Add abstract_jargon and eli5 columns to papers"
```

Note for deploy: run the same two ALTER TABLE statements against Turso prod before/at deploy.

---

### Task 2: Insights API — lazy jargon + ELI5, cached

**Files:**
- Create: `src/app/api/papers/[id]/insights/route.ts`

**Interfaces:**
- Consumes: `papers.abstractJargon` / `papers.eli5` columns (Task 1); `aiComplete`, `AIConfig` from `@/lib/ai/provider`; `getAuthUser` from `@/lib/get-user`.
- Produces:
  - `GET /api/papers/:id/insights` → `{ jargon: {term: string, def: string}[] }` — generates + caches on first call.
  - `POST /api/papers/:id/insights` → `{ eli5: string }` — generates + caches on first call.
  - Both 401 without session, 404 for unknown paper, and degrade to empty (`{jargon: []}` / `{eli5: ""}`) on AI failure without caching, so the next open retries.

- [ ] **Step 1: Create the route**

```ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { papers } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { aiComplete, type AIConfig } from "@/lib/ai/provider";
import { getAuthUser } from "@/lib/get-user";

export const maxDuration = 30;

// Reading-list insights for a paper's abstract, generated at most once each and
// cached on the row (same lazy pattern as the blurb route):
//   GET  → jargon: [{term, def}] hover definitions for hard words in the abstract
//   POST → eli5: a plain-language gist ("explain like I'm five")

function cronConfig(): AIConfig | null {
  const provider = (process.env.CRON_AI_PROVIDER || "gemini") as AIConfig["provider"];
  const model =
    process.env.CRON_AI_MODEL ||
    (provider === "anthropic" ? "claude-sonnet-4-6" : provider === "openai" ? "gpt-4o" : "gemini-2.5-flash");
  if (!process.env.CRON_AI_KEY) return null;
  return { apiKey: process.env.CRON_AI_KEY, provider, model, baseUrl: process.env.CRON_AI_BASE_URL || "" };
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getAuthUser(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { id } = await params;
    const paper = await db.query.papers.findFirst({ where: eq(papers.id, id) });
    if (!paper) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (paper.abstractJargon) return NextResponse.json({ jargon: JSON.parse(paper.abstractJargon) });

    const abstract = (paper.abstract || "").trim();
    const config = cronConfig();
    if (!abstract || !config) return NextResponse.json({ jargon: [] });

    const system = `You extract jargon from a paper abstract for a curious non-expert reader. Return ONLY a JSON array (no markdown fence) of at most 8 objects: [{"term": "<exact phrase as it appears in the abstract>", "def": "<plain-language definition, one sentence, under 25 words>"}]. Only include genuinely hard terms — skip words any college graduate knows. "term" must be copied verbatim from the abstract so it can be matched.`;
    const raw = await aiComplete(config, system, abstract).catch(() => "");
    let jargon: { term: string; def: string }[] = [];
    try {
      const parsed = JSON.parse(raw.trim().replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, ""));
      if (Array.isArray(parsed)) {
        jargon = parsed
          .filter((j) => j && typeof j.term === "string" && typeof j.def === "string")
          .map((j) => ({ term: j.term.trim(), def: j.def.trim() }))
          .filter((j) => j.term && j.def && abstract.toLowerCase().includes(j.term.toLowerCase()))
          .slice(0, 8);
      }
    } catch { /* leave empty — retried next open since we don't cache empties */ }

    if (jargon.length) {
      await db.update(papers).set({ abstractJargon: JSON.stringify(jargon) }).where(eq(papers.id, id)).catch(() => {});
    }
    return NextResponse.json({ jargon });
  } catch {
    return NextResponse.json({ jargon: [] });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getAuthUser(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { id } = await params;
    const paper = await db.query.papers.findFirst({ where: eq(papers.id, id) });
    if (!paper) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (paper.eli5) return NextResponse.json({ eli5: paper.eli5 });

    const abstract = (paper.abstract || paper.summary || "").trim();
    const config = cronConfig();
    if (!abstract || !config) return NextResponse.json({ eli5: "" });

    const system = `Explain this paper abstract like the reader is five years old — but never condescending. 2-3 short sentences, everyday words and one concrete analogy, no jargon at all. Return ONLY the explanation, no preamble or quotes.`;
    const raw = await aiComplete(config, system, `${paper.title}\n\n${abstract}`).catch(() => "");
    const eli5 = raw.trim().replace(/^["']+|["']+$/g, "").slice(0, 600);
    if (eli5) await db.update(papers).set({ eli5 }).where(eq(papers.id, id)).catch(() => {});
    return NextResponse.json({ eli5 });
  } catch {
    return NextResponse.json({ eli5: "" });
  }
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: succeeds.

- [ ] **Step 3: Manual check**

With `npm run dev` running and a signed-in session, grab a paper id from the DB (`sqlite3 paper-processor.db "SELECT id FROM papers WHERE abstract IS NOT NULL LIMIT 1;"`), then in the browser devtools console (so the session cookie is sent):
`fetch("/api/papers/<ID>/insights").then(r=>r.json()).then(console.log)` → `{jargon:[...]}` with terms that appear in the abstract. Run it twice — the second call must be near-instant (cached). Same for `fetch("/api/papers/<ID>/insights", {method:"POST"})` → `{eli5:"..."}`.

- [ ] **Step 4: Commit**

```bash
git add "src/app/api/papers/[id]/insights/route.ts"
git commit -m "Add insights API: cached abstract jargon + ELI5 gist per paper"
```

---

### Task 3: Simplify the vault API to bookmarks-only; delete compare

**Files:**
- Modify: `src/app/api/vault/route.ts` (full rewrite)
- Delete: `src/app/api/vault/compare/route.ts`, `src/components/vault/compare-view.tsx`

**Interfaces:**
- Produces: `GET /api/vault` → `{ papers: PaperItem-shaped[] }` — ALL of the signed-in user's bookmarked papers (no pagination params; bookmark lists are small). Each paper has `authors`/`keywords`/`keyFindings` parsed to arrays and `bookmarked: true`. Consumed by Task 4.
- Removes: `?page/limit/search/source/bookmarked` params, the all-papers branch, and `POST /api/vault/compare`.

- [ ] **Step 1: Rewrite `src/app/api/vault/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { papers, feedback } from "@/lib/db/schema";
import { eq, and, desc, inArray } from "drizzle-orm";
import { getAuthUser } from "@/lib/get-user";

// The vault is the reading list: the papers this user has bookmarked
// (feedback rows of type "star"). Returns them all, newest first.
export async function GET(req: NextRequest) {
  const userId = await getAuthUser(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const starredRows = await db.query.feedback.findMany({
      where: and(eq(feedback.userId, userId), eq(feedback.type, "star")),
      columns: { paperId: true },
    });
    const starredIds = [...new Set(starredRows.map((r) => r.paperId))];
    if (starredIds.length === 0) return NextResponse.json({ papers: [] });

    const rows = await db.query.papers.findMany({
      where: inArray(papers.id, starredIds),
      orderBy: desc(papers.createdAt),
    });
    return NextResponse.json({
      papers: rows.map((p) => ({
        ...p,
        authors: p.authors ? JSON.parse(p.authors) : [],
        keywords: p.keywords ? JSON.parse(p.keywords) : [],
        keyFindings: p.keyFindings ? JSON.parse(p.keyFindings) : [],
        connectionReason: p.connectionReason || null,
        bookmarked: true,
      })),
    });
  } catch (error) {
    console.error("Vault fetch error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Delete the compare route and view**

```bash
git rm src/app/api/vault/compare/route.ts src/components/vault/compare-view.tsx
```

(The build will fail until Task 4 rewrites `vault-page.tsx`, which imports `CompareView` — do Task 4 before building, or accept the red build within this commit pair. Preferred: complete Task 4's Step 1 in the same working tree before committing if you want every commit green; otherwise commit Tasks 3+4 together as one commit at the end of Task 4.)

- [ ] **Step 3: Hold the commit — fold into Task 4's commit**

---

### Task 4: Rewrite the vault page as the Reading List

**Files:**
- Modify: `src/components/vault/vault-page.tsx` (full rewrite)
- Modify: `src/components/today/source-card.tsx` (add `onOpen` prop)

**Interfaces:**
- Consumes: `GET /api/vault` (Task 3), `SourceCard` from `@/components/today/source-card`, `PageTitle`/`ActionButton` from `@/components/design-system`.
- Produces: `VaultPage({ session })` — same external signature app-shell already uses. Internal state `view: "list" | "history"` and `detail: PaperItem | null`, consumed by Task 5 (`ReadingPaperDetail`) and Task 6 (`DigestHistory`) — Task 4 leaves clearly-marked mount points for both.
- `SourceCard` gains optional `onOpen?: (p: PaperItem) => void`: when set, card click calls it instead of navigating to `sourceUrl`.

- [ ] **Step 1: Add `onOpen` to SourceCard**

In `src/components/today/source-card.tsx`, add to the props destructure + type:

```ts
export function SourceCard({ paper, index, loggedIn, initialBookmarked, compareMode, isSelected, onSelect, onOpen }: {
  paper: PaperItem;
  index: number;
  loggedIn?: boolean;
  initialBookmarked?: boolean;
  compareMode?: boolean;
  isSelected?: boolean;
  onSelect?: (p: PaperItem) => void;
  onOpen?: (p: PaperItem) => void;
}) {
```

And change the anchor's `onClick` handler to:

```ts
      onClick={e => {
        if (compareMode) { e.preventDefault(); onSelect?.(paper); return; }
        if (onOpen) { e.preventDefault(); onOpen(paper); return; }
        if (!paper.sourceUrl) e.preventDefault();
      }}
      target={!compareMode && !onOpen && paper.sourceUrl ? "_blank" : undefined}
```

- [ ] **Step 2: Rewrite `src/components/vault/vault-page.tsx`**

```tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, History, ArrowLeft } from "lucide-react";
import type { PaperItem } from "@/components/today/paper-card";
import { SourceCard } from "@/components/today/source-card";
import { PageTitle, ActionButton } from "@/components/design-system";
import { ReadingPaperDetail } from "./reading-paper-detail";
import { DigestHistory } from "./digest-history";

interface VaultPageProps {
  session: {
    userId: string | null;
    isSetUp: boolean;
  };
}

export function VaultPage({ session }: VaultPageProps) {
  const [papers, setPapers] = useState<PaperItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"list" | "history">("list");
  const [detail, setDetail] = useState<PaperItem | null>(null);

  const fetchPapers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/vault");
      if (!res.ok) throw new Error("Failed to fetch reading list");
      const data = await res.json();
      setPapers(data.papers ?? []);
    } catch { setPapers([]); }
    finally { setLoading(false); }
  }, []);

  // Refetch whenever the list view becomes active so un-bookmarks made in the
  // detail overlay or on Today are reflected.
  useEffect(() => { if (view === "list") fetchPapers(); }, [view, fetchPapers]);

  return (
    <div style={{ maxWidth: 1400, margin: "0 auto" }} className="px-4 md:px-8 pt-8 pb-20">
      {/* ── Header: title left, history toggle top-right ── */}
      <div
        className="flex flex-wrap items-center justify-between gap-4"
        style={{ borderBottom: "1px solid #1a1a1a", paddingBottom: "12px", marginBottom: "24px" }}
      >
        <PageTitle size="sm">{view === "history" ? "Digest History" : "Reading List"}</PageTitle>
        <ActionButton size="sm" onClick={() => setView(v => (v === "list" ? "history" : "list"))}>
          {view === "history"
            ? <><ArrowLeft size={11} />Reading List</>
            : <><History size={11} />Digest History</>}
        </ActionButton>
      </div>

      {view === "history" ? (
        <DigestHistory loggedIn={!!session.userId} />
      ) : loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: "80px 0" }}>
          <Loader2 className="size-6 animate-spin" style={{ color: "#666" }} />
        </div>
      ) : papers.length === 0 ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "10px", padding: "80px 0" }}>
          <span style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "2px", color: "#888", fontFamily: "var(--font-mono), monospace" }}>
            No saved papers yet
          </span>
          <span style={{ fontSize: "0.8rem", color: "#aaa" }}>
            Tap the bookmark on any paper card in your digest to save it here.
          </span>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
          {papers.map((paper, idx) => (
            <SourceCard
              key={paper.id}
              paper={paper}
              index={idx}
              loggedIn={!!session.userId}
              initialBookmarked
              onOpen={p => setDetail(p)}
            />
          ))}
        </div>
      )}

      {detail && <ReadingPaperDetail paper={detail} index={papers.findIndex(p => p.id === detail.id)} onClose={() => setDetail(null)} />}
    </div>
  );
}
```

Note: `ReadingPaperDetail` and `DigestHistory` don't exist yet (Tasks 5 and 6). To keep this commit green, create both files now as minimal stubs that Tasks 5/6 replace:

`src/components/vault/reading-paper-detail.tsx` (stub):
```tsx
"use client";
import type { PaperItem } from "@/components/today/paper-card";
export function ReadingPaperDetail({ paper, index, onClose }: { paper: PaperItem; index: number; onClose: () => void }) {
  return null; // replaced in the paper-detail task
}
```

`src/components/vault/digest-history.tsx` (stub):
```tsx
"use client";
export function DigestHistory({ loggedIn }: { loggedIn: boolean }) {
  return null; // replaced in the digest-history task
}
```

- [ ] **Step 3: Check for stray references to removed pieces**

```bash
grep -rn "compare-view\|CompareView\|/api/vault/compare\|bookmarked=true" src/
```

Expected: no hits (the vault page rewrite removed the last consumers). Fix any stragglers.

- [ ] **Step 4: Verify build + manual check**

Run: `npm run build` → succeeds (lint warnings about unused stub props are acceptable only if the build passes; otherwise prefix them with `_`).
Manual: Vault tab shows "Reading List" header + only bookmarked papers; bookmark icons filled; clicking a card does nothing yet (stub); "Digest History" button flips the header title.

- [ ] **Step 5: Commit (includes Task 3 deletions)**

```bash
git add -A src/app/api/vault src/components/vault src/components/today/source-card.tsx
git commit -m "Vault becomes the Reading List: bookmarked papers only, compare removed"
```

---

### Task 5: Paper detail overlay — jargon abstract + ELI5

**Files:**
- Modify: `src/components/today/brief-digest.tsx` (export `TermChip`)
- Replace stub: `src/components/vault/reading-paper-detail.tsx`

**Interfaces:**
- Consumes: `GET/POST /api/papers/:id/insights` (Task 2), `TermChip` from `@/components/today/brief-digest`, `journalName` from `@/lib/venue-name`, `SOURCE_PALETTES`, `dispersedWash` from `@/components/today/source-card`.
- Produces: `ReadingPaperDetail({ paper, index, onClose })` — full-screen overlay (already mounted by Task 4).

- [ ] **Step 1: Export TermChip from brief-digest**

In `src/components/today/brief-digest.tsx`, change `function TermChip(` to `export function TermChip(`.

- [ ] **Step 2: Replace the stub with the real component**

`src/components/vault/reading-paper-detail.tsx`:

```tsx
"use client";

import React, { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import type { PaperItem } from "@/components/today/paper-card";
import { SOURCE_PALETTES, dispersedWash } from "@/components/today/source-card";
import { TermChip } from "@/components/today/brief-digest";
import { journalName } from "@/lib/venue-name";

const MONO = "var(--font-mono), monospace";
const DISPLAY = "var(--font-display), sans-serif";

type Jargon = { term: string; def: string };

// Interleave TermChips into the abstract at the first occurrence of each term.
function annotateAbstract(abstract: string, jargon: Jargon[]): React.ReactNode[] {
  const sorted = [...jargon].sort((a, b) => b.term.length - a.term.length);
  const out: React.ReactNode[] = [];
  const used = new Set<string>();
  let rest = abstract;
  let key = 0;
  while (rest) {
    let best: { i: number; len: number; j: Jargon } | null = null;
    for (const j of sorted) {
      if (used.has(j.term.toLowerCase())) continue;
      const i = rest.toLowerCase().indexOf(j.term.toLowerCase());
      if (i >= 0 && (!best || i < best.i)) best = { i, len: j.term.length, j };
    }
    if (!best) { out.push(<span key={key++}>{rest}</span>); break; }
    used.add(best.j.term.toLowerCase());
    if (best.i > 0) out.push(<span key={key++}>{rest.slice(0, best.i)}</span>);
    out.push(<TermChip key={key++} text={rest.slice(best.i, best.i + best.len)} def={best.j.def} />);
    rest = rest.slice(best.i + best.len);
  }
  return out;
}

export function ReadingPaperDetail({ paper, index, onClose }: { paper: PaperItem; index: number; onClose: () => void }) {
  const idx = Math.max(index, 0);
  const palette = SOURCE_PALETTES[idx % SOURCE_PALETTES.length];
  const journal = journalName(paper.sourceUrl, paper.authors);
  const abstract = (paper.abstract || "").trim();

  const [jargon, setJargon] = useState<Jargon[] | null>(null); // null = loading
  const [eli5, setEli5] = useState<string | null>(null);
  const [eli5Loading, setEli5Loading] = useState(false);
  const [eli5Error, setEli5Error] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!abstract) { setJargon([]); return; }
    fetch(`/api/papers/${paper.id}/insights`)
      .then(r => r.json())
      .then(d => { if (!cancelled) setJargon(d.jargon ?? []); })
      .catch(() => { if (!cancelled) setJargon([]); });
    return () => { cancelled = true; };
  }, [paper.id, abstract]);

  const generateEli5 = async () => {
    setEli5Loading(true);
    setEli5Error(false);
    try {
      const res = await fetch(`/api/papers/${paper.id}/insights`, { method: "POST" });
      const data = await res.json();
      if (data.eli5) setEli5(data.eli5);
      else setEli5Error(true);
    } catch { setEli5Error(true); }
    finally { setEli5Loading(false); }
  };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 80, background: "rgba(26,26,26,0.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ ...dispersedWash(palette, false, idx), maxWidth: 640, width: "100%", maxHeight: "88vh", overflowY: "auto", border: "2px solid #1a1a1a", boxShadow: "8px 8px 0 0 rgba(0,0,0,1)", padding: "26px 30px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <span style={{ fontFamily: MONO, fontSize: "0.6rem", letterSpacing: "1.5px", textTransform: "uppercase", color: "#666" }}>
            {(paper.sourceUrl || "").toLowerCase().includes("arxiv") ? "arXiv" : paper.source === "rss" ? "News" : "Paper"}
            {paper.year ? ` · ${paper.year}` : ""}
          </span>
          <button onClick={onClose} style={{ fontSize: "0.78rem", background: "none", border: "none", cursor: "pointer", color: "#888" }}>✕ Close</button>
        </div>

        <h3 style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: "1.35rem", lineHeight: 1.25, margin: "0 0 8px" }}>{paper.title}</h3>
        {(paper.authors.length > 0 || journal) && (
          <p style={{ fontSize: "0.75rem", fontStyle: "italic", color: "#666", margin: "0 0 20px" }}>
            {paper.authors.slice(0, 6).join(", ")}
            {paper.authors.length > 0 && journal ? " — " : ""}
            {journal}
          </p>
        )}

        {abstract ? (
          <div style={{ marginBottom: 22 }}>
            <div style={{ fontFamily: MONO, fontSize: "0.56rem", letterSpacing: "1.5px", textTransform: "uppercase", color: "#999", marginBottom: 7 }}>
              Abstract{jargon === null && <Loader2 size={9} className="animate-spin" style={{ display: "inline", marginLeft: 6 }} />}
            </div>
            <p style={{ fontSize: "0.92rem", lineHeight: 1.7, color: "#333", margin: 0 }}>
              {jargon && jargon.length > 0 ? annotateAbstract(abstract, jargon) : abstract}
            </p>
          </div>
        ) : (
          <p style={{ fontSize: "0.88rem", color: "#999", fontStyle: "italic", marginBottom: 22 }}>No abstract available.</p>
        )}

        {/* ELI5 — button until generated, then the gist in a yellow callout */}
        {abstract && (
          <div style={{ marginBottom: 22 }}>
            {eli5 ? (
              <div style={{ background: "#FFF4B8", border: "2px solid #1a1a1a", padding: "14px 16px" }}>
                <div style={{ fontFamily: MONO, fontSize: "0.56rem", letterSpacing: "1.5px", textTransform: "uppercase", color: "#1a1a1a", marginBottom: 7, fontWeight: 700 }}>The gist</div>
                <p style={{ fontSize: "0.9rem", lineHeight: 1.65, color: "#1a1a1a", margin: 0 }}>{eli5}</p>
              </div>
            ) : (
              <button
                onClick={generateEli5}
                disabled={eli5Loading}
                style={{ display: "inline-flex", alignItems: "center", gap: 8, fontFamily: MONO, fontSize: "0.65rem", fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", background: "#fff", border: "2px solid #1a1a1a", boxShadow: "3px 3px 0 0 rgba(0,0,0,1)", padding: "10px 16px", cursor: eli5Loading ? "wait" : "pointer", color: "#1a1a1a" }}
              >
                {eli5Loading ? <><Loader2 size={11} className="animate-spin" /> Thinking…</> : "Explain like I'm five"}
              </button>
            )}
            {eli5Error && <p style={{ fontSize: "0.7rem", color: "#ff007f", marginTop: 8 }}>Couldn&apos;t generate — try again.</p>}
          </div>
        )}

        {paper.sourceUrl && (
          <a href={paper.sourceUrl} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 8, fontFamily: MONO, fontSize: "0.65rem", letterSpacing: "1px", textTransform: "uppercase", background: "#1a1a1a", color: "#fff", padding: "10px 16px" }}>
            Read the full paper ↗
          </a>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify build + manual check**

Run: `npm run build` → succeeds.
Manual: open Reading List → click a card → overlay shows metadata + abstract; dotted terms appear after a moment (first open generates); hover shows definitions; reopening is instant (cached). "Explain like I'm five" → gist appears in the yellow callout; reopening the paper and clicking again returns instantly.
Note: `TermChip` hover works on tap for mobile browsers via mouseenter emulation — verify in responsive mode that tapping a dotted term shows the tooltip.

- [ ] **Step 4: Commit**

```bash
git add src/components/vault/reading-paper-detail.tsx src/components/today/brief-digest.tsx
git commit -m "Reading list paper detail: jargon-annotated abstract + ELI5 gist"
```

---

### Task 6: Digest History — two-pane browser

**Files:**
- Replace stub: `src/components/vault/digest-history.tsx`
- Modify: `src/components/today/brief-digest.tsx` (add `revealAll` prop)

**Interfaces:**
- Consumes: `GET /api/digest?all=true` → `{digests: [{id, date, theme, synthesisContent, ...}]}`; `GET /api/digest?id=<id>` → `{digest, papers}` (digest has parsed `keyConcepts`, `suggestedQuestions`, `suggestedAnswers` — confirm in `src/app/api/digest/route.ts` lines 60+ that the id branch parses these the same as the default branch; if it returns raw JSON strings, parse client-side as shown below).
- Produces: `DigestHistory({ loggedIn })`; `BriefDigest` gains `revealAll?: boolean` — starts fully revealed (no "Next source" pacing).

- [ ] **Step 1: Add `revealAll` to BriefDigest**

In `src/components/today/brief-digest.tsx`, add `revealAll` to the props type and destructure:

```ts
export function BriefDigest({ synthesis, theme, keyConcepts, papers, digestId, seeds, guestAnswers, isLoggedIn, onSignIn, revealAll }: {
  // ...existing props...
  revealAll?: boolean;
```

And change the step state line from `const [step, setStep] = useState(0);` to:

```ts
  const [step, setStep] = useState(revealAll ? Number.MAX_SAFE_INTEGER : 0);
```

(`n` is already clamped via `stops[Math.min(step, stops.length - 1)]`, so MAX_SAFE_INTEGER safely means "last stop".)

- [ ] **Step 2: Replace the DigestHistory stub**

`src/components/vault/digest-history.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { Loader2, ArrowLeft } from "lucide-react";
import type { PaperItem } from "@/components/today/paper-card";
import { BriefDigest } from "@/components/today/brief-digest";

const MONO = "var(--font-mono), monospace";
const DISPLAY = "var(--font-display), sans-serif";

interface DigestListItem {
  id: string;
  date: string;
  theme: string;
}

interface LoadedDigest {
  id: string;
  theme: string | null;
  synthesisContent: string | null;
  keyConcepts: string[];
  suggestedQuestions: string[];
  suggestedAnswers?: string[];
  gist?: string | null;
  date: string;
}

const asArray = (v: unknown): string[] =>
  Array.isArray(v) ? v : typeof v === "string" && v.trim() ? (() => { try { return JSON.parse(v); } catch { return []; } })() : [];

// Derive a display title for digests without a stored theme (same fallback the
// old vault drawer used).
function displayTheme(d: { theme?: string | null; synthesisContent?: string | null }): string {
  if (d.theme) return d.theme;
  const firstLine = (d.synthesisContent || "").split("\n").find(l => l.trim()) ?? "";
  return firstLine.replace(/^#+\s*/, "").replace(/\*\*/g, "").replace(/^Today[^.!?]*[.!?]\s*/i, "").trim().slice(0, 80) || "Untitled digest";
}

export function DigestHistory({ loggedIn }: { loggedIn: boolean }) {
  const [list, setList] = useState<DigestListItem[] | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [digest, setDigest] = useState<LoadedDigest | null>(null);
  const [papers, setPapers] = useState<PaperItem[]>([]);
  const [loadingDigest, setLoadingDigest] = useState(false);

  useEffect(() => {
    fetch("/api/digest?all=true")
      .then(r => (r.ok ? r.json() : { digests: [] }))
      .then(d => {
        const items = (d.digests ?? []).map((x: { id: string; date: string; theme?: string | null; synthesisContent?: string | null }) => ({
          id: x.id, date: x.date, theme: displayTheme(x),
        }));
        setList(items);
        if (items.length > 0) setActiveId(items[0].id);
      })
      .catch(() => setList([]));
  }, []);

  useEffect(() => {
    if (!activeId) return;
    let cancelled = false;
    setLoadingDigest(true);
    fetch(`/api/digest?id=${activeId}`)
      .then(r => r.json())
      .then(d => {
        if (cancelled || !d.digest) return;
        setDigest({
          ...d.digest,
          keyConcepts: asArray(d.digest.keyConcepts),
          suggestedQuestions: asArray(d.digest.suggestedQuestions),
          suggestedAnswers: asArray(d.digest.suggestedAnswers),
        });
        setPapers(d.papers ?? []);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoadingDigest(false); });
    return () => { cancelled = true; };
  }, [activeId]);

  if (list === null) {
    return <div style={{ display: "flex", justifyContent: "center", padding: "80px 0" }}><Loader2 className="size-6 animate-spin" style={{ color: "#666" }} /></div>;
  }
  if (list.length === 0) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: "80px 0" }}>
        <span style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "2px", color: "#888", fontFamily: MONO }}>
          No digests yet — generate your first from Today
        </span>
      </div>
    );
  }

  const rail = (
    <div style={{ border: "2px solid #1a1a1a", background: "white", overflowY: "auto", maxHeight: "calc(100vh - 180px)" }}>
      {list.map((item, i) => {
        const isActive = activeId === item.id;
        return (
          <button
            key={item.id}
            onClick={() => setActiveId(item.id)}
            style={{
              display: "flex", flexDirection: "column", gap: "4px",
              width: "100%", padding: "12px 16px", textAlign: "left",
              background: isActive ? "#1a1a1a" : "transparent",
              border: "none", borderBottom: i === list.length - 1 ? "none" : "1px solid rgba(26,26,26,0.08)",
              color: isActive ? "white" : "#1a1a1a", cursor: "pointer", transition: "background 100ms",
            }}
            className={isActive ? "" : "hover:bg-[#f5f5f5]"}
          >
            <span style={{ fontFamily: MONO, fontSize: "0.55rem", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: isActive ? "rgba(255,255,255,0.5)" : "#aaa" }}>
              {item.date}
            </span>
            <span style={{ fontFamily: DISPLAY, fontSize: "0.8rem", fontWeight: isActive ? 700 : 500, lineHeight: 1.3 }}>
              {item.theme}
            </span>
          </button>
        );
      })}
    </div>
  );

  const pane = loadingDigest || !digest ? (
    <div style={{ display: "flex", justifyContent: "center", padding: "80px 0" }}><Loader2 className="size-5 animate-spin" style={{ color: "#666" }} /></div>
  ) : (
    <div>
      <div style={{ fontFamily: MONO, fontSize: "0.6rem", letterSpacing: "1.5px", textTransform: "uppercase", color: "#999", marginBottom: 10 }}>
        {new Date(digest.date + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
      </div>
      <h2 style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: "1.6rem", lineHeight: 1.25, letterSpacing: "-0.03em", color: "#1a1a1a", margin: "0 0 8px" }}>
        {displayTheme(digest)}
      </h2>
      {digest.gist && <p style={{ fontSize: "0.95rem", color: "#555", margin: "0 0 24px", lineHeight: 1.6 }}>{digest.gist}</p>}
      {digest.synthesisContent ? (
        <BriefDigest
          key={digest.id}
          revealAll
          synthesis={digest.synthesisContent}
          theme={digest.theme ?? undefined}
          keyConcepts={digest.keyConcepts}
          papers={papers}
          digestId={digest.id}
          seeds={digest.suggestedQuestions}
          guestAnswers={digest.suggestedAnswers}
          isLoggedIn={loggedIn}
        />
      ) : (
        <p style={{ fontSize: "0.85rem", color: "#999", fontStyle: "italic" }}>This digest has no synthesis.</p>
      )}
    </div>
  );

  return (
    <>
      {/* Desktop: chat-style two-pane. Mobile: list, then full-screen digest with back. */}
      <div className="hidden md:grid" style={{ gridTemplateColumns: "300px 1fr", gap: "32px", alignItems: "start" }}>
        {rail}
        {pane}
      </div>
      <div className="md:hidden">
        {activeId && digest ? (
          <div>
            <button onClick={() => { setActiveId(null); setDigest(null); }} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: MONO, fontSize: "0.6rem", fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", background: "none", border: "none", cursor: "pointer", color: "#666", padding: 0, marginBottom: 16 }}>
              <ArrowLeft size={11} /> All digests
            </button>
            {pane}
          </div>
        ) : rail}
      </div>
    </>
  );
}
```

Mobile note: on mobile the initial auto-select would jump straight into the first digest — that's the intended "chat" behavior on desktop, but on mobile the back button returns to the rail. If the auto-selected digest on mobile feels wrong during manual QA, gate the auto-select with a `matchMedia("(min-width: 768px)")` check; don't preemptively add it.

- [ ] **Step 3: Verify build + manual check**

Run: `npm run build` → succeeds.
Manual: Vault → "Digest History" → left rail lists all digests newest-first, first auto-selected; right pane shows date, title, gist, and the full digest with every source revealed (no "Next source" button); clicking older digests swaps the pane; brief threads / dig-deeper work in the pane; mobile (responsive mode) shows the list → digest → back flow. Today's digest still paces one-source-at-a-time (revealAll not passed there).

- [ ] **Step 4: Commit**

```bash
git add src/components/vault/digest-history.tsx src/components/today/brief-digest.tsx
git commit -m "Add two-pane digest history to the vault"
```

---

### Task 7: Remove digest starring end-to-end

**Files:**
- Modify: `src/components/today/today-page.tsx` (remove Star/Ban header controls, `starred` state, `hiddenStash`, `HiddenDigestState`)
- Delete: `src/app/api/digest/star/route.ts`
- Modify: `src/app/api/cron/route.ts:148-150, 169-174`
- Modify: `src/lib/email.ts` (drop `starred` field + ★ row marker)
- Modify: `src/components/today/synthesis-banner.tsx` (drop `digestStarred` prop)

**Interfaces:**
- Removes: `POST /api/digest/star`; `digestStarred` prop on `SynthesisBanner`; `starred` on `DigestEmailData`'s summary items.
- Keeps: `digests.starred` column (dormant), `/api/digest/hide` + `/api/digest/feedback` routes (used by Task 8's CTA), `trackEvent` type string `star_digest` in the schema comment (harmless).

- [ ] **Step 1: today-page.tsx — strip starring and the top-bar hide**

1. Imports: remove `Star` and `Ban` from the lucide import (keep `Loader2`, `RefreshCw`).
2. Delete the whole `HiddenDigestState` component (lines ~298–369).
3. Delete state: `hiddenStash` (`useState` at ~403), `starred` (~420), `hidden` (~421).
4. In `fetchDigest`, change the post-fetch line to just `setDigest(data.digest); setPapers(data.papers ?? []);` (drop the `setStarred`/`setHidden` line).
5. In the no-digest branch, remove the `hiddenStash ? <HiddenDigestState …/> : (…)` conditional — keep only the "Today's digest is brewing" content, and drop the `!hiddenStash &&` guards on the error text and generate button.
6. In the header controls (`digest.id && session && (…)`), delete the entire block containing the Save/star button AND the Ban/hide button — the whole `<div style={{ display:"flex", alignItems:"center", gap:"6px" }}>…</div>`. Keep the `generateError` span.
7. Remove `digestStarred={!!digest.starred}` from the `<SynthesisBanner …>` call.
8. `Digest` interface: `starred`/`hidden` fields may stay (API still returns them) — but remove them if lint flags unused.

- [ ] **Step 2: synthesis-banner.tsx — drop the prop**

Remove `digestStarred?: boolean;` from the props interface (~line 379) and `digestStarred = false,` from the destructure (~line 609). Then `grep -n "digestStarred" src/components/today/synthesis-banner.tsx` — if it's referenced in the body (a star button in classic mode), delete that button/usage too.

- [ ] **Step 3: Delete the star route**

```bash
git rm src/app/api/digest/star/route.ts
grep -rn "digest/star" src/
```
Expected grep: no hits.

- [ ] **Step 4: cron — best is most recent**

In `src/app/api/cron/route.ts`, replace lines 148-150 with:

```ts
      // Pick the "best" digest for the period email: most recent.
      const best = periodDigests[0];
```

And in `allDigestSummaries` (~line 169), remove the `starred: !!d.starred,` line. Also update the comment at ~line 23 if it mentions starred.

- [ ] **Step 5: email.ts — drop ★ markers**

Remove `starred?: boolean;` (~line 26) and the `${d.starred ? ' <span style="color:#f59e0b;">★</span>' : ""}` interpolation (~line 125). Leave the decorative "★ Best of" headline/subject (~lines 145, 221) — it's branding, not the starred feature.

- [ ] **Step 6: Verify build + manual check**

Run: `npm run build` → succeeds. `grep -rn "starred" src/ | grep -v schema.ts` → remaining hits should only be dead API fields (digest route returning the column) — acceptable.
Manual: Today page header shows no Save/star or hide buttons; digest renders normally.

- [ ] **Step 7: Commit**

```bash
git add -A src/components/today src/app/api/cron/route.ts src/lib/email.ts
git commit -m "Remove digest starring: UI, star route, email best-of preference"
```

---

### Task 8: End-of-digest "Don't like this digest? Regenerate." CTA

**Files:**
- Create: `src/components/today/regenerate-cta.tsx`
- Modify: `src/components/today/brief-digest.tsx` (render slot when all sources revealed)
- Modify: `src/components/today/today-page.tsx` (wire the CTA into BriefDigest)

**Interfaces:**
- Consumes: `POST /api/digest/feedback` `{digestId, reason}`; `POST /api/digest/hide` `{digestId}` (toggle — marks hidden); `handleGenerate(true)` in today-page.
- Produces: `RegenerateCta({ digestId, generating, onRegenerate })`; `BriefDigest` gains `endSlot?: React.ReactNode`, rendered between the prose and the threads once `allRevealed`.

- [ ] **Step 1: Create `src/components/today/regenerate-cta.tsx`**

```tsx
"use client";

import { useState } from "react";
import { X, Loader2 } from "lucide-react";

const MONO = "var(--font-mono), monospace";
const DISPLAY = "var(--font-display), sans-serif";

// End-of-digest escape hatch: big centered dark-grey text + X. Clicking reveals
// a one-line reason input; submitting files digest feedback, hides the digest,
// and force-regenerates. Named after its reward (a fresh digest), not the complaint.
export function RegenerateCta({ digestId, generating, onRegenerate }: {
  digestId: string;
  generating: boolean;
  onRegenerate: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const submit = async () => {
    if (!reason.trim() || submitted) return;
    setSubmitted(true);
    try {
      await fetch("/api/digest/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ digestId, reason: reason.trim() }),
      });
      await fetch("/api/digest/hide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ digestId }),
      });
    } catch { /* non-critical — still regenerate */ }
    onRegenerate();
  };

  if (submitted && generating) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 10, padding: "36px 0", color: "#888", fontFamily: MONO, fontSize: "0.75rem" }}>
        <Loader2 size={14} className="animate-spin" /> Generating a new digest…
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, padding: "36px 0 8px", textAlign: "center" }}>
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, background: "none", border: "none", cursor: "pointer", color: "#555" }}
          className="hover:opacity-70"
        >
          <X size={28} strokeWidth={2.5} style={{ color: "#555" }} />
          <span style={{ fontFamily: DISPLAY, fontSize: "1.05rem", fontWeight: 700, color: "#555", letterSpacing: "-0.01em" }}>
            Don&apos;t like this digest? Regenerate.
          </span>
        </button>
      ) : (
        <div style={{ width: "100%", maxWidth: 420, display: "flex", flexDirection: "column", gap: 10 }}>
          <p style={{ fontSize: "0.8rem", color: "#555", fontFamily: MONO, margin: 0 }}>
            Tell us why and we&apos;ll regenerate.
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={reason}
              onChange={e => setReason(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && reason.trim()) submit(); }}
              placeholder="e.g. too technical, already know this topic…"
              autoFocus
              style={{ flex: 1, padding: "8px 10px", border: "1.5px solid #1a1a1a", fontSize: "0.8rem", outline: "none", fontFamily: "var(--font-inter), sans-serif" }}
            />
            <button
              onClick={submit}
              disabled={!reason.trim() || generating}
              className="hover:bg-[#333] disabled:opacity-40"
              style={{ padding: "8px 14px", background: "#1a1a1a", color: "white", border: "none", cursor: "pointer", fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", fontFamily: MONO }}
            >
              {generating ? <Loader2 size={12} className="animate-spin" /> : "Regenerate"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add `endSlot` to BriefDigest**

In `src/components/today/brief-digest.tsx`, add `endSlot?: React.ReactNode;` to the props (destructure it too), and render it after the prose, before the threads block:

```tsx
      {allRevealed && endSlot}

      {/* Threads mount immediately so seed preloads start, but stay hidden until the walk ends */}
```

- [ ] **Step 3: Wire it in today-page.tsx**

Import: `import { RegenerateCta } from "./regenerate-cta";`

In the `<BriefDigest …>` call, add:

```tsx
              endSlot={session ? (
                <RegenerateCta digestId={digest.id} generating={generating} onRegenerate={() => handleGenerate(true)} />
              ) : undefined}
```

(The digest stays visible while regenerating; `handleGenerate` swaps in the new digest when done, and on failure the old digest remains with `generateError` shown in the header.)

- [ ] **Step 4: Verify build + manual check**

Run: `npm run build` → succeeds.
Manual: click through all sources on Today → below the last prose/threads boundary, the centered grey X + "Don't like this digest? Regenerate." appears; clicking reveals the reason input; submitting shows "Generating a new digest…" and eventually a fresh digest replaces the old one; a `digest_feedback` row and `hidden=1` land in the DB (`sqlite3 paper-processor.db "SELECT reason FROM digest_feedback ORDER BY created_at DESC LIMIT 1;"`). Logged-out view shows no CTA. Digest History (Task 6) also renders BriefDigest — it passes no `endSlot`, so no CTA appears there.

- [ ] **Step 5: Commit**

```bash
git add src/components/today/regenerate-cta.tsx src/components/today/brief-digest.tsx src/components/today/today-page.tsx
git commit -m "Add end-of-digest regenerate CTA"
```

---

### Task 9: Docs + final verification

**Files:**
- Modify: `docs/changelog.md`, `docs/design-decisions.md`, `docs/features-todo.md`, `CLAUDE.md`

- [ ] **Step 1: Update docs**

- `docs/changelog.md`: add a dated entry — vault → Reading List + Digest History; digest starring removed; end-of-digest regenerate CTA; jargon/ELI5 paper insights.
- `docs/design-decisions.md`: record the decisions — bookmarking papers is the single save action (digest starring removed as confusing); hide/regenerate trigger moved to end-of-digest and named after its reward; insights generated lazily and cached to avoid burning tokens on unopened papers.
- `docs/features-todo.md`: no open item covers this work, but check the "Consolidate to one digest UX" item still reflects reality (it does — untouched modes) and add a line to Shipped: "**Reading List + Digest History** — vault rebuilt around bookmarked papers with jargon-annotated abstracts + ELI5 gists; digest starring removed; end-of-digest regenerate CTA."
- `CLAUDE.md`: in Tech Decisions, update the "Email: … 'Best' = starred digest if any, else most recent" line to "'Best' = most recent digest of the period", and the "Feedback:" line to mention the end-of-digest regenerate CTA.

- [ ] **Step 2: Full verification**

```bash
npm run lint
npm run build
```
Expected: both pass. Then a final manual sweep of the four flows: bookmark → Reading List → detail (jargon + ELI5) → unbookmark; Digest History browse; Today with no star/hide in header; end-of-digest CTA regenerate.

- [ ] **Step 3: Commit**

```bash
git add docs CLAUDE.md
git commit -m "Docs: reading list, digest history, starring removal"
```

- [ ] **Step 4: Prod DB note**

Before deploying, run against Turso prod:
```sql
ALTER TABLE papers ADD COLUMN abstract_jargon TEXT;
ALTER TABLE papers ADD COLUMN eli5 TEXT;
```

---

### Task 10: Plain-language study names in synthesis (no author surnames)

User feedback: prose like "the Kwesi S&P controls study" is confusing. Study references
must use plain everyday words ("the chatbot privacy study"), never author names or
opaque title jargon. The `[Source N]` prefix mapping is untouched. Names must still be
DISTINCT — the closing paragraph cross-references studies, so three identical "this
study" labels would be ambiguous.

**Files:**
- Modify: `src/lib/ai/prompts.ts` — shortName rules in BOTH `selectionSkeletonPrompt` (~line 197 + example ~186) and `skeletonPrompt` (~line 236 + example ~219) (CLAUDE.md gotcha: the rules live in two places)
- Modify: `CLAUDE.md` — update the shortName gotcha line
- Modify: `docs/synthesis.md` — record the naming rule change if shortNames are documented there

- [ ] **Step 1: Rewrite both shortName rules**

Replace the rule text at ~line 197 (`selectionSkeletonPrompt`) with:

```
- shortName: MAX 4 WORDS, plain everyday language a reader who has NOT read the paper instantly understands: "the chatbot privacy study", "the makeup tutorial study", "the delete-button study". NEVER author names ("the Smith study"), acronyms, or title jargon — a reader should know what the study is ABOUT from the name alone. Each shortName must be DISTINCT from the others so the closing can cross-reference them unambiguously.
```

Replace the rule at ~line 236 (`skeletonPrompt`) with the same text. Update the inline JSON examples (~lines 186 and 219) to match, e.g. `"shortName": "the chatbot privacy study"` and `'the makeup tutorial study', 'the delete-button study'`.

- [ ] **Step 2: Update docs**

- `CLAUDE.md` gotcha: change "They must require the author's last name (or most specific title noun) as anchor" to "They must require plain-language topic names (no author surnames or title jargon), distinct per paper."
- `docs/synthesis.md`: if shortName conventions appear, update them to the plain-language rule.

- [ ] **Step 3: Verify build**

Run: `npm run build` → succeeds. Full effect is only visible on the next digest generation.

- [ ] **Step 4: Commit**

```bash
git add src/lib/ai/prompts.ts CLAUDE.md docs/synthesis.md
git commit -m "Synthesis study names: plain language, no author surnames"
```
