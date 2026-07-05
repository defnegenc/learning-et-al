"use client";

import React, { useMemo, useRef, useState } from "react";
import type { PaperItem } from "./paper-card";
import { flattenSynthesis, resolvePaperFromBold, splitSynthesisTheme } from "./synthesis-banner";
import { BriefThreads, streamThread, toLines as answerToLines, LineReveal, ThinkingTrace, type AgentSource, type ResultPayload } from "./brief-threads";

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

// Word count for a line, used to pace the timed reveal.
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
      <h4 style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: "0.95rem", lineHeight: 1.2, margin: "0 0 3px" }}>{paper.plainName || paper.title}</h4>
      {paper.plainName && <p style={{ fontSize: "0.66rem", color: "#666", lineHeight: 1.35, margin: "0 0 4px" }}>{paper.title}</p>}
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
  const [expanded, setExpanded] = useState(false);
  // Click-in shows something the homepage card does NOT: how it relates to the theme
  // (bold, starred) + the actual abstract (expandable) — not the same summary again.
  const relates = paper.connectionReason ? relatesFallback(paper.connectionReason) : (paper.relatesLine || "");
  const abstract = paper.abstract || paper.fullText || "";
  const LIMIT = 340;
  const isLong = abstract.length > LIMIT;
  const shownAbstract = expanded || !isLong ? abstract : abstract.slice(0, LIMIT).trimEnd() + "…";
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 80, background: "rgba(26,26,26,0.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ ...washStyle(paperIdx), maxWidth: 560, width: "100%", maxHeight: "85vh", overflowY: "auto", border: "2px solid #1a1a1a", boxShadow: "8px 8px 0 0 rgba(0,0,0,1)", padding: "26px 28px" }}>
        <button onClick={onClose} style={{ fontFamily: BODY, fontSize: "0.78rem", background: "none", border: "none", cursor: "pointer", color: "#888", marginBottom: 14 }}>✕ Close</button>
        <div style={{ fontFamily: MONO, fontSize: "0.6rem", letterSpacing: "1.5px", color: "#666", marginBottom: 10 }}>{venueLabel(paper)}</div>
        <h3 style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: "1.3rem", lineHeight: 1.2, margin: "0 0 6px" }}>{paper.plainName || paper.title}</h3>
        {paper.plainName && <p style={{ fontSize: "0.8rem", color: "#555", lineHeight: 1.4, margin: "0 0 8px" }}>{paper.title}</p>}
        {paper.authors.length > 0 && <p style={{ fontFamily: MONO, fontSize: "0.66rem", fontStyle: "italic", color: "#777", margin: "0 0 16px" }}>{paper.authors.slice(0, 4).join(", ")}</p>}

        {relates && (
          <div style={{ borderLeft: "3px solid #1a1a1a", paddingLeft: 12, margin: "0 0 18px" }}>
            <div style={{ fontSize: "0.72rem", letterSpacing: "2px", color: "#f5a623", marginBottom: 4 }}>★ ★ ★</div>
            <p style={{ fontSize: "0.98rem", fontWeight: 700, lineHeight: 1.45, color: "#1a1a1a", margin: 0 }}>{relates}</p>
          </div>
        )}

        {abstract && (
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontFamily: MONO, fontSize: "0.58rem", letterSpacing: "1.5px", textTransform: "uppercase", color: "#888", marginBottom: 6 }}>Abstract</div>
            <p style={{ fontSize: "0.9rem", lineHeight: 1.62, color: "#333", margin: 0 }}>{shownAbstract}</p>
            {isLong && (
              <button onClick={() => setExpanded(v => !v)} style={{ marginTop: 8, fontFamily: MONO, fontSize: "0.6rem", letterSpacing: "1px", textTransform: "uppercase", background: "none", border: "none", borderBottom: "1.5px solid #1a1a1a", padding: "0 0 1px", cursor: "pointer", color: "#1a1a1a" }}>
                {expanded ? "Show less" : "Show more"}
              </button>
            )}
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: 4, gap: 12, flexWrap: "wrap" }}>
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

// Turn the headless connectionReason fragment ("shows X…") into a sentence.
function relatesFallback(reason: string): string {
  const r = reason.trim();
  if (!r) return "";
  const sentence = /^[a-z]/.test(r) ? `This study ${r}` : r;
  return /[.!?]$/.test(sentence) ? sentence : sentence + ".";
}

// The lens each paper brings, for the compare view.
function lensLabel(p: PaperItem): string {
  if (p.category === "news") return "Recent news";
  if (p.category === "foundational") return "The foundational view";
  const kw = p.keywords[0]?.toLowerCase();
  if (kw) return `${/^[aeiou]/.test(kw) ? "An" : "A"} ${kw} lens`;
  return "Another angle";
}

