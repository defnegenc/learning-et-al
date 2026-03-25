"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { KeywordTag } from "@/components/keyword-tag";
import { Loader2 } from "lucide-react";
import type { PaperItem } from "@/components/today/paper-card";

interface CompareViewProps {
  content: string;
  papers: PaperItem[];
  onBack: () => void;
  session?: {
    apiKey: string;
    provider: string;
    model: string;
    baseUrl: string;
  };
}

const PASTEL_COLORS = ["#d4edda", "#f8d7da", "#e2d5f1", "#cce5ff", "#ffeeba"];

export function CompareView({ content, papers, onBack, session }: CompareViewProps) {
  const [digDeeperAnswer, setDigDeeperAnswer] = useState<string | null>(null);
  const [digDeeperLoading, setDigDeeperLoading] = useState(false);
  const [customQuestion, setCustomQuestion] = useState("");

  const handleDigDeeper = async (question: string) => {
    if (!session || !papers[0] || digDeeperLoading) return;
    setDigDeeperLoading(true);
    setDigDeeperAnswer(null);
    try {
      const res = await fetch(`/api/papers/${papers[0].id}/qa`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: `Context: Comparing ${papers.map(p => p.title).join(" vs ")}.\n\nQuestion: ${question}`,
          apiKey: session.apiKey,
          provider: session.provider,
          model: session.model,
          baseUrl: session.baseUrl,
        }),
      });
      const data = await res.json();
      setDigDeeperAnswer(data.qaPair?.answer || data.qa?.answer || "Couldn't get an answer.");
    } catch {
      setDigDeeperAnswer("Something went wrong.");
    }
    setDigDeeperLoading(false);
  };

  return (
    <div style={{ maxWidth: "760px", margin: "0 auto", padding: "40px 20px" }}>
      <button
        onClick={onBack}
        style={{
          fontFamily: "var(--font-mono), monospace",
          fontSize: "0.7rem",
          textTransform: "uppercase",
          letterSpacing: "2px",
          color: "#999",
          background: "none",
          border: "none",
          padding: 0,
          marginBottom: "32px",
          display: "block",
          cursor: "pointer",
        }}
        onMouseEnter={(e) => { (e.target as HTMLElement).style.color = "#1a1a1a"; }}
        onMouseLeave={(e) => { (e.target as HTMLElement).style.color = "#999"; }}
      >
        &larr; Back to vault
      </button>

      <span style={{ fontSize: "0.6rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "2px", color: "#999", fontFamily: "var(--font-mono), monospace" }}>
        Paper Comparison
      </span>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "12px", marginBottom: "28px" }}>
        {papers.map((paper, idx) => (
          <KeywordTag
            key={paper.id}
            keyword={paper.title.length > 50 ? paper.title.slice(0, 49) + "\u2026" : paper.title}
            color={PASTEL_COLORS[idx % PASTEL_COLORS.length]}
          />
        ))}
      </div>

      <div style={{ fontSize: "1rem", lineHeight: 1.75, color: "#333", fontFamily: "'Apercu Pro', var(--font-inter), sans-serif" }}>
        <ReactMarkdown
          components={{
            p: ({ children }) => <p style={{ marginBottom: "16px" }}>{children}</p>,
            h2: ({ children }) => <h2 style={{ fontSize: "1.1rem", fontWeight: 700, marginTop: "28px", marginBottom: "12px", textTransform: "uppercase", letterSpacing: "1px", fontFamily: "var(--font-display), sans-serif" }}>{children}</h2>,
            h3: ({ children }) => <h3 style={{ fontSize: "1rem", fontWeight: 600, marginTop: "20px", marginBottom: "10px" }}>{children}</h3>,
            strong: ({ children }) => <strong style={{ color: "#1a1a1a" }}>{children}</strong>,
            li: ({ children }) => <li style={{ marginBottom: "6px" }}>{children}</li>,
          }}
        >
          {content}
        </ReactMarkdown>
      </div>

      {session && papers.length > 0 && (
        <div style={{ borderTop: "4px solid #1a1a1a", paddingTop: "24px", marginTop: "32px" }}>
          <span
            style={{ fontFamily: "var(--font-mono), monospace", fontSize: "0.6rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "2px", color: "#555", display: "block", marginBottom: "12px" }}
          >
            Dig Deeper
          </span>
          <div className="flex gap-2 items-start" style={{ maxWidth: "500px" }}>
            <input
              value={customQuestion}
              onChange={(e) => setCustomQuestion(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && customQuestion.trim()) { handleDigDeeper(customQuestion); setCustomQuestion(""); } }}
              placeholder="Ask about this comparison..."
              style={{ flex: 1, border: "2px solid #1a1a1a", padding: "8px 12px", fontSize: "0.85rem", background: "white", outline: "none", fontFamily: "'Apercu Pro', var(--font-inter), sans-serif" }}
            />
            <button
              onClick={() => { if (customQuestion.trim()) { handleDigDeeper(customQuestion); setCustomQuestion(""); } }}
              disabled={!customQuestion.trim() || digDeeperLoading}
              style={{ padding: "8px 16px", border: "2px solid #1a1a1a", background: "#1a1a1a", color: "white", fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", fontFamily: "var(--font-mono), monospace", opacity: !customQuestion.trim() || digDeeperLoading ? 0.4 : 1, boxShadow: "2px 2px 0px 0px rgba(0,0,0,1)" }}
            >
              Ask
            </button>
          </div>
          {digDeeperLoading && (
            <div className="flex items-center gap-2 mt-3 text-[#666]">
              <Loader2 className="size-3 animate-spin" />
              <span style={{ fontSize: "0.75rem", fontFamily: "var(--font-mono), monospace" }}>Thinking...</span>
            </div>
          )}
          {digDeeperAnswer && (
            <div style={{ marginTop: "12px", padding: "16px", border: "2px solid #1a1a1a", background: "#fafafa", fontSize: "0.95rem", lineHeight: 1.7, color: "#333", fontFamily: "'Apercu Pro', var(--font-inter), sans-serif" }}>
              <ReactMarkdown>{digDeeperAnswer}</ReactMarkdown>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
