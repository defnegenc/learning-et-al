"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Loader2, RefreshCw, Star, Ban, Bookmark } from "lucide-react";
import type { PaperItem } from "./paper-card";
import { SynthesisBanner, GuestDigDeeper, AnswerBlock } from "./synthesis-banner";
import { BriefThreads } from "./brief-threads";
import { BriefDigest } from "./brief-digest";
import { PapersMode } from "./papers-mode";
import React from "react";

/* ── Types ── */
type ConvEntry = { q: string; a: string; paletteIdx?: number; paperLinks?: { title: string; sourceUrl: string | null }[] };

/* ── dispersedWash — 4-corner radial blob background ── */
const SOURCE_PALETTES: [string, string][] = [
  ["#6EE9A8", "#D4F04A"],
  ["#FF85A8", "#FFD020"],
  ["#60AAE8", "#A878E8"],
  ["#FFD020", "#FF85A8"],
];

function hex2rgba(hex: string, a: number) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

const BLOB_LAYOUTS = [
  // card 0: top-left dominant, bottom-right reach, top-right wisp
  (c1: string, c2: string) => `
    radial-gradient(circle 280px at 5% 8%, ${c1} 0%, transparent 60%),
    radial-gradient(circle 200px at 92% 5%, ${c2} 0%, transparent 55%),
    radial-gradient(circle 260px at 96% 96%, ${c1} 0%, transparent 60%),
    #fff`,
  // card 1: bottom-left blob, top-right reach, bottom-right accent
  (c1: string, c2: string) => `
    radial-gradient(circle 270px at 2% 95%, ${c2} 0%, transparent 60%),
    radial-gradient(circle 220px at 90% 5%, ${c1} 0%, transparent 55%),
    radial-gradient(circle 200px at 98% 88%, ${c2} 0%, transparent 55%),
    #fff`,
  // card 2: top-right dominant, left-center reach, small bottom-left
  (c1: string, c2: string) => `
    radial-gradient(circle 280px at 98% 4%, ${c1} 0%, transparent 60%),
    radial-gradient(circle 220px at 2% 45%, ${c2} 0%, transparent 55%),
    radial-gradient(circle 190px at 8% 98%, ${c1} 0%, transparent 55%),
    #fff`,
  // card 3: both bottom corners reaching up, small top-right
  (c1: string, c2: string) => `
    radial-gradient(circle 260px at 3% 98%, ${c1} 0%, transparent 60%),
    radial-gradient(circle 250px at 97% 92%, ${c2} 0%, transparent 60%),
    radial-gradient(circle 180px at 88% 3%, ${c1} 0%, transparent 50%),
    #fff`,
];

function dispersedWash(palette: [string, string], hover = false, idx = 0): React.CSSProperties {
  const [h1, h2] = palette;
  const a = hover ? 0.55 : 0.42;
  const c1 = hex2rgba(h1, a);
  const c2 = hex2rgba(h2, a);
  return { background: BLOB_LAYOUTS[idx % BLOB_LAYOUTS.length](c1, c2) } as React.CSSProperties;
}

/* ── Journal name helper ── */
function getJournalName(sourceUrl: string | null, authors: string[] = []): string | null {
  if (!sourceUrl) return null;
  try {
    const hostname = new URL(sourceUrl).hostname.replace("www.", "");
    const domainMap: Record<string, string> = {
      "arxiv.org": "arXiv", "nature.com": "Nature", "sciencedirect.com": "ScienceDirect",
      "springer.com": "Springer", "ieee.org": "IEEE", "acm.org": "ACM", "pnas.org": "PNAS",
      "frontiersin.org": "Frontiers", "mdpi.com": "MDPI", "wiley.com": "Wiley",
      "tandfonline.com": "Taylor & Francis", "sagepub.com": "SAGE", "cambridge.org": "Cambridge UP",
      "oup.com": "Oxford UP", "plos.org": "PLOS", "biorxiv.org": "bioRxiv",
      "medrxiv.org": "medRxiv", "ssrn.com": "SSRN", "researchgate.net": "ResearchGate",
      "mckinsey.com": "McKinsey",
    };
    for (const [domain, name] of Object.entries(domainMap)) {
      if (hostname.includes(domain)) return name;
    }
    if (hostname.includes("doi.org")) {
      const path = new URL(sourceUrl).pathname;
      const doiMap: Record<string, string> = {
        "10.3389": "Frontiers", "10.1038": "Nature", "10.1016": "Elsevier",
        "10.1007": "Springer", "10.1109": "IEEE", "10.1145": "ACM",
        "10.1073": "PNAS", "10.3390": "MDPI", "10.1002": "Wiley",
        "10.1080": "Taylor & Francis", "10.1177": "SAGE", "10.1371": "PLOS",
        "10.1093": "Oxford UP", "10.1017": "Cambridge UP",
      };
      for (const [prefix, pub] of Object.entries(doiMap)) {
        if (path.includes(prefix)) return pub;
      }
      return null;
    }
    const parts = hostname.split(".");
    const name = parts.length > 2 ? parts.slice(0, -2).join(".") : parts[0];
    if (name.length < 3) return null;
    const derived = name.charAt(0).toUpperCase() + name.slice(1);
    // Don't show journal if it duplicates an author name
    if (authors.some(a => a.toLowerCase() === derived.toLowerCase())) return null;
    return derived;
  } catch { return null; }
}