/* ---- generated "how they differ" contrast, citations drill into the paper ---- */
function ContrastBody({ result, papers, onOpenPaper }: { result: ResultPayload; papers: PaperItem[]; onOpenPaper: (p: PaperItem) => void }) {
  const lines = useMemo(() => answerToLines(result.answer), [result.answer]);
  const cardedRef = useRef<Set<string>>(new Set());
  return (
    <div style={{ fontSize: "1.02rem", lineHeight: 1.7, color: "#1a1a1a" }}>
      <LineReveal
        lines={lines}
        sources={result.sources}
        onOpen={(s: AgentSource) => { const p = papers.find((pp) => pp.id === s.id); if (p) onOpenPaper(p); }}
        onSourceSeen={() => {}}
        onDone={() => {}}
        cardedRef={cardedRef}
      />
    </div>
  );
}

/* ---- compare card: one paper's lens, side by side with the others ---- */
function CompareCard({ paper, idx, onOpen }: { paper: PaperItem; idx: number; onOpen: (p: PaperItem) => void }) {
  const [c1] = PALETTES[idx % PALETTES.length];
  // Show this paper's DISTINCT take (its connection to the question), not the same
  // generic summary shown elsewhere.
  const distinct = paper.connectionReason
    ? relatesFallback(paper.connectionReason)
    : (paper.summary || paper.abstract || "");
  return (
    <button onClick={() => onOpen(paper)} className="brief-card" style={{ ...washStyle(idx), display: "flex", flexDirection: "column", textAlign: "left", border: "2px solid #1a1a1a", boxShadow: "5px 5px 0 0 rgba(0,0,0,1)", padding: "16px 18px", cursor: "pointer", height: "100%" }}>
      <span style={{ display: "flex", alignItems: "flex-end", alignSelf: "flex-start", minHeight: "2.3em", fontFamily: DISPLAY, fontSize: "1.0rem", fontWeight: 800, textTransform: "uppercase", lineHeight: 1.15, color: "#1a1a1a", marginBottom: 12, paddingBottom: 6, borderBottom: `3px solid ${c1}` }}>{lensLabel(paper)}</span>
      {distinct && <span style={{ fontSize: "0.84rem", lineHeight: 1.5, color: "#1a1a1a" }}>{distinct}</span>}
      <span style={{ marginTop: "auto", paddingTop: 12, fontFamily: MONO, fontSize: "0.55rem", letterSpacing: "1.5px", textTransform: "uppercase", color: "#1a1a1a" }}>Open →</span>
    </button>
  );
}

