"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import type { PaperItem } from "./paper-card";
import { flattenSynthesis, resolvePaperFromBold, splitSynthesisTheme } from "./synthesis-banner";
import { BriefThreads } from "./brief-threads";

const MONO = "var(--font-mono), monospace";
const DISPLAY = "var(--font-display), sans-serif";
const BODY = "var(--font-inter), sans-serif";

const PALETTES: [string, string][] = [
  ["#C8F0D8", "#F0F5A8"],
  ["#FFD6E0", "#FFE89A"],
  ["#D0E3F7", "#E2D6F7"],
  ["#FFE89A", "#FFD6E0"],
  ["#D8C8F0", "#F0C8D8"],
];
const HOVER_PALETTES: [string, string][] = [
  ["#A4E0BC", "#DCF060"],
  ["#FFB0C8", "#FFD870"],
  ["#B0CCF0", "#C8B4F0"],
  ["#FFD870", "#FFB0C8"],
  ["#C8B0F0", "#F0B0C8"],
];

function washStyle(idx: number): React.CSSProperties {
  const [h1, h2] = PALETTES[idx % PALETTES.length];
  return {
    background: `radial-gradient(circle 120px at 2% 4%, ${h1}cc 0%, transparent 60%), radial-gradient(circle 120px at 98% 8%, ${h2}cc 0%, transparent 60%), radial-gradient(circle 110px at 96% 100%, ${h1}99 0%, transparent 60%), #fff`,
    backgroundBlendMode: "multiply, multiply, multiply, normal",
  };
}

function venueLabel(p: PaperItem): string {
  const url = (p.sourceUrl || "").toLowerCase();
  const kind = url.includes("arxiv") ? "ARXIV" : p.source === "rss" ? "NEWS" : "PAPER";
  return p.year ? `${kind} · ${p.year}` : kind;
}

/* ---- verdict parsing: **[Source N] name** → paper chips, concept terms → hover defs ---- */

type Seg =
  | { t: "w"; text: string }
  | { t: "b"; text: string }
  | { t: "cite"; paperIdx: number; label: string }
  | { t: "term"; text: string; def: string };
interface Line { idx: number; segs: Seg[]; para: boolean; }

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// First-mention term annotation: each concept term gets a hover definition once.
function annotateTerms(text: string, defs: { term: string; def: string }[], used: Set<string>): Seg[] {
  const out: Seg[] = [];
  let rest = text;
  while (rest) {
    let best: { i: number; len: number; term: string; def: string } | null = null;
    for (const { term, def } of defs) {
      if (used.has(term)) continue;
      const m = new RegExp(`\\b${escapeRe(term)}\\b`, "i").exec(rest);
      if (m && (!best || m.index < best.i)) best = { i: m.index, len: m[0].length, term, def };
    }
    if (!best) { out.push({ t: "w", text: rest }); break; }
    used.add(best.term);
    if (best.i > 0) out.push({ t: "w", text: rest.slice(0, best.i) });
    out.push({ t: "term", text: rest.slice(best.i, best.i + best.len), def: best.def });
    rest = rest.slice(best.i + best.len);
  }
  return out;
}

type PaperLite = { title: string; keywords: string[]; authors: string[] };

function tokenize(text: string, defs: { term: string; def: string }[], usedTerms: Set<string>, papers: PaperLite[]): Seg[] {
  const segs: Seg[] = [];
  const re = /\*\*([^*]+)\*\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  const pushPlain = (run: string) => { if (run) segs.push(...annotateTerms(run, defs, usedTerms)); };
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) pushPlain(text.slice(last, m.index));
    const inner = m[1];
    // "[Source N] name" → explicit; otherwise fuzzy-match the bold run to a paper
    // (older digests name papers inline without a marker)
    const { paperIdx, displayText } = resolvePaperFromBold(inner, papers);
    if (paperIdx >= 0) segs.push({ t: "cite", paperIdx, label: displayText.trim() || papers[paperIdx].title });
    else segs.push({ t: "b", text: inner });
    last = m.index + m[0].length;
  }
  pushPlain(text.slice(last));
  return segs;
}

