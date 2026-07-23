"use client";

import React, { useMemo, useState } from "react";
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
  | { t: "i"; text: string }
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

function tokenize(text: string, defs: { term: string; def: string }[], usedTerms: Set<string>, papers: PaperLite[], strictCites: boolean): Seg[] {
  const segs: Seg[] = [];
  const re = /\*\*([^*]+)\*\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  // Plain runs may still carry *italics* (single asterisks — the ** bold pass ran first).
  const pushPlain = (run: string) => {
    if (!run) return;
    const ire = /\*([^*\n]+)\*/g;
    let l = 0;
    let im: RegExpExecArray | null;
    while ((im = ire.exec(run)) !== null) {
      if (im.index > l) segs.push(...annotateTerms(run.slice(l, im.index), defs, usedTerms));
      segs.push({ t: "i", text: im[1] });
      l = im.index + im[0].length;
    }
    if (l < run.length) segs.push(...annotateTerms(run.slice(l), defs, usedTerms));
  };
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) pushPlain(text.slice(last, m.index));
    const inner = m[1];
    // "[Source N] name" → explicit paper cite. Fuzzy-matching unmarked bold to a
    // paper only runs for older digests without markers (strictCites=false) — in
    // marker-era digests, plain bold is strategic emphasis, not a paper name.
    if (strictCites && !/^\s*\[/.test(inner)) {
      segs.push({ t: "b", text: inner });
    } else {
      const { paperIdx, displayText } = resolvePaperFromBold(inner, papers);
      if (paperIdx >= 0) segs.push({ t: "cite", paperIdx, label: displayText.trim() || papers[paperIdx].title });
      else segs.push({ t: "b", text: inner });
    }
    last = m.index + m[0].length;
  }
  pushPlain(text.slice(last));
  return segs;
}

