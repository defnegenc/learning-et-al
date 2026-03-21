"use client";

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { SynthesisBanner } from "@/components/today/synthesis-banner";
import { PaperCard, type PaperItem } from "@/components/today/paper-card";
import { PaperDetail } from "@/components/today/paper-detail";

interface Digest {
  id: string;
  theme: string | null;
  synthesisContent: string | null;
  keyConcepts: string[];
  starred: boolean | null;
  date: string;
}

export function PublicDigest({ onSignIn }: { onSignIn: () => void }) {
  const [digest, setDigest] = useState<Digest | null>(null);
  const [papers, setPapers] = useState<PaperItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPaper, setSelectedPaper] = useState<PaperItem | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/public/digest");
        if (!res.ok) return;
        const data = await res.json();
        setDigest(data.digest);
        setPapers(data.papers ?? []);
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-6 animate-spin text-[#888]" />
      </div>
    );
  }

  if (!digest) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-6 px-4">
        <h1
          style={{
            fontSize: "2.5rem",
            fontWeight: 700,
            fontFamily: "var(--font-display), sans-serif",
            letterSpacing: "-0.03em",
            textAlign: "center",
          }}
        >
          Learning Et Al.
        </h1>
        <p style={{ fontSize: "1rem", color: "#666", textAlign: "center", maxWidth: "400px" }}>
          Your AI research companion. Get a daily digest of papers that make you think.
        </p>
        <button
          onClick={onSignIn}
          style={{
            padding: "14px 32px",
            background: "#1a1a1a",
            color: "white",
            border: "2px solid #1a1a1a",
            fontSize: "0.85rem",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "2px",
            fontFamily: "var(--font-mono), monospace",
            cursor: "pointer",
            boxShadow: "4px 4px 0px 0px rgba(0,0,0,1)",
          }}
        >
          Sign in with Google
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row md:h-[calc(100vh-2.75rem)]">
      {/* Sidebar — paper cards */}
      <aside
        className="overflow-y-auto shrink-0 w-full md:w-[380px]"
        style={{ borderRight: "4px solid #1a1a1a" }}
      >
        <div className="p-4 space-y-3">
          {papers.map((paper, idx) => (
            <PaperCard
              key={paper.id}
              paper={paper}
              index={idx}
              onSelect={setSelectedPaper}
              onStar={() => {}}
              onDislike={() => {}}
            />
          ))}
        </div>
      </aside>

      {/* Canvas */}
      <div className="flex-1 flex flex-col overflow-y-auto">
        {selectedPaper ? (
          <PaperDetail
            paper={selectedPaper}
            session={{ apiKey: "", provider: "gemini", model: "", baseUrl: "" }}
            inline
            onBack={() => setSelectedPaper(null)}
            onStar={() => {}}
            onDislike={() => {}}
          />
        ) : (
          <div style={{ padding: "40px 40px 24px 40px" }}>
            {digest.synthesisContent && (
              <SynthesisBanner
                synthesis={digest.synthesisContent}
                theme={digest.theme ?? undefined}
                keyConcepts={digest.keyConcepts}
                activeConcept={null}
                onConceptClick={() => {}}
                papers={papers}
                onSelectPaper={setSelectedPaper}
              />
            )}

            {/* CTA */}
            <div
              style={{
                marginTop: "40px",
                padding: "24px 32px",
                border: "3px solid #1a1a1a",
                boxShadow: "6px 6px 0px 0px rgba(0,0,0,1)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "16px",
                flexWrap: "wrap",
              }}
            >
              <div>
                <h3 style={{
                  fontSize: "1.1rem", fontWeight: 700,
                  fontFamily: "var(--font-display), sans-serif",
                  marginBottom: "4px",
                }}>
                  Want your own daily digest?
                </h3>
                <p style={{ fontSize: "0.85rem", color: "#666" }}>
                  Pick your interests, connect an AI provider, and get personalized research every day.
                </p>
              </div>
              <button
                onClick={onSignIn}
                style={{
                  padding: "12px 28px",
                  background: "#1a1a1a",
                  color: "white",
                  border: "2px solid #1a1a1a",
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "2px",
                  fontFamily: "var(--font-mono), monospace",
                  cursor: "pointer",
                  boxShadow: "4px 4px 0px 0px rgba(0,0,0,1)",
                  flexShrink: 0,
                }}
              >
                Sign up free
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
