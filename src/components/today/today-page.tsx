"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PaperCard, type PaperItem } from "./paper-card";
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
  const [activeConcept, setActiveConcept] = useState<string | null>(null);
  const [selectedPaper, setSelectedPaper] = useState<PaperItem | null>(null);

  // Suppress unused var warning — selectedPaper will be used in Task 7
  void selectedPaper;

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

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await fetch("/api/digest/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: session.apiKey,
          provider: session.provider,
          model: session.model,
          baseUrl: session.baseUrl,
        }),
      });
      if (res.ok) {
        await fetchDigest();
        await fetchInterests();
      }
    } catch (err) {
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

  const researchPapers = papers.filter((p) => p.source === "arxiv");
  const newsPapers = papers.filter((p) => p.source === "rss");

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
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!digest) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <p className="text-muted-foreground text-sm">
          No digest found for today.
        </p>
        <Button onClick={handleGenerate} disabled={generating}>
          {generating ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <RefreshCw className="size-4" />
              Generate today&apos;s digest
            </>
          )}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex gap-6">
      {/* Main content */}
      <div className="flex-1 min-w-0 space-y-6">
        {digest.synthesisContent && (
          <SynthesisBanner
            synthesis={digest.synthesisContent}
            keyConcepts={digest.keyConcepts}
            activeConcept={activeConcept}
            onConceptClick={handleConceptClick}
          />
        )}

        {researchPapers.length > 0 && (
          <section className="space-y-3">
            <h3 className="text-sm font-semibold tracking-tight text-foreground">
              Research Papers
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {researchPapers.map((paper) => (
                <PaperCard
                  key={paper.id}
                  paper={paper}
                  highlighted={isPaperHighlighted(paper)}
                  onSelect={setSelectedPaper}
                  onStar={(id) => handleFeedback(id, "star")}
                  onDislike={(id) => handleFeedback(id, "dislike")}
                />
              ))}
            </div>
          </section>
        )}

        {newsPapers.length > 0 && (
          <section className="space-y-3">
            <h3 className="text-sm font-semibold tracking-tight text-foreground">
              News &amp; Articles
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {newsPapers.map((paper) => (
                <PaperCard
                  key={paper.id}
                  paper={paper}
                  highlighted={isPaperHighlighted(paper)}
                  onSelect={setSelectedPaper}
                  onStar={(id) => handleFeedback(id, "star")}
                  onDislike={(id) => handleFeedback(id, "dislike")}
                />
              ))}
            </div>
          </section>
        )}

        {researchPapers.length === 0 && newsPapers.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">
            No papers found in today&apos;s digest.
          </p>
        )}
      </div>

      {/* Knowledge graph sidebar */}
      <aside className="hidden lg:block w-[280px] shrink-0">
        <div className="sticky top-20">
          <KnowledgeGraph
            interests={interests}
            onNodeClick={handleConceptClick}
          />
        </div>
      </aside>
    </div>
  );
}
