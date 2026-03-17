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
        <div className="flex flex-wrap gap-1.5 pt-1">
          {keyConcepts.map((concept, idx) => {
            const color = ACCENT_COLORS[idx % ACCENT_COLORS.length];
            const isActive = activeConcept === concept;
            return (
              <button
                key={concept}
                onClick={() => onConceptClick(concept)}
                className="px-2 py-0.5 text-[0.6rem] uppercase tracking-[1px] transition-colors"
                style={{
                  border: `1px solid ${color}`,
                  background: isActive ? color : "transparent",
                  color: isActive ? "#fff" : color,
                  fontFamily: '"Courier New", Courier, monospace',
                  cursor: "crosshair",
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
