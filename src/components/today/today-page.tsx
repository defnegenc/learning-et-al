"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Loader2, RefreshCw, Star, Pin } from "lucide-react";
import { PaperCard, type PaperItem } from "./paper-card";
import { SynthesisBanner } from "./synthesis-banner";
import React from "react";

/* ── Floating Note Card ── */
function NoteCard({ digestId }: { digestId: string }) {
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
    <div
      className="transition-transform duration-200 hover:rotate-[1.5deg]"
      style={{
        width: "100%",
        border: "2px solid #1a1a1a",
        boxShadow: "6px 6px 0px 0px rgba(0,0,0,1)",
        background: "#fafafa",
        padding: "20px",
        minHeight: "220px",
      }}
    >
      <textarea
        value={notes}
        onChange={(e) => {
          setNotes(e.target.value);
          setSaved(false);
        }}
        onBlur={handleBlur}
        placeholder="Jot down your thoughts..."
        style={{
          width: "100%",
          minHeight: "140px",
          background: "transparent",
          border: "none",
          outline: "none",
          resize: "vertical",
          fontSize: "0.95rem",
          lineHeight: 1.7,
          color: "#333",
          fontFamily: "'Apercu Pro', var(--font-inter), sans-serif",
        }}
      />
      {saved && (
        <span
          style={{
            fontSize: "0.6rem",
            color: "#38b000",
            fontFamily: "var(--font-mono), monospace",
          }}
        >
          Saved
        </span>
      )}
    </div>
  );
}

/* ── Paper Source Tab ── */
const TAB_DOT_COLORS = ["#f9a8d4", "#93c5fd", "#a3a3a3"];
const TAB_TAG_COLORS = [["#fce7f3", "#dcfce7"], ["#dbeafe", "#fef9c3"], ["#ede9fe", "#fee2e2"]];

function getJournalName(sourceUrl: string | null): string | null {
  if (!sourceUrl) return null;
  try {
    const hostname = new URL(sourceUrl).hostname.replace("www.", "");
    const domainMap: Record<string, string> = {
      "arxiv.org": "arXiv",
      "nature.com": "Nature",
      "sciencedirect.com": "ScienceDirect",
      "springer.com": "Springer",
      "ieee.org": "IEEE",
      "acm.org": "ACM",
      "pnas.org": "PNAS",
      "frontiersin.org": "Frontiers",
      "mdpi.com": "MDPI",
      "wiley.com": "Wiley",
      "tandfonline.com": "Taylor & Francis",
      "sagepub.com": "SAGE",
      "cambridge.org": "Cambridge UP",
      "oup.com": "Oxford UP",
      "plos.org": "PLOS",
      "biorxiv.org": "bioRxiv",
      "medrxiv.org": "medRxiv",
      "ssrn.com": "SSRN",
      "researchgate.net": "ResearchGate",
      "builtin.com": "Built In",
      "techcrunch.com": "TechCrunch",
      "wired.com": "WIRED",
      "theverge.com": "The Verge",
      "mckinsey.com": "McKinsey",
    };
    for (const [domain, name] of Object.entries(domainMap)) {
      if (hostname.includes(domain)) return name;
    }
    // DOI prefix → publisher
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
      return null; // Unknown DOI — don't show "Doi"
    }
    // Extract readable name from hostname
    const parts = hostname.split(".");
    const name = parts.length > 2 ? parts.slice(0, -2).join(".") : parts[0];
    if (name.length < 3) return null; // skip very short names
    return name.charAt(0).toUpperCase() + name.slice(1);
  } catch { return null; }
}

