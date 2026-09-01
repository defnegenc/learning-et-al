"use client";

import React, { useMemo, useState } from "react";
import type { PaperItem } from "@/lib/types";
import { flattenSynthesis, resolvePaperFromBold, splitSynthesisTheme } from "./synthesis-text";
import { PaperCard, paperByline } from "@/components/paper-card";
import { ActionButton, BODY_STYLE, DIM, INK, InkTip } from "@/components/design-system";
import { DefinitionTerm, parseDefinitions } from "./definition-term";
import { stripAbstractLabel } from "@/lib/utils";

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

/**
 * A paper's name in the prose. The ink underline replaces the coloured
 * highlight the name used to carry: the card's wash is what makes the match, so
 * a second colour on the word was saying the same thing twice.
 */
function PaperChip({ paper, label, cap, onOpen }: { paper: PaperItem; label: string; cap: boolean; onOpen: (p: PaperItem) => void }) {
  const [hover, setHover] = useState(false);
  const summary = stripAbstractLabel(paper.summary || paper.abstract || "");
  return (
    <span style={{ position: "relative", display: "inline" }} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <button
        onClick={(e) => { e.stopPropagation(); onOpen(paper); }}
        style={{
          fontWeight: 600, color: INK, border: "none", cursor: "pointer",
          background: "none", padding: 0,
          textDecoration: "underline", textDecorationThickness: hover ? "3px" : "2px",
          textUnderlineOffset: "3px", transition: "text-decoration-thickness 140ms",
          fontFamily: "inherit", fontSize: "inherit", lineHeight: "inherit",
        }}
      >{cap ? label.charAt(0).toUpperCase() + label.slice(1) : label}</button>
      {hover && summary && (
        <span style={{ position: "absolute", bottom: "calc(100% + 8px)", left: 0, zIndex: 40, pointerEvents: "none" }}>
          <InkTip label={paperByline(paper)}>
            {summary.length > 150 ? summary.slice(0, 147) + "…" : summary}
          </InkTip>
        </span>
      )}
    </span>
  );
}

/** Hard-word definitions. Same ink tooltip as everything else that explains. */
export function TermChip({ text, def, tint }: { text: string; def: string; tint?: string }) {
  return <DefinitionTerm text={text} def={def} tint={tint} />;
}

/* ---- main: user-paced verdict (Next source) → dig deeper ---- */

