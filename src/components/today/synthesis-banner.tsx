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
  const today = new Date().toISOString().split("T")[0];

  return (
    <div className="relative border border-[#1a1a1a] p-4 space-y-3" style={{ borderWidth: "1.5px" }}>
      {/* Header with pulsing green status dot */}
      <div className="flex items-center gap-2">
        <span
          className="inline-block w-2 h-2"
          style={{
            background: "#38b000",
            borderRadius: "50%",
            animation: "pulse 2s ease-in-out infinite",
          }}
        />
        <h3
          className="text-[0.65rem] font-bold uppercase tracking-[2px] text-[#1a1a1a]"
          style={{ fontFamily: '"Courier New", Courier, monospace' }}
        >
          DAILY_SYNTHESIS // {today}
        </h3>
      </div>

      {/* Key concept tags with accent colors */}
      {keyConcepts.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {keyConcepts.map((concept, idx) => {
            const color = ACCENT_COLORS[idx % ACCENT_COLORS.length];
            const isActive = activeConcept === concept;
            return (
              <button
                key={concept}
                onClick={() => onConceptClick(concept)}
                className="px-2 py-0.5 text-[0.65rem] uppercase tracking-[1px] transition-colors"
                style={{
                  borderWidth: "1.5px",
                  borderStyle: "solid",
                  borderColor: isActive ? color : color,
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

      {/* Synthesis text */}
      <div
        className="relative z-10 text-[0.95rem] text-[#1a1a1a] leading-[1.6] max-w-[800px] prose prose-sm"
        style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}
      >
        <ReactMarkdown>{synthesis}</ReactMarkdown>
      </div>

      {/* Inline pulse keyframe */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}
