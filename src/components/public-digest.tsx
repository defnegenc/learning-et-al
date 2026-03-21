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
    // No admin digest yet — show minimal background, the auth modal overlay handles sign-in
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-6 px-4">
        <h1 style={{
          fontSize: "2.5rem", fontWeight: 700,
          fontFamily: "var(--font-display), sans-serif",
          letterSpacing: "-0.03em", textAlign: "center",
        }}>
          Today&apos;s digest is brewing
        </h1>
        <p style={{ fontSize: "1rem", color: "#999", textAlign: "center", maxWidth: "440px" }}>
          Check back soon — a fresh research digest is generated every day.
        </p>
        <div style={{ display: "none" }}>
        <button onClick={onSignIn} style={{
          padding: "14px 32px", background: "#1a1a1a", color: "white",
          border: "2px solid #1a1a1a", fontSize: "0.85rem", fontWeight: 700,
          textTransform: "uppercase", letterSpacing: "2px",
          fontFamily: "var(--font-mono), monospace", cursor: "pointer",
          boxShadow: "4px 4px 0px 0px rgba(0,0,0,1)",
        }}>
          Sign in with Google
        </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row md:h-[calc(100vh-4rem)]">
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
          <div className="flex-1 overflow-y-auto" style={{ padding: "40px" }}>
            <div className="max-w-3xl mx-auto">
              <button
                onClick={() => setSelectedPaper(null)}
                style={{
                  fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase",
                  letterSpacing: "2px", fontFamily: "var(--font-mono), monospace",
                  background: "none", border: "none", padding: 0, cursor: "pointer",
                  color: "#888", marginBottom: "24px",
                }}
                className="hover:text-[#7700ff] transition-colors"
              >
                ← Back to digest
              </button>

              <h2 style={{
                fontSize: "clamp(1.6rem, 4vw, 2.5rem)", fontWeight: 700,
                lineHeight: 1.1, fontFamily: "var(--font-display), sans-serif",
                color: "#111", marginBottom: "12px",
              }}>
                {selectedPaper.title}
              </h2>

              {selectedPaper.authors.length > 0 && (
                <p style={{ fontSize: "0.75rem", color: "#888", fontFamily: "var(--font-mono), monospace", fontStyle: "italic", marginBottom: "24px" }}>
                  {selectedPaper.authors.join(", ")}{selectedPaper.year ? `, ${selectedPaper.year}` : ""}
                </p>
              )}

              {selectedPaper.summary && (
                <div className="mb-10 text-[0.95rem] text-gray-700" style={{ lineHeight: "1.8" }}>
                  {selectedPaper.summary}
                </div>
              )}

              {selectedPaper.keyFindings && selectedPaper.keyFindings.length > 0 && (
                <div className="mb-10 pb-8" style={{ borderBottom: "2px solid #e5e7eb" }}>
                  <h3 style={{ fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "3px", color: "#999", fontFamily: "var(--font-mono), monospace", marginBottom: "16px" }}>
                    Key Findings
                  </h3>
                  <ul className="space-y-4">
                    {selectedPaper.keyFindings.map((finding, i) => (
                      <li key={i} className="flex gap-4 items-start">
                        <span style={{ flexShrink: 0, width: "22px", height: "22px", background: "#f3f4f6", border: "2px solid #1a1a1a", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.6rem", fontWeight: 700, fontFamily: "var(--font-mono), monospace" }}>{i + 1}</span>
                        <p style={{ fontSize: "0.95rem", lineHeight: 1.7, color: "#333" }}>{finding}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {selectedPaper.abstract && (
                <div className="mb-10">
                  <h3 style={{ fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "3px", color: "#999", fontFamily: "var(--font-mono), monospace", marginBottom: "16px" }}>
                    Abstract
                  </h3>
                  <div className="text-[0.95rem] text-gray-700" style={{ lineHeight: "1.8", whiteSpace: "pre-wrap" }}>
                    {selectedPaper.abstract}
                  </div>
                </div>
              )}

              {/* Sign in CTA */}
              <div style={{
                padding: "20px 24px", border: "3px solid #1a1a1a",
                boxShadow: "6px 6px 0px 0px rgba(0,0,0,1)",
                display: "flex", alignItems: "center", justifyContent: "space-between",
                gap: "16px", flexWrap: "wrap",
              }}>
                <p style={{ fontSize: "0.85rem", color: "#333" }}>
                  Sign in to ask questions about this paper, save notes, and get personalized digests.
                </p>
                <button onClick={onSignIn} style={{
                  padding: "10px 24px", background: "#1a1a1a", color: "white",
                  border: "2px solid #1a1a1a", fontSize: "0.7rem", fontWeight: 700,
                  textTransform: "uppercase", letterSpacing: "2px",
                  fontFamily: "var(--font-mono), monospace", cursor: "pointer",
                  boxShadow: "3px 3px 0px 0px rgba(0,0,0,1)", flexShrink: 0,
                }}>
                  Sign in
                </button>
              </div>
            </div>
          </div>
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

            {/* Sign in CTA — replaces dig deeper for logged-out users */}
            <div style={{
              marginTop: "32px", padding: "24px 32px",
              border: "3px solid #1a1a1a",
              boxShadow: "6px 6px 0px 0px rgba(0,0,0,1)",
            }}>
              <div style={{ background: "#1a1a1a", margin: "-24px -32px 20px", padding: "16px 32px" }}>
                <span style={{
                  fontSize: "1rem", fontWeight: 700, textTransform: "uppercase",
                  letterSpacing: "2px", fontFamily: "var(--font-mono), monospace", color: "white",
                }}>
                  Want your own digest?
                </span>
              </div>
              <p style={{ fontSize: "0.9rem", color: "#333", marginBottom: "16px", lineHeight: 1.6 }}>
                Sign in to pick your own interests, ask questions about papers, and get a personalized digest every day. Bring your own AI key (Gemini free tier works great).
              </p>
              <button onClick={onSignIn} style={{
                padding: "12px 28px", background: "#1a1a1a", color: "white",
                border: "2px solid #1a1a1a", fontSize: "0.75rem", fontWeight: 700,
                textTransform: "uppercase", letterSpacing: "2px",
                fontFamily: "var(--font-mono), monospace", cursor: "pointer",
                boxShadow: "4px 4px 0px 0px rgba(0,0,0,1)",
              }}>
                Sign in with Google
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
