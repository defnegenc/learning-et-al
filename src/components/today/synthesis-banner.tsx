"use client";

import ReactMarkdown from "react-markdown";
import { KeywordTag } from "@/components/keyword-tag";

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
        style={{ fontFamily: 'var(--font-mono), monospace' }}
      >
        {today}
      </span>

      <div
        className="text-[0.95rem] md:text-[1.05rem] text-[#1a1a1a]"
        style={{
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
              <KeywordTag
                key={concept}
                keyword={concept}
                color={isActive ? "#1a1a1a" : pastel}
                textColor={isActive ? "#e8e8e8" : "#1a1a1a"}
                onClick={() => onConceptClick(concept)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
