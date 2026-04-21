"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Loader2, RefreshCw, Star } from "lucide-react";
import type { PaperItem } from "./paper-card";
import { SynthesisBanner, DigestFeedback, GuestDigDeeper, AnswerBlock } from "./synthesis-banner";
import React from "react";

/* ── Types ── */
type ConvEntry = { q: string; a: string; paperLinks?: { title: string; sourceUrl: string | null }[] };

/* ── dispersedWash — 4-corner radial blob background ── */
const SOURCE_PALETTES: [string, string][] = [
  ["#C8F0D8", "#F0F5A8"],
  ["#FFD6E0", "#FFE89A"],
  ["#D0E3F7", "#E2D6F7"],
  ["#FFE89A", "#FFD6E0"],
];

function dispersedWash(palette: [string, string], intensity = 0.5): React.CSSProperties {
  const a = Math.min(255, Math.round(intensity * 255)).toString(16).padStart(2, "0");
  const b = Math.min(255, Math.round(intensity * 0.6 * 255)).toString(16).padStart(2, "0");
  const [h1, h2] = palette;
  return {
    background: `
      radial-gradient(circle 170px at 2% 2%, ${h1}${a} 0%, transparent 62%),
      radial-gradient(circle 160px at 98% 6%, ${h2}${a} 0%, transparent 62%),
      radial-gradient(circle 150px at 96% 100%, ${h1}${b} 0%, transparent 62%),
      radial-gradient(circle 170px at 2% 98%, ${h2}${b} 0%, transparent 62%),
      #fff`,
    backgroundBlendMode: "multiply, multiply, multiply, multiply, normal",
  } as React.CSSProperties;
}

/* ── Journal name helper ── */
function getJournalName(sourceUrl: string | null): string | null {
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
    return name.charAt(0).toUpperCase() + name.slice(1);
  } catch { return null; }
}

