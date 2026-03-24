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
        boxShadow: "4px 4px 0px 0px rgba(0,0,0,1)",
        background: "white",
        padding: "16px",
      }}
    >
      <div
        style={{
          fontSize: "0.6rem",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "2px",
          color: "#1a1a1a",
          fontFamily: "var(--font-mono), monospace",
          marginBottom: "10px",
          display: "flex",
          alignItems: "center",
          gap: "6px",
        }}
      >
        <Pin size={12} />
        Note
      </div>
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
          minHeight: "120px",
          background: "transparent",
          border: "none",
          outline: "none",
          resize: "vertical",
          fontSize: "0.85rem",
          lineHeight: 1.6,
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
const TAB_COLORS = [
  { dot: "#f9a8d4", bg: "linear-gradient(135deg, #fff 60%, #fce7f3)" },
  { dot: "#93c5fd", bg: "linear-gradient(135deg, #fff 60%, #dbeafe)" },
  { dot: "#a3a3a3", bg: "linear-gradient(135deg, #fff 60%, #f3f4f6)" },
];
const TAB_TAG_COLORS = [["#fce7f3", "#dcfce7"], ["#dbeafe", "#fef9c3"], ["#ede9fe", "#fee2e2"]];

function PaperSourceTab({ paper, index }: { paper: PaperItem; index: number }) {
  const colors = TAB_COLORS[index % TAB_COLORS.length];
  const tagColors = TAB_TAG_COLORS[index % TAB_TAG_COLORS.length];
  const url = (paper.sourceUrl || "").toLowerCase();
  const sourceType = url.includes("arxiv") ? "ARXIV" : paper.source === "rss" ? "NEWS" : "PAPER";

  return (
    <button
      onClick={() => paper.sourceUrl && window.open(paper.sourceUrl, "_blank", "noopener,noreferrer")}
      className="flex-shrink-0 group transition-all duration-150 hover:-translate-y-1 hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
      style={{
        border: "2px solid #1a1a1a",
        background: colors.bg,
        padding: "10px 14px",
        display: "flex",
        flexDirection: "column",
        gap: "5px",
        width: "100%",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
        <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: colors.dot, flexShrink: 0 }} />
        <span style={{ fontSize: "0.5rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "1px", fontFamily: "var(--font-mono), monospace", color: "#888" }}>
          {sourceType} {paper.year && `· ${paper.year}`}
        </span>
      </div>
      <span style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", lineHeight: 1.3, color: "#1a1a1a", textAlign: "left", fontFamily: "var(--font-display), sans-serif" }}
        className="group-hover:underline">
        {paper.title.length > 55 ? paper.title.slice(0, 52) + "..." : paper.title}
      </span>
      {paper.keywords.length > 0 && (
        <div style={{ display: "flex", gap: "3px", marginTop: "2px" }}>
          {paper.keywords.slice(0, 2).map((kw, ki) => (
            <span key={kw} style={{ padding: "1px 6px", fontSize: "0.5rem", fontWeight: 700, textTransform: "uppercase", fontFamily: "var(--font-mono), monospace", background: tagColors[ki % tagColors.length], border: "1px solid #1a1a1a" }}>
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
  onRegisterRefresh?: (fn: () => void) => void;
}

export function TodayPage({ session, onRegisterRefresh }: TodayPageProps) {
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
      {/* ── Header row: Today's Digest + Regen + Save ── */}
      <div
        className="h-14 flex items-center justify-between px-4 md:px-12 mx-auto w-full"
        style={{ borderBottom: "1.5px solid #e5e7eb", maxWidth: "1200px" }}
      >
        <span
          style={{
            fontSize: "0.7rem",
            color: "#555",
            fontFamily: "var(--font-mono), monospace",
            textTransform: "uppercase",
            letterSpacing: "2px",
            fontWeight: 700,
          }}
        >
          Today&apos;s Digest
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleGenerate(true)}
            disabled={generating}
            style={{
              background: "none",
              border: "1.5px solid #e5e7eb",
              cursor: "pointer",
              padding: "4px 10px",
              display: "flex",
              alignItems: "center",
              gap: "5px",
            }}
            className="hover:border-[#1a1a1a] transition-colors disabled:opacity-50"
          >
            {generating ? (
              <Loader2
                size={12}
                className="animate-spin"
                style={{ color: "#888" }}
              />
            ) : (
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#888"
                strokeWidth="2.5"
              >
                <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
                <path d="M21 3v5h-5" />
              </svg>
            )}
            <span
              style={{
                fontSize: "0.6rem",
                fontWeight: 600,
                fontFamily: "var(--font-mono), monospace",
                color: "#888",
              }}
            >
              Regen
            </span>
          </button>
          {digest.id && (
            <button
              onClick={async () => {
                setStarred(!starred);
                try {
                  await fetch("/api/digest/star", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ digestId: digest.id }),
                  });
                } catch {
                  setStarred(starred);
                }
              }}
              style={{
                background: "none",
                border: "1.5px solid #e5e7eb",
                cursor: "pointer",
                padding: "4px 10px",
                display: "flex",
                alignItems: "center",
                gap: "5px",
                color: starred ? "#f59e0b" : "#ccc",
                transition: "all 0.15s",
              }}
              className="hover:border-[#f59e0b]"
            >
              <Star
                size={14}
                className={starred ? "fill-current" : ""}
              />
              <span
                style={{
                  fontSize: "0.6rem",
                  fontWeight: 600,
                  fontFamily: "var(--font-mono), monospace",
                  color: starred ? "#f59e0b" : "#aaa",
                }}
              >
                {starred ? "Saved" : "Save Digest"}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* ── Main area: digest left, sources+notes right ── */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr_380px] flex-1 overflow-hidden mx-auto w-full" style={{ maxWidth: "1200px" }}>
        {/* Left: digest content */}
        <div className="overflow-y-auto px-4 md:px-12 py-6 md:py-10">
          <div style={{ maxWidth: "640px", margin: "0 auto" }}>
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
        </div>

        {/* Right: sources + notes (desktop only) */}
        <div className="hidden md:block overflow-y-auto pt-4">
          <div style={{ padding: "0 16px 10px" }}>
            <span style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "3px", fontFamily: "var(--font-mono), monospace", color: "#555" }}>Referenced Sources</span>
          </div>
          <div className="px-3 space-y-2">
            {allPapers.map((paper, idx) => (
              <PaperSourceTab key={paper.id} paper={paper} index={idx} />
            ))}
            {digest.id && session && (
              <NoteCard digestId={digest.id} />
            )}
          </div>
        </div>
      </div>

      {/* ── Mobile: sources + notes below synthesis ── */}
      <div className="block md:hidden px-4 pb-20 space-y-2">
        <span style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "3px", fontFamily: "var(--font-mono), monospace", color: "#555" }}>Sources</span>
        {allPapers.map((paper, idx) => (
          <PaperCard
            key={paper.id}
            paper={paper}
            index={idx}
            compact
            highlighted={isPaperHighlighted(paper)}
            conceptDefs={conceptDefs}
            onSelect={openSource}
            onStar={(id) => handleFeedback(id, "star")}
            onDislike={(id) => handleFeedback(id, "dislike")}
          />
        ))}
        {/* Mobile note area */}
        {digest?.id && session && (
          <div
            style={{
              border: "2px dashed #ccc",
              padding: "16px",
              marginTop: "8px",
            }}
          >
            <div
              style={{
                fontSize: "0.65rem",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "2px",
                color: "#555",
                fontFamily: "var(--font-mono), monospace",
                marginBottom: "10px",
              }}
            >
              Notes & Reflections
            </div>
            <MobileNotesInput digestId={digest.id} />
          </div>
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
