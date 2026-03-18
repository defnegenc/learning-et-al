"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
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

  // Show user's interests that connect to today's papers (partial match)
  const graphInterests = useMemo(() => {
    const paperText = papers.map(p => `${p.title} ${p.keywords.join(" ")} ${p.summary || ""}`).join(" ").toLowerCase();

    // Include any user interest where any word appears in today's paper content
    const matched = interests.filter((i) => {
      const words = i.keyword.toLowerCase().split(/\s+/).filter(w => w.length > 3);
      return words.some(w => paperText.includes(w));
    });

    // If fewer than 3 matches, pad with top-weighted interests
    if (matched.length < 3) {
      const matchedIds = new Set(matched.map((m) => m.id));
      const remaining = interests
        .filter((i) => !matchedIds.has(i.id))
        .sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0));
      for (const interest of remaining) {
        if (matched.length >= 3) break;
        matched.push(interest);
      }
    }

    return matched;
  }, [papers, interests]);

  // Extract paper keywords for the graph
  const paperKeywordsForGraph = useMemo(() => {
    return papers.flatMap(p =>
      p.keywords.map(kw => ({ keyword: kw, paperId: p.id, paperTitle: p.title }))
    );
  }, [papers]);

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
    <div className="flex flex-col md:flex-row md:h-[calc(100vh-2.75rem)]">
      {/* Synthesis - shown first on mobile, inside canvas on desktop */}
      <div className="block md:hidden p-4">
        {digest.synthesisContent ? (
          <SynthesisBanner
            synthesis={digest.synthesisContent}
            keyConcepts={digest.keyConcepts}
            activeConcept={activeConcept}
            onConceptClick={handleConceptClick}
            papers={allPapers}
            onSelectPaper={setSelectedPaper}
            onAddInterest={() => fetchInterests()}
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
        className="border-b md:border-b-0 md:border-r border-[#1a1a1a] overflow-y-auto shrink-0 w-full md:w-[33.33vw]"
        style={{ borderRightWidth: undefined, borderBottomWidth: undefined }}
      >
        <style>{`
          @media (min-width: 768px) {
            .today-sidebar { border-right-width: 1.5px !important; border-bottom-width: 0 !important; }
          }
          @media (max-width: 767px) {
            .today-sidebar { border-bottom-width: 1.5px !important; border-right-width: 0 !important; }
          }
        `}</style>
        <div className="today-sidebar p-4 space-y-3">
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

      {/* Canvas area - hidden on mobile (synthesis shown above, graph below) */}
      <div className="hidden md:flex flex-1 flex-col overflow-y-auto">
        {/* Synthesis */}
        <div style={{ padding: "40px" }}>
          {digest.synthesisContent ? (
            <SynthesisBanner
              synthesis={digest.synthesisContent}
              keyConcepts={digest.keyConcepts}
              activeConcept={activeConcept}
              onConceptClick={handleConceptClick}
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

        {/* Node graph — below synthesis */}
        <div style={{ padding: "0 40px 40px 40px", display: "flex", justifyContent: "flex-end" }}>
          <KnowledgeGraph
            interests={graphInterests}
            paperKeywords={paperKeywordsForGraph}
            onNodeClick={handleConceptClick}
          />
        </div>
      </div>

      {/* Knowledge graph on mobile - at the bottom */}
      <div className="block md:hidden p-4">
        <KnowledgeGraph
          interests={graphInterests}
          onNodeClick={handleConceptClick}
        />
      </div>
    </div>
  );
}
