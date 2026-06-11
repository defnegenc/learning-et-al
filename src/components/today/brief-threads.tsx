"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Loader2 } from "lucide-react";

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

interface ResultPayload { answer: string; seeds: string[]; sources: AgentSource[]; }

function washStyle(idx: number): React.CSSProperties {
  const [h1, h2] = PALETTES[idx % PALETTES.length];
  return {
    background: `radial-gradient(circle 120px at 2% 4%, ${h1}cc 0%, transparent 60%), radial-gradient(circle 120px at 98% 8%, ${h2}cc 0%, transparent 60%), radial-gradient(circle 110px at 96% 100%, ${h1}99 0%, transparent 60%), #fff`,
    backgroundBlendMode: "multiply, multiply, multiply, normal",
  };
}

/* ---- SSE consumer ---- */
async function streamThread(
  digestId: string,
  question: string,
  trail: string[],
  h: { onStatus: (t: string) => void; onSource: (s: AgentSource) => void; onResult: (r: ResultPayload) => void; onError: (m: string) => void }
) {
  let res: Response;
  try {
    res = await fetch("/api/thread", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ digestId, question, trail }) });
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
      else if (ev.type === "source") h.onSource(ev.source as AgentSource);
      else if (ev.type === "result") h.onResult(ev as unknown as ResultPayload);
      else if (ev.type === "error") h.onError((ev.message as string) || "Thread failed");
    }
  }
}

/* ---- citation chip + source card ---- */
function CiteChip({ src, idx, onOpen }: { src: AgentSource; idx: number; onOpen: (s: AgentSource) => void }) {
  const [g1, g2] = PALETTES[idx % PALETTES.length];
  const [hover, setHover] = useState(false);
  const label = src.authors[0] ? `${src.authors[0].split(" ").pop()}${src.authors.length > 1 ? " et al." : ""}${src.year ? `, ${src.year}` : ""}` : src.title.slice(0, 28);
  return (
    <span style={{ position: "relative", display: "inline" }} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <button onClick={() => onOpen(src)} style={{ fontWeight: 700, color: "#111", border: "none", cursor: "pointer", background: `linear-gradient(135deg, ${g1} 0%, ${g2} 100%)`, padding: "1px 4px", margin: "0 -1px", borderRadius: 2, fontFamily: "inherit", fontSize: "inherit", lineHeight: "inherit" }}>{label}</button>
      {hover && (
        <span style={{ position: "absolute", bottom: "calc(100% + 8px)", left: 0, zIndex: 50, width: 280, background: "#1a1a1a", color: "#fff", fontFamily: BODY, fontSize: "0.75rem", lineHeight: 1.5, padding: "10px 14px", boxShadow: "4px 4px 0 0 rgba(0,0,0,0.3)", pointerEvents: "none" }}>
          <span style={{ display: "block", fontFamily: MONO, fontSize: "0.55rem", letterSpacing: "1.5px", color: "#aaa", marginBottom: 5 }}>{src.title}</span>
          {src.summary.slice(0, 160)}
        </span>
      )}
    </span>
  );
}