export function toLines(paragraphs: string[], defs: { term: string; def: string }[], papers: PaperLite[]): Line[] {
  const out: { segs: Seg[]; para: boolean }[] = [];
  const usedTerms = new Set<string>();
  for (const para of paragraphs) {
    let cur: Seg[] = [];
    let first = true;
    const flush = () => { if (cur.length) { out.push({ segs: cur, para: first }); cur = []; first = false; } };
    for (const s of tokenize(para.replace(/\s+/g, " ").trim(), defs, usedTerms, papers)) {
      if (s.t === "cite" || s.t === "term") { cur.push(s); continue; }
      // segments keep their exact text — punctuation after a chip lives in the next segment
      for (const piece of s.text.split(/(?<=[.!?])\s+/)) {
        if (!piece) continue;
        cur.push({ t: s.t, text: piece });
        if (/[.!?]$/.test(piece)) flush();
      }
    }
    flush();
  }
  return out.map((ln, i) => ({ idx: i, segs: ln.segs, para: ln.para }));
}

// Reveal boundary: index just past the chunk containing line `from`'s paragraph.
function nextChunkEnd(lines: Line[], from: number): number {
  let j = from + 1;
  while (j < lines.length && !lines[j].para) j++;
  return j;
}

/* ---- chips ---- */

function PaperChip({ paper, paperIdx, label, cap, onOpen }: { paper: PaperItem; paperIdx: number; label: string; cap: boolean; onOpen: (p: PaperItem) => void }) {
  const [g1, g2] = PALETTES[paperIdx % PALETTES.length];
  const [h1, h2] = HOVER_PALETTES[paperIdx % HOVER_PALETTES.length];
  const [hover, setHover] = useState(false);
  const summary = paper.summary || paper.abstract || "";
  return (
    <span style={{ position: "relative", display: "inline" }} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <button
        onClick={() => onOpen(paper)}
        style={{
          fontWeight: 700, color: "#111", border: "none", cursor: "pointer",
          background: `linear-gradient(135deg, ${hover ? h1 : g1} 0%, ${hover ? h2 : g2} 100%)`,
          padding: "1px 4px", margin: "0 -1px", borderRadius: 2, transition: "background 0.15s",
          fontFamily: "inherit", fontSize: "inherit", lineHeight: "inherit",
          WebkitBoxDecorationBreak: "clone", boxDecorationBreak: "clone" as React.CSSProperties["boxDecorationBreak"],
        }}
      >{cap ? label.charAt(0).toUpperCase() + label.slice(1) : label}</button>
      {hover && summary && (
        <span style={{ position: "absolute", bottom: "calc(100% + 8px)", left: 0, zIndex: 40, width: 280, background: "#1a1a1a", color: "#fff", fontFamily: BODY, fontSize: "0.75rem", fontWeight: 400, lineHeight: 1.5, padding: "10px 14px", boxShadow: "4px 4px 0 0 rgba(0,0,0,0.3)", pointerEvents: "none" }}>
          <span style={{ display: "block", fontFamily: MONO, fontSize: "0.55rem", letterSpacing: "1.5px", color: "#aaa", marginBottom: 5 }}>{venueLabel(paper)}</span>
          {summary.length > 150 ? summary.slice(0, 147) + "..." : summary}
        </span>
      )}
    </span>
  );
}

function TermChip({ text, def }: { text: string; def: string }) {
  const [hover, setHover] = useState(false);
  return (
    <span style={{ position: "relative", display: "inline" }} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <span style={{ borderBottom: "2px dotted #1a1a1a", cursor: "help", fontWeight: 500 }}>{text}</span>
      {hover && (
        <span style={{ position: "absolute", bottom: "calc(100% + 8px)", left: 0, zIndex: 40, width: 240, background: "#1a1a1a", color: "#fff", fontFamily: BODY, fontSize: "0.74rem", fontWeight: 400, lineHeight: 1.5, padding: "10px 12px", boxShadow: "4px 4px 0 0 rgba(0,0,0,0.3)", pointerEvents: "none" }}>
          {def}
        </span>
      )}
    </span>
  );
}

/* ---- inline paper card (revealed on first mention) ---- */

