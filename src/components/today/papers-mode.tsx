"use client";

import React, { useMemo, useRef, useState } from "react";
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
  const kind = url.includes("arxiv") ? "ARXIV" : p.source === "rss" ? "NEWS" : "PAPER";
  return p.year ? `${kind} · ${p.year}` : kind;
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

function starterQuestions(paper: PaperItem, theme: string): string[] {
  return [
    "What did it actually find?",
    "How strong is the evidence?",
    theme ? `How does this answer "${theme}"?` : "How does this connect to the big question?",
  ];
}

/* ---- one Q&A turn inside a paper's conversation ---- */
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
    <div style={{ marginTop: 18, paddingLeft: 14, borderLeft: "3px solid #1a1a1a" }}>
      <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: "1.02rem", lineHeight: 1.25, marginBottom: 10 }}>{turn.question}</div>
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

/* ---- detail overlay for a cited source ---- */
function DetailOverlay({ src, idx, onClose }: { src: AgentSource; idx: number; onClose: () => void }) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 80, background: "rgba(26,26,26,0.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ ...washStyle(idx), maxWidth: 520, width: "100%", border: "2px solid #1a1a1a", boxShadow: "8px 8px 0 0 rgba(0,0,0,1)", padding: "26px 28px" }}>
        <button onClick={onClose} style={{ fontFamily: BODY, fontSize: "0.78rem", background: "none", border: "none", cursor: "pointer", color: "#888", marginBottom: 14 }}>✕ Close</button>
        {(src.venue || src.year) && <div style={{ fontFamily: MONO, fontSize: "0.6rem", letterSpacing: "1.5px", color: "#666", marginBottom: 10 }}>{src.venue}{src.venue && src.year ? " · " : ""}{src.year || ""}</div>}
        <h3 style={{ fontFamily: DISPLAY, fontWeight: 800, textTransform: "uppercase", fontSize: "1.3rem", lineHeight: 1.15, margin: "0 0 6px" }}>{src.title}</h3>
        {src.authors.length > 0 && <p style={{ fontFamily: MONO, fontSize: "0.66rem", fontStyle: "italic", color: "#777", margin: "0 0 16px" }}>{src.authors.slice(0, 4).join(", ")}</p>}
        <p style={{ fontSize: "0.95rem", lineHeight: 1.6, color: "#222", margin: 0 }}>{src.summary}</p>
        {src.url && <a href={src.url} target="_blank" rel="noopener noreferrer" style={{ display: "inline-block", marginTop: 18, fontFamily: MONO, fontSize: "0.62rem", letterSpacing: "1px", background: "#1a1a1a", color: "#fff", padding: "7px 12px" }}>VIEW STUDY ↗</a>}
      </div>
    </div>
  );
}

/* ---- compact (collapsed) paper row ---- */
function CompactCard({ paper, idx, onOpen }: { paper: PaperItem; idx: number; onOpen: () => void }) {
  return (
    <button onClick={onOpen} className="pm-card" style={{ ...washStyle(idx), display: "block", width: "100%", textAlign: "left", border: "2px solid #1a1a1a", boxShadow: "3px 3px 0 0 rgba(0,0,0,1)", padding: "11px 14px", cursor: "pointer" }}>
      <span style={{ fontFamily: MONO, fontSize: "0.52rem", letterSpacing: "1.5px", color: "#666" }}>{venueLabel(paper)}</span>
      <span style={{ display: "block", fontFamily: DISPLAY, fontWeight: 800, textTransform: "uppercase", fontSize: "0.82rem", lineHeight: 1.15, marginTop: 3 }}>{paper.title}</span>
    </button>
  );
}

