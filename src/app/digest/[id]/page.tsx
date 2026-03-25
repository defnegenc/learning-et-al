"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { SynthesisBanner } from "@/components/today/synthesis-banner";
import type { PaperItem } from "@/components/today/paper-card";
import { NoiseOverlay } from "@/components/noise-overlay";

interface Digest {
  id: string;
  theme: string | null;
  synthesisContent: string | null;
  keyConcepts: string[];
  starred: boolean | null;
  date: string;
}

// Source tab (same as today-page)
const TAB_DOT_COLORS = ["#f9a8d4", "#93c5fd", "#a3a3a3"];
const TAB_TAG_COLORS = [["#fce7f3", "#dcfce7"], ["#dbeafe", "#fef9c3"], ["#ede9fe", "#fee2e2"]];

function getJournalName(sourceUrl: string | null): string | null {
  if (!sourceUrl) return null;
  try {
    const hostname = new URL(sourceUrl).hostname.replace("www.", "");
    const map: Record<string, string> = {
      "arxiv.org": "arXiv", "nature.com": "Nature", "sciencedirect.com": "ScienceDirect",
      "springer.com": "Springer", "frontiersin.org": "Frontiers", "mdpi.com": "MDPI",
    };
    for (const [domain, name] of Object.entries(map)) {
      if (hostname.includes(domain)) return name;
    }
    return null;
  } catch { return null; }
}

function PaperSourceTab({ paper, index }: { paper: PaperItem; index: number }) {
  const dot = TAB_DOT_COLORS[index % TAB_DOT_COLORS.length];
  const tagColors = TAB_TAG_COLORS[index % TAB_TAG_COLORS.length];
  const url = (paper.sourceUrl || "").toLowerCase();
  const sourceType = url.includes("arxiv") ? "ARXIV" : paper.source === "rss" ? "NEWS" : "PAPER";
  const journalName = getJournalName(paper.sourceUrl);

  return (
    <button
      onClick={() => paper.sourceUrl && window.open(paper.sourceUrl, "_blank", "noopener,noreferrer")}
      className="group transition-all duration-150 hover:-translate-y-0.5 hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]"
      style={{ border: "2px solid #1a1a1a", boxShadow: "6px 6px 0px 0px rgba(0,0,0,1)", background: "white", padding: "16px 18px", display: "flex", flexDirection: "column", gap: "10px", width: "100%", textAlign: "left" }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: dot, flexShrink: 0 }} />
          <span style={{ fontSize: "0.55rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "1px", fontFamily: "var(--font-mono), monospace", color: "#999" }}>
            {sourceType} · {paper.year || "2026"}
          </span>
        </div>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#bbb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="group-hover:stroke-[#1a1a1a] transition-colors"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
      </div>
      <span style={{ fontSize: "0.85rem", fontWeight: 700, textTransform: "uppercase", lineHeight: 1.3, color: "#1a1a1a", fontFamily: "var(--font-display), sans-serif" }} className="group-hover:underline">
        {paper.title}
      </span>
      {(paper.authors.length > 0 || journalName) && (
        <span style={{ fontSize: "0.65rem", color: "#888", fontStyle: "italic", lineHeight: 1.4 }}>
          {paper.authors.length > 0 && (paper.authors.length <= 2 ? paper.authors.join(" & ") : `${paper.authors[0]} et al.`)}
          {paper.authors.length > 0 && journalName ? " — " : ""}
          {journalName && <em>{journalName}</em>}
        </span>
      )}
      {paper.summary && (
        <p style={{ fontSize: "0.75rem", color: "#555", lineHeight: 1.5, borderLeft: "3px solid #e5e7eb", paddingLeft: "10px", margin: 0 }}>
          {paper.summary.length > 160 ? paper.summary.slice(0, 157) + "..." : paper.summary}
        </p>
      )}
      {paper.keywords.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
          {paper.keywords.slice(0, 2).map((kw, ki) => (
            <span key={kw} style={{ padding: "3px 10px", fontSize: "0.6rem", fontWeight: 700, textTransform: "uppercase", fontFamily: "var(--font-mono), monospace", background: tagColors[ki % tagColors.length], border: "1.5px solid #1a1a1a" }}>
              {kw}
            </span>
          ))}
        </div>
      )}
    </button>
  );
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

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ background: "white" }}>
        <Loader2 className="size-6 animate-spin text-[#888]" />
      </div>
    );
  }

  if (error || !digest) {
    return (
      <div className="flex min-h-screen items-center justify-center flex-col gap-4" style={{ background: "white" }}>
        <p style={{ fontSize: "0.8rem", color: "#888", fontFamily: "var(--font-mono), monospace", textTransform: "uppercase", letterSpacing: "2px" }}>
          {error || "Digest not found"}
        </p>
        <a href="/" style={{ fontSize: "0.7rem", color: "#1a1a1a", fontFamily: "var(--font-mono), monospace", textDecoration: "underline" }}>
          Go to today&apos;s digest
        </a>
      </div>
    );
  }

  const openSource = (p: PaperItem) => p.sourceUrl && window.open(p.sourceUrl, "_blank", "noopener,noreferrer");

  return (
    <div className="relative min-h-screen" style={{ background: "white" }}>
      <NoiseOverlay />

      {/* Header */}
      <header style={{ borderBottom: "3px solid #1a1a1a", background: "white", padding: "12px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "relative", zIndex: 20 }}>
        <a href="/" style={{ textDecoration: "none" }}>
          <span style={{ fontSize: "0.85rem", fontWeight: 800, fontFamily: "var(--font-display), sans-serif", letterSpacing: "-0.02em", color: "#1a1a1a" }}>
            Learning et al.
          </span>
        </a>
        <span style={{ fontSize: "0.6rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "2px", fontFamily: "var(--font-mono), monospace", color: "#888" }}>
          Archive
        </span>
      </header>

      {/* Content */}
      <div className="grid grid-cols-1 md:grid-cols-[5fr_minmax(340px,2fr)] w-full" style={{ position: "relative", zIndex: 10 }}>
        {/* Left: synthesis */}
        <div className="px-4 md:px-10 pt-6 md:pt-8 pb-6 md:pb-8">
          <span style={{ fontSize: "0.7rem", color: "#555", fontFamily: "var(--font-mono), monospace", textTransform: "uppercase", letterSpacing: "2px", fontWeight: 700 }}>
            {digest.date}
          </span>

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
          <div style={{ marginBottom: "20px" }}>
            <span style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "2px", fontFamily: "var(--font-mono), monospace", color: "#555" }}>Referenced Sources</span>
          </div>
          <div className="space-y-3">
            {papers.map((paper, idx) => (
              <PaperSourceTab key={paper.id} paper={paper} index={idx} />
            ))}
          </div>
        </div>
      </div>

      {/* Mobile: sources below */}
      <div className="block md:hidden px-4 pb-20 space-y-3">
        <span style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "2px", fontFamily: "var(--font-mono), monospace", color: "#555" }}>Referenced Sources</span>
        {papers.map((paper, idx) => (
          <PaperSourceTab key={paper.id} paper={paper} index={idx} />
        ))}
      </div>
    </div>
  );
}