function PaperBlobCard({ paper, paperIdx, onOpen }: { paper: PaperItem; paperIdx: number; onOpen: (p: PaperItem) => void }) {
  const tags = PALETTES[paperIdx % PALETTES.length];
  const summary = paper.summary || paper.abstract || "";
  return (
    <div onClick={() => onOpen(paper)} className="brief-card" style={{ ...washStyle(paperIdx), border: "2px solid #1a1a1a", boxShadow: "5px 5px 0 0 rgba(0,0,0,1)", padding: "12px 14px", cursor: "pointer" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <span style={{ fontFamily: MONO, fontSize: "0.55rem", letterSpacing: "1.5px", color: "#666", border: "1px solid #cbd5e1", padding: "2px 6px" }}>{venueLabel(paper)}</span>
      </div>
      <h4 style={{ fontFamily: DISPLAY, fontWeight: 800, textTransform: "uppercase", fontSize: "0.9rem", lineHeight: 1.15, margin: "0 0 3px" }}>{paper.title}</h4>
      {paper.authors.length > 0 && <p style={{ fontFamily: MONO, fontSize: "0.58rem", fontStyle: "italic", color: "#888", margin: "0 0 7px" }}>{paper.authors.slice(0, 4).join(", ")}</p>}
      {summary && <p style={{ fontSize: "0.74rem", lineHeight: 1.5, color: "#333", margin: 0 }}>{summary.length > 260 ? summary.slice(0, 257) + "..." : summary}</p>}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: 9, gap: 8 }}>
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
          {paper.keywords.slice(0, 3).map((kw, i) => (
            <span key={kw} style={{ fontFamily: MONO, fontSize: "0.55rem", textTransform: "uppercase", letterSpacing: "0.5px", background: tags[i % 2], border: "1px solid #1a1a1a", padding: "2px 7px" }}>{kw}</span>
          ))}
        </div>
        {paper.sourceUrl && (
          <a href={paper.sourceUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} style={{ fontFamily: MONO, fontSize: "0.55rem", letterSpacing: "1px", color: "#1a1a1a", whiteSpace: "nowrap", borderBottom: "1.5px solid #1a1a1a", paddingBottom: 1 }}>VIEW STUDY ↗</a>
        )}
      </div>
    </div>
  );
}

