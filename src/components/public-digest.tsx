"use client";

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { SynthesisBanner } from "@/components/today/synthesis-banner";
import { PaperCard, type PaperItem } from "@/components/today/paper-card";

interface Digest {
  id: string;
  theme: string | null;
  synthesisContent: string | null;
  keyConcepts: string[];
  starred: boolean | null;
  date: string;
}

/* ── Source tab (matches logged-in sidebar) ── */
const TAB_DOT_COLORS = ["#f9a8d4", "#93c5fd", "#a3a3a3"];
const TAB_TAG_COLORS = [["#fce7f3", "#dcfce7"], ["#dbeafe", "#fef9c3"], ["#ede9fe", "#fee2e2"]];

function getJournalName(sourceUrl: string | null): string | null {
  if (!sourceUrl) return null;
  try {
    const hostname = new URL(sourceUrl).hostname.replace("www.", "");
    const map: Record<string, string> = {
      "arxiv.org": "arXiv", "nature.com": "Nature", "sciencedirect.com": "ScienceDirect",
      "springer.com": "Springer", "ieee.org": "IEEE", "acm.org": "ACM", "pnas.org": "PNAS",
      "frontiersin.org": "Frontiers", "mdpi.com": "MDPI", "wiley.com": "Wiley",
      "tandfonline.com": "Taylor & Francis", "sagepub.com": "SAGE", "cambridge.org": "Cambridge UP",
      "biorxiv.org": "bioRxiv", "medrxiv.org": "medRxiv", "builtin.com": "Built In",
      "techcrunch.com": "TechCrunch", "wired.com": "WIRED", "theverge.com": "The Verge",
    };
    for (const [domain, name] of Object.entries(map)) {
      if (hostname.includes(domain)) return name;
    }
    if (hostname.includes("doi.org")) {
      const path = new URL(sourceUrl).pathname;
      const doiMap: Record<string, string> = {
        "10.3389": "Frontiers", "10.1038": "Nature", "10.1016": "Elsevier",
        "10.1007": "Springer", "10.1109": "IEEE", "10.1145": "ACM",
        "10.1073": "PNAS", "10.3390": "MDPI", "10.1002": "Wiley",
        "10.1080": "Taylor & Francis", "10.1177": "SAGE", "10.1371": "PLOS",
        "10.1093": "Oxford UP", "10.1017": "Cambridge UP",
      };
      for (const [prefix, pub] of Object.entries(doiMap)) {
        if (path.includes(prefix)) return pub;
      }
      return null;
    }
    const parts = hostname.split(".");
    const name = parts.length > 2 ? parts.slice(0, -2).join(".") : parts[0];
    if (name.length < 3) return null;
    return name.charAt(0).toUpperCase() + name.slice(1);
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
      style={{
        border: "2px solid #1a1a1a", boxShadow: "6px 6px 0px 0px rgba(0,0,0,1)",
        background: "white", padding: "16px 18px",
        display: "flex", flexDirection: "column", gap: "10px",
        width: "100%", textAlign: "left",
      }}
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
      <span style={{ fontSize: "0.85rem", fontWeight: 700, textTransform: "uppercase", lineHeight: 1.3, color: "#1a1a1a", fontFamily: "var(--font-display), sans-serif" }}
        className="group-hover:underline">
        {paper.title}
      </span>
      {(paper.authors.length > 0 || journalName) && (
        <span style={{ fontSize: "0.65rem", color: "#888", fontStyle: "italic", lineHeight: 1.4 }}>
          {paper.authors.length > 0 && (
            paper.authors.length <= 2
              ? paper.authors.join(" & ")
              : `${paper.authors[0]}${paper.authors[1] ? `, ${paper.authors[1]}` : ""} et al.`
          )}
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

const openSource = (p: PaperItem) =>
  p.sourceUrl && window.open(p.sourceUrl, "_blank", "noopener,noreferrer");

export function PublicDigest({ onSignIn }: { onSignIn: () => void }) {
  const [digest, setDigest] = useState<Digest | null>(null);
  const [papers, setPapers] = useState<PaperItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/public/digest");
        if (!res.ok) return;
        const data = await res.json();
        setDigest(data.digest);
        setPapers(data.papers ?? []);
      } catch { /* silent */ }
      finally { setLoading(false); }
    })();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-6 animate-spin text-[#888]" />
      </div>
    );
  }

  if (!digest) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-6 px-4">
        <h1 style={{ fontSize: "2.5rem", fontWeight: 700, fontFamily: "var(--font-display), sans-serif", letterSpacing: "-0.03em", textAlign: "center" }}>
          Today&apos;s digest is brewing
        </h1>
        <p style={{ fontSize: "1rem", color: "#999", textAlign: "center", maxWidth: "440px" }}>
          Check back soon — a fresh research digest is generated every day.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="h-14 flex items-center px-4 md:px-10 mx-auto w-full" style={{ maxWidth: "1400px" }}>
        <span style={{ fontSize: "0.7rem", color: "#555", fontFamily: "var(--font-mono), monospace", textTransform: "uppercase", letterSpacing: "2px", fontWeight: 700 }}>
          Today&apos;s Digest
        </span>
      </div>

      {/* Grid: digest left, sources right */}
      <div className="grid grid-cols-1 md:grid-cols-[3fr_minmax(320px,1fr)] flex-1 overflow-hidden mx-auto w-full" style={{ maxWidth: "1400px" }}>
        {/* Left */}
        <div className="overflow-y-auto px-4 md:px-10 py-6 md:py-8">
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

          {/* Sign in CTA */}
          <div style={{
            marginTop: "32px", padding: "20px 28px",
            border: "2px solid #1a1a1a", boxShadow: "6px 6px 0px 0px rgba(0,0,0,1)",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            gap: "16px", flexWrap: "wrap",
          }}>
            <div>
              <p style={{ fontSize: "0.95rem", fontWeight: 700, color: "#1a1a1a", marginBottom: "4px" }}>
                Want your own daily digest?
              </p>
              <p style={{ fontSize: "0.8rem", color: "#666" }}>
                Pick your interests, connect an AI provider, and get personalized research every day.
              </p>
            </div>
            <button onClick={onSignIn} style={{
              padding: "10px 24px", background: "#1a1a1a", color: "white",
              border: "2px solid #1a1a1a", fontSize: "0.7rem", fontWeight: 700,
              textTransform: "uppercase", letterSpacing: "2px",
              fontFamily: "var(--font-mono), monospace", cursor: "pointer",
              boxShadow: "4px 4px 0px 0px rgba(0,0,0,1)", flexShrink: 0, whiteSpace: "nowrap",
            }}>
              Sign Up Free
            </button>
          </div>
        </div>

        {/* Right: sources (desktop) */}
        <div className="hidden md:block overflow-y-auto py-8 px-4">
          <div style={{ marginBottom: "12px" }}>
            <span style={{ fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "3px", fontFamily: "var(--font-mono), monospace", color: "#999" }}>Referenced Sources</span>
          </div>
          <div className="space-y-3">
            {papers.map((paper, idx) => (
              <PaperSourceTab key={paper.id} paper={paper} index={idx} />
            ))}
          </div>
        </div>
      </div>

      {/* Mobile: sources below */}
      <div className="block md:hidden px-4 pb-8 space-y-2">
        <span style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "3px", fontFamily: "var(--font-mono), monospace", color: "#555" }}>Sources</span>
        {papers.map((paper, idx) => (
          <PaperCard
            key={paper.id}
            paper={paper}
            index={idx}
            compact
            onSelect={openSource}
            onStar={() => {}}
            onDislike={() => {}}
          />
        ))}
      </div>
    </div>
  );
}