/* ── Source Card (dispersedWash, design-accurate) ── */
function SourceCard({ paper, index, loggedIn, initialBookmarked }: { paper: PaperItem; index: number; loggedIn?: boolean; initialBookmarked?: boolean }) {
  const palette = SOURCE_PALETTES[index % SOURCE_PALETTES.length];
  const url = (paper.sourceUrl || "").toLowerCase();
  const sourceType = url.includes("arxiv") ? "arXiv" : paper.source === "rss" ? "News" : "Paper";
  const journalName = getJournalName(paper.sourceUrl, paper.authors);
  const baseWash = dispersedWash(palette, false, index);
  const hoverWash = dispersedWash(palette, true, index);
  const [bookmarked, setBookmarked] = useState(!!initialBookmarked);

  async function toggleBookmark(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const next = !bookmarked;
    setBookmarked(next);
    try {
      await fetch(`/api/papers/${paper.id}/feedback`, {
        method: next ? "POST" : "DELETE",
        headers: next ? { "Content-Type": "application/json" } : undefined,
        body: next ? JSON.stringify({ type: "star" }) : undefined,
      });
    } catch {
      setBookmarked(!next);
    }
  }

  return (
    <a
      href={paper.sourceUrl || "#"}
      onClick={e => { if (!paper.sourceUrl) e.preventDefault(); }}
      target={paper.sourceUrl ? "_blank" : undefined}
      rel="noopener noreferrer"
      style={{
        ...baseWash,
        display: "block",
        padding: "16px 18px 18px",
        textDecoration: "none",
        color: "inherit",
        position: "relative",
        overflow: "hidden",
        border: `1.5px solid ${hex2rgba(palette[0], 0.45)}`,
        boxShadow: "0 1px 4px rgba(0,0,0,0.07)",
        transition: "background 320ms, box-shadow 150ms, transform 150ms",
        height: "100%",
      }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLElement;
        Object.assign(el.style, hoverWash);
        el.style.boxShadow = "0 4px 12px rgba(0,0,0,0.10)";
        el.style.transform = "translate(-1px,-1px)";
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLElement;
        Object.assign(el.style, baseWash);
        el.style.boxShadow = "0 1px 4px rgba(0,0,0,0.07)";
        el.style.transform = "";
      }}
    >
      {/* Venue + year + ext-link */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
        <div style={{ fontFamily: "var(--font-mono), monospace", fontSize: "0.625rem", letterSpacing: "0.12em", fontWeight: 700, color: "#1a1a1a", textTransform: "uppercase", display: "flex", alignItems: "center", gap: "6px" }}>
          <span>{sourceType}</span>
          <span style={{ color: "#aaa" }}>·</span>
          <span>{paper.year || "2025"}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {loggedIn && (
            <button
              onClick={toggleBookmark}
              style={{ background: "none", border: "none", padding: 0, cursor: "pointer", display: "flex", lineHeight: 1 }}
              aria-label={bookmarked ? "Remove bookmark" : "Bookmark paper"}
            >
              <Bookmark size={12} style={{ fill: bookmarked ? "#1a1a1a" : "none", stroke: "#1a1a1a", opacity: bookmarked ? 1 : 0.4, transition: "all 0.15s" }} />
            </button>
          )}
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0, opacity: 0.5 }}>
            <path d="M7 1h4v4M11 1L6 6M9 7v3.5H1.5V2H5" stroke="#1a1a1a" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>

      {/* Title */}
      <h3 style={{ margin: "0 0 8px", fontFamily: "var(--font-display), sans-serif", fontSize: "0.875rem", fontWeight: 700, lineHeight: 1.25, letterSpacing: "-0.01em", color: "#1a1a1a", textTransform: "uppercase" }}>
        {paper.title}
      </h3>

      {/* Authors + journal */}
      {(paper.authors.length > 0 || journalName) && (
        <div style={{ fontStyle: "italic", color: "#444", fontSize: "0.75rem", lineHeight: 1.4, marginBottom: "10px" }}>
          {paper.authors.length > 0 && (
            paper.authors.length <= 2 ? paper.authors.join(" & ") : `${paper.authors[0]}${paper.authors[1] ? `, ${paper.authors[1]}` : ""} et al.`
          )}
          {paper.authors.length > 0 && journalName ? " — " : ""}
          {journalName && <em>{journalName}</em>}
        </div>
      )}

      {/* Summary — vertical accent + text */}
      {paper.summary && (
        <div style={{ display: "flex", gap: "10px", alignItems: "stretch", paddingTop: "10px", marginBottom: "12px" }}>
          <div style={{ width: 3, flexShrink: 0, borderRadius: 1, background: "#ddd" }} />
          <div style={{ fontSize: "0.8rem", lineHeight: 1.55, color: "#333" }}>
            {paper.summary.length > 160 ? paper.summary.slice(0, 157) + "..." : paper.summary}
          </div>
        </div>
      )}

      {/* Tags — clear/glass style */}
      {paper.keywords.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
          {paper.keywords.slice(0, 2).map((kw) => (
            <span key={kw} style={{
              background: "rgba(255,255,255,0.55)",
              color: "#1a1a1a",
              border: "1px solid rgba(26,26,26,0.35)",
              fontFamily: "var(--font-mono), monospace",
              fontSize: "0.6rem", fontWeight: 600,
              letterSpacing: "0.08em", padding: "4px 9px",
              textTransform: "uppercase", display: "inline-block",
              lineHeight: 1, whiteSpace: "nowrap",
              backdropFilter: "blur(6px)",
            }}>
              {kw}
            </span>
          ))}
        </div>
      )}
    </a>
  );
}

