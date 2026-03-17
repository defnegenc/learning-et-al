"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { PaperCard, type PaperItem } from "./paper-card";
import { PaperDetail } from "./paper-detail";
import { SynthesisBanner } from "./synthesis-banner";
import { KnowledgeGraph } from "./knowledge-graph";

interface Digest {
  id: string;
  synthesisContent: string | null;
  keyConcepts: string[];
  date: string;
}

interface Interest {
  id: string;
  keyword: string;
  weight: number | null;
  source: "seed" | "star" | "engagement" | "dislike";
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
}

export function TodayPage({ session }: TodayPageProps) {
  const [digest, setDigest] = useState<Digest | null>(null);
  const [papers, setPapers] = useState<PaperItem[]>([]);
  const [interests, setInterests] = useState<Interest[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [activeConcept, setActiveConcept] = useState<string | null>(null);
  const [selectedPaper, setSelectedPaper] = useState<PaperItem | null>(null);

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

  const fetchInterests = useCallback(async () => {
    try {
      const res = await fetch("/api/interests");
      if (!res.ok) return;
      const data = await res.json();
      setInterests(data.interests ?? []);
    } catch (err) {
      console.error("Failed to fetch interests:", err);
    }
  }, []);

  useEffect(() => {
    Promise.all([fetchDigest(), fetchInterests()]).finally(() =>
      setLoading(false)
    );
  }, [fetchDigest, fetchInterests]);

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
        await fetchInterests();
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
      await fetchInterests();
    } catch (err) {
      console.error("Failed to submit feedback:", err);
    }
  };

  const handleConceptClick = (concept: string) => {
    setActiveConcept((prev) => (prev === concept ? null : concept));
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
        <Loader2 className="size-6 animate-spin text-[#555]" />
      </div>
    );
  }

  if (!digest) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <p
          className="text-[0.75rem] uppercase tracking-[2px] text-[#555]"
          style={{ fontFamily: '"Courier New", Courier, monospace' }}
        >
          NO_DIGEST_FOUND_FOR_TODAY
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
          style={{ borderWidth: "1.5px", fontFamily: '"Courier New", Courier, monospace' }}
        >
          {generating ? (
            <span className="flex items-center gap-2">
              <Loader2 className="size-3 animate-spin" />
              GENERATING (THIS MAY TAKE A MINUTE)...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <RefreshCw className="size-3" />
              {generateError ? "TRY_AGAIN" : "GENERATE_TODAYS_DIGEST"}
            </span>
          )}
        </button>
      </div>
    );
  }

  if (selectedPaper) {
    return (
      <div className="p-4">
        <PaperDetail
          paper={selectedPaper}
          session={session}
          onBack={() => setSelectedPaper(null)}
          onStar={(id) => handleFeedback(id, "star")}
          onDislike={(id) => handleFeedback(id, "dislike")}
        />
      </div>
    );
  }

  const allPapers = papers;

  return (
    <div className="flex h-[calc(100vh-7rem)]">
      {/* Sidebar - paper cards (33.33vw) */}
      <aside
        className="border-r border-[#1a1a1a] overflow-y-auto shrink-0"
        style={{ width: "33.33vw", borderRightWidth: "1.5px" }}
      >
        {/* Sidebar header */}
        <div
          className="sticky top-0 z-10 border-b border-[#1a1a1a] px-3 py-2"
          style={{ borderBottomWidth: "1.5px", background: "#e8e8e8" }}
        >
          <h2
            className="text-[0.65rem] font-bold uppercase tracking-[2px] text-[#1a1a1a]"
            style={{ fontFamily: '"Courier New", Courier, monospace' }}
          >
            TODAY // {allPapers.length} ITEMS
          </h2>
        </div>

        {/* Paper cards list */}
        <div className="p-2 space-y-2">
          {allPapers.map((paper) => (
            <PaperCard
              key={paper.id}
              paper={paper}
              highlighted={isPaperHighlighted(paper)}
              onSelect={setSelectedPaper}
              onStar={(id) => handleFeedback(id, "star")}
              onDislike={(id) => handleFeedback(id, "dislike")}
            />
          ))}

          {allPapers.length === 0 && (
            <div className="flex flex-col items-center gap-3 py-8">
              <p
                className="text-[0.65rem] uppercase tracking-[2px] text-[#555]"
                style={{ fontFamily: '"Courier New", Courier, monospace' }}
              >
                NO_PAPERS_FOUND
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
                style={{ borderWidth: "1.5px", fontFamily: '"Courier New", Courier, monospace' }}
              >
                {generating ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="size-3 animate-spin" /> REGENERATING...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <RefreshCw className="size-3" /> REGENERATE_DIGEST
                  </span>
                )}
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Canvas area (66.66vw) */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Synthesis panel (top ~40%) */}
        <div className="overflow-y-auto border-b border-[#1a1a1a]" style={{ height: "40%", borderBottomWidth: "1.5px", padding: "40px" }}>
          {digest.synthesisContent ? (
            <SynthesisBanner
              synthesis={digest.synthesisContent}
              keyConcepts={digest.keyConcepts}
              activeConcept={activeConcept}
              onConceptClick={handleConceptClick}
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <span
                className="text-[0.65rem] uppercase tracking-[2px] text-[#555]"
                style={{ fontFamily: '"Courier New", Courier, monospace' }}
              >
                NO_SYNTHESIS_AVAILABLE
              </span>
            </div>
          )}
        </div>

        {/* Visual workspace (bottom ~60%) */}
        <div className="relative overflow-hidden" style={{ height: "60%" }}>
          {/* Subtle aura blobs — concentrated near the node graph (bottom-right) */}
          <div
            className="absolute pointer-events-none"
            style={{
              width: "250px",
              height: "250px",
              background: "#7700ff",
              borderRadius: "50%",
              filter: "blur(80px)",
              opacity: 0.06,
              bottom: "5%",
              right: "10%",
            }}
          />
          <div
            className="absolute pointer-events-none"
            style={{
              width: "200px",
              height: "200px",
              background: "#38b000",
              borderRadius: "50%",
              filter: "blur(70px)",
              opacity: 0.05,
              bottom: "15%",
              right: "25%",
            }}
          />

          {/* Node graph - small bordered box, bottom-right */}
          <div className="absolute" style={{ bottom: "20px", right: "20px" }}>
            <KnowledgeGraph
              interests={interests}
              onNodeClick={handleConceptClick}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