function PaperSourceTab({ paper, index }: { paper: PaperItem; index: number }) {
  const dot = TAB_DOT_COLORS[index % TAB_DOT_COLORS.length];
  const tagColors = TAB_TAG_COLORS[index % TAB_TAG_COLORS.length];
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
        background: "white",
        padding: "16px 18px",
        display: "flex",
        flexDirection: "column",
        gap: "10px",
        width: "100%",
        textAlign: "left",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: dot, flexShrink: 0 }} />
          <span style={{ fontSize: "0.55rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "1px", fontFamily: "var(--font-mono), monospace", color: "#999" }}>
            {sourceType} · {paper.year || "2026"}
          </span>
        </div>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#bbb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="group-hover:stroke-[#1a1a1a] transition-colors"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
      </div>
      <span style={{ fontSize: "0.85rem", fontWeight: 700, textTransform: "uppercase", lineHeight: 1.3, color: "#1a1a1a", fontFamily: "var(--font-display), sans-serif" }}
        className="group-hover:underline">
        {paper.title}
      </span>
      {(paper.authors.length > 0 || journalName) && (
        <span style={{ fontSize: "0.65rem", color: "#888", fontStyle: "italic", lineHeight: 1.4 }}>
          {paper.authors.length > 0 && (
            paper.authors.length <= 2
              ? paper.authors.join(" & ")
              : `${paper.authors[0]}${paper.authors[1] ? `, ${paper.authors[1]}` : ""} et al.`
          )}
          {paper.authors.length > 0 && journalName ? " — " : ""}
          {journalName && <em>{journalName}</em>}
        </span>
      )}
      {paper.summary && (
        <p style={{ fontSize: "0.75rem", color: "#555", lineHeight: 1.5, borderLeft: "3px solid #e5e7eb", paddingLeft: "10px", margin: 0 }}>
          {paper.summary.length > 160 ? paper.summary.slice(0, 157) + "..." : paper.summary}
        </p>
      )}
      {paper.keywords.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
          {paper.keywords.slice(0, 2).map((kw, ki) => (
            <span key={kw} style={{ padding: "3px 10px", fontSize: "0.6rem", fontWeight: 700, textTransform: "uppercase", fontFamily: "var(--font-mono), monospace", background: tagColors[ki % tagColors.length], border: "1.5px solid #1a1a1a" }}>
              {kw}
            </span>
          ))}
        </div>
      )}
    </button>
  );
}

interface Digest {
  id: string;
  theme: string | null;
  synthesisContent: string | null;
  keyConcepts: string[];
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
  session: Session;
  isAdmin?: boolean;
  onRegisterRefresh?: (fn: () => void) => void;
}