/* ── Animated sweep title ── */
// Phase "exit-prep" instantly switches background anchor to right (no visual change at 100% size),
// then "exit" animates size→0 with right anchor so the bar collapses left-to-right.
type BarPhase = "hidden" | "in" | "exit-prep" | "exit";

function SweepTitle({ text, palettes }: { text: string; palettes: [string, string][] }) {
  const [p1, setP1] = useState<BarPhase>("hidden");
  const [p2, setP2] = useState<BarPhase>("hidden");

  const VERBS = new Set(["drive", "drives", "shape", "shapes", "affect", "affects", "are", "is",
    "make", "makes", "help", "helps", "change", "changes", "influence", "influences",
    "determine", "determines", "impact", "impacts", "reveal", "reveals", "show", "shows",
    "explain", "explains", "challenge", "challenges", "use", "uses", "enable", "enables",
    "transform", "transforms", "predict", "predicts", "blur", "blurs", "define", "defines"]);
  const words = text.split(" ");
  let splitIdx = -1;
  for (let i = 1; i < words.length - 1; i++) {
    if (VERBS.has(words[i].replace(/[^a-z]/gi, "").toLowerCase())) { splitIdx = i; break; }
  }
  if (splitIdx <= 0) splitIdx = Math.ceil(words.length / 2);

  const phrase1 = words.slice(0, splitIdx).join(" ");
  const phrase2 = words.slice(splitIdx).join(" ");

  useEffect(() => {
    setP1("hidden"); setP2("hidden");
    const ts = [
      setTimeout(() => setP1("in"), 200),
      setTimeout(() => setP1("exit-prep"), 830),  // instant anchor switch (no visual change)
      setTimeout(() => setP1("exit"), 845),         // now animate size→0 from right anchor
      setTimeout(() => setP2("in"), 1060),
      setTimeout(() => setP2("exit-prep"), 1690),
      setTimeout(() => setP2("exit"), 1705),
    ];
    return () => ts.forEach(clearTimeout);
  }, [text]);

  // Uses display:inline + background-image so the bar follows text wrapping per-line,
  // not the inline-block box width (which overshoot on wrapped lines).
  const phraseStyle = (phase: BarPhase, c1: string, c2: string): React.CSSProperties => {
    const rightAnchor = phase === "exit-prep" || phase === "exit";
    return {
      display: "inline",
      backgroundImage: `linear-gradient(90deg, ${c1} 0%, ${c2} 100%)`,
      backgroundRepeat: "no-repeat",
      backgroundPosition: rightAnchor ? "right bottom" : "left bottom",
      backgroundSize: (phase === "in" || phase === "exit-prep") ? "100% 9px" : "0% 9px",
      transition: phase === "in"   ? "background-size 0.52s ease-in-out"
                : phase === "exit" ? "background-size 0.44s ease-in-out"
                : "none",
      paddingBottom: "10px",
    };
  };

  const [a1, b1] = palettes[0];
  const [a2, b2] = palettes[1 % palettes.length];

  return (
    <h1 style={{
      fontFamily: "var(--font-display), sans-serif",
      fontSize: "clamp(2.75rem, 5vw, 4rem)",
      lineHeight: 1.25, fontWeight: 700,
      letterSpacing: "-0.055em", color: "#1a1a1a",
      margin: "0 0 28px",
    }}>
      <span style={phraseStyle(p1, a1, b1)}>{phrase1}</span>
      {" "}
      <span style={phraseStyle(p2, a2, b2)}>{phrase2}</span>
    </h1>
  );
}

/* ── Dig Deeper Rail (right column or mobile inline) ── */

