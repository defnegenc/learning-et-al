"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import type { PaperItem } from "./paper-card";
import { splitSynthesisTheme } from "./synthesis-text";
import { journalName } from "@/lib/venue-name";
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

// Shared section-heading format (matches the "Daily digest" eyebrow).
const HEADING: React.CSSProperties = { fontFamily: DISPLAY, fontSize: "0.95rem", fontWeight: 500, color: "#1a1a1a", textTransform: "uppercase", letterSpacing: "0.04em" };
// The "PAPER · 2026" chip used across prod (faint-bordered mono tag).
const VENUE_CHIP: React.CSSProperties = { display: "inline-block", fontFamily: MONO, fontSize: "0.55rem", letterSpacing: "1.5px", textTransform: "uppercase", color: "#666", border: "1px solid #cbd5e1", padding: "2px 6px" };

function venueLabel(p: PaperItem): string {
  // Show the actual source (arXiv, Nature, PNAS…) rather than a generic "Paper".
  const src = journalName(p.sourceUrl, p.authors) || (p.source === "rss" ? "News" : "Paper");
  return p.year ? `${src} · ${p.year}` : src;
}

// The lens each paper brings, as a noun phrase (the card headline; the title
// stays hidden until you reveal it).
function lensLabel(p: PaperItem): string {
  if (p.category === "news") return "Recent news";
  if (p.category === "foundational") return "The foundational text";
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

/* ---- an anonymized paper card: the lens + what it does, title hidden until reveal ---- */
function RowCard({ paper, idx, onOpen }: { paper: PaperItem; idx: number; onOpen: () => void }) {
  const [c1] = PALETTES[idx % PALETTES.length];
  const isFoundational = paper.category === "foundational";
  // Foundational lane: gold frame + the "why this mattered" line instead of the relates teaser
  const teaser = (isFoundational && paper.foundationalReason)
    || paper.relatesLine
    || (paper.connectionReason ? relatesFallback(paper.connectionReason) : "");
  return (
    <button onClick={onOpen} className="pm-card" style={{ ...washStyle(idx), display: "flex", flexDirection: "column", textAlign: "left", border: isFoundational ? "3px solid transparent" : "2px solid #1a1a1a", ...(isFoundational ? { borderImage: "linear-gradient(135deg, #F7E38F 0%, #C9A227 35%, #8C6D1F 55%, #E6C34A 75%, #F7E38F 100%) 1" } : {}), boxShadow: isFoundational ? "5px 5px 0 0 #C9A227, 0 0 12px rgba(201, 162, 39, 0.45)" : "5px 5px 0 0 rgba(0,0,0,1)", padding: "20px 22px", cursor: "pointer", height: "100%" }}>
      <span style={{ alignSelf: "flex-start", fontFamily: DISPLAY, fontSize: "1.15rem", fontWeight: 800, textTransform: "uppercase", lineHeight: 1.15, letterSpacing: "-0.01em", color: "#1a1a1a", marginBottom: 12, paddingBottom: 5, borderBottom: `3px solid ${isFoundational ? "#C9A227" : c1}` }}>{lensLabel(paper)}</span>
      {teaser && <span style={{ fontFamily: DISPLAY, fontSize: "1.0rem", fontWeight: 600, lineHeight: 1.32, color: "#1a1a1a", marginBottom: 16 }}>{teaser}</span>}
      <span style={{ marginTop: "auto", alignSelf: "flex-end", fontFamily: MONO, fontSize: "0.6rem", letterSpacing: "1.5px", textTransform: "uppercase", color: "#1a1a1a" }}>Reveal the paper →</span>
    </button>
  );
}

/* ---- one Q&A turn ---- */
interface Turn { id: string; question: string; status: string[]; result: ResultPayload | null; error: string | null; }

function TurnBlock({ turn, focusPaperId, onOpenDetail, onSourceSeen, cardedRef }: {
  turn: Turn;
  focusPaperId: string;
  onOpenDetail: (s: AgentSource) => void;
  onSourceSeen: (s: AgentSource) => void;
  cardedRef: React.MutableRefObject<Set<string>>;
}) {
  const [traceDone, setTraceDone] = useState(false);
  // Never render a citation chip for the paper you're already reading — strip its
  // [N] marker even if the model slips and cites it.
  const lines = useMemo(() => {
    if (!turn.result) return [];
    let answer = turn.result.answer;
    const focusIdx = turn.result.sources.findIndex((s) => s.id === focusPaperId);
    if (focusIdx >= 0) answer = answer.replace(new RegExp(`\\s*\\[${focusIdx + 1}\\]`, "g"), "");
    return toLines(answer);
  }, [turn.result, focusPaperId]);
  return (
    <div style={{ marginTop: 18, paddingLeft: 14, borderLeft: "3px solid #1a1a1a" }}>
      <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: "1.0rem", lineHeight: 1.25, marginBottom: 10 }}>{turn.question}</div>
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

/* ---- agentic Q&A about ONE paper, baked into its detail view ---- */
function PaperThread({ paper, theme, digestId, isLoggedIn, onSignIn, onOpenDetail, onSourceSeen, cardedRef }: {
  paper: PaperItem;
  theme: string;
  digestId: string;
  isLoggedIn: boolean;
  onSignIn?: () => void;
  onOpenDetail: (s: AgentSource) => void;
  onSourceSeen: (s: AgentSource) => void;
  cardedRef: React.MutableRefObject<Set<string>>;
}) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const askedRef = useRef(0);
  const starters = [
    "What did it actually find?",
    "How strong is the evidence?",
    theme ? `How does this answer "${theme}"?` : "How does this connect to the big question?",
  ];

  const ask = (question: string) => {
    const q = question.trim();
    if (!q) return;
    if (!isLoggedIn) {
      setTurns((t) => [...t, { id: `t${askedRef.current++}`, question: q, status: [], result: { answer: "Sign in to interrogate this paper — the agent reads it and answers.", seeds: [], sources: [] }, error: null }]);
      return;
    }
    const id = `t${askedRef.current++}`;
    setTurns((t) => [...t, { id, question: q, status: [], result: null, error: null }]);
    const patch = (fn: (t: Turn) => Turn) => setTurns((prev) => prev.map((t) => (t.id === id ? fn(t) : t)));
    streamThread(digestId, q, [], {
      onStatus: (s) => patch((t) => ({ ...t, status: [...t.status, s] })),
      onResult: (r) => patch((t) => ({ ...t, result: r })),
      onError: (m) => patch((t) => ({ ...t, error: m })),
    }, { focusPaperId: paper.id, concise: true });
  };

  const followups = turns.length ? turns[turns.length - 1].result?.seeds ?? [] : [];
  const prompts = turns.length === 0 ? starters : followups;

  return (
    <div style={{ marginTop: 22, borderTop: "1.5px solid rgba(26,26,26,0.18)", paddingTop: 18 }}>
      <div style={{ ...HEADING, marginBottom: 11 }}>Ask this paper</div>

      {turns.map((t) => (
        <TurnBlock key={t.id} turn={t} focusPaperId={paper.id} onOpenDetail={onOpenDetail} onSourceSeen={onSourceSeen} cardedRef={cardedRef} />
      ))}

      {prompts.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: turns.length ? 16 : 0 }}>
          {prompts.map((q) => (
            <button key={q} onClick={() => ask(q)} className="pm-seed" style={{ fontFamily: DISPLAY, fontSize: "0.86rem", fontWeight: 700, color: "#1a1a1a", background: "#fff", border: "1.5px solid #1a1a1a", boxShadow: "3px 3px 0 0 rgba(0,0,0,1)", padding: "8px 13px", textAlign: "left", cursor: "pointer" }}>
              {q}<span style={{ marginLeft: 8, color: "#b3a89a" }}>↳</span>
            </button>
          ))}
        </div>
      )}

      <form onSubmit={(e) => { e.preventDefault(); ask(draft); setDraft(""); }} style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Ask this paper anything…"
          style={{ flex: 1, fontFamily: BODY, fontSize: "0.84rem", border: "1.5px solid #1a1a1a", padding: "8px 11px", outline: "none", background: "#fff" }}
        />
        <button type="submit" style={{ fontFamily: MONO, fontSize: "0.6rem", letterSpacing: "1px", textTransform: "uppercase", fontWeight: 700, background: "#1a1a1a", color: "#fff", border: "none", padding: "8px 13px", cursor: "pointer" }}>Ask</button>
      </form>
      {!isLoggedIn && onSignIn && (
        <button onClick={onSignIn} style={{ marginTop: 8, background: "none", border: "none", color: "#1a1a1a", textDecoration: "underline", cursor: "pointer", fontFamily: BODY, fontSize: "0.78rem" }}>Sign in to research with the agent</button>
      )}
    </div>
  );
}