export function TodayPage({ session, isAdmin = false, onRegisterRefresh }: TodayPageProps) {
  const [digest, setDigest] = useState<Digest | null>(null);
  const [papers, setPapers] = useState<PaperItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [activeConcept, setActiveConcept] = useState<string | null>(null);
  const [starred, setStarred] = useState(false);
  const handleGenerateRef = useRef<((force?: boolean) => void) | null>(null);

  const fetchDigest = useCallback(async () => {
    try {
      const res = await fetch("/api/digest");
      if (!res.ok) return;
      const data = await res.json();
      setDigest(data.digest);
      setPapers(data.papers ?? []);
      if (data.digest) setStarred(!!data.digest.starred);
    } catch (err) {
      console.error("Failed to fetch digest:", err);
    }
  }, []);

  useEffect(() => {
    fetchDigest().finally(() => setLoading(false));
  }, [fetchDigest]);

  useEffect(() => {
    handleGenerateRef.current = handleGenerate;
  });

  useEffect(() => {
    onRegisterRefresh?.(() => handleGenerateRef.current?.(true));
  }, [onRegisterRefresh]);

  const handleGenerate = async (force = false) => {
    setGenerating(true);
    setGenerateError(null);
    try {
      const res = await fetch("/api/digest/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: session.apiKey,
          provider: session.provider,
          model: session.model,
          baseUrl: session.baseUrl,
          force,
        }),
      });
      if (res.ok) {
        await fetchDigest();
      } else {
        const data = await res.json().catch(() => ({}));
        setGenerateError(
          data.error ||
            `Generation failed (${res.status}). Check your API key in settings.`
        );
      }
    } catch (err) {
      setGenerateError("Network error — couldn't reach the server.");
      console.error("Failed to generate digest:", err);
    } finally {
      setGenerating(false);
    }
  };

  const handleFeedback = async (paperId: string, type: "star" | "dislike") => {
    try {
      await fetch(`/api/papers/${paperId}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      });
    } catch (err) {
      console.error("Failed to submit feedback:", err);
    }
  };

  const isPaperHighlighted = (paper: PaperItem) => {
    if (!activeConcept) return false;
    const conceptLower = activeConcept.toLowerCase();
    return (
      paper.keywords.some((k) => k.toLowerCase().includes(conceptLower)) ||
      paper.title.toLowerCase().includes(conceptLower) ||
      (paper.summary ?? "").toLowerCase().includes(conceptLower)
    );
  };

  const openSource = (p: PaperItem) =>
    p.sourceUrl &&
    window.open(p.sourceUrl, "_blank", "noopener,noreferrer");

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-6 animate-spin text-[#666]" />
      </div>
    );
  }

  if (!digest) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 px-4">
        <p
          className="text-[0.75rem] uppercase tracking-[2px] text-[#666]"
          style={{ fontFamily: "var(--font-mono), monospace" }}
        >
          No digest found for today
        </p>
        {generateError && (
          <p className="text-[0.75rem] text-[#ff007f] max-w-md text-center">
            {generateError}
          </p>
        )}
        <button
          onClick={() => handleGenerate(true)}
          disabled={generating}
          className="border border-[#1a1a1a] px-4 py-2 text-[0.65rem] uppercase tracking-[2px] hover:bg-[#1a1a1a] hover:text-[#e8e8e8] transition-colors disabled:opacity-50"
          style={{
            borderWidth: "1.5px",
            fontFamily: "var(--font-mono), monospace",
          }}
        >
          {generating ? (
            <span className="flex items-center gap-2">
              <Loader2 className="size-3 animate-spin" />
              GENERATING (THIS MAY TAKE A MINUTE)...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <RefreshCw className="size-3" />
              {generateError ? "Try again" : "Generate today's digest"}
            </span>
          )}
        </button>
      </div>
    );
  }

  const allPapers = papers;

  // Build concept definition map from digest keyConcepts ("term: definition" format)
  const conceptDefs: Record<string, string> = {};
  for (const concept of digest.keyConcepts) {
    const colonIdx = concept.indexOf(": ");
    if (colonIdx > 0) {
      const term = concept.slice(0, colonIdx).toLowerCase().trim();
      const def = concept.slice(colonIdx + 2).trim();
      conceptDefs[term] = def;
    }
  }

  return (
    <div className="flex flex-col min-h-[calc(100vh-3.5rem)]">
      {/* ── Main area: digest left, sources+notes right ── */}
      <div className="grid grid-cols-1 md:grid-cols-[5fr_minmax(340px,2fr)] flex-1 overflow-hidden w-full">
        {/* Left: digest content */}
        <div className="overflow-y-auto px-4 md:px-10 pt-6 md:pt-8 pb-6 md:pb-8">
          {/* Today's Digest label + Regen + Save */}
          <div className="flex items-center gap-3 mb-6">
            <span style={{ fontSize: "0.7rem", color: "#555", fontFamily: "var(--font-mono), monospace", textTransform: "uppercase", letterSpacing: "2px", fontWeight: 700 }}>
              Today&apos;s Digest
            </span>
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
              <span style={{ fontSize: "0.6rem", color: "#ff007f", fontFamily: "var(--font-mono), monospace", maxWidth: "400px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={generateError}>
                {generateError}
              </span>
            )}
            {digest.id && (
              <button
                onClick={async () => {
                  setStarred(!starred);
                  try { await fetch("/api/digest/star", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ digestId: digest.id }) }); } catch { setStarred(starred); }
                }}
                style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: "5px", color: starred ? "#f59e0b" : "#aaa", transition: "all 0.15s", marginLeft: "auto" }}
              >
                <Star size={16} className={starred ? "fill-current" : ""} />
                <span style={{ fontSize: "0.75rem", fontWeight: 700, fontFamily: "var(--font-mono), monospace", letterSpacing: "1px" }}>{starred ? "Saved" : "Save"}</span>
              </button>
            )}
          </div>
            {digest.synthesisContent ? (
              <SynthesisBanner
                synthesis={digest.synthesisContent}
                theme={digest.theme ?? undefined}
                keyConcepts={digest.keyConcepts}
                digestId={digest.id}
                digestStarred={!!digest.starred}
                activeConcept={activeConcept}
                onConceptClick={(concept) => setActiveConcept((prev) => prev === concept ? null : concept)}
                papers={allPapers}
                onSelectPaper={openSource}
                onRegenerate={() => handleGenerate(true)}
                generating={generating}
                session={session}
              />
            ) : (
              <div className="flex flex-col items-center gap-3 py-16">
                <p className="text-[0.65rem] uppercase tracking-[2px] text-[#888]" style={{ fontFamily: "var(--font-mono), monospace" }}>
                  {generateError || "No digest found for today"}
                </p>
                <button onClick={() => handleGenerate(true)} disabled={generating}
                  className="flex items-center gap-2 px-4 py-2 text-[0.7rem] uppercase tracking-[2px] bg-[#1a1a1a] text-white disabled:opacity-50"
                  style={{ border: "2px solid #1a1a1a", fontFamily: "var(--font-mono), monospace", boxShadow: "4px 4px 0px 0px rgba(0,0,0,1)" }}>
                  {generating ? <><Loader2 className="size-3 animate-spin" /> Generating...</> : <><RefreshCw className="size-3" /> Generate digest</>}
                </button>
              </div>
            )}
        </div>

        {/* Right: sources + notes (desktop only) */}
        <div className="hidden md:block overflow-y-auto pt-8 pb-8 px-4">
          <div style={{ marginBottom: "20px" }}>
            <span style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "2px", fontFamily: "var(--font-mono), monospace", color: "#555" }}>Referenced Sources</span>
          </div>
          <div className="space-y-3">
            {allPapers.map((paper, idx) => (
              <PaperSourceTab key={paper.id} paper={paper} index={idx} />
            ))}
          </div>
          {digest.id && session && (
            <div style={{ marginTop: "28px" }}>
              <div style={{ marginBottom: "12px" }}>
                <span style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "2px", fontFamily: "var(--font-mono), monospace", color: "#555" }}>Notepad</span>
              </div>
              <NoteCard digestId={digest.id} />
            </div>
          )}
        </div>
      </div>

      {/* ── Mobile: sources + notes below synthesis ── */}
      <div className="block md:hidden px-4 pb-20 space-y-3">
        <span style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "2px", fontFamily: "var(--font-mono), monospace", color: "#555" }}>Referenced Sources</span>
        {allPapers.map((paper, idx) => (
          <PaperSourceTab key={paper.id} paper={paper} index={idx} />
        ))}
        {digest?.id && session && (
          <>
            <div style={{ marginTop: "8px" }}>
              <span style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "2px", fontFamily: "var(--font-mono), monospace", color: "#555" }}>Notepad</span>
            </div>
            <NoteCard digestId={digest.id} />
          </>
        )}
      </div>
    </div>
  );
}

/* ── Mobile Notes (kept simple) ── */
function MobileNotesInput({ digestId }: { digestId: string }) {
  const [notes, setNotes] = useState("");
  const [saved, setSaved] = useState(false);
  const storageKey = `digest_notes_${digestId}`;
  useEffect(() => {
    const s = localStorage.getItem(storageKey);
    if (s) setNotes(s);
  }, [storageKey]);
  return (
    <div style={{ position: "relative" }}>
      <textarea
        value={notes}
        onChange={(e) => {
          setNotes(e.target.value);
          setSaved(false);
        }}
        onBlur={() => {
          if (notes.trim()) {
            localStorage.setItem(storageKey, notes);
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
          }
        }}
        placeholder="Jot down your thoughts..."
        style={{
          width: "100%",
          minHeight: "80px",
          background: "transparent",
          border: "none",
          padding: "0",
          fontSize: "0.8rem",
          lineHeight: 1.7,
          outline: "none",
          resize: "vertical",
          color: "#333",
          fontFamily: "'Apercu Pro', var(--font-inter), sans-serif",
        }}
      />
      {saved && (
        <span
          style={{
            position: "absolute",
            bottom: "8px",
            right: "10px",
            fontSize: "0.6rem",
            color: "#38b000",
            fontFamily: "var(--font-mono), monospace",
          }}
        >
          Saved
        </span>
      )}
    </div>
  );
}
