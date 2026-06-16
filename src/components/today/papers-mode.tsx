"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import type { PaperItem } from "./paper-card";
import { splitSynthesisTheme } from "./synthesis-banner";
import {
  type AgentSource,
  type ResultPayload,
  PALETTES,
  washStyle,
  streamThread,
  toLines,
  LineReveal,
  ThinkingTrace,
} from "./brief-threads";

const MONO = "var(--font-mono), monospace";
const DISPLAY = "var(--font-display), sans-serif";
const BODY = "var(--font-inter), sans-serif";

function venueLabel(p: PaperItem): string {
  const url = (p.sourceUrl || "").toLowerCase();
  const kind = url.includes("arxiv") ? "arXiv" : p.source === "rss" ? "News" : "Paper";
  return p.year ? `${kind} · ${p.year}` : kind;
}

// The lens each paper brings, as a noun phrase (the card headline; the title
// stays hidden until you reveal it).
function lensLabel(p: PaperItem): string {
  if (p.category === "news") return "Recent news";
  if (p.category === "foundational") return "A foundational view";
  const kw = p.keywords[0]?.toLowerCase();
  if (kw) return `${/^[aeiou]/.test(kw) ? "An" : "A"} ${kw} lens`;
  return "Another angle";
}

// 1-2 sentence verdict from the synthesis lead, stripped of markdown + source markers.
function verdictLead(synthesis: string, theme?: string): string {
  const { bodyText } = splitSynthesisTheme(synthesis, theme);
  const firstPara = bodyText.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)[0] || "";
  const clean = firstPara
    .replace(/\*\*\[(?:source\s*)?\d+\]\s*/gi, "**")
    .replace(/\[(?:source\s*)?\d+\]/gi, "")
    .replace(/\*\*/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const sentences = clean.match(/[^.!?]+[.!?]+/g) || [clean];
  return sentences.slice(0, 2).map((s) => s.trim()).join(" ");
}

// Cross-cutting starters: prefer the digest's suggested questions, else templates.
function crossStarters(seeds: string[]): string[] {
  if (seeds.length) return seeds.slice(0, 3).map((s) => s.replace(/\*\*/g, ""));
  return ["Where do these three disagree?", "What's the common thread?"];
}

/* ---- an anonymized paper card: the lens + what it does, title hidden until reveal ---- */
function RowCard({ paper, idx, onOpen }: { paper: PaperItem; idx: number; onOpen: () => void }) {
  const [c1] = PALETTES[idx % PALETTES.length];
  const teaser = paper.relatesLine || (paper.connectionReason ? relatesFallback(paper.connectionReason) : "");
  return (
    <button onClick={onOpen} className="pm-card" style={{ ...washStyle(idx), display: "flex", flexDirection: "column", textAlign: "left", border: "2px solid #1a1a1a", boxShadow: "5px 5px 0 0 rgba(0,0,0,1)", padding: "18px 20px", cursor: "pointer", height: "100%" }}>
      <span style={{ fontFamily: BODY, fontSize: "0.72rem", fontWeight: 500, color: "#8a8378", marginBottom: 9 }}>{venueLabel(paper)}</span>
      <span style={{ alignSelf: "flex-start", fontFamily: DISPLAY, fontSize: "0.74rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#1a1a1a", marginBottom: 11, paddingBottom: 4, borderBottom: `3px solid ${c1}` }}>{lensLabel(paper)}</span>
      {teaser && <span style={{ fontFamily: DISPLAY, fontSize: "1.0rem", fontWeight: 600, lineHeight: 1.32, color: "#1a1a1a", marginBottom: 14 }}>{teaser}</span>}
      <span style={{ marginTop: "auto", fontFamily: MONO, fontSize: "0.6rem", letterSpacing: "1.5px", textTransform: "uppercase", color: "#1a1a1a" }}>Reveal the paper →</span>
    </button>
  );
}

/* ---- one Q&A turn in the cross-paper thread ---- */
interface Turn { id: string; question: string; status: string[]; result: ResultPayload | null; error: string | null; }

