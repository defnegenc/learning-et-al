"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Loader2 } from "lucide-react";

const MONO = "var(--font-mono), monospace";
const DISPLAY = "var(--font-display), sans-serif";
const BODY = "var(--font-inter), sans-serif";

export const PALETTES: [string, string][] = [
  ["#C8F0D8", "#F0F5A8"],
  ["#FFD6E0", "#FFE89A"],
  ["#D0E3F7", "#E2D6F7"],
  ["#FFE89A", "#FFD6E0"],
  ["#D8C8F0", "#F0C8D8"],
];

// brighter variants for hover (mirrors HIGHLIGHT_HOVER_GRADIENTS on the synthesis)
const HOVER_PALETTES: [string, string][] = [
  ["#A4E0BC", "#DCF060"],
  ["#FFB0C8", "#FFD870"],
  ["#B0CCF0", "#C8B4F0"],
  ["#FFD870", "#FFB0C8"],
  ["#C8B0F0", "#F0B0C8"],
];

export interface AgentSource {
  id: string;
  title: string;
  authors: string[];
  year?: number | null;
  venue?: string;
  url?: string | null;
  summary: string;
  origin: "digest" | "discovered";
}

export interface ResultPayload { answer: string; seeds: string[]; sources: AgentSource[]; }

// One agent run, cached by question so threads can preload before they're opened.
interface ThreadRun { status: string[]; result: ResultPayload | null; error: string | null; }

export function washStyle(idx: number): React.CSSProperties {
  const [h1, h2] = PALETTES[idx % PALETTES.length];
  return {
    background: `radial-gradient(circle 120px at 2% 4%, ${h1}cc 0%, transparent 60%), radial-gradient(circle 120px at 98% 8%, ${h2}cc 0%, transparent 60%), radial-gradient(circle 110px at 96% 100%, ${h1}99 0%, transparent 60%), #fff`,
    backgroundBlendMode: "multiply, multiply, multiply, normal",
  };
}

/* ---- SSE consumer ---- */
export async function streamThread(
  digestId: string,
  question: string,
  trail: string[],
  h: { onStatus: (t: string) => void; onResult: (r: ResultPayload) => void; onError: (m: string) => void },
  focusPaperId?: string
) {
  let res: Response;
  try {
    res = await fetch("/api/thread", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ digestId, question, trail, ...(focusPaperId ? { focusPaperId } : {}) }) });
  } catch { h.onError("Network error"); return; }
  if (!res.ok || !res.body) { h.onError(res.status === 401 ? "Sign in to pull threads" : "Thread failed"); return; }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf("\n\n")) >= 0) {
      const chunk = buf.slice(0, i);
      buf = buf.slice(i + 2);
      const line = chunk.split("\n").find((l) => l.startsWith("data:"));
      if (!line) continue;
      let ev: { type: string; [k: string]: unknown };
      try { ev = JSON.parse(line.slice(5).trim()); } catch { continue; }
      if (ev.type === "status") h.onStatus(ev.text as string);
      else if (ev.type === "result") h.onResult(ev as unknown as ResultPayload);
      else if (ev.type === "error") h.onError((ev.message as string) || "Thread failed");
    }
  }
}

/* ---- answer parsing: paragraphs (\n\n), **bold**, [N] cites → sentence lines ---- */

type Seg = { t: "w"; text: string } | { t: "b"; text: string } | { t: "cite"; idx: number };
interface Line { idx: number; segs: Seg[]; para: boolean; }

