"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { PaperCard, type PaperItem } from "./paper-card";
import { SynthesisBanner } from "./synthesis-banner";

function NotesInput({ digestId }: { digestId: string }) {
  const [notes, setNotes] = useState("");
  const storageKey = `digest_notes_${digestId}`;
  useEffect(() => { const s = localStorage.getItem(storageKey); if (s) setNotes(s); }, [storageKey]);
  return (
    <textarea
      value={notes}
      onChange={(e) => setNotes(e.target.value)}
      onBlur={() => { if (notes.trim()) localStorage.setItem(storageKey, notes); }}
      placeholder="Jot down your thoughts..."
      style={{ width: "100%", minHeight: "80px", background: "white", border: "2px solid #1a1a1a", padding: "10px", fontSize: "0.8rem", lineHeight: 1.5, outline: "none", resize: "vertical", boxShadow: "3px 3px 0px 0px rgba(0,0,0,1)" }}
    />
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
  const handleGenerateRef = useRef<((force?: boolean) => void) | null>(null);

  const fetchDigest = useCallback(async () => {
    try {
      const res = await fetch("/api/digest");
      if (!res.ok) return;
      const data = await res.json();
      setDigest(data.digest);
      setPapers(data.papers ?? []);
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
        setGenerateError(data.error || `Generation failed (${res.status}). Check your API key in settings.`);
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
          style={{ fontFamily: 'var(--font-mono), monospace' }}
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
          style={{ borderWidth: "1.5px", fontFamily: 'var(--font-mono), monospace' }}
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

  const openSource = (p: PaperItem) => p.sourceUrl && window.open(p.sourceUrl, "_blank", "noopener,noreferrer");

  return (
    <div className="flex flex-col md:flex-row md:h-[calc(100vh-3.5rem)]">
      {/* ── Left: Synthesis (digest content) ── */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 md:p-10 md:max-w-3xl">
          {digest.synthesisContent ? (
            <SynthesisBanner
              synthesis={digest.synthesisContent}
              theme={digest.theme ?? undefined}
              keyConcepts={digest.keyConcepts}
              digestId={digest.id}
              digestStarred={!!digest.starred}
              activeConcept={activeConcept}
              onConceptClick={(concept) => setActiveConcept((prev) => (prev === concept ? null : concept))}
              papers={allPapers}
              onSelectPaper={openSource}
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

      {/* ── Right: Sources + Notes (desktop) ── */}
      <aside
        className="hidden md:flex flex-col overflow-y-auto shrink-0 w-[340px]"
        style={{ borderLeft: "3px solid #1a1a1a" }}
      >
        {/* Regenerate */}
        <div style={{ padding: "12px 16px", borderBottom: "1px solid #eee", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: "0.6rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "2px", fontFamily: "var(--font-mono), monospace", color: "#999" }}>Sources</span>
          <button onClick={() => handleGenerate(true)} disabled={generating}
            className="flex items-center gap-1.5 px-2 py-1 text-[0.55rem] uppercase tracking-[1px] text-[#888] hover:text-[#1a1a1a] hover:bg-gray-50 disabled:opacity-50"
            style={{ border: "1px solid #ddd", fontFamily: "var(--font-mono), monospace" }}>
            {generating ? <Loader2 className="size-2.5 animate-spin" /> : <RefreshCw className="size-2.5" />}
            {generating ? "..." : "Regen"}
          </button>
        </div>

        {/* Paper cards — compact */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {allPapers.map((paper, idx) => (
            <PaperCard key={paper.id} paper={paper} index={idx} compact
              highlighted={isPaperHighlighted(paper)} conceptDefs={conceptDefs}
              onSelect={openSource}
              onStar={(id) => handleFeedback(id, "star")}
              onDislike={(id) => handleFeedback(id, "dislike")} />
          ))}
        </div>

        {/* Notes */}
        {digest.id && session && (
          <div style={{ borderTop: "2px solid #1a1a1a", padding: "14px 16px" }}>
            <div style={{ fontSize: "0.6rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "2px", color: "#1a1a1a", fontFamily: "var(--font-mono), monospace", marginBottom: "8px" }}>
              ✦ What did you find interesting?
            </div>
            <NotesInput digestId={digest.id} />
          </div>
        )}
      </aside>

      {/* ── Mobile: sources + notes below synthesis ── */}
      <div className="block md:hidden px-4 pb-20 space-y-2">
        {allPapers.map((paper, idx) => (
          <PaperCard key={paper.id} paper={paper} index={idx} compact
            highlighted={isPaperHighlighted(paper)} conceptDefs={conceptDefs}
            onSelect={openSource}
            onStar={(id) => handleFeedback(id, "star")}
            onDislike={(id) => handleFeedback(id, "dislike")} />
        ))}
      </div>
    </div>
  );
}
