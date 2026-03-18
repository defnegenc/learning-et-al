"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { KeywordTag } from "@/components/keyword-tag";
import { Loader2 } from "lucide-react";
import type { PaperItem } from "./paper-card";

interface SynthesisBannerProps {
  synthesis: string;
  keyConcepts: string[];
  activeConcept: string | null;
  onConceptClick: (concept: string) => void;
  papers?: PaperItem[];
  onSelectPaper?: (paper: PaperItem) => void;
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
  session,
}: SynthesisBannerProps) {
  const [digDeeperAnswer, setDigDeeperAnswer] = useState<string | null>(null);
  const [digDeeperLoading, setDigDeeperLoading] = useState(false);
  const [customQuestion, setCustomQuestion] = useState("");

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

  // Generate pre-made dig deeper prompts from the papers
  const digDeeperPrompts = papers.length > 0 ? [
    papers.length >= 2
      ? `How does **${papers[0].title}** compare to **${papers[papers.length > 1 ? 1 : 0].title}**?`
      : null,
    `What are the limitations of the approach in **${papers[0].title}**?`,
    papers.length >= 3 && papers[2].source === "rss"
      ? `What does the ${papers[2].title.split(" ").slice(0, 5).join(" ")} story mean for this research?`
      : null,
  ].filter(Boolean) as string[] : [];

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
        className="text-[0.6rem] uppercase tracking-[2px] text-[#999] block"
        style={{ fontFamily: "var(--font-mono), monospace" }}
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
              // Check if this bold text matches a paper title
              const text = String(children);
              const matchedPaper = papers.find(
                p => p.title.toLowerCase().includes(text.toLowerCase()) ||
                     text.toLowerCase().includes(p.title.toLowerCase().slice(0, 30))
              );
              if (matchedPaper && onSelectPaper) {
                return (
                  <strong
                    style={{
                      cursor: "pointer",
                      borderBottom: "1px solid #1a1a1a",
                      paddingBottom: "1px",
                    }}
                    onClick={() => onSelectPaper(matchedPaper)}
                    onMouseEnter={(e) => { (e.target as HTMLElement).style.borderBottomColor = "#ff007f"; (e.target as HTMLElement).style.color = "#ff007f"; }}
                    onMouseLeave={(e) => { (e.target as HTMLElement).style.borderBottomColor = "#1a1a1a"; (e.target as HTMLElement).style.color = "inherit"; }}
                  >
                    {children}
                  </strong>
                );
              }
              return <strong>{children}</strong>;
            },
          }}
        >
          {bodyText}
        </ReactMarkdown>
      </div>

      {/* Key concept tags — prominent, clickable */}
      {keyConcepts.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-2">
          {keyConcepts.map((concept, idx) => {
            const isActive = activeConcept === concept;
            const pastel = PASTEL_COLORS[idx % 5];
            return (
              <button
                key={concept}
                onClick={() => onConceptClick(concept)}
                style={{
                  padding: "5px 14px",
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
                onMouseEnter={(e) => {
                  if (!isActive) {
                    (e.target as HTMLElement).style.borderColor = "#1a1a1a";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    (e.target as HTMLElement).style.borderColor = "rgba(26,26,26,0.15)";
                  }
                }}
              >
                {concept}
              </button>
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