export function BriefDigest({ synthesis, theme, keyConcepts, papers, revealAll, endSlot, loggedIn, savedIds, onSignedOutSaveChange }: {
  synthesis: string;
  theme?: string;
  keyConcepts: string[];
  papers: PaperItem[];
  /** Accepted for call-site compatibility; no longer read since digest-level Q&A was removed. */
  digestId?: string;
  /** Start fully revealed (no "Next source" pacing) — used by the digest history view. */
  revealAll?: boolean;
  /** Rendered after the prose once every source is revealed (e.g. the regenerate CTA). */
  endSlot?: React.ReactNode;
  /** Shows the bookmark on each card for an authenticated reader. */
  loggedIn?: boolean;
  /** Paper ids already in the vault, so the bookmark renders filled on load. */
  savedIds?: Set<string>;
  /** Shared pages can hold a guest's saves until they sign in. */
  onSignedOutSaveChange?: (paper: PaperItem, saved: boolean) => void;
  // Accepted for API compatibility with today-page; keyword tags were removed from
  // the dead-simple card, so these are no longer read here.
  interests?: { keyword: string; field: string }[];
  seedField?: string;
}) {
  const lines = useMemo(() => {
    const { bodyText } = splitSynthesisTheme(synthesis, theme);
    const defs = parseDefinitions(keyConcepts);
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

  const sourceStarts = useMemo(() => (
    Object.entries(cardsAfter)
      .map(([lineIdx, paperIdxs]) => ({ lineIdx: Number(lineIdx), paperIdxs }))
      .sort((a, b) => a.lineIdx - b.lineIdx)
  ), [cardsAfter]);

  const [step, setStep] = useState(revealAll ? Number.MAX_SAFE_INTEGER : 0);
  const n = Math.min(stops[Math.min(step, stops.length - 1)] ?? lines.length, lines.length);
  const allRevealed = n >= lines.length;
  // First click reveals the first source; later clicks advance through the rest.
  const anySourceRevealed = Object.keys(cardsAfter).some(k => Number(k) < n);
  const nextStop = stops[Math.min(step + 1, stops.length - 1)] ?? lines.length;
  const nextPaperIdx = sourceStarts.find(start => start.lineIdx >= n && start.lineIdx < nextStop)?.paperIdxs[0]
    ?? sourceStarts.find(start => start.lineIdx >= n)?.paperIdxs[0];
  const nextPaperName = typeof nextPaperIdx === "number"
    ? (papers[nextPaperIdx]?.plainName || papers[nextPaperIdx]?.title || "").trim()
    : "";

  // Clicking a paper chip in the prose scrolls that paper's card into view (each
  // bump re-triggers the effect). The card is always open — there are no tiles.
  const [expandTicks, setExpandTicks] = useState<Record<number, number>>({});
  const openCard = (paper: PaperItem) => {
    const i = papers.findIndex(p => p.id === paper.id);
    if (i >= 0) setExpandTicks(t => ({ ...t, [i]: (t[i] || 0) + 1 }));
  };

  const renderSeg = (s: Seg, i: number, lineStart: boolean) => {
    if (s.t === "w") return <span key={i}>{s.text}</span>;
    if (s.t === "b") return <strong key={i} style={{ fontWeight: 600 }}>{s.text}</strong>;
    if (s.t === "i") return <em key={i}>{s.text}</em>;
    if (s.t === "term") return <TermChip key={i} text={s.text} def={s.def} />;
    const paper = papers[s.paperIdx];
    return paper ? <PaperChip key={i} paper={paper} label={s.label} cap={lineStart && i === 0} onOpen={openCard} /> : <strong key={i}>{s.label}</strong>;
  };

  // Assemble revealed lines into paragraphs. Each source's paragraph is replaced
  // by its card (the card composes its own study-context line — the synthesis
  // bullet prose is not rendered). A paragraph with no card (the intro answer,
  // a closing line) still renders as plain prose.
  const revealed = lines.slice(0, n);
  const els: React.ReactNode[] = [];
  let buf: React.ReactNode[] = [];
  let firstEl = true;
  let pendingCards: number[] = [];
  const flush = () => {
    const prose = buf.length ? <>{buf}</> : null;
    if (pendingCards.length) {
      pendingCards.forEach((pi) => {
        if (!papers[pi]) return;
        els.push(
          <div key={`c${pi}`} className="brief-line" style={{ margin: firstEl ? "0" : "34px 0 0" }}>
            <PaperCard
              paper={papers[pi]}
              index={pi}
              loggedIn={loggedIn}
              initialBookmarked={savedIds?.has(papers[pi].id)}
              onSignedOutSaveChange={onSignedOutSaveChange}
              expandTick={expandTicks[pi]}
            />
          </div>
        );
        firstEl = false;
      });
    } else if (prose) {
      els.push(<p key={`p${els.length}`} style={{ ...BODY_STYLE, color: DIM, margin: firstEl ? 0 : "24px 0 0" }}>{prose}</p>);
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
        @media (prefers-reduced-motion: reduce) { .brief-line { animation: none; } }
      `}</style>

      {els}

      {/* User-paced: reveal one source at a time, then straight into dig deeper */}
      {!allRevealed && (
        <div className="brief-line" style={{ marginTop: 24 }}>
          <ActionButton onClick={() => setStep((s) => s + 1)}>
            {nextPaperName ? `Next: ${nextPaperName}` : anySourceRevealed ? "Next source" : "Reveal first source →"}
          </ActionButton>
        </div>
      )}

      {allRevealed && endSlot}
    </div>
  );
}
