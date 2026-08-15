"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Bookmark } from "lucide-react";
import type { PaperItem } from "@/lib/types";
import { CARD_PALETTES as PALETTES, washStyle } from "./palettes";
import { flattenSynthesis, resolvePaperFromBold, splitSynthesisTheme } from "./synthesis-text";

const MONO = "var(--font-mono), monospace";
const DISPLAY = "var(--font-display), sans-serif";
const BODY = "var(--font-inter), sans-serif";


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
          {def}
        </span>
      )}
    </span>
  );
}

/* ---- inline paper card (revealed on first mention) ---- */

// Render the pipeline's **bold** emphasis without changing the tile's font or size.
function emphasize(text: string): React.ReactNode[] {
  return text.split(/\*\*(.+?)\*\*/g).map((part, i) =>
    !part ? null : i % 2 === 1
      ? <strong key={i} style={{ fontWeight: 700 }}>{part}</strong>
      : <span key={i}>{part}</span>
  );
}

// Some older digests stored detail copy with a lower-case first word. Capitalize
// the first visible character without otherwise rewriting the generated text.
function startCap(text: string): string {
  return text.replace(/[A-Za-z]/, (letter) => letter.toUpperCase());
}

const TILE_LABEL: React.CSSProperties = { fontFamily: DISPLAY, fontSize: "0.85rem", fontWeight: 700, letterSpacing: "-0.01em", color: "#1a1a1a", marginBottom: 10 };
// One explicit body style for every tile. Claim, findings, and takeaway now use
// the same Apercu face, size, weight, and rhythm regardless of their content.
const TILE_BODY: React.CSSProperties = {
  fontFamily: '"Apercu Pro", var(--font-inter), sans-serif',
  fontSize: "0.8rem",
  fontStyle: "normal",
  fontWeight: 400,
  letterSpacing: "normal",
  lineHeight: 1.55,
  color: "#1a1a1a",
};

function BriefTile({
  heading,
  background = "#fff",
  fullWidth = false,
  children,
}: {
  heading: string;
  background?: string;
  fullWidth?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      style={{
        background,
        border: "1.5px solid #1a1a1a",
        padding: "15px 16px 16px",
        gridColumn: fullWidth ? "1 / -1" : undefined,
      }}
    >
      <h3 style={{ ...TILE_LABEL, marginTop: 0 }}>{heading}</h3>
      <div style={TILE_BODY}>{children}</div>
    </section>
  );
}

// The collapsed card names exactly the tiles it will open, so the one line of
// copy under the TLDR doubles as the expand affordance ("See the Claim, the
// Findings, and the Takeaway ↓"). Only tiles that exist are listed.
function tileListLabel(labels: string[]): string {
  const parts = labels.map(l => `the ${l}`);
  if (parts.length === 1) return `See ${parts[0]}`;
  if (parts.length === 2) return `See ${parts[0]} and ${parts[1]}`;
  return `See ${parts.slice(0, -1).join(", ")}, and ${parts[parts.length - 1]}`;
}

// The card's one save affordance: a bookmark that says what it does. An icon
// alone read as decoration on a card this loud, so it carries a mono label —
// "Read later" before, "Saved" after. Optimistic, reverting if the write fails.
function ReadLater({ paperId, initialSaved }: { paperId: string; initialSaved?: boolean }) {
  const [saved, setSaved] = useState(!!initialSaved);
  const [busy, setBusy] = useState(false);
  const [hover, setHover] = useState(false);

  async function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;
    const next = !saved;
    setSaved(next);
    setBusy(true);
    try {
      const res = await fetch(`/api/papers/${paperId}/feedback`, {
        method: next ? "POST" : "DELETE",
        headers: next ? { "Content-Type": "application/json" } : undefined,
        body: next ? JSON.stringify({ type: "star" }) : undefined,
      });
      if (!res.ok) throw new Error("save failed");
      if (next) {
        // Warm the reading prep so the vault detail opens ready rather than
        // spinning — same background pair the old source-card fired.
        fetch(`/api/papers/${paperId}/companion`, { method: "POST" }).catch(() => {});
        fetch(`/api/papers/${paperId}/homework`, { method: "POST" }).catch(() => {});
      }
    } catch {
      setSaved(!next);
    } finally {
      setBusy(false);
    }
  }

  const lit = saved || hover;
  return (
    <button
      onClick={toggle}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      aria-pressed={saved}
      title={saved ? "Remove from your vault" : "Save to your vault"}
      style={{
        display: "inline-flex", alignItems: "center", gap: 6, flexShrink: 0,
        background: "none", border: "none", padding: 0, cursor: "pointer",
        fontFamily: MONO, fontSize: "0.6rem", fontWeight: 700,
        letterSpacing: "0.12em", textTransform: "uppercase", whiteSpace: "nowrap",
        color: lit ? "#1a1a1a" : "rgba(26,26,26,0.5)",
        transition: "color 0.15s",
      }}
    >
      <Bookmark size={13} style={{ fill: saved ? "#1a1a1a" : "none", stroke: "currentColor", transition: "fill 0.15s" }} />
      {saved ? "Saved" : "Read later"}
    </button>
  );
}