function tokenize(text: string): Seg[] {
  const segs: Seg[] = [];
  const re = /\*\*([^*]+)\*\*|\[(\d+)\]/g;
  let last = 0;
  let m: RegExpExecArray | null;
  const pushCites = (t: "w" | "b", run: string) => {
    const ire = /\[(\d+)\]/g;
    let il = 0;
    let im: RegExpExecArray | null;
    while ((im = ire.exec(run)) !== null) {
      if (im.index > il) segs.push({ t, text: run.slice(il, im.index) });
      segs.push({ t: "cite", idx: parseInt(im[1], 10) - 1 });
      il = im.index + im[0].length;
    }
    if (il < run.length) segs.push({ t, text: run.slice(il) });
  };
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) segs.push({ t: "w", text: text.slice(last, m.index) });
    if (m[1] !== undefined) pushCites("b", m[1]);
    else segs.push({ t: "cite", idx: parseInt(m[2], 10) - 1 });
    last = m.index + m[0].length;
  }
  if (last < text.length) segs.push({ t: "w", text: text.slice(last) });
  return segs;
}

export function toLines(answer: string): Line[] {
  const out: { segs: Seg[]; para: boolean }[] = [];
  const paras = answer.split(/\n{2,}/).map((p) => p.replace(/\s+/g, " ").trim()).filter(Boolean);
  for (const para of paras) {
    let cur: Seg[] = [];
    let first = true;
    const flush = () => { if (cur.length) { out.push({ segs: cur, para: first }); cur = []; first = false; } };
    for (const s of tokenize(para)) {
      if (s.t === "cite") { cur.push(s); continue; }
      // segments keep their exact text (punctuation after a citation lives in the
      // NEXT segment, so trimming here would corrupt the sentence)
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

function lineWordCount(line: Line): number {
  return line.segs.reduce((a, s) => a + (s.t === "cite" ? 1 : s.text.split(/\s+/).length), 0);
}
function lineCiteIdxs(line: Line): number[] {
  return line.segs.filter((s): s is { t: "cite"; idx: number } => s.t === "cite").map((s) => s.idx);
}

/* ---- thinking-trace phrasing: server statuses are past tense; flip the active one ---- */
function activePhrase(s: string): string {
  return s
    .replace(/^Searched/, "Searching")
    .replace(/^Looked/, "Looking")
    .replace(/^Re-read/, "Re-reading")
    .replace(/^Read /, "Reading ")
    .replace(/^Checked/, "Checking");
}

/* ---- citation chip + source card ---- */
function CiteChip({ src, idx, onOpen }: { src: AgentSource; idx: number; onOpen: (s: AgentSource) => void }) {
  const [g1, g2] = PALETTES[idx % PALETTES.length];
  const [h1, h2] = HOVER_PALETTES[idx % HOVER_PALETTES.length];
  const [hover, setHover] = useState(false);
  const label = src.authors[0] ? `${src.authors[0].split(" ").pop()}${src.authors.length > 1 ? " et al." : ""}${src.year ? `, ${src.year}` : ""}` : src.title.slice(0, 28);
  const summary = src.summary.length > 150 ? src.summary.slice(0, 147) + "..." : src.summary;
  return (
    <span style={{ position: "relative", display: "inline" }} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <button
        onClick={() => onOpen(src)}
        style={{
          fontWeight: 700, color: "#111", border: "none", cursor: "pointer",
          background: `linear-gradient(135deg, ${hover ? h1 : g1} 0%, ${hover ? h2 : g2} 100%)`,
          padding: "1px 4px", margin: "0 -1px", borderRadius: 2, transition: "background 0.15s",
          fontFamily: "inherit", fontSize: "inherit", lineHeight: "inherit",
          WebkitBoxDecorationBreak: "clone", boxDecorationBreak: "clone" as React.CSSProperties["boxDecorationBreak"],
        }}
      >{label}</button>
      {hover && (
        <span style={{ position: "absolute", bottom: "calc(100% + 8px)", left: 0, zIndex: 50, width: 280, background: "#1a1a1a", color: "#fff", fontFamily: BODY, fontSize: "0.75rem", fontWeight: 400, lineHeight: 1.5, padding: "10px 14px", boxShadow: "4px 4px 0 0 rgba(0,0,0,0.3)", pointerEvents: "none" }}>
          <span style={{ display: "block", fontFamily: MONO, fontSize: "0.55rem", letterSpacing: "1.5px", color: "#aaa", marginBottom: 5 }}>{src.title}</span>
          {summary}
        </span>
      )}
    </span>
  );
}

function InlineCard({ src, idx, onOpen }: { src: AgentSource; idx: number; onOpen: (s: AgentSource) => void }) {
  return (
    <div onClick={() => onOpen(src)} className="brief-card" style={{ ...washStyle(idx), border: "2px solid #1a1a1a", boxShadow: "5px 5px 0 0 rgba(0,0,0,1)", padding: "12px 14px", cursor: "pointer" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <span style={{ fontFamily: MONO, fontSize: "0.55rem", letterSpacing: "1.5px", color: "#666", border: "1px solid #cbd5e1", padding: "2px 6px" }}>{src.venue || (src.origin === "discovered" ? "FOUND" : "SOURCE")}{src.year ? ` · ${src.year}` : ""}</span>
        {src.origin === "discovered" && <span style={{ fontFamily: MONO, fontSize: "0.5rem", letterSpacing: "1.5px", background: "#ffe89a", border: "1px solid #1a1a1a", padding: "2px 6px" }}>AGENT FOUND</span>}
      </div>
      <h4 style={{ fontFamily: DISPLAY, fontWeight: 800, textTransform: "uppercase", fontSize: "0.9rem", lineHeight: 1.15, margin: "0 0 3px" }}>{src.title}</h4>
      {src.authors.length > 0 && <p style={{ fontFamily: MONO, fontSize: "0.58rem", fontStyle: "italic", color: "#888", margin: "0 0 7px" }}>{src.authors.slice(0, 4).join(", ")}</p>}
      <p style={{ fontSize: "0.74rem", lineHeight: 1.5, color: "#333", margin: 0 }}>{src.summary.slice(0, 220)}</p>
      {src.url && <a href={src.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} style={{ display: "inline-block", marginTop: 9, fontFamily: MONO, fontSize: "0.55rem", letterSpacing: "1px", color: "#1a1a1a", borderBottom: "1.5px solid #1a1a1a", paddingBottom: 1 }}>VIEW STUDY ↗</a>}
    </div>
  );
}

/* ---- sentence-by-sentence reveal: paragraphs, bold runs, cards on first mention ---- */
export function LineReveal({ lines, sources, onOpen, onSourceSeen, onDone, cardedRef }: {
  lines: Line[];
  sources: AgentSource[];
  onOpen: (s: AgentSource) => void;
  onSourceSeen: (s: AgentSource) => void;
  onDone: () => void;
  cardedRef: React.MutableRefObject<Set<string>>;
}) {
  const [n, setN] = useState(1);
  const [cardsAfter, setCardsAfter] = useState<Record<number, number[]>>({});
  const processedRef = useRef(0);
  const doneRef = useRef(onDone);
  const seenRef = useRef(onSourceSeen);
  useEffect(() => { doneRef.current = onDone; seenRef.current = onSourceSeen; });

  useEffect(() => {
    // register sources + first-mention cards for lines [processed, end) — runs in
    // timer callbacks so reveal, coda, and card placement stay in lockstep
    const processUpTo = (end: number) => {
      for (let i = processedRef.current; i < end; i++) {
        const line = lines[i];
        if (!line) continue;
        const fresh: number[] = [];
        for (const ci of lineCiteIdxs(line)) {
          const src = sources[ci];
          if (!src) continue;
          seenRef.current(src);
          if (src.origin === "discovered" && !cardedRef.current.has(src.id)) { cardedRef.current.add(src.id); fresh.push(ci); }
        }
        if (fresh.length) setCardsAfter((prev) => ({ ...prev, [line.idx]: fresh }));
      }
      processedRef.current = Math.max(processedRef.current, end);
    };
    if (n >= lines.length) {
      const t = setTimeout(() => { processUpTo(lines.length); doneRef.current(); }, 0);
      return () => clearTimeout(t);
    }
    const delay = Math.min(1300, Math.max(480, 420 + lineWordCount(lines[n]) * 32));
    const t = setTimeout(() => { processUpTo(n + 1); setN(n + 1); }, delay);
    return () => clearTimeout(t);
  }, [n, lines, sources, cardedRef]);

  const renderSeg = (s: Seg, i: number) => {
    if (s.t === "w") return <span key={i}>{s.text}</span>;
    if (s.t === "b") return <strong key={i} style={{ fontWeight: 700 }}>{s.text}</strong>;
    const src = sources[s.idx];
    return src ? <CiteChip key={i} src={src} idx={s.idx} onOpen={onOpen} /> : null;
  };

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
    buf.push(<span key={ln.idx} className="brief-line">{ln.segs.map(renderSeg)}{" "}</span>);
    const cards = cardsAfter[ln.idx];
    if (cards) {
      flush();
      for (const ci of cards) {
        if (sources[ci]) els.push(<div key={`c${ci}`} className="brief-line" style={{ margin: "16px 0 0" }}><InlineCard src={sources[ci]} idx={ci} onOpen={onOpen} /></div>);
      }
      firstEl = false;
    }
  }
  flush();
  return <div>{els}</div>;
}

/* ---- thinking trace: replays preloaded statuses, paces live ones, caret on the active line ---- */
export function ThinkingTrace({ status, done, onDone }: { status: string[]; done: boolean; onDone: () => void }) {
  const [n, setN] = useState(0); // completed count
  const doneRef = useRef(onDone);
  useEffect(() => { doneRef.current = onDone; });

  useEffect(() => {
    if (n >= status.length) {
      if (done) { const t = setTimeout(() => doneRef.current(), 420); return () => clearTimeout(t); }
      return; // still waiting on the agent — generic spinner line shows below
    }
    // only mark a line complete once the agent has moved past it (or finished)
    if (!done && n >= status.length - 1) return;
    const t = setTimeout(() => setN((x) => x + 1), n === 0 ? 520 : 880);
    return () => clearTimeout(t);
  }, [n, status.length, done]);

  if (status.length === 0 && done) return null;
  const visible = status.slice(0, Math.min(status.length, n + 1));
  const waiting = !done;
  return (
    <div style={{ background: "#fff", border: "1px solid #e6e1d8", padding: "10px 14px", marginBottom: 18, display: "inline-block", minWidth: 220 }}>
      {visible.map((l, i) => {
        const isDone = i < n;
        return (
          <div key={i} className="brief-line" style={{ display: "flex", alignItems: "center", gap: 8, padding: "2px 0", fontFamily: BODY, fontSize: "0.8rem", color: isDone ? "#a8a294" : "#5c574d" }}>
            {isDone
              ? <span style={{ color: "#38b000", fontSize: "0.72rem", width: 13, flexShrink: 0 }}>✓</span>
              : <Loader2 className="size-3.5 animate-spin" style={{ flexShrink: 0 }} />}
            <span>{isDone ? l : activePhrase(l)}{!isDone && <span className="brief-caret">▏</span>}</span>
          </div>
        );
      })}
      {waiting && status.length === 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "2px 0", fontFamily: BODY, fontSize: "0.8rem", color: "#5c574d" }}>
          <Loader2 className="size-3.5 animate-spin" style={{ flexShrink: 0 }} /> <span>Thinking<span className="brief-caret">▏</span></span>
        </div>
      )}
    </div>
  );
}

/* ---- seeds ---- */
function SeedRow({ seeds, onTap, label }: { seeds: string[]; onTap: (q: string) => void; label: string }) {
  if (seeds.length === 0) return null;
  return (
    <div className="brief-line" style={{ marginTop: 24 }}>
      <div style={{ fontFamily: DISPLAY, fontSize: "0.9rem", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.045em", color: "#1a1a1a", marginBottom: 10 }}>{label}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 9 }}>
        {seeds.map((q) => (
          <button key={q} onClick={() => onTap(q)} className="brief-seed" style={{ fontFamily: BODY, fontSize: "0.84rem", fontWeight: 500, background: "#fff", border: "1.5px solid #1a1a1a", boxShadow: "3px 3px 0 0 rgba(0,0,0,1)", padding: "8px 13px", textAlign: "left", cursor: "pointer" }}>
            {q.replace(/\*\*/g, "")}<span style={{ marginLeft: 8, color: "#b3a89a" }}>↳</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ---- one opened thread (state lives in the run cache, so preloads survive) ---- */
interface ThreadEntry { key: string; question: string; depth: number; }

function ThreadBlock({ entry, run, onOpenNested, onSourceSeen, onOpenDetail, onSignIn, isLoggedIn, cardedRef }: {
  entry: ThreadEntry;
  run: ThreadRun;
  onOpenNested: (q: string, depth: number) => void;
  onSourceSeen: (s: AgentSource) => void;
  onOpenDetail: (s: AgentSource) => void;
  onSignIn?: () => void;
  isLoggedIn: boolean;
  cardedRef: React.MutableRefObject<Set<string>>;
}) {
  const [traceDone, setTraceDone] = useState(false);
  const [bodyDone, setBodyDone] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const lines = useMemo(() => (run.result ? toLines(run.result.answer) : []), [run.result]);

  useEffect(() => { ref.current?.scrollIntoView({ behavior: "smooth", block: "center" }); }, []);

  return (
    <div ref={ref} style={{ marginTop: 28, paddingLeft: 18, borderLeft: `3px solid ${entry.depth % 2 === 0 ? "#1a1a1a" : "#ff007f"}` }}>
      <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: "1.2rem", lineHeight: 1.2, marginBottom: 14, letterSpacing: "-0.01em" }}>{entry.question}</div>
      {run.error ? (
        <div style={{ fontFamily: BODY, fontSize: "0.85rem", color: "#ff007f" }}>
          {run.error}{!isLoggedIn && onSignIn && <> · <button onClick={onSignIn} style={{ background: "none", border: "none", color: "#1a1a1a", textDecoration: "underline", cursor: "pointer" }}>Sign in</button></>}
        </div>
      ) : (
        <>
          <ThinkingTrace status={run.status} done={!!run.result} onDone={() => setTraceDone(true)} />
          {traceDone && run.result && (
            <LineReveal lines={lines} sources={run.result.sources} onOpen={onOpenDetail} onSourceSeen={onSourceSeen} onDone={() => setBodyDone(true)} cardedRef={cardedRef} />
          )}
          {bodyDone && run.result && (
            <SeedRow seeds={run.result.seeds} onTap={(q) => onOpenNested(q, entry.depth + 1)} label="Keep pulling" />
          )}
        </>
      )}
    </div>
  );
}

/* ---- detail overlay + sources coda ---- */
function DetailOverlay({ src, idx, onClose }: { src: AgentSource; idx: number; onClose: () => void }) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 80, background: "rgba(26,26,26,0.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ ...washStyle(idx), maxWidth: 520, width: "100%", border: "2px solid #1a1a1a", boxShadow: "8px 8px 0 0 rgba(0,0,0,1)", padding: "26px 28px" }}>
        <button onClick={onClose} style={{ fontFamily: BODY, fontSize: "0.78rem", background: "none", border: "none", cursor: "pointer", color: "#888", marginBottom: 14 }}>✕ Close</button>
        {(src.venue || src.year) && <div style={{ fontFamily: MONO, fontSize: "0.6rem", letterSpacing: "1.5px", color: "#666", marginBottom: 10 }}>{src.venue}{src.venue && src.year ? " · " : ""}{src.year || ""}</div>}
        <h3 style={{ fontFamily: DISPLAY, fontWeight: 800, textTransform: "uppercase", fontSize: "1.3rem", lineHeight: 1.15, margin: "0 0 6px" }}>{src.title}</h3>
        {src.authors.length > 0 && <p style={{ fontFamily: MONO, fontSize: "0.66rem", fontStyle: "italic", color: "#777", margin: "0 0 16px" }}>{src.authors.slice(0, 4).join(", ")}</p>}
        <p style={{ fontSize: "0.95rem", lineHeight: 1.6, color: "#222", margin: 0 }}>{src.summary}</p>
        {src.url && <a href={src.url} target="_blank" rel="noopener noreferrer" className="brief-seed" style={{ display: "inline-block", marginTop: 18, fontFamily: MONO, fontSize: "0.62rem", letterSpacing: "1px", background: "#1a1a1a", color: "#fff", padding: "7px 12px" }}>VIEW STUDY ↗</a>}
      </div>
    </div>
  );
}

/* ---- main ---- */
const VISIBLE_SEEDS = 3;

export function BriefThreads({ digestId, seeds, guestAnswers, isLoggedIn, onSignIn }: {
  digestId: string;
  seeds: string[];
  guestAnswers?: string[];
  isLoggedIn: boolean;
  onSignIn?: () => void;
}) {
  const [runs, setRuns] = useState<Record<string, ThreadRun>>({});
  const [trail, setTrail] = useState<ThreadEntry[]>([]);
  const [detail, setDetail] = useState<{ src: AgentSource; idx: number } | null>(null);
  const [coda, setCoda] = useState<AgentSource[]>([]);
  const [codaOpen, setCodaOpen] = useState(false);
  const startedRef = useRef<Set<string>>(new Set());
  const cardedRef = useRef<Set<string>>(new Set());

  const visibleSeeds = seeds.slice(0, VISIBLE_SEEDS);

  const patchRun = (q: string, patch: (r: ThreadRun) => ThreadRun) =>
    setRuns((prev) => ({ ...prev, [q]: patch(prev[q] || { status: [], result: null, error: null }) }));

  const startRun = (question: string, ancestors: string[]) => {
    if (startedRef.current.has(question)) return;
    startedRef.current.add(question);
    patchRun(question, (r) => r);
    if (!isLoggedIn) {
      const seedIdx = seeds.indexOf(question);
      const guestAnswer = seedIdx >= 0 ? guestAnswers?.[seedIdx] : undefined;
      patchRun(question, (r) => ({ ...r, result: { answer: guestAnswer || "Sign in to pull this thread and let the agent research it.", seeds: [], sources: [] } }));
      return;
    }
    streamThread(digestId, question, ancestors, {
      onStatus: (t) => patchRun(question, (r) => ({ ...r, status: [...r.status, t] })),
      onResult: (res) => patchRun(question, (r) => ({ ...r, result: res })),
      onError: (m) => patchRun(question, (r) => ({ ...r, error: m })),
    });
  };

  // Preload the visible seed threads so opening one is instant.
  useEffect(() => {
    visibleSeeds.forEach((q) => startRun(q, []));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [digestId]);

  const sourceIndex = (s: AgentSource) => {
    const existing = coda.findIndex((c) => c.id === s.id);
    return existing >= 0 ? existing : coda.length;
  };

  const seeSource = (s: AgentSource) => setCoda((prev) => (prev.some((c) => c.id === s.id) ? prev : [...prev, s]));

  const openThread = (question: string, depth: number) => {
    if (trail.some((t) => t.question === question)) return;
    const ancestors = trail.filter((t) => t.depth < depth).map((t) => t.question);
    startRun(question, ancestors);
    setTrail((prev) => (prev.some((t) => t.question === question) ? prev : [...prev, { key: `${depth}-${prev.length}-${question.slice(0, 24)}`, question, depth }]));
  };

  if (visibleSeeds.length === 0) return null;

  return (
    <div>
      <style>{`
        @keyframes briefRise { from { opacity: 0; transform: translateY(6px) } to { opacity: 1; transform: translateY(0) } }
        @keyframes briefBlink { 0%,49% { opacity: 1 } 50%,100% { opacity: 0 } }
        .brief-line { animation: briefRise 0.4s ease both; }
        .brief-caret { animation: briefBlink 1s steps(1) infinite; margin-left: 2px; color: #1a1a1a; }
        .brief-seed { transition: transform .12s ease, box-shadow .12s ease; }
        .brief-seed:hover { transform: translate(-2px,-2px); box-shadow: 5px 5px 0 0 rgba(255,0,127,1) !important; }
        .brief-card { transition: transform .12s ease, box-shadow .12s ease; }
        .brief-card:hover { transform: translate(-2px,-2px); box-shadow: 7px 7px 0 0 rgba(0,0,0,1) !important; }
      `}</style>

      <div style={{ fontFamily: DISPLAY, fontSize: "0.9rem", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.045em", color: "#1a1a1a", marginBottom: 12 }}>Pull a thread</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 9 }}>
        {visibleSeeds.map((q, i) => (
          <button key={i} onClick={() => openThread(q, 0)} className="brief-seed" style={{ fontFamily: BODY, fontSize: "0.86rem", fontWeight: 500, background: "#fff", border: "1.5px solid #1a1a1a", boxShadow: "3px 3px 0 0 rgba(0,0,0,1)", padding: "9px 14px", textAlign: "left", cursor: "pointer" }}>
            {q.replace(/\*\*/g, "")}<span style={{ marginLeft: 8, color: "#b3a89a" }}>↳</span>
          </button>
        ))}
      </div>

      {trail.map((entry) => (
        <ThreadBlock
          key={entry.key}
          entry={entry}
          run={runs[entry.question] || { status: [], result: null, error: null }}
          onOpenNested={openThread}
          onSourceSeen={seeSource}
          onOpenDetail={(s) => setDetail({ src: s, idx: sourceIndex(s) })}
          onSignIn={onSignIn}
          isLoggedIn={isLoggedIn}
          cardedRef={cardedRef}
        />
      ))}

      {coda.length > 0 && (
        <div style={{ marginTop: 40, borderTop: "1.5px solid #d8d3c8", paddingTop: 18 }}>
          <button onClick={() => setCodaOpen((o) => !o)} style={{ fontFamily: DISPLAY, fontSize: "0.9rem", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.045em", background: "none", border: "none", cursor: "pointer", color: "#1a1a1a", padding: 0, display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ color: "#b3a89a" }}>{codaOpen ? "▾" : "▸"}</span> Sources found ({coda.length})
          </button>
          {codaOpen && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 14, marginTop: 16 }}>
              {coda.map((s, i) => (
                <div key={s.id} onClick={() => setDetail({ src: s, idx: i })} className="brief-card" style={{ ...washStyle(i), border: "2px solid #1a1a1a", boxShadow: "4px 4px 0 0 rgba(0,0,0,1)", padding: "12px 14px", cursor: "pointer", display: "flex", flexDirection: "column", justifyContent: "space-between", gap: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontFamily: MONO, fontSize: "0.52rem", letterSpacing: "1px", color: "#666", border: "1px solid #cbd5e1", padding: "2px 5px" }}>{s.venue || (s.origin === "discovered" ? "FOUND" : "SOURCE")}{s.year ? ` · ${s.year}` : ""}</span>
                    {s.origin === "discovered" && <span style={{ fontFamily: MONO, fontSize: "0.48rem", background: "#ffe89a", border: "1px solid #1a1a1a", padding: "1px 4px" }}>★</span>}
                  </div>
                  <div>
                    <h4 style={{ fontFamily: DISPLAY, fontWeight: 800, textTransform: "uppercase", fontSize: "0.82rem", lineHeight: 1.15, margin: "0 0 6px" }}>{s.title}</h4>
                    {s.url && <a href={s.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} style={{ fontFamily: MONO, fontSize: "0.52rem", letterSpacing: "1px", color: "#1a1a1a", borderBottom: "1px solid #1a1a1a" }}>VIEW STUDY ↗</a>}
                  </div>
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