/* ---- expanded paper card with the conversation ---- */
function ExpandedCard({ paper, idx, theme, digestId, isLoggedIn, onSignIn, onOpenDetail, onSourceSeen, cardedRef, hasNext, onNext }: {
  paper: PaperItem;
  idx: number;
  theme: string;
  digestId: string;
  isLoggedIn: boolean;
  onSignIn?: () => void;
  onOpenDetail: (s: AgentSource) => void;
  onSourceSeen: (s: AgentSource) => void;
  cardedRef: React.MutableRefObject<Set<string>>;
  hasNext: boolean;
  onNext: () => void;
}) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const tags = PALETTES[idx % PALETTES.length];
  const summary = paper.summary || paper.abstract || "";
  const askedRef = useRef(0);

  const ask = (question: string) => {
    const q = question.trim();
    if (!q) return;
    if (!isLoggedIn) {
      setTurns((t) => [...t, { id: `t${askedRef.current++}`, question: q, status: [], result: { answer: "Sign in to interrogate this paper — the agent will read it and answer.", seeds: [], sources: [] }, error: null }]);
      return;
    }
    const id = `t${askedRef.current++}`;
    setTurns((t) => [...t, { id, question: q, status: [], result: null, error: null }]);
    const patch = (fn: (t: Turn) => Turn) => setTurns((prev) => prev.map((t) => (t.id === id ? fn(t) : t)));
    streamThread(
      digestId,
      q,
      [],
      {
        onStatus: (s) => patch((t) => ({ ...t, status: [...t.status, s] })),
        onResult: (r) => patch((t) => ({ ...t, result: r })),
        onError: (m) => patch((t) => ({ ...t, error: m })),
      },
      paper.id
    );
  };

  const lastResult = turns.length ? turns[turns.length - 1].result : null;
  const followups = lastResult?.seeds ?? [];
  const starters = starterQuestions(paper, theme);

  return (
    <div style={{ ...washStyle(idx), border: "2px solid #1a1a1a", boxShadow: "6px 6px 0 0 rgba(0,0,0,1)", padding: "16px 18px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 7 }}>
        <span style={{ fontFamily: MONO, fontSize: "0.62rem", fontWeight: 600, letterSpacing: "1.5px", color: "#1a1a1a", background: "#fff", border: "1.5px solid #1a1a1a", padding: "3px 9px" }}>{venueLabel(paper)}</span>
        {paper.sourceUrl && <a href={paper.sourceUrl} target="_blank" rel="noopener noreferrer" style={{ fontFamily: MONO, fontSize: "0.55rem", letterSpacing: "1px", color: "#1a1a1a", borderBottom: "1.5px solid #1a1a1a" }}>VIEW STUDY ↗</a>}
      </div>
      <h3 style={{ fontFamily: DISPLAY, fontWeight: 800, textTransform: "uppercase", fontSize: "1.05rem", lineHeight: 1.15, margin: "0 0 4px" }}>{paper.title}</h3>
      {paper.authors.length > 0 && <p style={{ fontFamily: MONO, fontSize: "0.58rem", fontStyle: "italic", color: "#888", margin: "0 0 9px" }}>{paper.authors.slice(0, 4).join(", ")}</p>}
      {summary && <p style={{ fontSize: "0.84rem", lineHeight: 1.55, color: "#222", margin: "0 0 8px" }}>{summary}</p>}
      <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: paper.connectionReason ? 14 : 4 }}>
        {paper.keywords.slice(0, 3).map((kw, i) => (
          <span key={kw} style={{ fontFamily: MONO, fontSize: "0.55rem", textTransform: "uppercase", letterSpacing: "0.5px", background: tags[i % 2], border: "1px solid #1a1a1a", padding: "2px 7px" }}>{kw}</span>
        ))}
      </div>
      {paper.connectionReason && (
        <div style={{ marginBottom: 4 }}>
          <div style={{ fontFamily: DISPLAY, fontSize: "0.78rem", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.045em", color: "#1a1a1a", marginBottom: 5 }}>Why it&apos;s here</div>
          <p style={{ fontSize: "0.86rem", lineHeight: 1.5, color: "#1a1a1a", margin: 0 }}>{paper.connectionReason}</p>
        </div>
      )}

      {/* conversation */}
      {turns.map((t) => (
        <TurnBlock key={t.id} turn={t} onOpenDetail={onOpenDetail} onSourceSeen={onSourceSeen} cardedRef={cardedRef} />
      ))}

      {/* prompts: starters before first question, follow-ups after */}
      <div style={{ marginTop: 16 }}>
        <div style={{ fontFamily: DISPLAY, fontSize: "0.78rem", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.045em", color: "#1a1a1a", marginBottom: 9 }}>
          {turns.length === 0 ? "Ask this paper" : followups.length ? "Keep going" : "Ask more"}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {(turns.length === 0 ? starters : followups).map((q) => (
            <button key={q} onClick={() => ask(q)} className="pm-seed" style={{ fontFamily: BODY, fontSize: "0.82rem", fontWeight: 500, background: "#fff", border: "1.5px solid #1a1a1a", boxShadow: "3px 3px 0 0 rgba(0,0,0,1)", padding: "7px 12px", textAlign: "left", cursor: "pointer" }}>
              {q.replace(/\*\*/g, "")}<span style={{ marginLeft: 8, color: "#b3a89a" }}>↳</span>
            </button>
          ))}
        </div>
        <form onSubmit={(e) => { e.preventDefault(); ask(draft); setDraft(""); }} style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={`Ask this paper anything…`}
            style={{ flex: 1, fontFamily: BODY, fontSize: "0.82rem", border: "1.5px solid #1a1a1a", padding: "8px 11px", outline: "none", background: "rgba(255,255,255,0.7)" }}
          />
          <button type="submit" style={{ fontFamily: MONO, fontSize: "0.6rem", letterSpacing: "1px", textTransform: "uppercase", fontWeight: 700, background: "#1a1a1a", color: "#fff", border: "none", padding: "8px 13px", cursor: "pointer" }}>Ask</button>
        </form>
        {!isLoggedIn && onSignIn && (
          <button onClick={onSignIn} style={{ marginTop: 8, background: "none", border: "none", color: "#1a1a1a", textDecoration: "underline", cursor: "pointer", fontFamily: BODY, fontSize: "0.78rem" }}>Sign in to research with the agent</button>
        )}
      </div>

      {hasNext && (
        <div style={{ marginTop: 18, borderTop: "1.5px solid #d8d3c8", paddingTop: 12 }}>
          <button onClick={onNext} className="pm-seed" style={{ fontFamily: DISPLAY, fontSize: "0.84rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", background: "#fff", border: "1.5px solid #1a1a1a", boxShadow: "3px 3px 0 0 rgba(0,0,0,1)", padding: "8px 14px", cursor: "pointer" }}>
            Next paper →
          </button>
        </div>
      )}
    </div>
  );
}

/* ---- main ---- */
export function PapersMode({ synthesis, theme, papers, digestId, isLoggedIn, onSignIn }: {
  synthesis: string;
  theme?: string;
  papers: PaperItem[];
  digestId: string;
  isLoggedIn: boolean;
  onSignIn?: () => void;
}) {
  const verdict = useMemo(() => verdictLead(synthesis, theme), [synthesis, theme]);
  const trio = papers.slice(0, 3);
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const [detail, setDetail] = useState<{ src: AgentSource; idx: number } | null>(null);
  const [coda, setCoda] = useState<AgentSource[]>([]);
  const [codaOpen, setCodaOpen] = useState(false);
  const cardedRef = useRef<Set<string>>(new Set());

  const seeSource = (s: AgentSource) => setCoda((prev) => (prev.some((c) => c.id === s.id) ? prev : [...prev, s]));
  const sourceIndex = (s: AgentSource) => { const i = coda.findIndex((c) => c.id === s.id); return i >= 0 ? i : coda.length; };

  if (trio.length === 0) return null;
  const displayTheme = theme || splitSynthesisTheme(synthesis, theme).displayTheme;

  return (
    <div>
      <style>{`
        .pm-card { transition: transform .12s ease, box-shadow .12s ease; }
        .pm-card:hover { transform: translate(-2px,-2px); box-shadow: 5px 5px 0 0 rgba(0,0,0,1) !important; }
        .pm-seed { transition: transform .12s ease, box-shadow .12s ease; }
        .pm-seed:hover { transform: translate(-2px,-2px); box-shadow: 5px 5px 0 0 rgba(255,0,127,1) !important; }
      `}</style>

      {verdict && (
        <p style={{ fontFamily: DISPLAY, fontSize: "1.18rem", fontWeight: 500, lineHeight: 1.45, color: "#1a1a1a", margin: "0 0 22px" }}>{verdict}</p>
      )}

      <div style={{ fontFamily: DISPLAY, fontSize: "0.9rem", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.045em", color: "#1a1a1a", marginBottom: 12 }}>
        Three papers to think with
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {trio.map((paper, i) =>
          activeIdx === i ? (
            <ExpandedCard
              key={paper.id}
              paper={paper}
              idx={i}
              theme={displayTheme}
              digestId={digestId}
              isLoggedIn={isLoggedIn}
              onSignIn={onSignIn}
              onOpenDetail={(s) => setDetail({ src: s, idx: sourceIndex(s) })}
              onSourceSeen={seeSource}
              cardedRef={cardedRef}
              hasNext={i < trio.length - 1}
              onNext={() => setActiveIdx(i + 1)}
            />
          ) : (
            <CompactCard key={paper.id} paper={paper} idx={i} onOpen={() => setActiveIdx(i)} />
          )
        )}
      </div>

      {coda.length > 0 && (
        <div style={{ marginTop: 36, borderTop: "1.5px solid #d8d3c8", paddingTop: 18 }}>
          <button onClick={() => setCodaOpen((o) => !o)} style={{ fontFamily: DISPLAY, fontSize: "0.9rem", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.045em", background: "none", border: "none", cursor: "pointer", color: "#1a1a1a", padding: 0, display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ color: "#b3a89a" }}>{codaOpen ? "▾" : "▸"}</span> Sources found ({coda.length})
          </button>
          {codaOpen && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 14, marginTop: 16 }}>
              {coda.map((s, i) => (
                <div key={s.id} onClick={() => setDetail({ src: s, idx: i })} className="pm-card" style={{ ...washStyle(i), border: "2px solid #1a1a1a", boxShadow: "4px 4px 0 0 rgba(0,0,0,1)", padding: "12px 14px", cursor: "pointer" }}>
                  <h4 style={{ fontFamily: DISPLAY, fontWeight: 800, textTransform: "uppercase", fontSize: "0.82rem", lineHeight: 1.15, margin: "0 0 6px" }}>{s.title}</h4>
                  {s.url && <a href={s.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} style={{ fontFamily: MONO, fontSize: "0.52rem", letterSpacing: "1px", color: "#1a1a1a", borderBottom: "1px solid #1a1a1a" }}>VIEW STUDY ↗</a>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {detail && <DetailOverlay src={detail.src} idx={detail.idx} onClose={() => setDetail(null)} />}
    </div>
  );
}