function PaperBlobCard({ paper, paperIdx, expandTick, canSave, initialSaved }: { paper: PaperItem; paperIdx: number; expandTick?: number; canSave?: boolean; initialSaved?: boolean }) {
  // Card anatomy: paper name + faint authors · year top-left; the summary's FIRST
  // sentence as the big bold TLDR; then one expand line that names the tiles it
  // reveals — THE CLAIM + FINDINGS side by side and a solid-palette full-width
  // TAKEAWAY — plus a "Read paper ↗" button. No detail overlay and no
  // study-context line: everything about a source lives on its card.
  const [expanded, setExpanded] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  // A paper-chip click in the prose bumps expandTick → open the tiles and scroll
  // here. Expansion is adjusted during render (not in the effect) so the scroll
  // effect fires after the tiles have laid out.
  const [seenTick, setSeenTick] = useState(0);
  if (expandTick && expandTick !== seenTick) {
    setSeenTick(expandTick);
    setExpanded(true);
  }
  useEffect(() => {
    if (expandTick) ref.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [expandTick]);
  const [c1] = PALETTES[paperIdx % PALETTES.length];
  const body = (paper.summary || paper.abstract || "").trim();
  const sentences = body.match(/[^.!?]+[.!?]+["')\]]?/g)?.map(s => s.trim()) ?? (body ? [body] : []);
  const hero = sentences[0] || "";

  const authors = paper.authors.length > 0
    ? paper.authors.length <= 3 ? paper.authors.join(", ") : `${paper.authors.slice(0, 3).join(", ")} et al.`
    : "";
  const byline = [authors, paper.year ? String(paper.year) : ""].filter(Boolean).join(" · ");

  // Every expanded detail uses the same tile component and type hierarchy.
  // Older digests can miss claim or findings, so only what exists renders.
  // The takeaway line is conversational and often lands its point in sentence 2-3
  // ("You know how X…? Turns out Y.") — capping at one sentence kept the setup
  // and cut the payoff, so the full line renders.
  const isNews = paper.source === "rss";
  const claim = (paper.claim || paper.takeawayHook || "").trim();
  const findings = (paper.keyFindings ?? []).slice(0, 3);
  const findingsLabel = isNews ? "Key Points" : "Findings";
  const takeaway = (paper.takeawayLine || paper.takeawayHook || paper.takeawayStat || "").trim();
  const tileLabels = [
    claim ? "Claim" : "",
    findings.length > 0 ? findingsLabel : "",
    takeaway ? "Takeaway" : "",
  ].filter(Boolean);
  const tileCount = tileLabels.length;

  return (
    <div ref={ref} style={{ ...washStyle(paperIdx), border: "2px solid #1a1a1a", boxShadow: "6px 6px 0 0 rgba(0,0,0,1)", padding: "26px 28px", display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Paper identity, top-left: name toggles the tiles; faint authors · year.
          Top-right: the read-later bookmark. */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
        <div>
          <button
            onClick={() => setExpanded(v => !v)}
            style={{ textAlign: "left", background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: DISPLAY, fontSize: "1rem", fontWeight: 700, letterSpacing: "-0.01em", color: "#1a1a1a", textDecoration: "underline", textUnderlineOffset: "3px", lineHeight: 1.4 }}
          >
            {paper.plainName || paper.title}
          </button>
          {byline && (
            <div style={{ fontSize: "0.62rem", fontStyle: "italic", color: "#999", marginTop: 3 }}>{byline}</div>
          )}
        </div>
        {canSave && <ReadLater paperId={paper.id} initialSaved={initialSaved} />}
      </div>

      {/* TLDR — the first sentence, big and bold */}
      {hero && (
        <p style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: "1.5rem", lineHeight: 1.32, color: "#1a1a1a", margin: 0, letterSpacing: "-0.01em" }}>
          {hero}
        </p>
      )}

      {/* The one line under the TLDR: names the tiles, opens them */}
      {(tileCount > 0 || paper.sourceUrl) && (
        <div>
          <button
            onClick={() => setExpanded(v => !v)}
            style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: DISPLAY, fontSize: "0.88rem", fontWeight: 700, color: "#1a1a1a", textDecoration: "underline", textUnderlineOffset: "3px" }}
          >
            {expanded ? "See less ↑" : tileCount > 0 ? `${tileListLabel(tileLabels)} ↓` : "Read paper ↓"}
          </button>
          {expanded && (
            <div style={{ marginTop: 12 }}>
              {tileCount > 0 && (
                <div className="brief-tiles" style={{ marginBottom: 14 }}>
                  {/* THE CLAIM — top-left, presented as plain text */}
                  {claim && (
                    <BriefTile heading="The Claim" background={`${c1}99`}>
                      {emphasize(startCap(claim))}
                    </BriefTile>
                  )}
                  {/* FINDINGS — top-right, aligned with the claim */}
                  {findings.length > 0 && (
                    <BriefTile heading={findingsLabel}>
                      <ul className="brief-tile-list">
                        {findings.map((finding, i) => (
                          <li key={i}>{emphasize(startCap(finding))}</li>
                        ))}
                      </ul>
                    </BriefTile>
                  )}
                  {/* TAKEAWAY — same type hierarchy, with color carrying emphasis */}
                  {takeaway && (
                    <BriefTile heading="Takeaway" background={c1} fullWidth>
                      {emphasize(startCap(takeaway))}
                    </BriefTile>
                  )}
                </div>
              )}
              {paper.sourceUrl && (
                <a
                  href={paper.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ display: "inline-flex", alignItems: "center", gap: 8, fontFamily: DISPLAY, fontSize: "0.88rem", fontWeight: 700, background: "#1a1a1a", color: "#fff", padding: "10px 16px", textDecoration: "none" }}
                >
                  Read paper ↗
                </a>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ---- main: user-paced verdict (Next source) → dig deeper ---- */

export function BriefDigest({ synthesis, theme, keyConcepts, papers, revealAll, endSlot, canSave, savedIds }: {
  synthesis: string;
  theme?: string;
  keyConcepts: string[];
  papers: PaperItem[];
  /** Show the read-later bookmark on each paper card (signed-in surfaces only). */
  canSave?: boolean;
  /** Paper ids already in the vault, so the bookmark renders filled on load. */
  savedIds?: Set<string>;
  /** Accepted for call-site compatibility; no longer read since digest-level Q&A was removed. */
  digestId?: string;
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

  // Clicking a paper chip in the prose no longer opens an overlay — it expands
  // that paper's card tiles and scrolls to it (each bump re-triggers the effect).
  const [expandTicks, setExpandTicks] = useState<Record<number, number>>({});
  const openCard = (paper: PaperItem) => {
    const i = papers.findIndex(p => p.id === paper.id);
    if (i >= 0) setExpandTicks(t => ({ ...t, [i]: (t[i] || 0) + 1 }));
  };

  const renderSeg = (s: Seg, i: number, lineStart: boolean) => {
    if (s.t === "w") return <span key={i}>{s.text}</span>;
    if (s.t === "b") return <strong key={i} style={{ fontWeight: 700 }}>{s.text}</strong>;
    if (s.t === "i") return <em key={i}>{s.text}</em>;
    if (s.t === "term") return <TermChip key={i} text={s.text} def={s.def} />;
    const paper = papers[s.paperIdx];
    return paper ? <PaperChip key={i} paper={paper} paperIdx={s.paperIdx} label={s.label} cap={lineStart && i === 0} onOpen={openCard} /> : <strong key={i}>{s.label}</strong>;
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
            <PaperBlobCard
              paper={papers[pi]}
              paperIdx={pi}
              expandTick={expandTicks[pi]}
              canSave={canSave}
              initialSaved={savedIds?.has(papers[pi].id)}
            />
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
        .brief-tiles { display: grid; grid-template-columns: minmax(0, 2fr) minmax(0, 3fr); gap: 12px; align-items: stretch; }
        .brief-tile-list { margin: 0; padding-left: 1rem; display: grid; gap: 10px; list-style: disc outside; text-align: left; }
        .brief-tile-list li { display: list-item; padding-left: 0; }
        .brief-tile-list li::marker { font-size: 0.8em; color: #1a1a1a; }
        @media (max-width: 520px) { .brief-tiles { grid-template-columns: minmax(0, 1fr); } }
        .brief-advance { transition: transform .12s ease, box-shadow .12s ease; }
        .brief-advance:hover { transform: translate(-2px,-2px); box-shadow: 6px 6px 0 0 rgba(255,0,127,1) !important; }
      `}</style>

      {els}

      {/* User-paced: reveal one source at a time, then straight into dig deeper */}
      {!allRevealed && (
        <button onClick={() => setStep((s) => s + 1)} className="brief-advance brief-line" style={{ marginTop: 24, fontFamily: DISPLAY, fontSize: "0.95rem", fontWeight: 700, background: "#fff", border: "2px solid #1a1a1a", boxShadow: "4px 4px 0 0 rgba(0,0,0,1)", padding: "11px 18px", cursor: "pointer", color: "#1a1a1a" }}>
          {anySourceRevealed ? "Next source →" : "Reveal first source →"}
        </button>
      )}

      {allRevealed && endSlot}
    </div>
  );
}
