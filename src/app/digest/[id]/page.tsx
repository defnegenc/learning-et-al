"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { SynthesisBanner } from "@/components/today/synthesis-banner";
import type { PaperItem } from "@/lib/types";
import { NoiseOverlay } from "@/components/noise-overlay";
import { PaperCard } from "@/components/paper-card";
import { BODY_STYLE, INK, Label, MUTED, PageLoader, SiteHeader, SURFACE } from "@/components/design-system";

interface Digest {
  id: string;
  theme: string | null;
  synthesisContent: string | null;
  keyConcepts: string[];
  starred: boolean | null;
  date: string;
}

export default function DigestPermalink() {
  const params = useParams();
  const id = params.id as string;
  const [digest, setDigest] = useState<Digest | null>(null);
  const [papers, setPapers] = useState<PaperItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/digest/${id}`);
        if (!res.ok) {
          setError(res.status === 404 ? "Digest not found" : "Failed to load digest");
          return;
        }
        const data = await res.json();
        setDigest(data.digest);
        setPapers(data.papers);
      } catch {
        setError("Failed to load digest");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) return <PageLoader />;

  if (error || !digest) {
    return (
      <div className="flex min-h-screen items-center justify-center flex-col gap-4" style={{ background: SURFACE }}>
        <Label>{error || "Digest not found"}</Label>
        <a href="/" style={{ ...BODY_STYLE, color: INK, textDecoration: "underline", textUnderlineOffset: 4 }}>
          Go to today&apos;s digest
        </a>
      </div>
    );
  }

  const openSource = (p: PaperItem) => p.sourceUrl && window.open(p.sourceUrl, "_blank", "noopener,noreferrer");

  return (
    <div className="relative min-h-screen" style={{ background: SURFACE }}>
      <NoiseOverlay />

      {/* The same 52px bar every other surface uses. */}
      <SiteHeader right={<Label>Vault</Label>} />

      {/* Content */}
      <div className="grid grid-cols-1 md:grid-cols-[5fr_minmax(340px,2fr)] w-full" style={{ position: "relative", zIndex: 10 }}>
        {/* Left: synthesis */}
        <div className="px-4 md:px-10 pt-6 md:pt-8 pb-6 md:pb-8">
          <Label style={{ marginBottom: 16 }}>{digest.date}</Label>

          {digest.synthesisContent && (
            <SynthesisBanner
              synthesis={digest.synthesisContent}
              theme={digest.theme ?? undefined}
              keyConcepts={digest.keyConcepts}
              activeConcept={null}
              onConceptClick={() => {}}
              papers={papers}
              onSelectPaper={openSource}
            />
          )}
        </div>

        {/* Right: sources (desktop) */}
        <div className="hidden md:block pt-8 pb-8 px-4">
          <Label style={{ marginBottom: 20 }}>Referenced sources</Label>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {papers.map((paper, idx) => (
              <PaperCard key={paper.id} paper={paper} index={idx} size="compact" />
            ))}
          </div>
        </div>
      </div>

      {/* Mobile: sources below */}
      <div className="block md:hidden px-4 pb-20" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Label>Referenced sources</Label>
        {papers.map((paper, idx) => (
          <PaperCard key={paper.id} paper={paper} index={idx} size="compact" />
        ))}
      </div>
    </div>
  );
}