/* ── Source Card (dispersedWash) ── */
function SourceCard({ paper, index }: { paper: PaperItem; index: number }) {
  const palette = SOURCE_PALETTES[index % SOURCE_PALETTES.length];
  const url = (paper.sourceUrl || "").toLowerCase();
  const sourceType = url.includes("arxiv") ? "ARXIV" : paper.source === "rss" ? "NEWS" : "PAPER";
  const journalName = getJournalName(paper.sourceUrl);

  return (
    <button
      onClick={() => paper.sourceUrl && window.open(paper.sourceUrl, "_blank", "noopener,noreferrer")}
      className="group transition-all duration-150 hover:-translate-y-0.5 hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]"
      style={{
        border: "2px solid #1a1a1a",
        boxShadow: "6px 6px 0px 0px rgba(0,0,0,1)",
        padding: "18px 20px",
        display: "flex",
        flexDirection: "column",
        gap: "10px",
        width: "100%",
        textAlign: "left",
        position: "relative",
        overflow: "hidden",
        ...dispersedWash(palette),
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: "0.55rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "1.5px", fontFamily: "var(--font-mono), monospace", color: "#888" }}>
          {sourceType} · {paper.year || "2025"}
        </span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#bbb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="group-hover:stroke-[#1a1a1a] transition-colors"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
      </div>
      <span
        className="group-hover:underline"
        style={{ fontSize: "0.85rem", fontWeight: 700, textTransform: "uppercase", lineHeight: 1.3, color: "#1a1a1a", fontFamily: "var(--font-display), sans-serif" }}
      >
        {paper.title}
      </span>
      {(paper.authors.length > 0 || journalName) && (
        <span style={{ fontSize: "0.65rem", color: "#666", fontStyle: "italic", lineHeight: 1.4 }}>
          {paper.authors.length > 0 && (
            paper.authors.length <= 2 ? paper.authors.join(" & ") : `${paper.authors[0]}${paper.authors[1] ? `, ${paper.authors[1]}` : ""} et al.`
          )}
          {paper.authors.length > 0 && journalName ? " — " : ""}
          {journalName && <em>{journalName}</em>}
        </span>
      )}
      {paper.summary && (
        <p style={{ fontSize: "0.75rem", color: "#555", lineHeight: 1.5, borderLeft: "3px solid rgba(0,0,0,0.12)", paddingLeft: "10px", margin: 0 }}>
          {paper.summary.length > 160 ? paper.summary.slice(0, 157) + "..." : paper.summary}
        </p>
      )}
      {paper.keywords.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
          {paper.keywords.slice(0, 2).map((kw) => (
            <span key={kw} style={{ padding: "3px 10px", fontSize: "0.6rem", fontWeight: 700, textTransform: "uppercase", fontFamily: "var(--font-mono), monospace", background: "rgba(0,0,0,0.06)", border: "1.5px solid rgba(0,0,0,0.18)" }}>
              {kw}
            </span>
          ))}
        </div>
      )}
    </button>
  );
}

/* ── Dig Deeper Rail (right column or mobile inline) ── */
const DIG_DOT_COLORS = ["#F7D9E8", "#D0E3F7", "#C8F0D8"];

function DigDeeperRail({
  questions,
  answers,
  history,
  loading,
  showQuestions,
  onAsk,
  session,
  onSignIn,
}: {
  questions: string[];
  answers?: string[];
  history: ConvEntry[];
  loading: boolean;
  showQuestions: boolean;
  onAsk: (q: string) => void;
  session?: { apiKey: string; provider: string; model: string; baseUrl: string };
  onSignIn?: () => void;
}) {
  const [customQ, setCustomQ] = useState("");

  if (!session) {
    return (
      <>
        <div style={{ fontFamily: "var(--font-mono), monospace", fontSize: "0.7rem", letterSpacing: "2.5px", fontWeight: 700, color: "#1a1a1a", textTransform: "uppercase", marginBottom: "16px" }}>
          Dig deeper
        </div>
        <GuestDigDeeper questions={questions} answers={answers || []} onSignIn={onSignIn} />
      </>
    );
  }

  return (
    <div>
      <div style={{ fontFamily: "var(--font-mono), monospace", fontSize: "0.7rem", letterSpacing: "2.5px", fontWeight: 700, color: "#1a1a1a", textTransform: "uppercase", marginBottom: "16px" }}>
        Dig deeper
      </div>

      {/* Suggested question rows */}
      {showQuestions && !loading && questions.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", marginBottom: "4px" }}>
          {questions.slice(0, 3).map((q, i) => (
            <button
              key={i}
              onClick={() => onAsk(q)}
              style={{
                textAlign: "left", cursor: "pointer", background: "transparent", border: "none",
                padding: "14px 4px", width: "100%", display: "flex", gap: "12px", alignItems: "flex-start",
                borderBottom: "1px solid #1a1a1a", transition: "padding-left 120ms",
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.paddingLeft = "8px"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.paddingLeft = "4px"; }}
            >
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: DIG_DOT_COLORS[i % 3], border: "1px solid rgba(26,26,26,0.3)", flexShrink: 0, marginTop: 4 }} />
              <div style={{ fontFamily: "var(--font-display), sans-serif", fontSize: "0.875rem", fontWeight: 500, letterSpacing: -0.2, lineHeight: 1.4, color: "#1a1a1a", flex: 1 }}>
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
          {history.map((entry, i) => (
            <div key={i} style={{ marginBottom: "12px" }}>
              <p style={{ fontSize: "0.7rem", fontWeight: 700, color: "#1a1a1a", marginBottom: "6px", fontFamily: "var(--font-mono), monospace" }}>
                {entry.q}
              </p>
              <div style={{ fontSize: "0.85rem", lineHeight: 1.65, color: "#444" }}>
                <AnswerBlock text={entry.a} paperLinks={entry.paperLinks} />
              </div>
              {i < history.length - 1 && <div style={{ borderBottom: "1px solid #e5e7eb", marginTop: "12px" }} />}
            </div>
          ))}
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

/* ── Interfaces ── */
interface Digest {
  id: string;
  theme: string | null;
  synthesisContent: string | null;
  keyConcepts: string[];
  suggestedQuestions?: string[];
  suggestedAnswers?: string[];
  starred: boolean | null;
  date: string;
}

interface Session {
  userId: string | null;
  apiKey: string;
  provider: string;
  model: string;
  baseUrl: string;
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
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [activeConcept, setActiveConcept] = useState<string | null>(null);
  const [starred, setStarred] = useState(false);
  const handleGenerateRef = useRef<((force?: boolean) => void) | null>(null);

  /* ── Dig-deeper state (lifted from SynthesisBanner) ── */
  const [digDeeperHistory, setDigDeeperHistory] = useState<ConvEntry[]>([]);
  const [digDeeperLoading, setDigDeeperLoading] = useState(false);
  const [showQuestions, setShowQuestions] = useState(true);

  const historyKey = digest ? `digest_chat_${digest.id}` : "";
  useEffect(() => {
    if (!historyKey) return;
    const saved = localStorage.getItem(historyKey);
    if (saved) {
      try { setDigDeeperHistory(JSON.parse(saved)); setShowQuestions(false); } catch { /* ignore */ }
    } else {
      setDigDeeperHistory([]);
      setShowQuestions(true);
    }
  }, [historyKey]);

  const fetchDigest = useCallback(async () => {
    try {
      const endpoint = session ? "/api/digest" : "/api/public/digest";
      const res = await fetch(endpoint);
      if (!res.ok) return;
      const data = await res.json();
      setDigest(data.digest);
      setPapers(data.papers ?? []);
      if (data.digest) setStarred(!!data.digest.starred);
    } catch (err) {
      console.error("Failed to fetch digest:", err);
    }
  }, [session]);

  useEffect(() => {
    fetchDigest().finally(() => setLoading(false));
  }, [fetchDigest]);

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
        body: JSON.stringify({ apiKey: session.apiKey, provider: session.provider, model: session.model, baseUrl: session.baseUrl, force }),
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

  const handleDigDeeper = async (question: string) => {
    if (!session || digDeeperLoading) return;
    setDigDeeperLoading(true);
    setShowQuestions(false);
    try {
      const res = await fetch("/api/digest/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: `Keep your answer to 3-4 sentences max. Be specific and concrete.\n\n${question}`,
          digestId: digest?.id || papers[0]?.id,
          apiKey: session.apiKey,
          provider: session.provider,
          model: session.model,
          baseUrl: session.baseUrl,
        }),
      });
      const data = await res.json();
      const answer = data.answer || data.error || "Couldn't get an answer.";
      const newHistory = [...digDeeperHistory, { q: question, a: answer, paperLinks: data.paperLinks }];
      setDigDeeperHistory(newHistory);
      if (historyKey) localStorage.setItem(historyKey, JSON.stringify(newHistory));
    } catch {
      const newHistory = [...digDeeperHistory, { q: question, a: "Something went wrong. Try again." }];
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
        <h1 style={{ fontSize: "2.5rem", fontWeight: 700, fontFamily: "var(--font-display), sans-serif", letterSpacing: "-0.03em", textAlign: "center" }}>
          Today&apos;s digest is brewing
        </h1>
        <p style={{ fontSize: "1rem", color: "#999", textAlign: "center", maxWidth: "440px" }}>
          Check back soon — a fresh research digest is generated every day.
        </p>
        {session && generateError && (
          <p className="text-[0.75rem] text-[#ff007f] max-w-md text-center">{generateError}</p>
        )}
        {session && (
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

  /* ── Main render — Marginalia layout ── */
  return (
    <div style={{ maxWidth: 1200, margin: "0 auto" }} className="px-4 md:px-7 pt-10 md:pt-12 pb-20">

      {/* ── Two-column grid: main | right rail ── */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr_300px] items-start" style={{ gap: "56px" }}>

        {/* ── Main column ── */}
        <main>
          {/* DigestTitleBlock */}
          <div style={{ marginBottom: "32px" }}>
            {/* Top bar: label + actions */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
              <span style={{ fontFamily: "var(--font-mono), monospace", fontSize: "0.7rem", letterSpacing: "2.5px", fontWeight: 700, color: "#1a1a1a", textTransform: "uppercase" }}>
                Daily digest
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                {isAdmin && (
                  <button
                    onClick={() => handleGenerate(true)}
                    disabled={generating}
                    style={{ background: "none", border: "1.5px solid #e5e7eb", cursor: "pointer", padding: "4px 10px", display: "flex", alignItems: "center", gap: "5px" }}
                    className="hover:border-[#1a1a1a] transition-colors disabled:opacity-50"
                  >
                    {generating ? <Loader2 size={12} className="animate-spin" style={{ color: "#888" }} /> : <RefreshCw size={12} style={{ color: "#888" }} />}
                    <span style={{ fontSize: "0.6rem", fontWeight: 600, fontFamily: "var(--font-mono), monospace", color: "#888" }}>Regenerate</span>
                  </button>
                )}
                {generateError && (
                  <span style={{ fontSize: "0.6rem", color: "#ff007f", fontFamily: "var(--font-mono), monospace", maxWidth: "300px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={generateError}>
                    {generateError}
                  </span>
                )}
                {digest.id && session && (
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
                )}
              </div>
            </div>

            {/* Big title */}
            <h1
              style={{
                fontFamily: "var(--font-display), sans-serif",
                fontSize: "clamp(2.75rem, 5vw, 4rem)",
                lineHeight: 1.02,
                fontWeight: 700,
                letterSpacing: "-0.055em",
                color: "#1a1a1a",
                margin: "0 0 18px",
              }}
            >
              {displayTheme}
            </h1>

            {/* Meta row + thumbs */}
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: "24px" }}>
              <div style={{ display: "flex", gap: "32px" }}>
                <div>
                  <div style={{ fontFamily: "var(--font-mono), monospace", fontSize: "0.55rem", letterSpacing: "2px", color: "#999", textTransform: "uppercase", fontWeight: 700, marginBottom: "3px" }}>Published</div>
                  <div style={{ fontFamily: "var(--font-display), sans-serif", fontSize: "0.8rem", fontWeight: 600, color: "#1a1a1a" }}>{today.replace(/^[A-Za-z]+, /, "")}</div>
                </div>
                <div>
                  <div style={{ fontFamily: "var(--font-mono), monospace", fontSize: "0.55rem", letterSpacing: "2px", color: "#999", textTransform: "uppercase", fontWeight: 700, marginBottom: "3px" }}>Sources</div>
                  <div style={{ fontFamily: "var(--font-display), sans-serif", fontSize: "0.8rem", fontWeight: 600, color: "#1a1a1a" }}>{papers.length} papers</div>
                </div>
              </div>
              {digest.id && session && (
                <DigestFeedback digestId={digest.id} onRegenerate={() => handleGenerate(true)} generating={generating} />
              )}
            </div>
          </div>

          {/* Synthesis body + key concepts */}
          {digest.synthesisContent ? (
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
              session={session}
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
        </main>

        {/* ── Right rail (desktop only) ── */}
        <aside className="hidden md:block">
          <div style={{ position: "sticky", top: 24 }}>
            <DigDeeperRail
              questions={digest.suggestedQuestions || []}
              answers={digest.suggestedAnswers}
              history={digDeeperHistory}
              loading={digDeeperLoading}
              showQuestions={showQuestions}
              onAsk={handleDigDeeper}
              session={session}
              onSignIn={onSignIn}
            />
          </div>
        </aside>
      </div>

      {/* ── Mobile: dig deeper below synthesis ── */}
      <div className="block md:hidden mt-8">
        <DigDeeperRail
          questions={digest.suggestedQuestions || []}
          answers={digest.suggestedAnswers}
          history={digDeeperHistory}
          loading={digDeeperLoading}
          showQuestions={showQuestions}
          onAsk={handleDigDeeper}
          session={session}
          onSignIn={onSignIn}
        />
      </div>

      {/* ── Bottom: source cards grid ── */}
      {papers.length > 0 && (
        <div style={{ marginTop: "56px", paddingTop: "28px", borderTop: "2px solid #1a1a1a" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: "12px", marginBottom: "16px" }}>
            <span style={{ fontFamily: "var(--font-mono), monospace", fontSize: "0.7rem", letterSpacing: "2.5px", fontWeight: 700, color: "#1a1a1a", textTransform: "uppercase" }}>
              Referenced sources
            </span>
            <span style={{ fontFamily: "var(--font-mono), monospace", fontSize: "0.6rem", letterSpacing: "1.5px", color: "#888" }}>
              {String(papers.length).padStart(2, "0")}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3" style={{ gap: "16px" }}>
            {papers.map((paper, idx) => (
              <SourceCard key={paper.id} paper={paper} index={idx} />
            ))}
          </div>
        </div>
      )}

      {/* ── Floating notepad ── */}
      {digest.id && session && <NotepadFloat digestId={digest.id} />}
    </div>
  );
}
