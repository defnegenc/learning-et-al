"use client";

import React, { useEffect, useState } from "react";
import { ArrowLeft, Bookmark, Loader2 } from "lucide-react";
import type { PaperItem } from "@/lib/types";
import { TermChip } from "@/components/today/brief-digest";
import { journalName } from "@/lib/venue-name";

const DISPLAY = "var(--font-display), sans-serif";

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
    <div style={{ display: "flex", gap: 14, alignItems: "flex-start", padding: "16px 0", borderTop: "1px solid rgba(26,26,26,0.12)" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <a
          href={item.url || undefined}
          target="_blank"
          rel="noopener noreferrer"
          style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: "1rem", lineHeight: 1.4, color: "#1a1a1a", textDecoration: item.url ? "underline" : "none", textUnderlineOffset: "3px" }}
        >
          {item.title}
        </a>
        <div style={{ fontSize: "0.78rem", color: "#888", marginTop: 6 }}>
          {meta}
        </div>
      </div>
      <button
        onClick={save}
        title={saved ? "In your reading list" : "Save to reading list"}
        style={{ background: "none", border: "none", cursor: saved ? "default" : "pointer", padding: 0, flexShrink: 0, color: "#1a1a1a", marginTop: 3 }}
      >
        {saving
          ? <Loader2 size={15} className="animate-spin" />
          : <Bookmark size={15} fill={saved ? "#1a1a1a" : "none"} />}
      </button>
    </div>
  );
}

// Full-screen reading view: the gist, then what's happened since. Nothing else —
// no card chrome, no metadata rail, no Q&A.
export function ReadingPaperDetail({ paper, onClose }: { paper: PaperItem; onClose: () => void }) {
  const journal = journalName(paper.sourceUrl, paper.authors);

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
        position: "fixed", inset: 0, zIndex: 80, background: "#fff",
        overflowY: "auto", WebkitOverflowScrolling: "touch", overscrollBehavior: "contain",
      }}
    >
      <div style={{ maxWidth: 680, margin: "0 auto" }} className="px-5 md:px-8 pt-6 pb-24">
        <button
          onClick={onClose}
          style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: "0.9rem", background: "none", border: "none", cursor: "pointer", color: "#1a1a1a", padding: 0, marginBottom: 28 }}
        >
          <ArrowLeft size={15} /> Back
        </button>

        <h1 style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: "1.7rem", lineHeight: 1.2, letterSpacing: "-0.02em", color: "#1a1a1a", margin: "0 0 10px" }}>
          {paper.title}
        </h1>
        {(paper.authors.length > 0 || journal) && (
          <p style={{ fontSize: "0.88rem", color: "#666", margin: "0 0 28px" }}>
            {paper.authors.slice(0, 6).join(", ")}
            {paper.authors.length > 0 && journal ? " — " : ""}
            {journal}
          </p>
        )}

        {/* ── The gist ── */}
        {companionPending ? (
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0" }}>
            <Loader2 size={13} className="animate-spin" style={{ color: "#666" }} />
            <span style={{ fontSize: "0.9rem", color: "#666" }}>
              Reading the paper…
            </span>
          </div>
        ) : companion?.gist ? (
          <p style={{ fontSize: "1.05rem", lineHeight: 1.75, color: "#1a1a1a", margin: 0 }}>
            {annotateText(companion.gist, glossary)}
          </p>
        ) : paper.abstract ? (
          <p style={{ fontSize: "1.05rem", lineHeight: 1.75, color: "#1a1a1a", margin: 0 }}>{paper.abstract}</p>
        ) : (
          <p style={{ fontSize: "0.9rem", color: "#999", fontStyle: "italic", margin: 0 }}>No summary available.</p>
        )}

        {paper.sourceUrl && (
          <a
            href={paper.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: "inline-flex", alignItems: "center", gap: 8, fontFamily: DISPLAY, fontSize: "0.9rem", fontWeight: 700, background: "#1a1a1a", color: "#fff", padding: "11px 18px", textDecoration: "none", marginTop: 28 }}
          >
            Read the full paper ↗
          </a>
        )}

        {/* ── What's happened since ── */}
        <h2 style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: "1.25rem", letterSpacing: "-0.02em", color: "#1a1a1a", margin: "52px 0 4px" }}>
          What&apos;s happened since
        </h2>
        <p style={{ fontSize: "0.85rem", color: "#888", margin: "0 0 8px" }}>
          Newer work that cites this paper.
        </p>
        {homework === null ? (
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 0" }}>
            <Loader2 size={12} className="animate-spin" style={{ color: "#666" }} />
            <span style={{ fontSize: "0.78rem", color: "#888" }}>Looking for follow-up work…</span>
          </div>
        ) : homework.length === 0 ? (
          <p style={{ fontSize: "0.82rem", color: "#999", fontStyle: "italic", margin: "12px 0 0" }}>Nothing citing this yet — it may be too new.</p>
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
