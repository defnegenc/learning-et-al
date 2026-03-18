"use client";

import { useState, useCallback, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import { KeywordTag } from "@/components/keyword-tag";
import { Loader2, Plus, Check } from "lucide-react";
import type { PaperItem } from "./paper-card";

interface SynthesisBannerProps {
  synthesis: string;
  keyConcepts: string[];
  activeConcept: string | null;
  onConceptClick: (concept: string) => void;
  papers?: PaperItem[];
  onSelectPaper?: (paper: PaperItem) => void;
  onAddInterest?: (keyword: string) => void;
  session?: {
    apiKey: string;
    provider: string;
    model: string;
    baseUrl: string;
  };
}

const PASTEL_COLORS = ["#d4edda", "#f8d7da", "#e2d5f1", "#cce5ff", "#ffeeba"];

export function SynthesisBanner({
  synthesis,
  keyConcepts,
  activeConcept,
  onConceptClick,
  papers = [],
  onSelectPaper,
  onAddInterest,
  session,
}: SynthesisBannerProps) {
  const [digDeeperAnswer, setDigDeeperAnswer] = useState<string | null>(null);
  const [digDeeperLoading, setDigDeeperLoading] = useState(false);
  const [customQuestion, setCustomQuestion] = useState("");
  const [addedConcepts, setAddedConcepts] = useState<Set<string>>(new Set());
  const [addingConcept, setAddingConcept] = useState<string | null>(null);

  const handleAddConcept = useCallback(async (concept: string) => {
    if (addedConcepts.has(concept) || addingConcept) return;
    setAddingConcept(concept);
    try {
      const res = await fetch("/api/interests/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyword: concept }),
      });
      const data = await res.json();
      if (data.added) {
        setAddedConcepts(prev => new Set([...prev, concept]));
        onAddInterest?.(concept);
      }
    } catch { /* silent */ }
    setAddingConcept(null);
  }, [addedConcepts, addingConcept, onAddInterest]);

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  // Split synthesis into thread title and body
  const lines = synthesis.split("\n").filter(l => l.trim());
  let threadTitle = "";
  let bodyLines = lines;

  const firstLine = lines[0] || "";
  if (firstLine.toLowerCase().startsWith("today's thread:")) {
    threadTitle = firstLine.replace(/^today's thread:\s*/i, "").trim();
    bodyLines = lines.slice(1);
  }
  const bodyText = bodyLines.join("\n\n");

  // Smart dig deeper prompts — based on the actual papers and theme
  const digDeeperPrompts = useMemo(() => {
    if (papers.length === 0) return [];
    const p0 = papers[0];
    const p1 = papers.length > 1 ? papers[1] : null;
    const p2 = papers.length > 2 ? papers[2] : null;
    const prompts: string[] = [];

    // Cross-pollination
    if (p0 && p1) {
      prompts.push(`What if ${p0.title.split(" ").slice(0, 4).join(" ")}'s approach was applied to ${p1.title.split(" ").slice(0, 4).join(" ")}'s problem?`);
    }
    // Practical implications
    prompts.push(`Who's actually building on this research right now? Any startups or products?`);
    // History / context
    if (p0) {
      prompts.push(`What came before ${p0.title.split(" ").slice(0, 5).join(" ")}? What made it possible?`);
    }
    // Challenge / critique
    if (p1) {
      prompts.push(`What are the strongest criticisms of this line of research?`);
    }
    // News connection
    if (p2 && p2.source === "rss") {
      prompts.push(`How does the ${p2.title.split(" ").slice(0, 5).join(" ")} story change the picture here?`);
    }

    return prompts.slice(0, 3);
  }, [papers]);

  const handleDigDeeper = async (question: string) => {
    if (!session || digDeeperLoading) return;
    setDigDeeperLoading(true);
    setDigDeeperAnswer(null);
    try {
      const context = papers.map(p => `${p.title}: ${p.summary || ""}`).join("\n\n");
      // Use the first paper's QA endpoint as a proxy, or call a general endpoint
      const res = await fetch(`/api/papers/${papers[0]?.id}/qa`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: `Context: Today's digest is about "${threadTitle}". Papers: ${context}\n\nQuestion: ${question}`,
          apiKey: session.apiKey,
          provider: session.provider,
          model: session.model,
          baseUrl: session.baseUrl,
        }),
      });
      const data = await res.json();
      setDigDeeperAnswer(data.qaPair?.answer || data.qa?.answer || "Couldn't get an answer.");
    } catch {
      setDigDeeperAnswer("Something went wrong. Try again.");
    }
    setDigDeeperLoading(false);
  };

  return (
    <div className="space-y-5">
      {/* Date */}
      <span
        style={{
          fontSize: "0.8rem",
          color: "#999",
          display: "block",
          fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
        }}
      >
        {today}
      </span>

      {/* Thread title — large and separate */}
      {threadTitle && (
        <h2
          style={{
            fontSize: "1.4rem",
            fontWeight: 700,
            lineHeight: 1.3,
            color: "#1a1a1a",
            fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
          }}
        >
          {threadTitle}
        </h2>
      )}

      {/* Synthesis body */}
      <div
        className="text-[0.95rem] md:text-[1rem] text-[#333]"
        style={{ lineHeight: "1.75" }}
      >
        <ReactMarkdown
          components={{
            strong: ({ children }) => {
              const text = String(children);
              const matchedPaper = papers.find(
                p => p.title.toLowerCase().includes(text.toLowerCase()) ||
                     text.toLowerCase().includes(p.title.toLowerCase().slice(0, 30))
              );
              if (matchedPaper && onSelectPaper) {
                return (
                  <span
                    style={{
                      display: "inline-block",
                      background: "white",
                      border: "1.5px solid #1a1a1a",
                      padding: "2px 6px",
                      fontFamily: "var(--font-mono), monospace",
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      textTransform: "uppercase",
                      letterSpacing: "1px",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                      verticalAlign: "baseline",
                    }}
                    onClick={() => onSelectPaper(matchedPaper)}
                    onMouseEnter={(e) => { (e.target as HTMLElement).style.background = "#1a1a1a"; (e.target as HTMLElement).style.color = "#fff"; }}
                    onMouseLeave={(e) => { (e.target as HTMLElement).style.background = "white"; (e.target as HTMLElement).style.color = "#1a1a1a"; }}
                  >
                    {children}
                  </span>
                );
              }
              return (
                <span
                  style={{
                    display: "inline-block",
                    background: "white",
                    border: "1.5px solid #1a1a1a",
                    padding: "2px 6px",
                    fontFamily: "var(--font-mono), monospace",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "1px",
                    verticalAlign: "baseline",
                  }}
                >
                  {children}
                </span>
              );
            },
          }}
        >
          {bodyText}
        </ReactMarkdown>
      </div>

      {/* Key concept tags — clickable to filter, "+" to add to interests */}
      {keyConcepts.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-2">
          {keyConcepts.map((concept, idx) => {
            const isActive = activeConcept === concept;
            const isAdded = addedConcepts.has(concept);
            const isAdding = addingConcept === concept;
            const pastel = PASTEL_COLORS[idx % 5];
            return (
              <span
                key={concept}
                className="group/tag"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "5px 10px 5px 14px",
                  background: isActive ? "#1a1a1a" : pastel,
                  border: `1.5px solid ${isActive ? "#1a1a1a" : "rgba(26,26,26,0.15)"}`,
                  color: isActive ? "#fff" : "#1a1a1a",
                  fontSize: "0.7rem",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                <span onClick={() => onConceptClick(concept)}>{concept}</span>
                {isAdded ? (
                  <Check style={{ width: "12px", height: "12px", color: "#38b000", flexShrink: 0 }} />
                ) : (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleAddConcept(concept); }}
                    className="opacity-40 group-hover/tag:opacity-100 transition-opacity"
                    style={{
                      background: "none",
                      border: "none",
                      padding: "2px",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      color: isActive ? "#fff" : "#1a1a1a",
                    }}
                    title="Add to interests"
                  >
                    {isAdding ? (
                      <Loader2 style={{ width: "12px", height: "12px", animation: "spin 1s linear infinite" }} />
                    ) : (
                      <Plus style={{ width: "12px", height: "12px" }} />
                    )}
                  </button>
                )}
              </span>
            );
          })}
        </div>
      )}

      {/* Dig deeper section */}
      {papers.length > 0 && session && (
        <div
          style={{
            borderTop: "1px solid rgba(26,26,26,0.1)",
            paddingTop: "20px",
            marginTop: "8px",
          }}
        >
          <span
            className="text-[0.6rem] uppercase tracking-[2px] text-[#999] block mb-3"
            style={{ fontFamily: "var(--font-mono), monospace" }}
          >
            Dig deeper
          </span>

          {/* Pre-generated prompts */}
          <div className="flex flex-wrap gap-2 mb-3">
            {digDeeperPrompts.map((prompt, i) => (
              <button
                key={i}
                onClick={() => handleDigDeeper(prompt)}
                disabled={digDeeperLoading}
                style={{
                  padding: "6px 12px",
                  border: "1px solid rgba(26,26,26,0.15)",
                  background: "white",
                  color: "#333",
                  fontSize: "0.75rem",
                  lineHeight: 1.4,
                  textAlign: "left",
                  cursor: "pointer",
                  transition: "border-color 0.15s",
                  maxWidth: "300px",
                }}
                onMouseEnter={(e) => { (e.target as HTMLElement).style.borderColor = "#1a1a1a"; }}
                onMouseLeave={(e) => { (e.target as HTMLElement).style.borderColor = "rgba(26,26,26,0.15)"; }}
              >
                {prompt.replace(/\*\*/g, "")}
              </button>
            ))}
          </div>

          {/* Custom question input */}
          <div className="flex gap-2 items-start" style={{ maxWidth: "500px" }}>
            <input
              value={customQuestion}
              onChange={(e) => setCustomQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && customQuestion.trim()) {
                  handleDigDeeper(customQuestion);
                  setCustomQuestion("");
                }
              }}
              placeholder="Ask something about today's digest..."
              style={{
                flex: 1,
                border: "1px solid rgba(26,26,26,0.15)",
                padding: "6px 10px",
                fontSize: "0.8rem",
                background: "white",
                outline: "none",
              }}
            />
            <button
              onClick={() => {
                if (customQuestion.trim()) {
                  handleDigDeeper(customQuestion);
                  setCustomQuestion("");
                }
              }}
              disabled={!customQuestion.trim() || digDeeperLoading}
              style={{
                padding: "6px 14px",
                border: "1.5px solid #1a1a1a",
                background: "#1a1a1a",
                color: "white",
                fontSize: "0.7rem",
                textTransform: "uppercase",
                letterSpacing: "1px",
                fontFamily: "var(--font-mono), monospace",
                opacity: !customQuestion.trim() || digDeeperLoading ? 0.4 : 1,
              }}
            >
              Ask
            </button>
          </div>

          {/* Answer */}
          {digDeeperLoading && (
            <div className="flex items-center gap-2 mt-3 text-[#666]">
              <Loader2 className="size-3 animate-spin" />
              <span style={{ fontSize: "0.75rem" }}>Thinking...</span>
            </div>
          )}
          {digDeeperAnswer && (
            <div
              style={{
                marginTop: "12px",
                padding: "16px",
                border: "1px solid rgba(26,26,26,0.1)",
                background: "#fafafa",
                fontSize: "0.9rem",
                lineHeight: 1.7,
                color: "#333",
                maxWidth: "720px",
              }}
            >
              <ReactMarkdown>{digDeeperAnswer}</ReactMarkdown>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
