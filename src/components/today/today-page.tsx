"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { PaperCard, type PaperItem } from "./paper-card";
import { PaperDetail } from "./paper-detail";
import { SynthesisBanner } from "./synthesis-banner";

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
  const [selectedPaper, setSelectedPaper] = useState<PaperItem | null>(null);
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

  return (
    <div className="flex flex-col md:flex-row md:h-[calc(100vh-2.75rem)]">
      {/* Synthesis - shown first on mobile, inside canvas on desktop */}
      <div className="block md:hidden p-4">
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
            onSelectPaper={setSelectedPaper}
            session={session}
          />
        ) : (
          <span
            className="text-[0.65rem] uppercase tracking-[2px] text-[#888]"
            style={{ fontFamily: 'var(--font-mono), monospace' }}
          >
            No synthesis available
          </span>
        )}
      </div>

      {/* Sidebar - paper cards */}
      <aside
        className="overflow-y-auto shrink-0 w-full md:w-[380px]"
        style={{ borderRight: "4px solid #1a1a1a" }}
      >
        <div className="p-4 space-y-3">
          {/* Regenerate button */}
          <div className="flex justify-end">
            <button
              onClick={() => handleGenerate(true)}
              disabled={generating}
              className="flex items-center gap-1.5 px-3 py-1 text-[0.6rem] uppercase tracking-[1.5px] text-[#888] hover:text-[#1a1a1a] hover:bg-gray-50 transition-colors disabled:opacity-50"
              style={{ border: "1.5px solid #ccc", fontFamily: "var(--font-mono), monospace" }}
            >
              {generating ? (
                <><Loader2 className="size-3 animate-spin" /> Regenerating...</>
              ) : (
                <><RefreshCw className="size-3" /> Regenerate</>
              )}
            </button>
          </div>
          {allPapers.map((paper, idx) => (
            <PaperCard
              key={paper.id}
              paper={paper}
              index={idx}
              highlighted={isPaperHighlighted(paper)}
              conceptDefs={conceptDefs}
              onSelect={setSelectedPaper}
              onStar={(id) => handleFeedback(id, "star")}
              onDislike={(id) => handleFeedback(id, "dislike")}
            />
          ))}

          {allPapers.length === 0 && (
            <div className="flex flex-col items-center gap-3 py-8">
              <p
                className="text-[0.65rem] uppercase tracking-[2px] text-[#666]"
                style={{ fontFamily: 'var(--font-mono), monospace' }}
              >
                No papers found
              </p>
              {generateError && (
                <p className="text-[0.7rem] text-[#ff007f] max-w-md text-center">
                  {generateError}
                </p>
              )}
              <button
                onClick={() => handleGenerate(true)}
                disabled={generating}
                className="border border-[#1a1a1a] px-3 py-1 text-[0.6rem] uppercase tracking-[2px] hover:bg-[#1a1a1a] hover:text-[#e8e8e8] transition-colors disabled:opacity-50"
                style={{ borderWidth: "1.5px", fontFamily: 'var(--font-mono), monospace' }}
              >
                {generating ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="size-3 animate-spin" /> REGENERATING...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <RefreshCw className="size-3" /> Regenerate digest
                  </span>
                )}
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Canvas area - hidden on mobile */}
      <div className="hidden md:flex flex-1 flex-col overflow-y-auto">
        {selectedPaper ? (
          <PaperDetail
            paper={selectedPaper}
            session={session}
            inline
            onBack={() => setSelectedPaper(null)}
            onStar={(id) => handleFeedback(id, "star")}
            onDislike={(id) => handleFeedback(id, "dislike")}
          />
        ) : (
          <>
            <div style={{ padding: "40px 40px 24px 40px" }}>
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
                  onSelectPaper={setSelectedPaper}
                  session={session}
                />
              ) : (
                <span
                  className="text-[0.65rem] uppercase tracking-[2px] text-[#888]"
                  style={{ fontFamily: 'var(--font-mono), monospace' }}
                >
                  No synthesis available
                </span>
              )}
            </div>
          </>
        )}
      </div>


      {/* Paper detail overlay — mobile only (desktop uses inline) */}
      {selectedPaper && (
        <div className="block md:hidden">
          <PaperDetail
            paper={selectedPaper}
            session={session}
            onBack={() => setSelectedPaper(null)}
            onStar={(id) => handleFeedback(id, "star")}
            onDislike={(id) => handleFeedback(id, "dislike")}
          />
        </div>
      )}
    </div>
  );
}
