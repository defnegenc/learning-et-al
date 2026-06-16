"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  BRIEF,
  SOURCES,
  SOURCE_PALETTES,
  type Segment,
  type Source,
} from "./brief-data";

const MONO = "var(--font-mono), ui-monospace, monospace";
const DISPLAY = "var(--font-display), 'Cabinet Grotesk', sans-serif";
const BODY = "var(--font-inter), sans-serif";

// brighter variants for hover (mirrors HIGHLIGHT_HOVER_GRADIENTS on prod)
const HOVER_PALETTES: [string, string][] = [
  ["#A4E0BC", "#DCF060"],
  ["#FFB0C8", "#FFD870"],
  ["#B0CCF0", "#C8B4F0"],
  ["#FFD870", "#FFB0C8"],
  ["#C8B0F0", "#F0B0C8"],
];

/* ---------------- sentence splitting ---------------- */

interface Line { idx: number; segs: Segment[]; para: boolean; }

function toLines(segs: Segment[]): Line[] {
  const out: { segs: Segment[]; para: boolean }[] = [];
  let cur: Segment[] = [];
  let paraPending = false;
  const flush = () => { if (cur.length) { out.push({ segs: cur, para: paraPending }); cur = []; paraPending = false; } };
  for (const s of segs) {
    if (s.t === "break") { flush(); paraPending = true; continue; }
    if (s.t === "card") { flush(); out.push({ segs: [s], para: true }); paraPending = true; continue; }
    if (s.t === "w") {
      const pieces = s.text.match(/[^.!?]+[.!?]*(?:\s|$)/g) || [s.text];
      for (const raw of pieces) {
        const text = raw.trim();
        if (!text) continue;
        cur.push({ t: "w", text });
        if (/[.!?]$/.test(text)) flush();
      }
      continue;
    }
    cur.push(s);
    if ((s.t === "b" || s.t === "term") && /[.!?]$/.test(s.text)) flush();
  }
  flush();
  return out.map((ln, i) => ({ idx: i, segs: ln.segs, para: ln.para }));
}

function lineWordCount(line: Line): number {
  return line.segs.reduce((a, s) => a + (s.t === "w" ? s.text.split(/\s+/).length : 1), 0);
}
function lineSourceIds(line: Line): string[] {
  return line.segs.filter((s) => s.t === "cite" || s.t === "card").map((s) => (s as { srcId: string }).srcId);
}
function cap(str: string) { return str.charAt(0).toUpperCase() + str.slice(1); }

// agent status → human phrasing, present (active) and past (done)
function statusParts(s: string) { const [head, tail] = s.split(/:\s*/); return { h: head.trim().toUpperCase(), tail: (tail || "").trim() }; }
function activePhrase(s: string): string {
  const { h, tail } = statusParts(s);
  if (h.startsWith("SEARCHING OPENALEX")) return "Searching OpenAlex";
  if (h.startsWith("SEARCHING VAULT")) return "Looking through your vault";
  if (h.startsWith("READING CLAIMS")) return "Re-reading the studies";
  if (h === "READING") return `Reading ${tail}`;
  if (h.startsWith("CROSS-REFERENCING")) return "Cross-referencing";
  if (h.startsWith("CHECKING")) return "Checking the evidence";
  return cap(h.toLowerCase());
}
function donePhrase(s: string): string {
  const { h, tail } = statusParts(s);
  if (h.startsWith("SEARCHING OPENALEX")) return "Searched OpenAlex";
  if (h.startsWith("SEARCHING VAULT")) return "Searched your vault";
  if (h.startsWith("READING CLAIMS")) return "Re-read the studies";
  if (h === "READING") return `Read ${tail}`;
  if (h.startsWith("CROSS-REFERENCING")) return "Cross-referenced the claims";
  if (h.startsWith("CHECKING")) return "Checked the evidence";
  return cap(h.toLowerCase());
}