function TurnBlock({ turn, onOpenDetail, onSourceSeen, cardedRef }: {
  turn: Turn;
  onOpenDetail: (s: AgentSource) => void;
  onSourceSeen: (s: AgentSource) => void;
  cardedRef: React.MutableRefObject<Set<string>>;
}) {
  const [traceDone, setTraceDone] = useState(false);
  const lines = useMemo(() => (turn.result ? toLines(turn.result.answer) : []), [turn.result]);
  return (
    <div style={{ marginTop: 20, paddingLeft: 16, borderLeft: "3px solid #1a1a1a" }}>
      <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: "1.08rem", lineHeight: 1.25, marginBottom: 12 }}>{turn.question}</div>
      {turn.error ? (
        <div style={{ fontFamily: BODY, fontSize: "0.85rem", color: "#ff007f" }}>{turn.error}</div>
      ) : (
        <>
          {!traceDone && <ThinkingTrace status={turn.status} done={!!turn.result} onDone={() => setTraceDone(true)} />}
          {traceDone && turn.result && (
            <LineReveal lines={lines} sources={turn.result.sources} onOpen={onOpenDetail} onSourceSeen={onSourceSeen} onDone={() => {}} cardedRef={cardedRef} />
          )}
        </>
      )}
    </div>
  );
}

/* ---- the cross-paper thread: tell the agent what interests you ---- */
function CrossThread({ digestId, seeds, isLoggedIn, onSignIn, onOpenDetail, onSourceSeen, cardedRef }: {
  digestId: string;
  seeds: string[];
  isLoggedIn: boolean;
  onSignIn?: () => void;
  onOpenDetail: (s: AgentSource) => void;
  onSourceSeen: (s: AgentSource) => void;
  cardedRef: React.MutableRefObject<Set<string>>;
}) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const askedRef = useRef(0);
  const starters = useMemo(() => crossStarters(seeds), [seeds]);

  const ask = (question: string) => {
    const q = question.trim();
    if (!q) return;
    if (!isLoggedIn) {
      setTurns((t) => [...t, { id: `t${askedRef.current++}`, question: q, status: [], result: { answer: "Sign in to thread these papers together — the agent will weave them around your question.", seeds: [], sources: [] }, error: null }]);
      return;
    }
    const id = `t${askedRef.current++}`;
    setTurns((t) => [...t, { id, question: q, status: [], result: null, error: null }]);
    const patch = (fn: (t: Turn) => Turn) => setTurns((prev) => prev.map((t) => (t.id === id ? fn(t) : t)));
    streamThread(digestId, q, [], {
      onStatus: (s) => patch((t) => ({ ...t, status: [...t.status, s] })),
      onResult: (r) => patch((t) => ({ ...t, result: r })),
      onError: (m) => patch((t) => ({ ...t, error: m })),
    }, { concise: true });
  };

  const lastResult = turns.length ? turns[turns.length - 1].result : null;
  const followups = lastResult?.seeds ?? [];
  const prompts = turns.length === 0 ? starters : followups;

  return (
    <div style={{ marginTop: 30 }}>
      <div style={{ fontFamily: DISPLAY, fontSize: "1.05rem", fontWeight: 700, lineHeight: 1.25, color: "#1a1a1a", marginBottom: 12 }}>
        What do you want to pull on across these three?
      </div>

      {turns.map((t) => (
        <TurnBlock key={t.id} turn={t} onOpenDetail={onOpenDetail} onSourceSeen={onSourceSeen} cardedRef={cardedRef} />
      ))}

      {prompts.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: turns.length ? 18 : 4 }}>
          {prompts.map((q) => (
            <button key={q} onClick={() => ask(q)} className="pm-seed" style={{ fontFamily: DISPLAY, fontSize: "0.92rem", fontWeight: 700, color: "#1a1a1a", background: "#fff", border: "1.5px solid #1a1a1a", boxShadow: "3px 3px 0 0 rgba(0,0,0,1)", padding: "10px 15px", textAlign: "left", cursor: "pointer" }}>
              {q}<span style={{ marginLeft: 8, color: "#b3a89a" }}>↳</span>
            </button>
          ))}
        </div>
      )}

      <form onSubmit={(e) => { e.preventDefault(); ask(draft); setDraft(""); }} style={{ display: "flex", gap: 8, marginTop: 14 }}>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Say what interests you across all three…"
          style={{ flex: 1, fontFamily: BODY, fontSize: "0.86rem", border: "1.5px solid #1a1a1a", padding: "9px 12px", outline: "none", background: "#fff" }}
        />
        <button type="submit" style={{ fontFamily: MONO, fontSize: "0.62rem", letterSpacing: "1px", textTransform: "uppercase", fontWeight: 700, background: "#1a1a1a", color: "#fff", border: "none", padding: "9px 15px", cursor: "pointer" }}>Thread it</button>
      </form>
      {!isLoggedIn && onSignIn && (
        <button onClick={onSignIn} style={{ marginTop: 8, background: "none", border: "none", color: "#1a1a1a", textDecoration: "underline", cursor: "pointer", fontFamily: BODY, fontSize: "0.78rem" }}>Sign in to research with the agent</button>
      )}
    </div>
  );
}

