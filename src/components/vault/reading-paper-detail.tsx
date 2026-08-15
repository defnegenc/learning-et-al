"use client";

import React, { useEffect, useState } from "react";
import { ArrowLeft, Bookmark, Loader2 } from "lucide-react";
import type { PaperItem } from "@/lib/types";
import { TermChip } from "@/components/today/brief-digest";
import { paperByline, READING_BODY } from "@/components/paper-card";
import {
  BODY_STYLE, BORDER, DIM, DISPLAY_LG, DISPLAY_SM, HAIRLINE, INK, MUTED, SHADOW, SURFACE,
} from "@/components/design-system";

type Jargon = { term: string; def: string };

interface Companion {
  gist: string;
  glossary: Jargon[];
}

interface HomeworkItem {
  openAlexId: string;
  title: string;
  authors: string[];
  year: number | null;
  venue: string | null;
  url: string | null;
  pdfUrl: string | null;
  abstract: string;
  citationCount: number;
}

// Interleave TermChips into a text block at the first occurrence of each term.
function annotateText(text: string, jargon: Jargon[]): React.ReactNode[] {
  const sorted = [...jargon].sort((a, b) => b.term.length - a.term.length);
  const out: React.ReactNode[] = [];
  const used = new Set<string>();
  let rest = text;
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

// Follow-up work reads as a plain list, not as cards — one hairline-separated
// row per paper with a save control on the right.
function HomeworkRow({ item, sourcePaperId }: { item: HomeworkItem; sourcePaperId: string }) {
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  async function save(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (saved || saving) return;
    setSaving(true);
    try {
      const res = await fetch("/api/papers/save-external", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourcePaperId, item }),
      });
      if (res.ok) setSaved(true);
    } catch { /* leave unsaved */ }
    finally { setSaving(false); }
  }

  const meta = [
    item.year ? String(item.year) : "",
    item.venue || "",
    item.citationCount > 0 ? `${item.citationCount} citations` : "",
  ].filter(Boolean).join(" · ");

  return (
    <div style={{ display: "flex", gap: 14, alignItems: "flex-start", padding: "18px 0", borderTop: HAIRLINE }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <a
          href={item.url || undefined}
          target="_blank"
          rel="noopener noreferrer"
          style={{ ...DISPLAY_SM, textDecoration: item.url ? "underline" : "none", textUnderlineOffset: 4 }}
        >
          {item.title}
        </a>
        <div style={{ ...BODY_STYLE, color: MUTED, marginTop: 8 }}>{meta}</div>
      </div>
      <button
        onClick={save}
        title={saved ? "In your reading list" : "Save to reading list"}
        style={{ background: "none", border: "none", cursor: saved ? "default" : "pointer", padding: 0, flexShrink: 0, color: INK, marginTop: 3 }}
      >
        {saving
          ? <Loader2 size={15} className="animate-spin" />
          : <Bookmark size={15} fill={saved ? INK : "none"} />}
      </button>
    </div>
  );
}

// Full-screen reading view: the gist, then what's happened since. Nothing else —
// no card chrome, no metadata rail, no Q&A.
export function ReadingPaperDetail({ paper, onClose }: { paper: PaperItem; onClose: () => void }) {
  const byline = paperByline(paper);

  const [companion, setCompanion] = useState<Companion | null>(null);
  const [companionPending, setCompanionPending] = useState(true);
  const [homework, setHomework] = useState<HomeworkItem[] | null>(null);

  // Full-screen means the page behind must not scroll with it (the source of the
  // jittery double-scroll on mobile).
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Companion + homework: use the cache if the bookmark already generated
  // them, otherwise trigger generation now and wait.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/papers/${paper.id}/companion`);
        let data = await res.json();
        if (!data.companion) {
          const gen = await fetch(`/api/papers/${paper.id}/companion`, { method: "POST" });
          data = await gen.json();
        }
        if (!cancelled) setCompanion(data.companion ?? null);
      } catch { /* companion stays null */ }
      finally { if (!cancelled) setCompanionPending(false); }
    })();
    (async () => {
      try {
        const res = await fetch(`/api/papers/${paper.id}/homework`);
        let data = await res.json();
        if (!data.homework) {
          const gen = await fetch(`/api/papers/${paper.id}/homework`, { method: "POST" });
          data = await gen.json();
        }
        if (!cancelled) setHomework(data.homework ?? []);
      } catch { if (!cancelled) setHomework([]); }
    })();
    return () => { cancelled = true; };
  }, [paper.id]);

  const glossary = companion?.glossary ?? [];

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 80, background: SURFACE,
        overflowY: "auto", WebkitOverflowScrolling: "touch", overscrollBehavior: "contain",
      }}
    >
      <div style={{ maxWidth: 680, margin: "0 auto" }} className="px-5 md:px-8 pt-6 pb-24">
        <button
          onClick={onClose}
          style={{ ...BODY_STYLE, display: "inline-flex", alignItems: "center", gap: 8, background: "none", border: "none", cursor: "pointer", color: DIM, padding: 0, marginBottom: 28 }}
        >
          <ArrowLeft size={15} /> Back
        </button>

        <h1 style={{ ...DISPLAY_LG, margin: "0 0 10px" }}>{paper.title}</h1>
        {byline && (
          <p style={{ ...BODY_STYLE, fontStyle: "italic", color: DIM, margin: "0 0 32px" }}>{byline}</p>
        )}

        {/* ── The gist ── */}
        {companionPending ? (
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0" }}>
            <Loader2 size={15} className="animate-spin" style={{ color: MUTED }} />
            <span style={{ ...BODY_STYLE, color: MUTED }}>Reading the paper…</span>
          </div>
        ) : companion?.gist ? (
          <p style={{ ...READING_BODY, margin: 0 }}>{annotateText(companion.gist, glossary)}</p>
        ) : paper.abstract ? (
          <p style={{ ...READING_BODY, margin: 0 }}>{paper.abstract}</p>
        ) : (
          <p style={{ ...BODY_STYLE, color: MUTED, fontStyle: "italic", margin: 0 }}>No summary available.</p>
        )}

        {paper.sourceUrl && (
          <a
            href={paper.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="ds-lift"
            style={{ ...DISPLAY_SM, display: "inline-flex", alignItems: "center", gap: 8, background: INK, color: SURFACE, border: BORDER, boxShadow: SHADOW, padding: "12px 22px", textDecoration: "none", marginTop: 32 }}
          >
            Read the full paper ↗
          </a>
        )}

        {/* ── What's happened since ── */}
        <h2 style={{ ...DISPLAY_LG, margin: "56px 0 6px" }}>What&apos;s happened since</h2>
        <p style={{ ...BODY_STYLE, color: MUTED, margin: "0 0 10px" }}>
          Newer work that cites this paper.
        </p>
        {homework === null ? (
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 0" }}>
            <Loader2 size={15} className="animate-spin" style={{ color: MUTED }} />
            <span style={{ ...BODY_STYLE, color: MUTED }}>Looking for follow-up work…</span>
          </div>
        ) : homework.length === 0 ? (
          <p style={{ ...BODY_STYLE, color: MUTED, fontStyle: "italic", margin: "12px 0 0" }}>Nothing citing this yet — it may be too new.</p>
        ) : (
          <div>
            {homework.map(item => (
              <HomeworkRow key={item.openAlexId || item.title} item={item} sourcePaperId={paper.id} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
