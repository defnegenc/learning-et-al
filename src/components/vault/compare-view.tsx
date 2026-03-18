"use client";

import ReactMarkdown from "react-markdown";
import { KeywordTag } from "@/components/keyword-tag";
import type { PaperItem } from "@/components/today/paper-card";

interface CompareViewProps {
  content: string;
  papers: PaperItem[];
  onBack: () => void;
}

const PASTEL_COLORS = ["#d4edda", "#f8d7da", "#e2d5f1", "#cce5ff", "#ffeeba"];

export function CompareView({ content, papers, onBack }: CompareViewProps) {
  return (
    <div style={{ padding: "40px", maxWidth: "800px" }}>
      <button
        onClick={onBack}
        style={{
          fontFamily: "'Courier New', Courier, monospace",
          fontSize: "0.7rem",
          textTransform: "uppercase",
          letterSpacing: "2px",
          color: "#1a1a1a",
          background: "none",
          border: "none",
          padding: 0,
          cursor: "crosshair",
          marginBottom: "24px",
          display: "block",
        }}
        onMouseEnter={(e) => { (e.target as HTMLElement).style.color = "#ff007f"; }}
        onMouseLeave={(e) => { (e.target as HTMLElement).style.color = "#1a1a1a"; }}
      >
        &larr; Back to vault
      </button>

      <h1
        style={{
          fontSize: "1.2rem",
          fontWeight: 800,
          textTransform: "uppercase",
          letterSpacing: "1px",
          fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
          marginBottom: "16px",
        }}
      >
        Comparison
      </h1>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "24px" }}>
        {papers.map((paper, idx) => (
          <KeywordTag
            key={paper.id}
            keyword={paper.title.length > 40 ? paper.title.slice(0, 39) + "…" : paper.title}
            color={PASTEL_COLORS[idx % PASTEL_COLORS.length]}
          />
        ))}
      </div>

      <div
        style={{
          fontSize: "1.05rem",
          lineHeight: 1.7,
          color: "#1a1a1a",
        }}
      >
        <ReactMarkdown>{content}</ReactMarkdown>
      </div>
    </div>
  );
}