/* ---- shared overlay shell ---- */
function OverlayShell({ idx, onClose, children }: { idx: number; onClose: () => void; children: React.ReactNode }) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 80, background: "rgba(26,26,26,0.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ ...washStyle(idx), maxWidth: 540, width: "100%", maxHeight: "85vh", overflowY: "auto", border: "2px solid #1a1a1a", boxShadow: "8px 8px 0 0 rgba(0,0,0,1)", padding: "26px 28px" }}>
        <button onClick={onClose} style={{ fontFamily: BODY, fontSize: "0.78rem", background: "none", border: "none", cursor: "pointer", color: "#888", marginBottom: 14 }}>✕ Close</button>
        {children}
      </div>
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 18 }}>
      <div style={{ fontFamily: DISPLAY, fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#8a8378", marginBottom: 5 }}>{label}</div>
      <div style={{ fontSize: "0.92rem", lineHeight: 1.55, color: "#1a1a1a" }}>{children}</div>
    </div>
  );
}

// Fallback when generation isn't available: turn the headless connectionReason
// fragment ("shows X…") into a complete sentence ("This study shows X…").
function relatesFallback(reason: string): string {
  const r = reason.trim();
  if (!r) return "";
  const sentence = /^[a-z]/.test(r) ? `This study ${r}` : r;
  return /[.!?]$/.test(sentence) ? sentence : sentence + ".";
}

interface Blurb { dinner: string; relates: string }

/* ---- rich detail for a digest paper: TL;DR, how it relates, dinner-party line ---- */
function PaperDetail({ paper, idx, blurb, onClose }: { paper: PaperItem; idx: number; blurb?: Blurb; onClose: () => void }) {
  // The blurb is owned + cached by PapersMode and prefetched on mount, so by the
  // time you click it's usually ready (no flash) and reopening is instant.
  const loading = !blurb;
  const dinner = blurb?.dinner ?? "";
  const relates = blurb?.relates ?? "";

  const tldr = paper.summary || paper.abstract || "";
  // While the generated sentence is still loading, show a loading state rather than
  // the fallback — otherwise the longer fallback flashes then "shortens" to it.
  const relatesText = relates || (loading ? "" : (paper.connectionReason ? relatesFallback(paper.connectionReason) : ""));
  return (
    <OverlayShell idx={idx} onClose={onClose}>
      <div style={{ fontFamily: BODY, fontSize: "0.74rem", fontWeight: 500, color: "#8a8378", marginBottom: 10 }}>{venueLabel(paper)}</div>
      <h3 style={{ fontFamily: DISPLAY, fontWeight: 800, textTransform: "uppercase", fontSize: "1.3rem", lineHeight: 1.15, margin: "0 0 6px" }}>{paper.title}</h3>
      {paper.authors.length > 0 && <p style={{ fontFamily: MONO, fontSize: "0.66rem", fontStyle: "italic", color: "#777", margin: 0 }}>{paper.authors.slice(0, 4).join(", ")}</p>}
      {tldr && <Section label="TL;DR">{tldr}</Section>}
      {(loading || relatesText) && (
        <Section label="How it relates">
          {loading && !relates ? <span style={{ color: "#8a8378", fontStyle: "italic" }}>…</span> : relatesText}
        </Section>
      )}
      {(loading || dinner) && (
        <Section label="At a dinner party">
          {loading ? <span style={{ color: "#8a8378", fontStyle: "italic" }}>Finding the one-liner…</span> : dinner}
        </Section>
      )}
      {paper.sourceUrl && <a href={paper.sourceUrl} target="_blank" rel="noopener noreferrer" style={{ display: "inline-block", marginTop: 20, fontFamily: MONO, fontSize: "0.62rem", letterSpacing: "1px", background: "#1a1a1a", color: "#fff", padding: "7px 12px" }}>VIEW STUDY ↗</a>}
    </OverlayShell>
  );
}