function DigDeeperRail({
  questions,
  answers,
  history,
  loading,
  onAsk,
  isLoggedIn,
  onSignIn,
}: {
  questions: string[];
  answers?: string[];
  history: ConvEntry[];
  loading: boolean;
  onAsk: (q: string, paletteIdx?: number) => void;
  isLoggedIn?: boolean;
  onSignIn?: () => void;
}) {
  const [customQ, setCustomQ] = useState("");
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());

  if (!isLoggedIn) {
    return (
      <>
        <div style={{ fontFamily: "var(--font-display), sans-serif", fontSize: "0.95rem", fontWeight: 500, color: "#1a1a1a", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "16px" }}>
          Dig deeper
        </div>
        <GuestDigDeeper questions={questions} answers={answers || []} onSignIn={onSignIn} />
      </>
    );
  }

  return (
    <div>
      <div style={{ fontFamily: "var(--font-display), sans-serif", fontSize: "0.95rem", fontWeight: 500, color: "#1a1a1a", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "16px" }}>
        Dig deeper
      </div>

      {/* Suggested question rows */}
      {!loading && questions.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", marginBottom: "4px" }}>
          {questions.slice(0, 3).map((q, i) => (
            <button
              key={i}
              onClick={() => onAsk(q, i)}
              style={{
                textAlign: "left", cursor: "pointer", background: "transparent", border: "none",
                padding: "14px 4px", width: "100%", display: "flex", gap: "12px", alignItems: "flex-start",
                borderBottom: "1px solid #1a1a1a", transition: "padding-left 120ms",
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.paddingLeft = "8px"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.paddingLeft = "4px"; }}
            >
              <div style={{ width: 4, alignSelf: "stretch", flexShrink: 0, borderRadius: 2, background: `linear-gradient(to bottom, ${SOURCE_PALETTES[i % SOURCE_PALETTES.length][0]} 0%, ${SOURCE_PALETTES[i % SOURCE_PALETTES.length][1]} 100%)`, border: "1px solid rgba(26,26,26,0.12)" }} />
              <div style={{ fontFamily: "var(--font-display), sans-serif", fontSize: "1rem", fontWeight: 400, letterSpacing: -0.2, lineHeight: 1.4, color: "#1a1a1a", flex: 1 }}>
                {q.replace(/\*\*/g, "")}
              </div>
              <span style={{ fontFamily: "var(--font-mono), monospace", fontSize: "0.6rem", letterSpacing: "1.5px", color: "#888", marginTop: 3, flexShrink: 0 }}>Ask →</span>
            </button>
          ))}
        </div>
      )}

      {/* Conversation history */}
      {history.length > 0 && (
        <div style={{ marginBottom: "12px" }}>
          {history.map((entry, i) => {
            const isCollapsed = collapsed.has(i);
            const pal = entry.paletteIdx !== undefined ? SOURCE_PALETTES[entry.paletteIdx % SOURCE_PALETTES.length] : null;
            return (
              <div key={i} style={{ marginBottom: "12px" }}>
                <button
                  onClick={() => setCollapsed(prev => { const s = new Set(prev); s.has(i) ? s.delete(i) : s.add(i); return s; })}
                  style={{
                    display: "flex", alignItems: "center", gap: "10px", width: "100%", textAlign: "left",
                    background: pal ? `linear-gradient(135deg, ${pal[0]}66 0%, ${pal[1]}66 100%)` : "transparent",
                    border: "none", cursor: "pointer",
                    padding: pal ? "10px 12px" : "0",
                    marginBottom: isCollapsed ? 0 : "8px",
                  }}
                >
                  <span style={{ fontSize: "0.95rem", fontWeight: 400, color: "#1a1a1a", fontFamily: "var(--font-display), sans-serif", flex: 1, letterSpacing: -0.2, lineHeight: 1.35 }}>
                    {entry.q}
                  </span>
                  <span style={{ fontSize: "0.55rem", color: "#888", fontFamily: "var(--font-mono), monospace", flexShrink: 0 }}>
                    {isCollapsed ? "▼" : "▲"}
                  </span>
                </button>
                {!isCollapsed && (
                  <div style={{ fontSize: "0.85rem", lineHeight: 1.65, color: "#444" }}>
                    <AnswerBlock text={entry.a} paperLinks={entry.paperLinks} />
                  </div>
                )}
                {i < history.length - 1 && <div style={{ borderBottom: "1px solid #e5e7eb", marginTop: "12px" }} />}
              </div>
            );
          })}
        </div>
      )}

      {loading && (
        <div className="flex items-center gap-2" style={{ marginBottom: "12px" }}>
          <Loader2 className="size-3 animate-spin text-[#888]" />
          <span style={{ fontSize: "0.65rem", color: "#888", fontFamily: "var(--font-mono), monospace" }}>Thinking...</span>
        </div>
      )}

      {/* Freeform ask — minimal textarea variant */}
      <div style={{ marginTop: "16px" }}>
        <div style={{ position: "relative", border: "2px solid #1a1a1a", background: "#fff", display: "flex", alignItems: "flex-end" }}>
          <textarea
            value={customQ}
            onChange={e => setCustomQ(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (customQ.trim() && !loading) { onAsk(customQ); setCustomQ(""); }
              }
            }}
            placeholder="Ask your own question…"
            rows={1}
            style={{
              flex: 1, minHeight: 38, maxHeight: 120, border: "none", background: "transparent",
              padding: "10px 44px 10px 12px", resize: "none", outline: "none",
              fontFamily: "var(--font-inter), sans-serif", fontSize: "0.875rem", lineHeight: 1.45,
              color: "#1a1a1a", boxSizing: "border-box",
            }}
          />
          <button
            onClick={() => { if (customQ.trim() && !loading) { onAsk(customQ); setCustomQ(""); } }}
            disabled={!customQ.trim() || loading}
            style={{
              position: "absolute", right: 6, bottom: 6, width: 28, height: 28, borderRadius: "50%",
              background: customQ.trim() && !loading ? "#1a1a1a" : "#e5e3dc",
              color: customQ.trim() && !loading ? "#fff" : "#999", border: "none",
              cursor: customQ.trim() && !loading ? "pointer" : "not-allowed",
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "background 120ms",
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 19V5M5 12l7-7 7 7" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Floating Notepad ── */
function NotepadFloat({ digestId }: { digestId: string }) {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [saved, setSaved] = useState(false);
  const storageKey = `digest_notes_${digestId}`;

  useEffect(() => {
    const s = localStorage.getItem(storageKey);
    if (s) setNotes(s);
  }, [storageKey]);

  const handleBlur = () => {
    if (notes.trim()) {
      localStorage.setItem(storageKey, notes);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  };

  return (
    <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 20, display: "flex", flexDirection: "column", gap: 10, alignItems: "flex-end" }}>
      {open && (
        <div style={{ width: 300, background: "#fff", border: "2px solid #1a1a1a", boxShadow: "4px 4px 0 #1a1a1a" }}>
          <div style={{ borderBottom: "2px solid #1a1a1a", padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontFamily: "var(--font-mono), monospace", fontSize: "0.65rem", letterSpacing: "2px", fontWeight: 700, textTransform: "uppercase" }}>Notes</span>
            <button onClick={() => setOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, lineHeight: 1, color: "#666" }}>×</button>
          </div>
          <div style={{ padding: 14 }}>
            <textarea
              value={notes}
              onChange={e => { setNotes(e.target.value); setSaved(false); }}
              onBlur={handleBlur}
              placeholder="Jot down your thoughts..."
              style={{ width: "100%", minHeight: 120, background: "transparent", border: "none", outline: "none", resize: "vertical", fontSize: "0.875rem", lineHeight: 1.65, color: "#333", fontFamily: "inherit", boxSizing: "border-box" }}
            />
            {saved && <span style={{ fontSize: "0.6rem", color: "#38b000", fontFamily: "var(--font-mono), monospace" }}>Saved</span>}
          </div>
        </div>
      )}
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          padding: "10px 18px 10px 40px", position: "relative",
          background: open ? "#FFF4B8" : "#fff",
          border: "2px solid #1a1a1a", borderRadius: 999,
          cursor: "pointer", fontFamily: "var(--font-display), sans-serif",
          fontSize: "0.8rem", fontWeight: 700, letterSpacing: 0.5, color: "#1a1a1a",
          textTransform: "uppercase", display: "inline-flex", alignItems: "center",
          boxShadow: "3px 3px 0 #1a1a1a", transition: "transform 150ms, box-shadow 150ms",
          whiteSpace: "nowrap",
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = "translate(-1px,-1px)"; (e.currentTarget as HTMLElement).style.boxShadow = "4px 4px 0 #1a1a1a"; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ""; (e.currentTarget as HTMLElement).style.boxShadow = "3px 3px 0 #1a1a1a"; }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          style={{ position: "absolute", left: 12, transform: open ? "rotate(-20deg)" : "none", transition: "transform 220ms" }}>
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4 12.5-12.5z" />
        </svg>
        {open ? "Close" : "Notes"}
      </button>
    </div>
  );
}