/* ---- shared overlay shell ---- */
function OverlayShell({ idx, onClose, topRight, children }: { idx: number; onClose: () => void; topRight?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 80, background: "rgba(26,26,26,0.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ ...washStyle(idx), maxWidth: 540, width: "100%", maxHeight: "85vh", overflowY: "auto", border: "2px solid #1a1a1a", boxShadow: "8px 8px 0 0 rgba(0,0,0,1)", padding: "26px 28px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <button onClick={onClose} style={{ fontFamily: BODY, fontSize: "0.78rem", background: "none", border: "none", cursor: "pointer", color: "#888" }}>✕ Close</button>
          {topRight}
        </div>
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

/* ---- rich detail for a digest paper: TL;DR, how it relates, dinner-party line, + Q&A ---- */
function PaperDetail({ paper, idx, blurb, theme, digestId, isLoggedIn, onSignIn, onOpenDetail, onSourceSeen, cardedRef, onClose }: {
  paper: PaperItem;
  idx: number;
  blurb?: Blurb;
  theme: string;
  digestId: string;
  isLoggedIn: boolean;
  onSignIn?: () => void;
  onOpenDetail: (s: AgentSource) => void;
  onSourceSeen: (s: AgentSource) => void;
  cardedRef: React.MutableRefObject<Set<string>>;
  onClose: () => void;
}) {
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
    <OverlayShell idx={idx} onClose={onClose} topRight={<span style={VENUE_CHIP}>{venueLabel(paper)}</span>}>
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
      <PaperThread
        paper={paper}
        theme={theme}
        digestId={digestId}
        isLoggedIn={isLoggedIn}
        onSignIn={onSignIn}
        onOpenDetail={onOpenDetail}
        onSourceSeen={onSourceSeen}
        cardedRef={cardedRef}
      />
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

/* ---- "Dig deeper": explore the topic in different directions (concept-led, not Q&A) ---- */
function DigDeeper({ concepts, digestId, isLoggedIn, onSignIn, onOpenDetail, onSourceSeen, cardedRef }: {
  concepts: string[];
  digestId: string;
  isLoggedIn: boolean;
  onSignIn?: () => void;
  onOpenDetail: (s: AgentSource) => void;
  onSourceSeen: (s: AgentSource) => void;
  cardedRef: React.MutableRefObject<Set<string>>;
}) {
  const directions = useMemo(
    () => concepts.map((c) => (c.includes(": ") ? c.split(": ")[0] : c).trim()).filter(Boolean).slice(0, 5),
    [concepts]
  );
  const [turns, setTurns] = useState<Turn[]>([]);
  const askedRef = useRef(0);

  if (directions.length === 0) return null;

  const explore = (direction: string) => {
    if (!isLoggedIn) {
      setTurns((t) => [...t, { id: `d${askedRef.current++}`, question: direction, status: [], result: { answer: "Sign in to explore this direction across all three papers.", seeds: [], sources: [] }, error: null }]);
      return;
    }
    const id = `d${askedRef.current++}`;
    setTurns((t) => [...t, { id, question: direction, status: [], result: null, error: null }]);
    const patch = (fn: (t: Turn) => Turn) => setTurns((prev) => prev.map((t) => (t.id === id ? fn(t) : t)));
    streamThread(digestId, `Across these three papers, what's the story on "${direction}"? Pull the threads together.`, [], {
      onStatus: (s) => patch((t) => ({ ...t, status: [...t.status, s] })),
      onResult: (r) => patch((t) => ({ ...t, result: r })),
      onError: (m) => patch((t) => ({ ...t, error: m })),
    }, { concise: true });
  };

  const exploredKeys = new Set(turns.map((t) => t.question));
  const remaining = directions.filter((d) => !exploredKeys.has(d));

  return (
    <div style={{ marginTop: 34 }}>
      <div style={{ ...HEADING, marginBottom: 12 }}>Dig deeper</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 9 }}>
        {remaining.map((d) => (
          <button key={d} onClick={() => explore(d)} className="pm-seed" style={{ fontFamily: DISPLAY, fontSize: "0.9rem", fontWeight: 700, color: "#1a1a1a", background: "#fff", border: "1.5px solid #1a1a1a", boxShadow: "3px 3px 0 0 rgba(0,0,0,1)", padding: "9px 14px", textAlign: "left", cursor: "pointer" }}>
            {d}<span style={{ marginLeft: 8, color: "#b3a89a" }}>→</span>
          </button>
        ))}
      </div>
      {turns.map((t) => (
        <TurnBlock key={t.id} turn={t} focusPaperId="" onOpenDetail={onOpenDetail} onSourceSeen={onSourceSeen} cardedRef={cardedRef} />
      ))}
      {!isLoggedIn && onSignIn && turns.length === 0 && (
        <button onClick={onSignIn} style={{ marginTop: 10, background: "none", border: "none", color: "#1a1a1a", textDecoration: "underline", cursor: "pointer", fontFamily: BODY, fontSize: "0.78rem" }}>Sign in to research with the agent</button>
      )}
    </div>
  );
}

/* ---- main ---- */
export function PapersMode({ synthesis, theme, keyConcepts, papers, digestId, isLoggedIn, onSignIn }: {
  synthesis: string;
  theme?: string;
  keyConcepts: string[];
  papers: PaperItem[];
  digestId: string;
  isLoggedIn: boolean;
  onSignIn?: () => void;
}) {
  const verdict = useMemo(() => verdictLead(synthesis, theme), [synthesis, theme]);
  const displayTheme = useMemo(() => theme || splitSynthesisTheme(synthesis, theme).displayTheme, [synthesis, theme]);
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

      <div style={{ ...HEADING, marginBottom: 12 }}>Three papers</div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14, alignItems: "stretch" }}>
        {trio.map((paper, i) => (
          <RowCard key={paper.id} paper={paper} idx={i} onOpen={() => setDetail({ kind: "paper", paper, idx: i })} />
        ))}
      </div>

      <DigDeeper
        concepts={keyConcepts}
        digestId={digestId}
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
        ? <PaperDetail paper={detail.paper} idx={detail.idx} blurb={blurbs[detail.paper.id]} theme={displayTheme} digestId={digestId} isLoggedIn={isLoggedIn} onSignIn={onSignIn} onOpenDetail={openSource} onSourceSeen={seeSource} cardedRef={cardedRef} onClose={() => setDetail(null)} />
        : <DetailOverlay src={detail.src} idx={detail.idx} onClose={() => setDetail(null)} />)}
    </div>
  );
}