function washStyle(paletteIdx: number): React.CSSProperties {
  const [h1, h2] = SOURCE_PALETTES[paletteIdx % SOURCE_PALETTES.length];
  return {
    background: `
      radial-gradient(circle 120px at 2% 4%, ${h1}cc 0%, transparent 60%),
      radial-gradient(circle 120px at 98% 8%, ${h2}cc 0%, transparent 60%),
      radial-gradient(circle 110px at 96% 100%, ${h1}99 0%, transparent 60%),
      #fff`,
    backgroundBlendMode: "multiply, multiply, multiply, normal",
  };
}

/* ---------------- labels (prod style: display, uppercase, substantial) ---------------- */

function Eyebrow({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ fontFamily: DISPLAY, fontSize: "0.9rem", fontWeight: 500, color: "#1a1a1a", textTransform: "uppercase", letterSpacing: "0.045em", marginBottom: 12, ...style }}>
      {children}
    </div>
  );
}

/* ---------------- paper-name highlight (prod PaperHighlight block) ---------------- */

function CiteChip({ src, capitalize, onOpen }: { src: Source; capitalize?: boolean; onOpen: (s: Source) => void }) {
  const [g1, g2] = SOURCE_PALETTES[src.paletteIdx % SOURCE_PALETTES.length];
  const [h1, h2] = HOVER_PALETTES[src.paletteIdx % HOVER_PALETTES.length];
  const [hover, setHover] = useState(false);
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
      >
        {capitalize ? cap(src.shortName) : src.shortName}
      </button>
      {hover && (
        <span style={{ position: "absolute", bottom: "calc(100% + 8px)", left: 0, zIndex: 40, width: 280, background: "#1a1a1a", color: "#fff", fontFamily: BODY, fontSize: "0.75rem", fontWeight: 400, lineHeight: 1.5, padding: "10px 14px", boxShadow: "4px 4px 0 0 rgba(0,0,0,0.3)", pointerEvents: "none" }}>
          <span style={{ display: "block", fontFamily: MONO, fontSize: "0.55rem", letterSpacing: "1.5px", color: "#aaa", marginBottom: 5 }}>{src.venue}</span>
          {summary}
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

function renderSeg(s: Segment, i: number, onOpen: (src: Source) => void): React.ReactNode {
  if (s.t === "w") return <span key={i}>{s.text} </span>;
  if (s.t === "b") return <strong key={i} style={{ fontWeight: 700 }}>{s.text} </strong>;
  if (s.t === "term") return <React.Fragment key={i}><TermChip text={s.text} def={s.def} />{" "}</React.Fragment>;
  if (s.t === "cite") return <React.Fragment key={i}><CiteChip src={SOURCES[s.srcId]} capitalize={s.cap} onOpen={onOpen} />{" "}</React.Fragment>;
  return null;
}

/* ---------------- inline blob card ---------------- */

function InlineCard({ src, onOpen }: { src: Source; onOpen: (s: Source) => void }) {
  const tags = SOURCE_PALETTES[src.paletteIdx % SOURCE_PALETTES.length];
  return (
    <div onClick={() => onOpen(src)} className="blob-card" style={{ ...washStyle(src.paletteIdx), border: "2px solid #1a1a1a", boxShadow: "5px 5px 0 0 rgba(0,0,0,1)", padding: "12px 14px", cursor: "pointer" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <span style={{ fontFamily: MONO, fontSize: "0.55rem", letterSpacing: "1.5px", color: "#666", border: "1px solid #cbd5e1", padding: "2px 6px" }}>{src.venue}</span>
        {src.discovered && <span style={{ fontFamily: MONO, fontSize: "0.5rem", letterSpacing: "1.5px", color: "#1a1a1a", background: "#ffe89a", border: "1px solid #1a1a1a", padding: "2px 6px" }}>AGENT FOUND</span>}
      </div>
      <h4 style={{ fontFamily: DISPLAY, fontWeight: 800, textTransform: "uppercase", fontSize: "0.9rem", lineHeight: 1.15, margin: "0 0 3px" }}>{src.title}</h4>
      <p style={{ fontFamily: MONO, fontSize: "0.58rem", fontStyle: "italic", color: "#888", margin: "0 0 7px" }}>{src.authors}</p>
      <p style={{ fontSize: "0.74rem", lineHeight: 1.5, color: "#333", margin: 0 }}>{src.summary}</p>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: 9, gap: 8 }}>
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
          {src.keywords.map((kw, i) => (
            <span key={kw} style={{ fontFamily: MONO, fontSize: "0.55rem", textTransform: "uppercase", letterSpacing: "0.5px", background: tags[i % 2], border: "1px solid #1a1a1a", padding: "2px 7px" }}>{kw}</span>
          ))}
        </div>
        <a href={src.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} style={{ fontFamily: MONO, fontSize: "0.55rem", letterSpacing: "1px", color: "#1a1a1a", whiteSpace: "nowrap", borderBottom: "1.5px solid #1a1a1a", paddingBottom: 1 }}>VIEW STUDY ↗</a>
      </div>
    </div>
  );
}

/* ---------------- sentence-by-sentence reveal (cards on first mention) ---------------- */

function firstChunkEnd(lines: Line[]): number {
  const p = lines.findIndex((l, i) => i > 0 && l.para);
  return p === -1 ? lines.length : p;
}

function LineReveal({ lines, onOpen, onSourceSeen, onDone, cardedRef, mode = "timed" }: {
  lines: Line[];
  onOpen: (s: Source) => void;
  onSourceSeen: (id: string) => void;
  onDone: () => void;
  cardedRef: React.MutableRefObject<Set<string>>;
  mode?: "timed" | "scroll";
}) {
  const [n, setN] = useState(() => (mode === "scroll" ? firstChunkEnd(lines) : 1));
  const [cardsAfter, setCardsAfter] = useState<Record<number, string[]>>({});
  const processedRef = useRef(0);
  const doneRef = useRef(onDone); doneRef.current = onDone;
  const seenRef = useRef(onSourceSeen); seenRef.current = onSourceSeen;
  const sentinelRef = useRef<HTMLDivElement>(null);

  // register sources + first-mention cards for any newly revealed lines [processed, n)
  useEffect(() => {
    for (let i = processedRef.current; i < n; i++) {
      const line = lines[i];
      if (!line) continue;
      const fresh: string[] = [];
      for (const id of lineSourceIds(line)) {
        seenRef.current(id);
        if (!cardedRef.current.has(id)) { cardedRef.current.add(id); fresh.push(id); }
      }
      if (fresh.length) setCardsAfter((prev) => ({ ...prev, [line.idx]: fresh }));
    }
    processedRef.current = Math.max(processedRef.current, n);
  }, [n, lines, cardedRef]);

  // timed mode: reveal sentence by sentence
  useEffect(() => {
    if (mode !== "timed") return;
    if (n >= lines.length) { doneRef.current(); return; }
    const delay = Math.min(1300, Math.max(480, 420 + lineWordCount(lines[n]) * 32));
    const t = setTimeout(() => setN((x) => x + 1), delay);
    return () => clearTimeout(t);
  }, [n, lines, mode]);

  // scroll mode: reveal the next chunk (paragraph) when the sentinel scrolls into view
  useEffect(() => {
    if (mode !== "scroll") return;
    if (n >= lines.length) { doneRef.current(); return; }
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      setN((prev) => {
        let j = prev + 1;
        while (j < lines.length && !lines[j].para) j++;
        return j;
      });
    }, { rootMargin: "0px 0px -12% 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [n, lines, mode]);

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
    if (ln.segs.length === 1 && ln.segs[0].t === "card") continue;
    if (ln.para && buf.length) flush();
    buf.push(<span key={ln.idx} className="line-in">{ln.segs.map((s, i) => renderSeg(s, i, onOpen))}</span>);
    const cards = cardsAfter[ln.idx];
    if (cards) {
      flush();
      for (const id of cards) els.push(<div key={`c${id}`} className="line-in" style={{ margin: "16px 0 0" }}><InlineCard src={SOURCES[id]} onOpen={onOpen} /></div>);
      firstEl = false;
    }
  }
  flush();
  return <div>{els}{mode === "scroll" && n < lines.length && <div ref={sentinelRef} style={{ height: 1 }} />}</div>;
}

/* ---------------- "thinking" trace (light, accumulating, prod spinner) ---------------- */

function ThinkingTrace({ lines, onDone }: { lines: string[]; onDone: () => void }) {
  const [n, setN] = useState(0); // completed count
  const done = useRef(onDone); done.current = onDone;
  useEffect(() => {
    if (lines.length === 0) { done.current(); return; }
    if (n >= lines.length) { const t = setTimeout(() => done.current(), 480); return () => clearTimeout(t); }
    const t = setTimeout(() => setN((x) => x + 1), n === 0 ? 600 : 1050);
    return () => clearTimeout(t);
  }, [n, lines.length]);

  if (lines.length === 0) return null;
  const allDone = n >= lines.length;
  const visible = lines.slice(0, allDone ? lines.length : n + 1);
  return (
    <div style={{ background: "#fff", border: "1px solid #e6e1d8", padding: "10px 14px", marginBottom: 18, display: "inline-block", minWidth: 220 }}>
      {visible.map((l, i) => {
        const isDone = i < n;
        return (
          <div key={i} className="line-in" style={{ display: "flex", alignItems: "center", gap: 8, padding: "2px 0", fontFamily: BODY, fontSize: "0.8rem", color: isDone ? "#a8a294" : "#5c574d" }}>
            {isDone
              ? <span style={{ color: "#38b000", fontSize: "0.72rem", width: 13, flexShrink: 0 }}>✓</span>
              : <Loader2 className="size-3.5" style={{ animation: "spin 0.9s linear infinite", flexShrink: 0 }} />}
            <span>{isDone ? donePhrase(l) : activePhrase(l)}{!isDone && <span className="caret-thin">▏</span>}</span>
          </div>
        );
      })}
    </div>
  );
}

/* ---------------- seeds ---------------- */

function SeedRow({ seeds, onTap, label }: { seeds: { id: string; label: string }[]; onTap: (id: string) => void; label: string }) {
  if (seeds.length === 0) return null;
  return (
    <div className="line-in" style={{ marginTop: 24 }}>
      <Eyebrow style={{ marginBottom: 10 }}>{label}</Eyebrow>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 9 }}>
        {seeds.map((s) => (
          <button key={s.id} onClick={() => onTap(s.id)} className="seed-tag" style={{ fontFamily: BODY, fontSize: "0.84rem", fontWeight: 500, background: "#fff", border: "1.5px solid #1a1a1a", boxShadow: "3px 3px 0 0 rgba(0,0,0,1)", padding: "8px 13px", textAlign: "left" }}>
            {s.label}
            <span style={{ marginLeft: 8, color: "#b3a89a" }}>↳</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ---------------- thread ---------------- */

function ThreadBlock({ threadId, depth, onOpen, onSourceSeen, onTapSeed, cardedRef }: {
  threadId: string;
  depth: number;
  onOpen: (s: Source) => void;
  onSourceSeen: (id: string) => void;
  onTapSeed: (id: string) => void;
  cardedRef: React.MutableRefObject<Set<string>>;
}) {
  const thread = BRIEF.threads[threadId];
  const lines = useMemo(() => toLines(thread.body), [thread]);
  const [loaded, setLoaded] = useState(false);
  const [done, setDone] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { ref.current?.scrollIntoView({ behavior: "smooth", block: "center" }); }, []);

  return (
    <div ref={ref} style={{ marginTop: 28, paddingLeft: 18, borderLeft: `3px solid ${depth % 2 === 0 ? "#1a1a1a" : "#ff007f"}` }}>
      <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: "1.2rem", lineHeight: 1.2, marginBottom: 14, letterSpacing: "-0.01em" }}>{thread.question}</div>
      <ThinkingTrace lines={thread.status} onDone={() => setLoaded(true)} />
      {loaded && <LineReveal lines={lines} onOpen={onOpen} onSourceSeen={onSourceSeen} onDone={() => setDone(true)} cardedRef={cardedRef} />}
      {done && <SeedRow seeds={thread.seeds} onTap={onTapSeed} label="Keep pulling" />}
    </div>
  );
}

/* ---------------- source detail overlay ---------------- */

function DetailOverlay({ src, onClose }: { src: Source; onClose: () => void }) {
  const tags = SOURCE_PALETTES[src.paletteIdx % SOURCE_PALETTES.length];
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(26,26,26,0.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ ...washStyle(src.paletteIdx), maxWidth: 520, width: "100%", border: "2px solid #1a1a1a", boxShadow: "8px 8px 0 0 rgba(0,0,0,1)", padding: "26px 28px" }}>
        <button onClick={onClose} style={{ fontFamily: BODY, fontSize: "0.78rem", background: "none", border: "none", cursor: "pointer", color: "#888", marginBottom: 14 }}>✕ Close</button>
        <div style={{ fontFamily: MONO, fontSize: "0.6rem", letterSpacing: "1.5px", color: "#666", marginBottom: 10 }}>{src.venue}</div>
        <h3 style={{ fontFamily: DISPLAY, fontWeight: 800, textTransform: "uppercase", fontSize: "1.3rem", lineHeight: 1.15, margin: "0 0 6px" }}>{src.title}</h3>
        <p style={{ fontFamily: MONO, fontSize: "0.66rem", fontStyle: "italic", color: "#777", margin: "0 0 16px" }}>{src.authors}</p>
        <p style={{ fontSize: "0.95rem", lineHeight: 1.6, color: "#222", margin: 0 }}>{src.summary}</p>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: 18, gap: 12, flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {src.keywords.map((kw, i) => (
              <span key={kw} style={{ fontFamily: MONO, fontSize: "0.6rem", textTransform: "uppercase", letterSpacing: "0.5px", background: tags[i % 2], border: "1px solid #1a1a1a", padding: "3px 9px" }}>{kw}</span>
            ))}
          </div>
          <a href={src.url} target="_blank" rel="noopener noreferrer" className="seed-tag" style={{ fontFamily: MONO, fontSize: "0.62rem", letterSpacing: "1px", background: "#1a1a1a", color: "#fff", padding: "7px 12px", whiteSpace: "nowrap" }}>VIEW STUDY ↗</a>
        </div>
      </div>
    </div>
  );
}

/* ---------------- sources coda ---------------- */

function SourcesCoda({ ids, onOpen }: { ids: string[]; onOpen: (s: Source) => void }) {
  const [open, setOpen] = useState(false);
  if (ids.length === 0) return null;
  return (
    <div style={{ marginTop: 48, borderTop: "1.5px solid #d8d3c8", paddingTop: 18 }}>
      <button onClick={() => setOpen((o) => !o)} style={{ fontFamily: DISPLAY, fontSize: "0.9rem", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.045em", background: "none", border: "none", cursor: "pointer", color: "#1a1a1a", padding: 0, display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ color: "#b3a89a" }}>{open ? "▾" : "▸"}</span> Sources ({ids.length})
      </button>
      {open && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 14, marginTop: 16 }}>
          {ids.map((id) => {
            const src = SOURCES[id];
            return (
              <div key={id} onClick={() => onOpen(src)} className="blob-card" style={{ ...washStyle(src.paletteIdx), border: "2px solid #1a1a1a", boxShadow: "4px 4px 0 0 rgba(0,0,0,1)", padding: "12px 14px", cursor: "pointer", aspectRatio: "1 / 1", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontFamily: MONO, fontSize: "0.52rem", letterSpacing: "1px", color: "#666", border: "1px solid #cbd5e1", padding: "2px 5px" }}>{src.venue}</span>
                  {src.discovered && <span style={{ fontFamily: MONO, fontSize: "0.48rem", background: "#ffe89a", border: "1px solid #1a1a1a", padding: "1px 4px" }}>★</span>}
                </div>
                <div>
                  <h4 style={{ fontFamily: DISPLAY, fontWeight: 800, textTransform: "uppercase", fontSize: "0.82rem", lineHeight: 1.15, margin: "0 0 6px" }}>{src.title}</h4>
                  <a href={src.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} style={{ fontFamily: MONO, fontSize: "0.52rem", letterSpacing: "1px", color: "#1a1a1a", borderBottom: "1px solid #1a1a1a" }}>VIEW STUDY ↗</a>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ---------------- animated question (mirrors prod AnimatedTheme sweep) ---------------- */

type BarPhase = "hidden" | "in" | "exit-prep" | "exit";

function AnimatedQuestion({ text }: { text: string }) {
  const [p1, setP1] = useState<BarPhase>("hidden");
  const [p2, setP2] = useState<BarPhase>("hidden");
  const words = text.split(" ");
  const splitIdx = Math.ceil(words.length / 2);
  const phrase1 = words.slice(0, splitIdx).join(" ");
  const phrase2 = words.slice(splitIdx).join(" ");

  useEffect(() => {
    setP1("hidden"); setP2("hidden");
    const ts = [
      setTimeout(() => setP1("in"), 200),
      setTimeout(() => setP1("exit-prep"), 830),
      setTimeout(() => setP1("exit"), 845),
      setTimeout(() => setP2("in"), 1060),
      setTimeout(() => setP2("exit-prep"), 1690),
      setTimeout(() => setP2("exit"), 1705),
    ];
    return () => ts.forEach(clearTimeout);
  }, [text]);

  const phraseStyle = (phase: BarPhase, c1: string, c2: string): React.CSSProperties => {
    const rightAnchor = phase === "exit-prep" || phase === "exit";
    return {
      display: "inline",
      backgroundImage: `linear-gradient(90deg, ${c1} 0%, ${c2} 100%)`,
      backgroundRepeat: "no-repeat",
      backgroundPosition: rightAnchor ? "right bottom" : "left bottom",
      backgroundSize: phase === "in" || phase === "exit-prep" ? "100% 9px" : "0% 9px",
      transition: phase === "in" ? "background-size 0.52s ease-in-out" : phase === "exit" ? "background-size 0.44s ease-in-out" : "none",
      paddingBottom: "10px",
    };
  };

  const [a1, b1] = SOURCE_PALETTES[1];
  const [a2, b2] = SOURCE_PALETTES[2];
  return (
    <h1 style={{ fontFamily: DISPLAY, fontSize: "clamp(2.75rem, 5vw, 4rem)", lineHeight: 1.25, fontWeight: 700, letterSpacing: "-0.055em", color: "#1a1a1a", margin: "0 0 34px" }}>
      <span style={phraseStyle(p1, a1, b1)}>{phrase1}</span>{" "}
      <span style={phraseStyle(p2, a2, b2)}>{phrase2}</span>
    </h1>
  );
}

/* ---------------- curiosity map (shows only the path you've taken) ---------------- */

const MAP_ROOT = "__root__";

function MindMap({ openedSet, currentId, onNav }: {
  openedSet: Set<string>;
  currentId: string;
  onNav: (id: string, opened: boolean, depth: number) => void;
}) {
  const renderNode = (id: string, label: string, depth: number, path: string[]): React.ReactNode => {
    const isRoot = id === MAP_ROOT;
    const isCurrent = id === currentId;
    const seeds = isRoot ? BRIEF.seeds : BRIEF.threads[id].seeds;
    const openedChildren = seeds.filter((c) => openedSet.has(c.id) && !path.includes(c.id));
    const accent = depth === 0 ? "#1a1a1a" : depth % 2 === 1 ? "#ff007f" : "#1a1a1a";
    return (
      <div key={path.join(">") + id} style={{ marginLeft: depth === 0 ? 0 : 12, borderLeft: depth === 0 ? "none" : `1.5px solid #e0dace`, paddingLeft: depth === 0 ? 0 : 10 }}>
        <button onClick={() => onNav(id, true, depth)} style={{ display: "flex", alignItems: "baseline", gap: 7, width: "100%", textAlign: "left", fontFamily: BODY, fontSize: "0.8rem", fontWeight: isCurrent ? 600 : 500, background: isCurrent ? accent : "transparent", color: isCurrent ? "#fff" : "#1a1a1a", border: "none", padding: "4px 7px", margin: "1px 0", cursor: "pointer", lineHeight: 1.3 }}>
          <span style={{ color: isCurrent ? "#fff" : accent, fontSize: "0.55rem", flexShrink: 0 }}>●</span>
          <span>{label}</span>
        </button>
        {openedChildren.map((c) => renderNode(c.id, c.label, depth + 1, [...path, id]))}
      </div>
    );
  };
  return <div style={{ maxHeight: "58vh", overflowY: "auto" }}>{renderNode(MAP_ROOT, "The verdict", 0, [])}</div>;
}

/* ---------------- page ---------------- */

export default function BriefPrototype() {
  const [runKey, setRunKey] = useState(0);
  const [verdictDone, setVerdictDone] = useState(false);
  const [trail, setTrail] = useState<{ key: string; threadId: string; depth: number }[]>([]);
  const [detail, setDetail] = useState<Source | null>(null);
  const [inPlay, setInPlay] = useState<string[]>([]);
  const [showMap, setShowMap] = useState(true);
  const cardedRef = useRef<Set<string>>(new Set());

  const verdictLines = useMemo(() => toLines(BRIEF.verdict), []);
  const openedSet = useMemo(() => new Set(trail.map((t) => t.threadId)), [trail]);
  const currentId = trail.length ? trail[trail.length - 1].threadId : MAP_ROOT;

  const seeSource = (id: string) => setInPlay((prev) => (prev.includes(id) ? prev : [...prev, id]));

  const openThread = (threadId: string, depth: number) => {
    setTrail((prev) => {
      if (prev.some((t) => t.threadId === threadId)) {
        document.getElementById(`thread-${threadId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
        return prev;
      }
      return [...prev, { key: `${threadId}-${prev.length}`, threadId, depth }];
    });
  };

  const onNav = (id: string, opened: boolean, depth: number) => {
    if (id === MAP_ROOT) { window.scrollTo({ top: 0, behavior: "smooth" }); return; }
    if (opened) { document.getElementById(`thread-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }); }
    else { openThread(id, depth - 1); }
  };

  const restart = () => {
    cardedRef.current = new Set();
    setTrail([]); setVerdictDone(false); setDetail(null); setInPlay([]);
    setRunKey((k) => k + 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div style={{ minHeight: "100vh", background: "#ffffff", padding: "0 20px 140px" }}>
      <style>{`
        @keyframes rise { from { opacity: 0; transform: translateY(6px) } to { opacity: 1; transform: translateY(0) } }
        @keyframes blink { 0%,49% { opacity: 1 } 50%,100% { opacity: 0 } }
        @keyframes spin { to { transform: rotate(360deg) } }
        .line-in { animation: rise 0.4s ease both; }
        .caret-thin { animation: blink 1s steps(1) infinite; margin-left: 2px; color: #1a1a1a; }
        .seed-tag { transition: transform 0.12s ease, box-shadow 0.12s ease; }
        .seed-tag:hover { transform: translate(-2px,-2px); box-shadow: 5px 5px 0 0 rgba(255,0,127,1) !important; }
        .blob-card { transition: transform 0.12s ease, box-shadow 0.12s ease; }
        .blob-card:hover { transform: translate(-2px,-2px); box-shadow: 7px 7px 0 0 rgba(0,0,0,1) !important; }
      `}</style>

      <div style={{ maxWidth: 720, margin: "0 auto", paddingTop: 40 }} key={runKey}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 48, paddingBottom: 16, borderBottom: "1.5px solid #1a1a1a" }}>
          <span style={{ fontFamily: DISPLAY, fontSize: "1.5rem", fontWeight: 800, color: "#1a1a1a", textTransform: "uppercase", letterSpacing: "0.02em" }}>LEARNING ET AL.</span>
          <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
            <span style={{ fontFamily: DISPLAY, fontSize: "0.95rem", fontWeight: 600, color: "#1a1a1a", textTransform: "uppercase", letterSpacing: "0.04em" }}>Today</span>
            <span style={{ fontFamily: DISPLAY, fontSize: "0.95rem", fontWeight: 600, color: "#bcb6a8", textTransform: "uppercase", letterSpacing: "0.04em" }}>Vault</span>
            <button onClick={restart} style={{ fontFamily: MONO, fontSize: "0.66rem", letterSpacing: "1.5px", textTransform: "uppercase", background: "transparent", color: "#7c766c", border: "none", cursor: "pointer" }}>↻ Replay</button>
          </div>
        </div>

        <Eyebrow>Daily digest</Eyebrow>
        <AnimatedQuestion text={BRIEF.centralQuestion} />

        <LineReveal lines={verdictLines} onOpen={setDetail} onSourceSeen={seeSource} onDone={() => setVerdictDone(true)} cardedRef={cardedRef} mode="scroll" />
        {verdictDone && <SeedRow seeds={BRIEF.seeds} onTap={(id) => openThread(id, 0)} label="Pull a thread" />}

        {trail.map((t) => (
          <div id={`thread-${t.threadId}`} key={t.key}>
            <ThreadBlock threadId={t.threadId} depth={t.depth} onOpen={setDetail} onSourceSeen={seeSource} onTapSeed={(id) => openThread(id, t.depth + 1)} cardedRef={cardedRef} />
          </div>
        ))}

        <SourcesCoda ids={inPlay} onOpen={setDetail} />
      </div>

      {showMap ? (
        <div style={{ position: "fixed", right: 20, bottom: 20, width: 248, zIndex: 50, background: "#fff", border: "1.5px solid #1a1a1a", boxShadow: "5px 5px 0 0 rgba(0,0,0,1)", padding: "12px 12px 14px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontFamily: DISPLAY, fontSize: "0.78rem", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.045em", color: "#1a1a1a" }}>Paper trail</span>
            <button onClick={() => setShowMap(false)} style={{ fontFamily: BODY, fontSize: "0.8rem", background: "none", border: "none", cursor: "pointer", color: "#a8a294" }}>✕</button>
          </div>
          <MindMap openedSet={openedSet} currentId={currentId} onNav={onNav} />
        </div>
      ) : (
        <button onClick={() => setShowMap(true)} style={{ position: "fixed", right: 20, bottom: 20, zIndex: 50, fontFamily: DISPLAY, fontSize: "0.78rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", background: "#1a1a1a", color: "#fff", border: "none", padding: "8px 14px", cursor: "pointer", boxShadow: "4px 4px 0 0 rgba(0,0,0,1)" }}>◆ Paper trail</button>
      )}

      {detail && <DetailOverlay src={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}