/* ---- basic detail for a discovered (cited) source ---- */
function DetailOverlay({ src, idx, onClose }: { src: AgentSource; idx: number; onClose: () => void }) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 80, background: "rgba(26,26,26,0.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ ...washStyle(idx), maxWidth: 520, width: "100%", border: "2px solid #1a1a1a", boxShadow: "8px 8px 0 0 rgba(0,0,0,1)", padding: "26px 28px" }}>
        <button onClick={onClose} style={{ fontFamily: BODY, fontSize: "0.78rem", background: "none", border: "none", cursor: "pointer", color: "#888", marginBottom: 14 }}>✕ Close</button>
        {(src.venue || src.year) && <div style={{ fontFamily: BODY, fontSize: "0.74rem", fontWeight: 500, color: "#8a8378", marginBottom: 10 }}>{src.venue}{src.venue && src.year ? " · " : ""}{src.year || ""}</div>}
        <h3 style={{ fontFamily: DISPLAY, fontWeight: 800, textTransform: "uppercase", fontSize: "1.3rem", lineHeight: 1.15, margin: "0 0 6px" }}>{src.title}</h3>
        {src.authors.length > 0 && <p style={{ fontFamily: MONO, fontSize: "0.66rem", fontStyle: "italic", color: "#777", margin: "0 0 16px" }}>{src.authors.slice(0, 4).join(", ")}</p>}
        <p style={{ fontSize: "0.95rem", lineHeight: 1.6, color: "#222", margin: 0 }}>{src.summary}</p>
        {src.url && <a href={src.url} target="_blank" rel="noopener noreferrer" style={{ display: "inline-block", marginTop: 18, fontFamily: MONO, fontSize: "0.62rem", letterSpacing: "1px", background: "#1a1a1a", color: "#fff", padding: "7px 12px" }}>VIEW STUDY ↗</a>}
      </div>
    </div>
  );
}

