"use client";

import ReactMarkdown from "react-markdown";

interface SynthesisBannerProps {
  synthesis: string;
  keyConcepts: string[];
  activeConcept: string | null;
  onConceptClick: (concept: string) => void;
}

const ACCENT_COLORS = ["#38b000", "#ff007f", "#7700ff", "#0077ff", "#ff8800"];

export function SynthesisBanner({
  synthesis,
  keyConcepts,
  activeConcept,
  onConceptClick,
}: SynthesisBannerProps) {
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="space-y-4">
      <span
        className="text-[0.65rem] uppercase tracking-[2px] text-[#888]"
        style={{ fontFamily: '"Courier New", Courier, monospace' }}
      >
        {today}
      </span>

      <div
        className="text-[1.05rem] text-[#1a1a1a]"
        style={{
          maxWidth: "680px",
          lineHeight: "1.7",
        }}
      >
        <ReactMarkdown>{synthesis}</ReactMarkdown>
      </div>

      {keyConcepts.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-2">
          {keyConcepts.map((concept, idx) => {
            const pastel = ["#d4edda", "#f8d7da", "#e2d5f1", "#cce5ff", "#ffeeba"][idx % 5];
            const isActive = activeConcept === concept;
            return (
              <button
                key={concept}
                onClick={() => onConceptClick(concept)}
                style={{
                  padding: "3px 10px",
                  background: isActive ? "#1a1a1a" : pastel,
                  border: "1px solid rgba(26,26,26,0.2)",
                  color: isActive ? "#e8e8e8" : "#1a1a1a",
                  fontSize: "0.65rem",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                  fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
                  cursor: "crosshair",
                  transition: "all 0.15s ease",
                }}
              >
                {concept}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