/* ---- main: user-paced verdict (Next source) → compare the three → dig deeper ---- */

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

  // User-paced reveal by SOURCE: each step shows everything up to where the next
  // source is first introduced, so a source's full discussion appears at once
  // (never split). Step 0 = intro + the whole first source; "Next source" adds the
  // next; the final step adds the last source + closing.
  const stops = useMemo(() => {
    const cardLines = Object.keys(cardsAfter).map(Number).sort((a, b) => a - b);
    const s = cardLines.slice(1); // reveal up to each subsequent source's first mention
    s.push(lines.length);
    return s.length ? s : [lines.length];
  }, [cardsAfter, lines.length]);

  const [step, setStep] = useState(0);
  const n = Math.min(stops[Math.min(step, stops.length - 1)] ?? lines.length, lines.length);
  const allRevealed = n >= lines.length;
  const [compared, setCompared] = useState(false);
  const [contrast, setContrast] = useState<{ status: string[]; result: ResultPayload | null } | null>(null);
  const [detail, setDetail] = useState<{ paper: PaperItem; idx: number } | null>(null);

  // On "Compare", generate a concise "how they differ" contrast across the three.
  const openCompare = () => {
    setCompared(true);
    if (contrast || !isLoggedIn) return;
    setContrast({ status: [], result: null });
    streamThread(
      digestId,
      "In 3 sentences, how do these three papers DIFFER in what they claim or emphasize? Contrast their distinct takes. Refer to each only by its [N] citation and its finding — never by author name or title.",
      [],
      {
        onStatus: (s) => setContrast((c) => (c ? { ...c, status: [...c.status, s] } : c)),
        onResult: (r) => setContrast((c) => (c ? { ...c, result: r } : c)),
        onError: () => {},
      },
      { concise: true }
    );
  };

  // Match the card's color: index by paper id (reference equality broke for agent-found
  // papers rebuilt from a different source). If it's not one of the main papers, derive a
  // stable index from the id so the color is at least consistent per paper, never always 0.
  const openDetail = (paper: PaperItem) => {
    const i = papers.findIndex(p => p.id === paper.id);
    const idx = i >= 0 ? i : Math.abs([...paper.id].reduce((a, c) => a + c.charCodeAt(0), 0)) % PALETTES.length;
    setDetail({ paper, idx });
  };

  const renderSeg = (s: Seg, i: number, lineStart: boolean) => {
    if (s.t === "w") return <span key={i}>{s.text}</span>;
    if (s.t === "b") return <strong key={i} style={{ fontWeight: 700 }}>{s.text}</strong>;
    if (s.t === "term") return <TermChip key={i} text={s.text} def={s.def} />;
    const paper = papers[s.paperIdx];
    return paper ? <PaperChip key={i} paper={paper} paperIdx={s.paperIdx} label={s.label} cap={lineStart && i === 0} onOpen={openDetail} /> : <strong key={i}>{s.label}</strong>;
  };

  // Assemble revealed lines into paragraphs. A paper's card is deferred to the end
  // of its paragraph (not dropped mid-sentence), so a source reads as one block.
  const revealed = lines.slice(0, n);
  const els: React.ReactNode[] = [];
  let buf: React.ReactNode[] = [];
  let firstEl = true;
  let pendingCards: number[] = [];
  const flush = () => {
    if (buf.length) {
      els.push(<p key={`p${els.length}`} style={{ fontSize: "1.06rem", lineHeight: 1.85, color: "#1a1a1a", margin: firstEl ? 0 : "34px 0 0" }}>{buf}</p>);
      buf = []; firstEl = false;
    }
    for (const pi of pendingCards) {
      if (papers[pi]) els.push(<div key={`c${pi}`} className="brief-line" style={{ margin: "22px 0 6px" }}><PaperBlobCard paper={papers[pi]} paperIdx={pi} onOpen={openDetail} /></div>);
    }
    if (pendingCards.length) firstEl = false;
    pendingCards = [];
  };
  for (const ln of revealed) {
    if (ln.para && (buf.length || pendingCards.length)) flush();
    buf.push(<span key={ln.idx} className="brief-line">{ln.segs.map((s, i) => renderSeg(s, i, ln.para))}{" "}</span>);
    const cards = cardsAfter[ln.idx];
    if (cards) pendingCards.push(...cards);
  }
  flush();

  return (
    <div>
      <style>{`
        @keyframes briefRise { from { opacity: 0; transform: translateY(6px) } to { opacity: 1; transform: translateY(0) } }
        .brief-line { animation: briefRise 0.4s ease both; }
        .brief-card { transition: transform .12s ease, box-shadow .12s ease; }
        .brief-card:hover { transform: translate(-2px,-2px); box-shadow: 7px 7px 0 0 rgba(0,0,0,1) !important; }
        .brief-advance { transition: transform .12s ease, box-shadow .12s ease; }
        .brief-advance:hover { transform: translate(-2px,-2px); box-shadow: 6px 6px 0 0 rgba(255,0,127,1) !important; }
      `}</style>

      {els}

      {/* User-paced: reveal one source at a time, then compare, then dig deeper */}
      {!allRevealed && (
        <button onClick={() => setStep((s) => s + 1)} className="brief-advance brief-line" style={{ marginTop: 24, fontFamily: DISPLAY, fontSize: "0.92rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", background: "#fff", border: "2px solid #1a1a1a", boxShadow: "4px 4px 0 0 rgba(0,0,0,1)", padding: "11px 18px", cursor: "pointer", color: "#1a1a1a" }}>
          Next source →
        </button>
      )}
      {allRevealed && !compared && (
        <button onClick={openCompare} className="brief-advance brief-line" style={{ marginTop: 24, fontFamily: DISPLAY, fontSize: "0.92rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", background: "#1a1a1a", border: "2px solid #1a1a1a", boxShadow: "4px 4px 0 0 rgba(0,0,0,1)", padding: "11px 18px", cursor: "pointer", color: "#fff" }}>
          Compare the three →
        </button>
      )}

      {compared && (
        <div className="brief-line" style={{ marginTop: 36 }}>
          {isLoggedIn && (
            <div style={{ marginBottom: 28 }}>
              <div style={{ fontFamily: DISPLAY, fontSize: "0.95rem", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.04em", color: "#1a1a1a", marginBottom: 14 }}>How they differ</div>
              {contrast && !contrast.result && <ThinkingTrace status={contrast.status} done={false} onDone={() => {}} />}
              {contrast?.result && <ContrastBody result={contrast.result} papers={papers} onOpenPaper={openDetail} />}
            </div>
          )}
          <div style={{ fontFamily: DISPLAY, fontSize: "0.95rem", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.04em", color: "#1a1a1a", marginBottom: 14 }}>Three lenses, side by side</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 14, alignItems: "stretch" }}>
            {papers.slice(0, 3).map((p, i) => (
              <CompareCard key={p.id} paper={p} idx={i} onOpen={openDetail} />
            ))}
          </div>
        </div>
      )}

      {/* Threads mount immediately so seed preloads start, but stay hidden until you compare */}
      <div style={{ marginTop: 36, display: compared ? undefined : "none" }}>
        <BriefThreads digestId={digestId} seeds={seeds} guestAnswers={guestAnswers} isLoggedIn={isLoggedIn} onSignIn={onSignIn} />
      </div>

      {detail && <PaperDetailOverlay paper={detail.paper} paperIdx={detail.idx} onClose={() => setDetail(null)} />}
    </div>
  );
}