function PaperDetailOverlay({ paper, paperIdx, onClose }: { paper: PaperItem; paperIdx: number; onClose: () => void }) {
  const tags = PALETTES[paperIdx % PALETTES.length];
  const summary = paper.summary || paper.abstract || "";
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 80, background: "rgba(26,26,26,0.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ ...washStyle(paperIdx), maxWidth: 520, width: "100%", border: "2px solid #1a1a1a", boxShadow: "8px 8px 0 0 rgba(0,0,0,1)", padding: "26px 28px" }}>
        <button onClick={onClose} style={{ fontFamily: BODY, fontSize: "0.78rem", background: "none", border: "none", cursor: "pointer", color: "#888", marginBottom: 14 }}>✕ Close</button>
        <div style={{ fontFamily: MONO, fontSize: "0.6rem", letterSpacing: "1.5px", color: "#666", marginBottom: 10 }}>{venueLabel(paper)}</div>
        <h3 style={{ fontFamily: DISPLAY, fontWeight: 800, textTransform: "uppercase", fontSize: "1.3rem", lineHeight: 1.15, margin: "0 0 6px" }}>{paper.title}</h3>
        {paper.authors.length > 0 && <p style={{ fontFamily: MONO, fontSize: "0.66rem", fontStyle: "italic", color: "#777", margin: "0 0 16px" }}>{paper.authors.slice(0, 4).join(", ")}</p>}
        {summary && <p style={{ fontSize: "0.95rem", lineHeight: 1.6, color: "#222", margin: 0 }}>{summary}</p>}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: 18, gap: 12, flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {paper.keywords.slice(0, 4).map((kw, i) => (
              <span key={kw} style={{ fontFamily: MONO, fontSize: "0.6rem", textTransform: "uppercase", letterSpacing: "0.5px", background: tags[i % 2], border: "1px solid #1a1a1a", padding: "3px 9px" }}>{kw}</span>
            ))}
          </div>
          {paper.sourceUrl && (
            <a href={paper.sourceUrl} target="_blank" rel="noopener noreferrer" style={{ fontFamily: MONO, fontSize: "0.62rem", letterSpacing: "1px", background: "#1a1a1a", color: "#fff", padding: "7px 12px", whiteSpace: "nowrap" }}>VIEW STUDY ↗</a>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---- main: scroll-revealed verdict with inline paper cards, then threads ---- */

export function BriefDigest({ synthesis, theme, keyConcepts, papers, digestId, seeds, guestAnswers, isLoggedIn, onSignIn }: {
  synthesis: string;
  theme?: string;
  keyConcepts: string[];
  papers: PaperItem[];
  digestId: string;
  seeds: string[];
  guestAnswers?: string[];
  isLoggedIn: boolean;
  onSignIn?: () => void;
}) {
  const lines = useMemo(() => {
    const { bodyText } = splitSynthesisTheme(synthesis, theme);
    const defs = keyConcepts
      .map((c) => {
        const i = c.indexOf(": ");
        return i > 0 ? { term: c.slice(0, i).trim(), def: c.slice(i + 2).trim() } : null;
      })
      .filter((d): d is { term: string; def: string } => !!d)
      .sort((a, b) => b.term.length - a.term.length); // longest first so "spaced practice" wins over "practice"
    return toLines(flattenSynthesis(bodyText), defs, papers);
  }, [synthesis, theme, keyConcepts, papers]);

  // First mention of each paper drops its card after that line — pure plan, no state.
  const cardsAfter = useMemo(() => {
    const seen = new Set<number>();
    const map: Record<number, number[]> = {};
    for (const ln of lines) {
      for (const seg of ln.segs) {
        if (seg.t === "cite" && !seen.has(seg.paperIdx)) {
          seen.add(seg.paperIdx);
          (map[ln.idx] ||= []).push(seg.paperIdx);
        }
      }
    }
    return map;
  }, [lines]);

  const [n, setN] = useState(() => nextChunkEnd(lines, 0));
  const verdictDone = n >= lines.length;
  const [detail, setDetail] = useState<{ paper: PaperItem; idx: number } | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Reveal the next paragraph chunk when the sentinel scrolls into view.
  useEffect(() => {
    if (verdictDone) return;
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      setN((prev) => nextChunkEnd(lines, prev));
    }, { rootMargin: "0px 0px -12% 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [n, lines, verdictDone]);

  const openDetail = (paper: PaperItem) => setDetail({ paper, idx: Math.max(0, papers.indexOf(paper)) });

  const renderSeg = (s: Seg, i: number, lineStart: boolean) => {
    if (s.t === "w") return <span key={i}>{s.text}</span>;
    if (s.t === "b") return <strong key={i} style={{ fontWeight: 700 }}>{s.text}</strong>;
    if (s.t === "term") return <TermChip key={i} text={s.text} def={s.def} />;
    const paper = papers[s.paperIdx];
    return paper ? <PaperChip key={i} paper={paper} paperIdx={s.paperIdx} label={s.label} cap={lineStart && i === 0} onOpen={openDetail} /> : <strong key={i}>{s.label}</strong>;
  };

  // Assemble revealed lines into paragraphs with cards interleaved.
  const revealed = lines.slice(0, n);
  const els: React.ReactNode[] = [];
  let buf: React.ReactNode[] = [];
  let firstEl = true;
  const flush = () => {
    if (buf.length) {
      els.push(<p key={`p${els.length}`} style={{ fontSize: "1.06rem", lineHeight: 1.78, color: "#1a1a1a", margin: firstEl ? 0 : "14px 0 0" }}>{buf}</p>);
      buf = []; firstEl = false;
    }
  };
  for (const ln of revealed) {
    if (ln.para && buf.length) flush();
    buf.push(<span key={ln.idx} className="brief-line">{ln.segs.map((s, i) => renderSeg(s, i, ln.para))}{" "}</span>);
    const cards = cardsAfter[ln.idx];
    if (cards) {
      flush();
      for (const pi of cards) {
        if (papers[pi]) els.push(<div key={`c${pi}`} className="brief-line" style={{ margin: "16px 0 0" }}><PaperBlobCard paper={papers[pi]} paperIdx={pi} onOpen={openDetail} /></div>);
      }
      firstEl = false;
    }
  }
  flush();

  return (
    <div>
      <style>{`
        @keyframes briefRise { from { opacity: 0; transform: translateY(6px) } to { opacity: 1; transform: translateY(0) } }
        .brief-line { animation: briefRise 0.4s ease both; }
        .brief-card { transition: transform .12s ease, box-shadow .12s ease; }
        .brief-card:hover { transform: translate(-2px,-2px); box-shadow: 7px 7px 0 0 rgba(0,0,0,1) !important; }
      `}</style>

      {els}
      {!verdictDone && <div ref={sentinelRef} style={{ height: 1 }} />}

      {/* Threads mount immediately so seed preloads start, but stay hidden until the verdict is read */}
      <div style={{ marginTop: 32, display: verdictDone ? undefined : "none" }}>
        <BriefThreads digestId={digestId} seeds={seeds} guestAnswers={guestAnswers} isLoggedIn={isLoggedIn} onSignIn={onSignIn} />
      </div>

      {detail && <PaperDetailOverlay paper={detail.paper} paperIdx={detail.idx} onClose={() => setDetail(null)} />}
    </div>
  );
}
