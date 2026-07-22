"use client";

import React, { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import type { PaperItem } from "@/components/today/paper-card";
import { SOURCE_PALETTES, dispersedWash } from "@/components/today/source-card";
import { TermChip } from "@/components/today/brief-digest";
import { journalName } from "@/lib/venue-name";

const MONO = "var(--font-mono), monospace";
const DISPLAY = "var(--font-display), sans-serif";

type Jargon = { term: string; def: string };

// Interleave TermChips into the abstract at the first occurrence of each term.
function annotateAbstract(abstract: string, jargon: Jargon[]): React.ReactNode[] {
  const sorted = [...jargon].sort((a, b) => b.term.length - a.term.length);
  const out: React.ReactNode[] = [];
  const used = new Set<string>();
  let rest = abstract;
  let key = 0;
  while (rest) {
    let best: { i: number; len: number; j: Jargon } | null = null;
    for (const j of sorted) {
      if (used.has(j.term.toLowerCase())) continue;
      const i = rest.toLowerCase().indexOf(j.term.toLowerCase());
      if (i >= 0 && (!best || i < best.i)) best = { i, len: j.term.length, j };
    }
    if (!best) { out.push(<span key={key++}>{rest}</span>); break; }
    used.add(best.j.term.toLowerCase());
    if (best.i > 0) out.push(<span key={key++}>{rest.slice(0, best.i)}</span>);
    out.push(<TermChip key={key++} text={rest.slice(best.i, best.i + best.len)} def={best.j.def} />);
    rest = rest.slice(best.i + best.len);
  }
  return out;
}

export function ReadingPaperDetail({ paper, index, onClose }: { paper: PaperItem; index: number; onClose: () => void }) {
  const idx = Math.max(index, 0);
  const palette = SOURCE_PALETTES[idx % SOURCE_PALETTES.length];
  const journal = journalName(paper.sourceUrl, paper.authors);
  const abstract = (paper.abstract || "").trim();

  const [jargon, setJargon] = useState<Jargon[] | null>(null); // null = loading
  const [eli5, setEli5] = useState<string | null>(null);
  const [eli5Loading, setEli5Loading] = useState(false);
  const [eli5Error, setEli5Error] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!abstract) { setJargon([]); return; }
    fetch(`/api/papers/${paper.id}/insights`)
      .then(r => r.json())
      .then(d => { if (!cancelled) setJargon(d.jargon ?? []); })
      .catch(() => { if (!cancelled) setJargon([]); });
    return () => { cancelled = true; };
  }, [paper.id, abstract]);

  const generateEli5 = async () => {
    setEli5Loading(true);
    setEli5Error(false);
    try {
      const res = await fetch(`/api/papers/${paper.id}/insights`, { method: "POST" });
      const data = await res.json();
      if (data.eli5) setEli5(data.eli5);
      else setEli5Error(true);
    } catch { setEli5Error(true); }
    finally { setEli5Loading(false); }
  };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 80, background: "rgba(26,26,26,0.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ ...dispersedWash(palette, false, idx), maxWidth: 640, width: "100%", maxHeight: "88vh", overflowY: "auto", border: "2px solid #1a1a1a", boxShadow: "8px 8px 0 0 rgba(0,0,0,1)", padding: "26px 30px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <span style={{ fontFamily: MONO, fontSize: "0.6rem", letterSpacing: "1.5px", textTransform: "uppercase", color: "#666" }}>
            {(paper.sourceUrl || "").toLowerCase().includes("arxiv") ? "arXiv" : paper.source === "rss" ? "News" : "Paper"}
            {paper.year ? ` · ${paper.year}` : ""}
          </span>
          <button onClick={onClose} style={{ fontSize: "0.78rem", background: "none", border: "none", cursor: "pointer", color: "#888" }}>✕ Close</button>
        </div>

        <h3 style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: "1.35rem", lineHeight: 1.25, margin: "0 0 8px" }}>{paper.title}</h3>
        {(paper.authors.length > 0 || journal) && (
          <p style={{ fontSize: "0.75rem", fontStyle: "italic", color: "#666", margin: "0 0 20px" }}>
            {paper.authors.slice(0, 6).join(", ")}
            {paper.authors.length > 0 && journal ? " — " : ""}
            {journal}
          </p>
        )}

        {abstract ? (
          <div style={{ marginBottom: 22 }}>
            <div style={{ fontFamily: MONO, fontSize: "0.56rem", letterSpacing: "1.5px", textTransform: "uppercase", color: "#999", marginBottom: 7 }}>
              Abstract{jargon === null && <Loader2 size={9} className="animate-spin" style={{ display: "inline", marginLeft: 6 }} />}
            </div>
            <p style={{ fontSize: "0.92rem", lineHeight: 1.7, color: "#333", margin: 0 }}>
              {jargon && jargon.length > 0 ? annotateAbstract(abstract, jargon) : abstract}
            </p>
          </div>
        ) : (
          <p style={{ fontSize: "0.88rem", color: "#999", fontStyle: "italic", marginBottom: 22 }}>No abstract available.</p>
        )}

        {/* ELI5 — button until generated, then the gist in a yellow callout */}
        {abstract && (
          <div style={{ marginBottom: 22 }}>
            {eli5 ? (
              <div style={{ background: "#FFF4B8", border: "2px solid #1a1a1a", padding: "14px 16px" }}>
                <div style={{ fontFamily: MONO, fontSize: "0.56rem", letterSpacing: "1.5px", textTransform: "uppercase", color: "#1a1a1a", marginBottom: 7, fontWeight: 700 }}>The gist</div>
                <p style={{ fontSize: "0.9rem", lineHeight: 1.65, color: "#1a1a1a", margin: 0 }}>{eli5}</p>
              </div>
            ) : (
              <button
                onClick={generateEli5}
                disabled={eli5Loading}
                style={{ display: "inline-flex", alignItems: "center", gap: 8, fontFamily: MONO, fontSize: "0.65rem", fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", background: "#fff", border: "2px solid #1a1a1a", boxShadow: "3px 3px 0 0 rgba(0,0,0,1)", padding: "10px 16px", cursor: eli5Loading ? "wait" : "pointer", color: "#1a1a1a" }}
              >
                {eli5Loading ? <><Loader2 size={11} className="animate-spin" /> Thinking…</> : "Explain like I'm five"}
              </button>
            )}
            {eli5Error && <p style={{ fontSize: "0.7rem", color: "#ff007f", marginTop: 8 }}>Couldn&apos;t generate — try again.</p>}
          </div>
        )}

        {paper.sourceUrl && (
          <a href={paper.sourceUrl} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 8, fontFamily: MONO, fontSize: "0.65rem", letterSpacing: "1px", textTransform: "uppercase", background: "#1a1a1a", color: "#fff", padding: "10px 16px" }}>
            Read the full paper ↗
          </a>
        )}
      </div>
    </div>
  );
}