/* ── Hidden digest state with regenerate option ── */
function HiddenDigestState({
  hiddenStash, isLoggedIn, generating, generateError, onUndo, onRegenerate,
}: {
  hiddenStash: { digest: { id: string }; papers: unknown[] };
  isLoggedIn?: boolean;
  generating: boolean;
  generateError: string | null;
  onUndo: () => void;
  onRegenerate: (force?: boolean) => void;
}) {
  const [reason, setReason] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleRegenerate = async () => {
    if (!reason.trim()) return;
    setSubmitted(true);
    try {
      await fetch("/api/digest/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ digestId: hiddenStash.digest.id, reason: reason.trim() }),
      });
    } catch { /* non-critical */ }
    onRegenerate(true);
  };

  return (
    <>
      <h1 style={{ fontSize: "2.5rem", fontWeight: 700, fontFamily: "var(--font-display), sans-serif", letterSpacing: "-0.03em", textAlign: "center" }}>
        Digest hidden
      </h1>
      <button
        onClick={onUndo}
        style={{ fontSize: "0.65rem", color: "#999", background: "none", border: "none", cursor: "pointer", textDecoration: "underline", textUnderlineOffset: "2px", fontFamily: "var(--font-mono), monospace", letterSpacing: "1px" }}
      >
        Undo
      </button>
      {isLoggedIn && !submitted && (
        <div style={{ width: "100%", maxWidth: "420px", display: "flex", flexDirection: "column", gap: "10px", borderTop: "1px solid #e5e7eb", paddingTop: "24px" }}>
          <p style={{ fontSize: "0.8rem", color: "#555", fontFamily: "var(--font-mono), monospace" }}>
            Want a different one? Tell us why and we&apos;ll regenerate.
          </p>
          <div style={{ display: "flex", gap: "8px" }}>
            <input
              value={reason}
              onChange={e => setReason(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && reason.trim()) handleRegenerate(); }}
              placeholder="e.g. too technical, already know this topic…"
              autoFocus
              style={{ flex: 1, padding: "8px 10px", border: "1.5px solid #1a1a1a", fontSize: "0.8rem", outline: "none", fontFamily: "var(--font-inter), sans-serif" }}
            />
            <button
              onClick={handleRegenerate}
              disabled={!reason.trim() || generating}
              className="hover:bg-[#333] disabled:opacity-40"
              style={{ padding: "8px 14px", background: "#1a1a1a", color: "white", border: "none", cursor: "pointer", fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", fontFamily: "var(--font-mono), monospace" }}
            >
              {generating ? <Loader2 size={12} className="animate-spin" /> : "Go"}
            </button>
          </div>
          {generateError && <p style={{ fontSize: "0.7rem", color: "#ff007f" }}>{generateError}</p>}
        </div>
      )}
      {submitted && generating && (
        <div className="flex items-center gap-2 text-[#888]" style={{ fontSize: "0.8rem", fontFamily: "var(--font-mono), monospace" }}>
          <Loader2 size={14} className="animate-spin" /> Generating a new digest…
        </div>
      )}
    </>
  );
}

/* ── Interfaces ── */
interface Digest {
  id: string;
  theme: string | null;
  synthesisContent: string | null;
  keyConcepts: string[];
  suggestedQuestions?: string[];
  suggestedAnswers?: string[];
  starred: boolean | null;
  hidden?: boolean | null;
  date: string;
}

interface Session {
  userId: string | null;
  isSetUp: boolean;
}

interface TodayPageProps {
  session?: Session;
  isAdmin?: boolean;
  onRegisterRefresh?: (fn: () => void) => void;
  onSignIn?: () => void;
}

