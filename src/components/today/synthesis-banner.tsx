"use client";

import { Badge } from "@/components/ui/badge";

interface SynthesisBannerProps {
  synthesis: string;
  keyConcepts: string[];
  activeConcept: string | null;
  onConceptClick: (concept: string) => void;
}

export function SynthesisBanner({
  synthesis,
  keyConcepts,
  activeConcept,
  onConceptClick,
}: SynthesisBannerProps) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-muted/30 p-4 space-y-3">
      <h3 className="text-sm font-semibold tracking-tight">
        Today&apos;s Synthesis
      </h3>
      {keyConcepts.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {keyConcepts.map((concept) => (
            <button key={concept} onClick={() => onConceptClick(concept)}>
              <Badge
                variant={activeConcept === concept ? "default" : "outline"}
                className="cursor-pointer transition-colors"
              >
                {concept}
              </Badge>
            </button>
          ))}
        </div>
      )}
      <p className="text-sm text-muted-foreground leading-relaxed">
        {synthesis}
      </p>
    </div>
  );
}