function InlineCard({ src, idx, onOpen }: { src: AgentSource; idx: number; onOpen: (s: AgentSource) => void }) {
  return (
    <div onClick={() => onOpen(src)} className="brief-card" style={{ ...washStyle(idx), border: "2px solid #1a1a1a", boxShadow: "5px 5px 0 0 rgba(0,0,0,1)", padding: "12px 14px", margin: "16px 0", cursor: "pointer" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <span style={{ fontFamily: MONO, fontSize: "0.55rem", letterSpacing: "1.5px", color: "#666", border: "1px solid #cbd5e1", padding: "2px 6px" }}>{src.venue || (src.origin === "discovered" ? "FOUND" : "SOURCE")}{src.year ? ` · ${src.year}` : ""}</span>
        {src.origin === "discovered" && <span style={{ fontFamily: MONO, fontSize: "0.5rem", letterSpacing: "1.5px", background: "#ffe89a", border: "1px solid #1a1a1a", padding: "2px 6px" }}>AGENT FOUND</span>}
      </div>
      <h4 style={{ fontFamily: DISPLAY, fontWeight: 800, textTransform: "uppercase", fontSize: "0.9rem", lineHeight: 1.15, margin: "0 0 4px" }}>{src.title}</h4>
      <p style={{ fontSize: "0.78rem", lineHeight: 1.5, color: "#333", margin: 0 }}>{src.summary.slice(0, 220)}</p>
      {src.url && <a href={src.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} style={{ display: "inline-block", marginTop: 8, fontFamily: MONO, fontSize: "0.55rem", letterSpacing: "1px", color: "#1a1a1a", borderBottom: "1.5px solid #1a1a1a" }}>VIEW STUDY ↗</a>}
    </div>
  );
}

/* ---- answer rendering: parse [N] citations, reveal sentence by sentence, cards on first mention ---- */
function AnswerBody({ answer, sources, onOpen, cardedRef }: { answer: string; sources: AgentSource[]; onOpen: (s: AgentSource) => void; cardedRef: React.MutableRefObject<Set<string>> }) {
  const sentences = useMemo(() => answer.match(/[^.!?]+[.!?]*(?:\s|$)/g)?.map((s) => s.trim()).filter(Boolean) || [answer], [answer]);
  const [n, setN] = useState(1);
  const [cards, setCards] = useState<Record<number, number[]>>({});

  // First-mention cards for the just-revealed sentence (guarded so it never re-adds).
  useEffect(() => {
    const s = sentences[n - 1];
    if (!s) return;
    const fresh: number[] = [];
    for (const m of s.matchAll(/\[(\d+)\]/g)) {
      const idx = parseInt(m[1], 10) - 1;
      const src = sources[idx];
      if (src && src.origin === "discovered" && !cardedRef.current.has(src.id)) { cardedRef.current.add(src.id); fresh.push(idx); }
    }
    if (fresh.length) setCards((p) => ({ ...p, [n - 1]: fresh }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n]);

  useEffect(() => {
    if (n >= sentences.length) return;
    const wc = sentences[n].split(/\s+/).length;
    const t = setTimeout(() => setN((x) => x + 1), Math.min(1200, Math.max(450, 380 + wc * 30)));
    return () => clearTimeout(t);
  }, [n, sentences]);

  const renderSentence = (s: string, key: number) => {
    const parts: React.ReactNode[] = [];
    let last = 0;
    let m: RegExpExecArray | null;
    const re = /\[(\d+)\]/g;
    while ((m = re.exec(s)) !== null) {
      if (m.index > last) parts.push(s.slice(last, m.index));
      const idx = parseInt(m[1], 10) - 1;
      const src = sources[idx];
      if (src) parts.push(<CiteChip key={`c${key}-${m.index}`} src={src} idx={idx} onOpen={onOpen} />);
      last = m.index + m[0].length;
    }
    if (last < s.length) parts.push(s.slice(last));
    return parts;
  };

  const revealed = sentences.slice(0, n);
  return (
    <div style={{ fontSize: "1.02rem", lineHeight: 1.75, color: "#1a1a1a" }}>
      <p style={{ margin: 0 }}>
        {revealed.map((s, i) => (
          <React.Fragment key={i}>
            <span className="brief-fade">{renderSentence(s, i)} </span>
            {cards[i]?.map((ci) => sources[ci] && <InlineCard key={`ic${i}-${ci}`} src={sources[ci]} idx={ci} onOpen={onOpen} />)}
          </React.Fragment>
        ))}
      </p>
    </div>
  );
}

/* ---- thinking trace ---- */
function ThinkingTrace({ status, done }: { status: string[]; done: boolean }) {
  if (status.length === 0 && !done) {
    return (
      <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 14px", background: "#fff", border: "1px solid #e6e1d8", fontFamily: BODY, fontSize: "0.8rem", color: "#7c766c" }}>
        <Loader2 className="size-3.5 animate-spin" /> Thinking…
      </div>
    );
  }
  if (status.length === 0) return null;
  return (
    <div style={{ background: "#fff", border: "1px solid #e6e1d8", padding: "10px 14px", display: "inline-block", minWidth: 220 }}>
      {status.map((l, i) => {
        const isLast = i === status.length - 1;
        const showSpinner = isLast && !done;
        return (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "2px 0", fontFamily: BODY, fontSize: "0.8rem", color: showSpinner ? "#5c574d" : "#a8a294" }}>
            {showSpinner ? <Loader2 className="size-3.5 animate-spin" /> : <span style={{ color: "#38b000", fontSize: "0.72rem", width: 13 }}>✓</span>}
            <span>{l}</span>
          </div>
        );
      })}
    </div>
  );
}

/* ---- one opened thread ---- */
interface ThreadEntry { key: string; question: string; depth: number; }

function ThreadBlock({ entry, digestId, ancestor, isLoggedIn, guestAnswer, onOpenNested, onSource, onOpenDetail, onSignIn, cardedRef }: {
  entry: ThreadEntry;
  digestId: string;
  ancestor: string[];
  isLoggedIn: boolean;
  guestAnswer?: string;
  onOpenNested: (q: string, depth: number) => void;
  onSource: (s: AgentSource) => void;
  onOpenDetail: (s: AgentSource) => void;
  onSignIn?: () => void;
  cardedRef: React.MutableRefObject<Set<string>>;
}) {
  const [status, setStatus] = useState<string[]>([]);
  const [result, setResult] = useState<ResultPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ref.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    if (!isLoggedIn) { setResult({ answer: guestAnswer || "Sign in to pull this thread and let the agent research it.", seeds: [], sources: [] }); return; }
    let cancelled = false;
    streamThread(digestId, entry.question, ancestor, {
      onStatus: (t) => !cancelled && setStatus((s) => [...s, t]),
      onSource: (s) => !cancelled && onSource(s),
      onResult: (r) => !cancelled && setResult(r),
      onError: (m) => !cancelled && setError(m),
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div ref={ref} style={{ marginTop: 26, paddingLeft: 18, borderLeft: `3px solid ${entry.depth % 2 === 0 ? "#1a1a1a" : "#ff007f"}` }}>
      <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: "1.15rem", lineHeight: 1.2, marginBottom: 14 }}>{entry.question}</div>
      {!result && !error && <ThinkingTrace status={status} done={false} />}
      {error && <div style={{ fontFamily: BODY, fontSize: "0.85rem", color: "#ff007f" }}>{error}{!isLoggedIn && onSignIn && <> · <button onClick={onSignIn} style={{ background: "none", border: "none", color: "#1a1a1a", textDecoration: "underline", cursor: "pointer" }}>Sign in</button></>}</div>}
      {result && (
        <>
          {status.length > 0 && <div style={{ marginBottom: 16 }}><ThinkingTrace status={status} done /></div>}
          <AnswerBody answer={result.answer} sources={result.sources} onOpen={onOpenDetail} cardedRef={cardedRef} />
          {result.seeds.length > 0 && (
            <div style={{ marginTop: 20 }}>
              <div style={{ fontFamily: DISPLAY, fontSize: "0.82rem", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.045em", color: "#1a1a1a", marginBottom: 9 }}>Keep pulling</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 9 }}>
                {result.seeds.map((q) => (
                  <button key={q} onClick={() => onOpenNested(q, entry.depth + 1)} className="brief-seed" style={{ fontFamily: BODY, fontSize: "0.84rem", fontWeight: 500, background: "#fff", border: "1.5px solid #1a1a1a", boxShadow: "3px 3px 0 0 rgba(0,0,0,1)", padding: "8px 13px", textAlign: "left", cursor: "pointer" }}>
                    {q}<span style={{ marginLeft: 8, color: "#b3a89a" }}>↳</span>
                  </button>
                ))}
              </div>
            </div>
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
        <h3 style={{ fontFamily: DISPLAY, fontWeight: 800, textTransform: "uppercase", fontSize: "1.3rem", lineHeight: 1.15, margin: "0 0 6px" }}>{src.title}</h3>
        {src.authors.length > 0 && <p style={{ fontFamily: MONO, fontSize: "0.66rem", fontStyle: "italic", color: "#777", margin: "0 0 16px" }}>{src.authors.slice(0, 4).join(", ")}{src.year ? ` · ${src.year}` : ""}</p>}
        <p style={{ fontSize: "0.95rem", lineHeight: 1.6, color: "#222", margin: 0 }}>{src.summary}</p>
        {src.url && <a href={src.url} target="_blank" rel="noopener noreferrer" style={{ display: "inline-block", marginTop: 18, fontFamily: MONO, fontSize: "0.62rem", letterSpacing: "1px", background: "#1a1a1a", color: "#fff", padding: "7px 12px" }}>VIEW STUDY ↗</a>}
      </div>
    </div>
  );
}

/* ---- main ---- */
export function BriefThreads({ digestId, seeds, guestAnswers, isLoggedIn, onSignIn }: {
  digestId: string;
  seeds: string[];
  guestAnswers?: string[];
  isLoggedIn: boolean;
  onSignIn?: () => void;
}) {
  const [trail, setTrail] = useState<ThreadEntry[]>([]);
  const [detail, setDetail] = useState<{ src: AgentSource; idx: number } | null>(null);
  const [coda, setCoda] = useState<AgentSource[]>([]);
  const [codaOpen, setCodaOpen] = useState(false);
  const cardedRef = useRef<Set<string>>(new Set());

  const sourceIndex = (s: AgentSource) => {
    const existing = coda.findIndex((c) => c.id === s.id);
    return existing >= 0 ? existing : coda.length;
  };

  const seeSource = (s: AgentSource) => setCoda((prev) => (prev.some((c) => c.id === s.id) ? prev : [...prev, s]));

  const openThread = (question: string, depth: number) => {
    setTrail((prev) => {
      if (prev.some((t) => t.question === question)) return prev;
      return [...prev, { key: `${depth}-${prev.length}-${question.slice(0, 24)}`, question, depth }];
    });
  };

  if (seeds.length === 0) return null;

  return (
    <div>
      <style>{`
        @keyframes briefRise { from { opacity: 0; transform: translateY(6px) } to { opacity: 1; transform: translateY(0) } }
        .brief-fade { animation: briefRise 0.4s ease both; }
        .brief-seed { transition: transform .12s ease, box-shadow .12s ease; }
        .brief-seed:hover { transform: translate(-2px,-2px); box-shadow: 5px 5px 0 0 rgba(255,0,127,1) !important; }
        .brief-card { transition: transform .12s ease, box-shadow .12s ease; }
        .brief-card:hover { transform: translate(-2px,-2px); box-shadow: 7px 7px 0 0 rgba(0,0,0,1) !important; }
      `}</style>

      <div style={{ fontFamily: DISPLAY, fontSize: "0.9rem", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.045em", color: "#1a1a1a", marginBottom: 12 }}>Pull a thread</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 9 }}>
        {seeds.map((q, i) => (
          <button key={i} onClick={() => openThread(q, 0)} className="brief-seed" style={{ fontFamily: BODY, fontSize: "0.86rem", fontWeight: 500, background: "#fff", border: "1.5px solid #1a1a1a", boxShadow: "3px 3px 0 0 rgba(0,0,0,1)", padding: "9px 14px", textAlign: "left", cursor: "pointer" }}>
            {q.replace(/\*\*/g, "")}<span style={{ marginLeft: 8, color: "#b3a89a" }}>↳</span>
          </button>
        ))}
      </div>

      {trail.map((entry) => {
        const ancestor = trail.filter((t) => t.depth < entry.depth).map((t) => t.question);
        const seedIdx = seeds.indexOf(entry.question);
        return (
          <ThreadBlock
            key={entry.key}
            entry={entry}
            digestId={digestId}
            ancestor={ancestor}
            isLoggedIn={isLoggedIn}
            guestAnswer={seedIdx >= 0 ? guestAnswers?.[seedIdx] : undefined}
            onOpenNested={openThread}
            onSource={seeSource}
            onOpenDetail={(s) => setDetail({ src: s, idx: sourceIndex(s) })}
            onSignIn={onSignIn}
            cardedRef={cardedRef}
          />
        );
      })}

      {coda.length > 0 && (
        <div style={{ marginTop: 40, borderTop: "1.5px solid #d8d3c8", paddingTop: 18 }}>
          <button onClick={() => setCodaOpen((o) => !o)} style={{ fontFamily: DISPLAY, fontSize: "0.9rem", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.045em", background: "none", border: "none", cursor: "pointer", color: "#1a1a1a", padding: 0, display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ color: "#b3a89a" }}>{codaOpen ? "▾" : "▸"}</span> Sources found ({coda.length})
          </button>
          {codaOpen && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 14, marginTop: 16 }}>
              {coda.map((s, i) => (
                <div key={s.id} onClick={() => setDetail({ src: s, idx: i })} className="brief-card" style={{ ...washStyle(i), border: "2px solid #1a1a1a", boxShadow: "4px 4px 0 0 rgba(0,0,0,1)", padding: "12px 14px", cursor: "pointer" }}>
                  <h4 style={{ fontFamily: DISPLAY, fontWeight: 800, textTransform: "uppercase", fontSize: "0.82rem", lineHeight: 1.15, margin: "0 0 5px" }}>{s.title}</h4>
                  <p style={{ fontSize: "0.72rem", lineHeight: 1.45, color: "#444", margin: 0 }}>{s.summary.slice(0, 110)}…</p>
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