export function TodayPage({ session, isAdmin = false, onRegisterRefresh, onSignIn }: TodayPageProps) {
  const [digest, setDigest] = useState<Digest | null>(null);
  const [papers, setPapers] = useState<PaperItem[]>([]);
  const [hiddenStash, setHiddenStash] = useState<{ digest: Digest; papers: PaperItem[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [publicDigestList, setPublicDigestList] = useState<{ id: string; date: string; theme: string | null }[]>([]);
  const [publicDigestIdx, setPublicDigestIdx] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [activeConcept, setActiveConcept] = useState<string | null>(null);
  const [starred, setStarred] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());
  const handleGenerateRef = useRef<((force?: boolean) => void) | null>(null);

  /* ── Experience flags (?brief=1, ?papers=1) — gated rollouts to compare ── */
  const [briefMode, setBriefMode] = useState(false);
  const [papersMode, setPapersMode] = useState(false);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setBriefMode(params.get("brief") === "1");
    setPapersMode(params.get("papers") === "1");
  }, []);
  // Either flag collapses to the single-column reading layout + inline cards.
  const focusMode = briefMode || papersMode;

  /* ── Dig-deeper state (lifted from SynthesisBanner) ── */
  const [digDeeperHistory, setDigDeeperHistory] = useState<ConvEntry[]>([]);
  const [digDeeperLoading, setDigDeeperLoading] = useState(false);

  const historyKey = digest ? `digest_chat_${digest.id}` : "";
  useEffect(() => {
    if (!historyKey) return;
    const saved = localStorage.getItem(historyKey);
    if (saved) {
      try { setDigDeeperHistory(JSON.parse(saved)); } catch { /* ignore */ }
    } else {
      setDigDeeperHistory([]);
    }
  }, [historyKey]);

  const fetchDigest = useCallback(async (digestId?: string) => {
    try {
      const endpoint = session
        ? "/api/digest"
        : digestId
          ? `/api/public/digest?digestId=${digestId}`
          : "/api/public/digest";
      const res = await fetch(endpoint);
      if (!res.ok) return;
      const data = await res.json();
      setDigest(data.digest);
      setPapers(data.papers ?? []);
      if (data.digest) { setStarred(!!data.digest.starred); setHidden(!!data.digest.hidden); }
    } catch (err) {
      console.error("Failed to fetch digest:", err);
    }
  }, [session]);

  // Load public digest list for logged-out navigation
  useEffect(() => {
    if (session) return;
    fetch("/api/public/digests")
      .then(r => r.json())
      .then(list => setPublicDigestList(list))
      .catch(() => {});
  }, [session]);

  useEffect(() => {
    fetchDigest().finally(() => setLoading(false));
  }, [fetchDigest]);

  useEffect(() => {
    if (!session?.userId) return;
    fetch("/api/papers/bookmarks")
      .then(r => r.json())
      .then(data => setBookmarkedIds(new Set(data.ids ?? [])))
      .catch(() => {});
  }, [session?.userId]);

  useEffect(() => {
    if (!session || digest) return;
    const deadline = Date.now() + 4 * 60 * 1000;
    const id = setInterval(() => {
      if (Date.now() > deadline) { clearInterval(id); return; }
      fetchDigest();
    }, 10000);
    return () => clearInterval(id);
  }, [session, digest, fetchDigest]);

  useEffect(() => { handleGenerateRef.current = handleGenerate; });
  useEffect(() => { onRegisterRefresh?.(() => handleGenerateRef.current?.(true)); }, [onRegisterRefresh]);

  const handleGenerate = async (force = false) => {
    if (!session) return;
    setGenerating(true);
    setGenerateError(null);
    try {
      const res = await fetch("/api/digest/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force }),
      });
      if (res.ok) {
        await fetchDigest();
      } else {
        const data = await res.json().catch(() => ({}));
        setGenerateError(data.error || `Generation failed (${res.status}). Check your API key in settings.`);
      }
    } catch (err) {
      setGenerateError("Network error — couldn't reach the server.");
      console.error("Failed to generate digest:", err);
    } finally {
      setGenerating(false);
    }
  };

  const handleDigDeeper = async (question: string, paletteIdx?: number) => {
    if (!session || digDeeperLoading) return;
    setDigDeeperLoading(true);
    try {
      const res = await fetch("/api/digest/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: `Keep your answer to 3-4 sentences max. Be specific and concrete.\n\n${question}`,
          digestId: digest?.id || papers[0]?.id,
        }),
      });
      const data = await res.json();
      const answer = data.answer || data.error || "Couldn't get an answer.";
      const newHistory = [...digDeeperHistory, { q: question, a: answer, paletteIdx, paperLinks: data.paperLinks }];
      setDigDeeperHistory(newHistory);
      if (historyKey) localStorage.setItem(historyKey, JSON.stringify(newHistory));
    } catch {
      const newHistory = [...digDeeperHistory, { q: question, a: "Something went wrong. Try again.", paletteIdx }];
      setDigDeeperHistory(newHistory);
    }
    setDigDeeperLoading(false);
  };

  const openSource = (p: PaperItem) => p.sourceUrl && window.open(p.sourceUrl, "_blank", "noopener,noreferrer");

  /* ── Loading state ── */
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-6 animate-spin text-[#666]" />
      </div>
    );
  }

  /* ── No digest state ── */
  if (!digest) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-6 px-4">
        {hiddenStash ? (
          <HiddenDigestState
            hiddenStash={hiddenStash}
            isLoggedIn={!!session}
            generating={generating}
            generateError={generateError}
            onUndo={async () => {
              const { digest: d, papers: p } = hiddenStash;
              setDigest(d); setPapers(p); setHidden(false); setHiddenStash(null);
              try { await fetch("/api/digest/hide", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ digestId: d.id }) }); } catch { /* non-critical */ }
            }}
            onRegenerate={handleGenerate}
          />
        ) : (
          <>
            <h1 style={{ fontSize: "2.5rem", fontWeight: 700, fontFamily: "var(--font-display), sans-serif", letterSpacing: "-0.03em", textAlign: "center" }}>
              Today&apos;s digest is brewing
            </h1>
            <p style={{ fontSize: "1rem", color: "#999", textAlign: "center", maxWidth: "440px" }}>
              Check back soon — a fresh research digest is generated every day.
            </p>
          </>
        )}
        {!hiddenStash && session && generateError && (
          <p className="text-[0.75rem] text-[#ff007f] max-w-md text-center">{generateError}</p>
        )}
        {!hiddenStash && session && (
          <button
            onClick={() => handleGenerate(true)}
            disabled={generating}
            className="border border-[#1a1a1a] px-4 py-2 text-[0.65rem] uppercase tracking-[2px] hover:bg-[#1a1a1a] hover:text-[#e8e8e8] transition-colors disabled:opacity-50"
            style={{ borderWidth: "1.5px", fontFamily: "var(--font-mono), monospace" }}
          >
            {generating ? (
              <span className="flex items-center gap-2"><Loader2 className="size-3 animate-spin" /> GENERATING...</span>
            ) : (
              <span className="flex items-center gap-2"><RefreshCw className="size-3" />{generateError ? "Try again" : "Generate today's digest"}</span>
            )}
          </button>
        )}
      </div>
    );
  }

  /* ── Derive display theme (same logic as SynthesisBanner) ── */
  const displayTheme = digest.theme || (() => {
    const lines = (digest.synthesisContent || "").split("\n").filter(l => l.trim());
    const first = lines[0] || "";
    const prefixMatch = first.match(/^today(?:'s\s+\w+| we're exploring):\s*/i);
    if (prefixMatch) {
      const after = first.slice(prefixMatch[0].length).trim();
      const sentenceEnd = after.match(/^(.+?[?!.])/);
      return sentenceEnd ? sentenceEnd[1] : after;
    }
    const sentenceEnd = first.match(/^(.+?[?!.])/);
    return sentenceEnd ? sentenceEnd[1] : first;
  })();

  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });

  /* ── Main render — two-column: synthesis | paper rail ── */
  return (
    <div style={{ maxWidth: papersMode ? 1100 : briefMode ? 760 : 1380, margin: "0 auto" }} className="px-4 md:px-8 pt-5 md:pt-12 pb-20">
      <div className={focusMode ? "" : "grid grid-cols-1 md:grid-cols-[1fr_400px] items-start"} style={{ gap: "48px" }}>

        {/* ── Left: title + synthesis + dig deeper ── */}
        <main>
          {/* DigestTitleBlock */}
          <div style={{ marginBottom: "32px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <span style={{ fontFamily: "var(--font-display), sans-serif", fontSize: "0.95rem", fontWeight: 500, color: "#1a1a1a", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  Daily digest
                </span>
                {!session && publicDigestList.length > 1 && (
                  <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                    <button
                      disabled={publicDigestIdx >= publicDigestList.length - 1}
                      onClick={() => {
                        const next = publicDigestIdx + 1;
                        setPublicDigestIdx(next);
                        fetchDigest(publicDigestList[next].id);
                      }}
                      style={{ background: "none", border: "1px solid #ddd", cursor: publicDigestIdx >= publicDigestList.length - 1 ? "default" : "pointer", padding: "2px 8px", fontSize: "0.75rem", color: publicDigestIdx >= publicDigestList.length - 1 ? "#ccc" : "#555" }}
                    >←</button>
                    <span style={{ fontSize: "0.6rem", fontFamily: "var(--font-mono), monospace", color: "#999", whiteSpace: "nowrap" }}>
                      {new Date(publicDigestList[publicDigestIdx]?.date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </span>
                    <button
                      disabled={publicDigestIdx <= 0}
                      onClick={() => {
                        const prev = publicDigestIdx - 1;
                        setPublicDigestIdx(prev);
                        fetchDigest(publicDigestList[prev].id);
                      }}
                      style={{ background: "none", border: "1px solid #ddd", cursor: publicDigestIdx <= 0 ? "default" : "pointer", padding: "2px 8px", fontSize: "0.75rem", color: publicDigestIdx <= 0 ? "#ccc" : "#555" }}
                    >→</button>
                  </div>
                )}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                {generateError && (
                  <span style={{ fontSize: "0.6rem", color: "#ff007f", fontFamily: "var(--font-mono), monospace", maxWidth: "300px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={generateError}>
                    {generateError}
                  </span>
                )}
                {digest.id && session && (
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <button
                      onClick={async () => {
                        setStarred(!starred);
                        try { await fetch("/api/digest/star", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ digestId: digest.id }) }); } catch { setStarred(starred); }
                      }}
                      style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: "5px", color: starred ? "#f59e0b" : "#999", transition: "all 0.15s" }}
                    >
                      <Star size={14} className={starred ? "fill-current" : ""} />
                      <span style={{ fontSize: "0.65rem", fontWeight: 700, fontFamily: "var(--font-mono), monospace", letterSpacing: "1px" }}>{starred ? "Saved" : "Save"}</span>
                    </button>
                    <button
                      onClick={async () => {
                        setHiddenStash({ digest, papers });
                        setDigest(null);
                        setPapers([]);
                        setHidden(true);
                        try { await fetch("/api/digest/hide", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ digestId: digest.id }) }); } catch { setDigest(digest); setPapers(papers); setHidden(false); setHiddenStash(null); }
                      }}
                      title="Hide digest"
                      style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", color: "#bbb", transition: "color 0.15s", padding: "2px" }}
                      className="hover:text-[#ff007f]"
                    >
                      <Ban size={14} />
                    </button>
                  </div>
                )}
              </div>
            </div>

            <SweepTitle text={displayTheme} palettes={SOURCE_PALETTES} />

          </div>

          {/* Synthesis — gated experiences swap in here:
              ?papers=1 → paper-first (verdict + 3 cards you interrogate)
              ?brief=1  → dig-through (scroll-revealed verdict, inline cards, threads) */}
          {digest.synthesisContent && papersMode && digest.id ? (
            <PapersMode
              synthesis={digest.synthesisContent}
              theme={digest.theme ?? undefined}
              papers={papers}
              digestId={digest.id}
              seeds={digest.suggestedQuestions || []}
              isLoggedIn={!!session}
              onSignIn={onSignIn}
            />
          ) : digest.synthesisContent && briefMode && digest.id ? (
            <BriefDigest
              synthesis={digest.synthesisContent}
              theme={digest.theme ?? undefined}
              keyConcepts={digest.keyConcepts}
              papers={papers}
              digestId={digest.id}
              seeds={digest.suggestedQuestions || []}
              guestAnswers={digest.suggestedAnswers}
              isLoggedIn={!!session}
              onSignIn={onSignIn}
            />
          ) : digest.synthesisContent ? (
            <SynthesisBanner
              synthesis={digest.synthesisContent}
              theme={digest.theme ?? undefined}
              keyConcepts={digest.keyConcepts}
              suggestedQuestions={digest.suggestedQuestions}
              suggestedAnswers={digest.suggestedAnswers}
              digestId={digest.id}
              digestStarred={!!digest.starred}
              activeConcept={activeConcept}
              onConceptClick={(concept) => setActiveConcept(prev => prev === concept ? null : concept)}
              papers={papers}
              onSelectPaper={openSource}
              onRegenerate={() => handleGenerate(true)}
              generating={generating}
              onSignIn={onSignIn}
              hideHeader
              hideInteractionUI
            />
          ) : (
            <div className="flex flex-col items-center gap-3 py-16">
              <p className="text-[0.65rem] uppercase tracking-[2px] text-[#888]" style={{ fontFamily: "var(--font-mono), monospace" }}>
                {(session && generateError) || "No digest found for today"}
              </p>
              {session && (
                <button onClick={() => handleGenerate(true)} disabled={generating}
                  className="flex items-center gap-2 px-4 py-2 text-[0.7rem] uppercase tracking-[2px] bg-[#1a1a1a] text-white disabled:opacity-50"
                  style={{ border: "2px solid #1a1a1a", fontFamily: "var(--font-mono), monospace", boxShadow: "4px 4px 0px 0px rgba(0,0,0,1)" }}>
                  {generating ? <><Loader2 className="size-3 animate-spin" /> Generating...</> : <><RefreshCw className="size-3" /> Generate digest</>}
                </button>
              )}
            </div>
          )}

          {/* Dig deeper — below synthesis. Focus modes carry their own follow-up UI
              (brief threads / papers chat); keep brief's standalone threads only as a
              no-synthesis fallback, and show nothing extra for papers mode. */}
          {focusMode && digest.id ? (
            briefMode && !digest.synthesisContent && (
              <div style={{ marginTop: "40px" }}>
                <BriefThreads
                  digestId={digest.id}
                  seeds={digest.suggestedQuestions || []}
                  guestAnswers={digest.suggestedAnswers}
                  isLoggedIn={!!session}
                  onSignIn={onSignIn}
                />
              </div>
            )
          ) : (
            <div style={{ marginTop: "40px" }}>
              <DigDeeperRail
                questions={digest.suggestedQuestions || []}
                answers={digest.suggestedAnswers}
                history={digDeeperHistory}
                loading={digDeeperLoading}
                onAsk={handleDigDeeper}
                isLoggedIn={!!session}
                onSignIn={onSignIn}
              />
            </div>
          )}
        </main>

        {/* ── Right: paper rail (focus modes reveal cards inline instead) ── */}
        {papers.length > 0 && !focusMode && (
          <aside>
            <div style={{ fontFamily: "var(--font-display), sans-serif", fontSize: "0.95rem", fontWeight: 500, color: "#1a1a1a", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "16px" }}>
              Referenced sources
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {papers.map((paper, idx) => (
                <SourceCard key={paper.id} paper={paper} index={idx} loggedIn={!!session?.userId} initialBookmarked={bookmarkedIds.has(paper.id)} />
              ))}
            </div>
          </aside>
        )}
      </div>

      {/* ── Floating notepad — desktop only ── */}
      {digest.id && session && (
        <div className="hidden md:block">
          <NotepadFloat digestId={digest.id} />
        </div>
      )}
    </div>
  );
}