/* ---- main ---- */
export function PapersMode({ synthesis, theme, papers, digestId, seeds, isLoggedIn, onSignIn }: {
  synthesis: string;
  theme?: string;
  papers: PaperItem[];
  digestId: string;
  seeds: string[];
  isLoggedIn: boolean;
  onSignIn?: () => void;
}) {
  const verdict = useMemo(() => verdictLead(synthesis, theme), [synthesis, theme]);
  const trio = papers.slice(0, 3);
  type Detail = { kind: "paper"; paper: PaperItem; idx: number } | { kind: "src"; src: AgentSource; idx: number };
  const [detail, setDetail] = useState<Detail | null>(null);
  const [coda, setCoda] = useState<AgentSource[]>([]);
  const [codaOpen, setCodaOpen] = useState(false);
  const cardedRef = useRef<Set<string>>(new Set());

  // Blurb (TL;DR / how-it-relates / dinner line) cache, seeded from any values
  // already on the paper, populated by a prefetch so opening a paper is instant
  // and reopening never re-fetches (which caused the flash).
  const [blurbs, setBlurbs] = useState<Record<string, Blurb>>(() => {
    const init: Record<string, Blurb> = {};
    for (const p of papers.slice(0, 3)) if (p.dinnerLine != null && p.relatesLine != null) init[p.id] = { dinner: p.dinnerLine, relates: p.relatesLine };
    return init;
  });
  const inflight = useRef<Set<string>>(new Set());
  const ensureBlurb = (id: string) => {
    if (blurbs[id] || inflight.current.has(id)) return;
    inflight.current.add(id);
    fetch(`/api/papers/${id}/blurb`)
      .then((r) => r.json())
      .then((d) => setBlurbs((prev) => ({ ...prev, [id]: { dinner: d.dinner || "", relates: d.relates || "" } })))
      .catch(() => {})
      .finally(() => inflight.current.delete(id));
  };
  useEffect(() => {
    trio.forEach((p) => ensureBlurb(p.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const seeSource = (s: AgentSource) => setCoda((prev) => (prev.some((c) => c.id === s.id) ? prev : [...prev, s]));
  const sourceIndex = (s: AgentSource) => { const i = coda.findIndex((c) => c.id === s.id); return i >= 0 ? i : coda.length; };
  // A citation that points at one of the three digest papers drills into the rich
  // paper detail; anything else (a discovered source) gets the basic overlay.
  const openSource = (s: AgentSource) => {
    const trioIdx = trio.findIndex((p) => p.id === s.id);
    if (trioIdx >= 0) setDetail({ kind: "paper", paper: trio[trioIdx], idx: trioIdx });
    else setDetail({ kind: "src", src: s, idx: sourceIndex(s) });
  };

  if (trio.length === 0) return null;

  return (
    <div>
      <style>{`
        .pm-card { transition: transform .12s ease, box-shadow .12s ease; }
        .pm-card:hover { transform: translate(-2px,-2px); box-shadow: 6px 6px 0 0 rgba(0,0,0,1) !important; }
        .pm-seed { transition: transform .12s ease, box-shadow .12s ease; }
        .pm-seed:hover { transform: translate(-2px,-2px); box-shadow: 5px 5px 0 0 rgba(255,0,127,1) !important; }
      `}</style>

      {verdict && (
        <p style={{ fontFamily: DISPLAY, fontSize: "1.18rem", fontWeight: 500, lineHeight: 1.45, color: "#1a1a1a", margin: "0 0 22px" }}>{verdict}</p>
      )}

      <div style={{ fontFamily: DISPLAY, fontSize: "0.9rem", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.045em", color: "#1a1a1a", marginBottom: 12 }}>
        Three papers to think with
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14, alignItems: "stretch" }}>
        {trio.map((paper, i) => (
          <RowCard key={paper.id} paper={paper} idx={i} onOpen={() => setDetail({ kind: "paper", paper, idx: i })} />
        ))}
      </div>

      <CrossThread
        digestId={digestId}
        seeds={seeds}
        isLoggedIn={isLoggedIn}
        onSignIn={onSignIn}
        onOpenDetail={openSource}
        onSourceSeen={seeSource}
        cardedRef={cardedRef}
      />

      {coda.length > 0 && (
        <div style={{ marginTop: 36, borderTop: "1.5px solid #d8d3c8", paddingTop: 18 }}>
          <button onClick={() => setCodaOpen((o) => !o)} style={{ fontFamily: DISPLAY, fontSize: "0.9rem", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.045em", background: "none", border: "none", cursor: "pointer", color: "#1a1a1a", padding: 0, display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ color: "#b3a89a" }}>{codaOpen ? "▾" : "▸"}</span> Sources found ({coda.length})
          </button>
          {codaOpen && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 14, marginTop: 16 }}>
              {coda.map((s, i) => (
                <div key={s.id} onClick={() => setDetail({ kind: "src", src: s, idx: i })} className="pm-card" style={{ ...washStyle(i), border: "2px solid #1a1a1a", boxShadow: "4px 4px 0 0 rgba(0,0,0,1)", padding: "12px 14px", cursor: "pointer" }}>
                  <h4 style={{ fontFamily: DISPLAY, fontWeight: 800, textTransform: "uppercase", fontSize: "0.82rem", lineHeight: 1.15, margin: "0 0 6px" }}>{s.title}</h4>
                  {s.url && <a href={s.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} style={{ fontFamily: MONO, fontSize: "0.52rem", letterSpacing: "1px", color: "#1a1a1a", borderBottom: "1px solid #1a1a1a" }}>VIEW STUDY ↗</a>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {detail && (detail.kind === "paper"
        ? <PaperDetail paper={detail.paper} idx={detail.idx} blurb={blurbs[detail.paper.id]} onClose={() => setDetail(null)} />
        : <DetailOverlay src={detail.src} idx={detail.idx} onClose={() => setDetail(null)} />)}
    </div>
  );
}