export function toLines(paragraphs: string[], defs: { term: string; def: string }[], papers: PaperLite[]): Line[] {
  const out: { segs: Seg[]; para: boolean }[] = [];
  const usedTerms = new Set<string>();
  // Marker-era digests cite papers as **[Source N] name** — any other bold is emphasis.
  const strictCites = paragraphs.some((p) => /\*\*\s*\[(?:source\s*)?\d+\]/i.test(p));
  for (const para of paragraphs) {
    let cur: Seg[] = [];
    let first = true;
    const flush = () => { if (cur.length) { out.push({ segs: cur, para: first }); cur = []; first = false; } };
    for (const s of tokenize(para.replace(/\s+/g, " ").trim(), defs, usedTerms, papers, strictCites)) {
      if (s.t === "cite" || s.t === "term" || s.t === "i") { cur.push(s); continue; }
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
  const [hover, setHover] = useState(false);
  const summary = paper.summary || paper.abstract || "";
  return (
    <span style={{ position: "relative", display: "inline" }} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <button
        onClick={(e) => { e.stopPropagation(); onOpen(paper); }}
        style={{
          fontWeight: 700, color: hover ? "#555" : "#111", border: "none", cursor: "pointer",
          background: "none", padding: 0, transition: "color 0.15s",
          fontFamily: "inherit", fontSize: "inherit", lineHeight: "inherit",
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

export function TermChip({ text, def }: { text: string; def: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span
      style={{ position: "relative", display: "inline" }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <span
        role="button"
        tabIndex={0}
        onClick={() => setOpen(v => !v)}
        onKeyDown={e => { if (e.key === "Enter" || e.key === " ") setOpen(v => !v); }}
        style={{
          borderBottom: "2px dotted #888",
          cursor: "help",
          fontWeight: 500,
          textDecorationSkipInk: "none",
        }}
      >{text}</span>
      {open && (
        <span style={{
          position: "absolute", bottom: "calc(100% + 8px)", left: 0, zIndex: 40,
          width: 260, maxWidth: "80vw",
          background: "#1a1a1a", color: "#fff",
          fontFamily: BODY, fontSize: "0.78rem", fontWeight: 400, lineHeight: 1.55,
          padding: "10px 14px",
          boxShadow: "4px 4px 0 0 rgba(0,0,0,0.3)",
        }}>
          <span style={{ display: "block", fontFamily: MONO, fontSize: "0.52rem", letterSpacing: "1.5px", textTransform: "uppercase", color: "#aaa", marginBottom: 4 }}>Definition</span>
          {def}
        </span>
      )}
    </span>
  );
}

/* ---- inline paper card (revealed on first mention) ---- */

function PaperBlobCard({ paper, paperIdx, onOpen, prose }: { paper: PaperItem; paperIdx: number; onOpen: (p: PaperItem) => void; prose?: React.ReactNode }) {
  // Card anatomy: paper name (small, underlined, clickable) with faint authors
  // top-left; the summary's FIRST sentence as the big bold TLDR; then the
  // digest's explanation prose. The rest of the summary + the metrics breakdown
  // live in the detail overlay — the whole card opens it.
  const body = (paper.summary || paper.abstract || "").trim();
  const sentences = body.match(/[^.!?]+[.!?]+["')\]]?/g)?.map(s => s.trim()) ?? (body ? [body] : []);
  const hero = sentences[0] || "";

  const authors = paper.authors.length > 0
    ? paper.authors.length <= 3 ? paper.authors.join(", ") : `${paper.authors.slice(0, 3).join(", ")} et al.`
    : "";

  return (
    <div onClick={() => onOpen(paper)} className="brief-card" style={{ ...washStyle(paperIdx), border: "2px solid #1a1a1a", boxShadow: "6px 6px 0 0 rgba(0,0,0,1)", padding: "26px 28px", display: "flex", flexDirection: "column", gap: 16, cursor: "pointer" }}>
      {/* Paper identity, top-left: underlined clickable name, faint (not underlined) authors */}
      <div>
        <button
          onClick={(e) => { e.stopPropagation(); onOpen(paper); }}
          style={{ textAlign: "left", background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: MONO, fontSize: "0.6rem", fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", color: "#1a1a1a", textDecoration: "underline", textUnderlineOffset: "3px", lineHeight: 1.5 }}
        >
          {paper.plainName || paper.title}
        </button>
        {authors && (
          <div style={{ fontSize: "0.62rem", fontStyle: "italic", color: "#999", marginTop: 3 }}>{authors}</div>
        )}
      </div>

      {/* TLDR — the first sentence, big and bold. Tap the card for the breakdown. */}
      {hero && (
        <p style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: "1.5rem", lineHeight: 1.32, color: "#1a1a1a", margin: 0, letterSpacing: "-0.01em" }}>
          {hero}
        </p>
      )}

      {/* The digest's explanation of this study */}
      {prose && (
        <div style={{ fontSize: "0.95rem", lineHeight: 1.7, color: "#333" }}>{prose}</div>
      )}
    </div>
  );
}

// Study-details view — opened from a card's "View study". Shows the paper's formal
// identity (name, venue, year, authors), the start of the abstract, and a link out
// to the full paper.
function PaperDetailOverlay({ paper, paperIdx, onClose }: { paper: PaperItem; paperIdx: number; onClose: () => void }) {
  const abstract = paper.abstract || paper.fullText || "";
  const preview = abstract.length > 420 ? abstract.slice(0, 417).trimEnd() + "…" : abstract;
  // Metrics breakdown: takeaway stat first, then key findings. Pull a leading
  // number out big when a chunk has one ("7%", "354", "2.5x"); otherwise text only.
  const chunks = [...(paper.takeawayStat ? [paper.takeawayStat] : []), ...(paper.keyFindings ?? [])]
    .map(text => {
      const m = text.match(/\d[\d,.]*\s?(?:%|×|x\b|percent|million|billion|k\b)?/i);
      return { num: m?.[0]?.trim() ?? null, text };
    });
  const summaryRest = (() => {
    const body = (paper.summary || "").trim();
    const sentences = body.match(/[^.!?]+[.!?]+["')\]]?/g)?.map(s => s.trim()) ?? [];
    return sentences.slice(1).join(" ");
  })();
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 80, background: "rgba(26,26,26,0.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ ...washStyle(paperIdx), maxWidth: 560, width: "100%", maxHeight: "85vh", overflowY: "auto", border: "2px solid #1a1a1a", boxShadow: "8px 8px 0 0 rgba(0,0,0,1)", padding: "26px 28px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <span style={{ fontFamily: MONO, fontSize: "0.6rem", letterSpacing: "1.5px", color: "#666" }}>{venueLabel(paper)}</span>
          <button onClick={onClose} style={{ fontFamily: BODY, fontSize: "0.78rem", background: "none", border: "none", cursor: "pointer", color: "#888" }}>✕ Close</button>
        </div>

        <h3 style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: "1.3rem", lineHeight: 1.25, margin: "0 0 8px", textTransform: "capitalize" }}>{paper.title}</h3>
        {paper.authors.length > 0 && <p style={{ fontFamily: MONO, fontSize: "0.66rem", fontStyle: "italic", color: "#777", margin: "0 0 20px" }}>{paper.authors.slice(0, 6).join(", ")}</p>}

        {/* Rest of the plain-English summary (the card only shows the first sentence) */}
        {summaryRest && (
          <p style={{ fontSize: "0.92rem", lineHeight: 1.65, color: "#333", margin: "0 0 20px" }}>{summaryRest}</p>
        )}

        {/* The numbers — takeaway stat + key findings as stat chunks */}
        {chunks.length > 0 && (
          <div style={{ marginBottom: 22 }}>
            <div style={{ fontFamily: MONO, fontSize: "0.56rem", letterSpacing: "1.5px", textTransform: "uppercase", color: "#999", marginBottom: 7 }}>The numbers</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              {chunks.map((c, i) => (
                <div key={i} style={{ flex: "1 1 45%", minWidth: 170, background: "rgba(255,255,255,0.6)", border: "1px solid rgba(26,26,26,0.35)", padding: "12px 14px" }}>
                  {c.num && (
                    <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: "1.5rem", lineHeight: 1.1, color: "#1a1a1a", marginBottom: 5, letterSpacing: "-0.01em" }}>{c.num}</div>
                  )}
                  <div style={{ fontSize: "0.78rem", lineHeight: 1.5, color: "#444" }}>{c.text}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {preview ? (
          <div style={{ marginBottom: 22 }}>
            <div style={{ fontFamily: MONO, fontSize: "0.56rem", letterSpacing: "1.5px", textTransform: "uppercase", color: "#999", marginBottom: 7 }}>Abstract</div>
            <p style={{ fontSize: "0.92rem", lineHeight: 1.65, color: "#333", margin: 0 }}>{preview}</p>
          </div>
        ) : (
          <p style={{ fontSize: "0.88rem", color: "#999", fontStyle: "italic", marginBottom: 22 }}>No abstract available.</p>
        )}

        {paper.sourceUrl && (
          <a href={paper.sourceUrl} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 8, fontFamily: MONO, fontSize: "0.65rem", letterSpacing: "1px", textTransform: "uppercase", background: "#1a1a1a", color: "#fff", padding: "10px 16px", whiteSpace: "nowrap" }}>
            Read the full paper ↗
          </a>
        )}
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

/* ---- main: user-paced verdict (Next source) → dig deeper ---- */

export function BriefDigest({ synthesis, theme, keyConcepts, papers, digestId, seeds, guestAnswers, isLoggedIn, onSignIn, revealAll, endSlot }: {
  synthesis: string;
  theme?: string;
  keyConcepts: string[];
  papers: PaperItem[];
  digestId: string;
  seeds: string[];
  guestAnswers?: string[];
  isLoggedIn: boolean;
  onSignIn?: () => void;
  /** Start fully revealed (no "Next source" pacing) — used by the digest history view. */
  revealAll?: boolean;
  /** Rendered after the prose once every source is revealed (e.g. the regenerate CTA). */
  endSlot?: React.ReactNode;
  // Accepted for API compatibility with today-page; keyword tags were removed from
  // the dead-simple card, so these are no longer read here.
  interests?: { keyword: string; field: string }[];
  seedField?: string;
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

  // User-paced reveal by SOURCE: step 0 shows only the intro (the answer paragraph
  // before any source); each step then stops at the START of the next source's
  // paragraph, so a source's lead-in sentence always appears with its card.
  // Old digests with no intro (first source at line 0) start on the first source.
  const stops = useMemo(() => {
    const paraStartOf = (lineIdx: number) => {
      let start = 0;
      for (const l of lines) {
        if (l.idx > lineIdx) break;
        if (l.para) start = l.idx;
      }
      return start;
    };
    const cardParaStarts = [...new Set(Object.keys(cardsAfter).map(Number).map(paraStartOf))].sort((a, b) => a - b);
    const s = cardParaStarts.filter(x => x > 0); // stop before each source's paragraph (intro shows first)
    s.push(lines.length);
    return s.length ? s : [lines.length];
  }, [cardsAfter, lines]);

  const [step, setStep] = useState(revealAll ? Number.MAX_SAFE_INTEGER : 0);
  const n = Math.min(stops[Math.min(step, stops.length - 1)] ?? lines.length, lines.length);
  const allRevealed = n >= lines.length;
  // First click reveals the first source; later clicks advance through the rest.
  const anySourceRevealed = Object.keys(cardsAfter).some(k => Number(k) < n);
  const [detail, setDetail] = useState<{ paper: PaperItem; idx: number } | null>(null);

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
    if (s.t === "i") return <em key={i}>{s.text}</em>;
    if (s.t === "term") return <TermChip key={i} text={s.text} def={s.def} />;
    const paper = papers[s.paperIdx];
    return paper ? <PaperChip key={i} paper={paper} paperIdx={s.paperIdx} label={s.label} cap={lineStart && i === 0} onOpen={openDetail} /> : <strong key={i}>{s.label}</strong>;
  };

  // Assemble revealed lines into paragraphs. Each paragraph is one study's block:
  // its card wraps the paragraph's prose, so all of that study's info lives in one
  // box. A paragraph with no card (e.g. a closing line) renders as plain prose.
  const revealed = lines.slice(0, n);
  const els: React.ReactNode[] = [];
  let buf: React.ReactNode[] = [];
  let firstEl = true;
  let pendingCards: number[] = [];
  const flush = () => {
    const prose = buf.length ? <>{buf}</> : null;
    if (pendingCards.length) {
      pendingCards.forEach((pi, k) => {
        if (!papers[pi]) return;
        els.push(
          <div key={`c${pi}`} className="brief-line" style={{ margin: firstEl ? "0" : "34px 0 0" }}>
            <PaperBlobCard paper={papers[pi]} paperIdx={pi} onOpen={openDetail} prose={k === 0 ? prose : undefined} />
          </div>
        );
        firstEl = false;
      });
    } else if (prose) {
      els.push(<p key={`p${els.length}`} style={{ fontSize: "0.95rem", lineHeight: 1.7, color: "#333", margin: firstEl ? 0 : "24px 0 0" }}>{prose}</p>);
      firstEl = false;
    }
    buf = [];
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

      {/* User-paced: reveal one source at a time, then straight into dig deeper */}
      {!allRevealed && (
        <button onClick={() => setStep((s) => s + 1)} className="brief-advance brief-line" style={{ marginTop: 24, fontFamily: DISPLAY, fontSize: "0.92rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", background: "#fff", border: "2px solid #1a1a1a", boxShadow: "4px 4px 0 0 rgba(0,0,0,1)", padding: "11px 18px", cursor: "pointer", color: "#1a1a1a" }}>
          {anySourceRevealed ? "Next source →" : "Reveal first source →"}
        </button>
      )}

      {allRevealed && endSlot}

      {/* Threads mount immediately so seed preloads start, but stay hidden until the walk ends */}
      <div style={{ marginTop: 36, display: allRevealed ? undefined : "none" }}>
        <BriefThreads digestId={digestId} seeds={seeds} guestAnswers={guestAnswers} isLoggedIn={isLoggedIn} onSignIn={onSignIn} />
      </div>

      {detail && <PaperDetailOverlay paper={detail.paper} paperIdx={detail.idx} onClose={() => setDetail(null)} />}
    </div>
  );
}
