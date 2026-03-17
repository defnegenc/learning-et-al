"use client";

import type { PaperItem } from "@/components/today/paper-card";

interface CompareViewProps {
  content: string;
  papers: PaperItem[];
  onBack: () => void;
}

const ACCENT_COLORS = ["#38b000", "#ff007f", "#7700ff", "#0077ff", "#ff8800"];

export function CompareView({ content, papers, onBack }: CompareViewProps) {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Back button */}
      <button
        onClick={onBack}
        className="text-[0.7rem] uppercase tracking-[2px] text-[#1a1a1a] hover:text-[#ff007f] transition-colors"
        style={{ fontFamily: '"Courier New", Courier, monospace', cursor: "crosshair", background: "none", border: "none", padding: 0 }}
      >
        &larr; BACK_TO_ARCHIVE
      </button>

      <h1
        className="text-lg font-bold uppercase tracking-[3px] text-[#1a1a1a]"
        style={{ fontFamily: '"Courier New", Courier, monospace' }}
      >
        COMPARISON_REPORT
      </h1>

      {/* Paper title tags with accent colors */}
      <div className="flex flex-wrap gap-2">
        {papers.map((paper, idx) => {
          const color = ACCENT_COLORS[idx % ACCENT_COLORS.length];
          return (
            <span
              key={paper.id}
              className="px-2 py-0.5 text-[0.6rem] uppercase tracking-[1px] max-w-[240px] truncate inline-block"
              style={{
                borderWidth: "1.5px",
                borderStyle: "solid",
                borderColor: color,
                color: color,
                fontFamily: '"Courier New", Courier, monospace',
              }}
            >
              {paper.title}
            </span>
          );
        })}
      </div>

      <div className="border border-[#1a1a1a] p-4 space-y-3" style={{ borderWidth: "1.5px" }}>
        <h2
          className="text-[0.65rem] font-bold uppercase tracking-[2px] text-[#1a1a1a] border-b border-[#1a1a1a] pb-2"
          style={{ borderBottomWidth: "1.5px", fontFamily: '"Courier New", Courier, monospace' }}
        >
          AI_COMPARISON
        </h2>
        <p className="text-[0.85rem] leading-relaxed text-[#1a1a1a] whitespace-pre-wrap max-w-[800px]">
          {content}
        </p>
      </div>
    </div>
  );
}
