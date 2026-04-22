"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { GitCompare, Loader2, Search, ChevronLeft, ChevronRight, Star } from "lucide-react";
import React from "react";
import { CompareView } from "./compare-view";
import { FIELD_HIERARCHY } from "@/lib/field-hierarchy";
import type { PaperItem } from "@/components/today/paper-card";

interface VaultPageProps {
  session: {
    userId: string | null;
    apiKey: string;
    provider: string;
    model: string;
    baseUrl: string;
    isSetUp: boolean;
  };
}

interface DigestTheme {
  id: string;
  date: string;
  theme: string;
  starred: boolean;
}

interface Interest {
  id: string;
  keyword: string;
  field: string;
  weight: number | null;
  source: string;
}

const LIMIT = 12;

const SOURCE_PALETTES: [string, string][] = [
  ["#C8F0D8", "#F0F5A8"],
  ["#FFD6E0", "#FFE89A"],
  ["#D0E3F7", "#E2D6F7"],
  ["#FFE89A", "#FFD6E0"],
];

function dispersedWash(palette: [string, string], intensity = 0.5): React.CSSProperties {
  const a = Math.min(255, Math.round(intensity * 255)).toString(16).padStart(2, "0");
  const b = Math.min(255, Math.round(intensity * 0.6 * 255)).toString(16).padStart(2, "0");
  const [h1, h2] = palette;
  return {
    background: `
      radial-gradient(circle 170px at 2% 2%, ${h1}${a} 0%, transparent 62%),
      radial-gradient(circle 160px at 98% 6%, ${h2}${a} 0%, transparent 62%),
      radial-gradient(circle 150px at 96% 100%, ${h1}${b} 0%, transparent 62%),
      radial-gradient(circle 170px at 2% 98%, ${h2}${b} 0%, transparent 62%),
      #fff`,
    backgroundBlendMode: "multiply, multiply, multiply, multiply, normal",
  } as React.CSSProperties;
}

function getJournalName(sourceUrl: string | null, authors: string[]): string | null {
  if (!sourceUrl) return null;
  try {
    const hostname = new URL(sourceUrl).hostname.replace("www.", "");
    const domainMap: Record<string, string> = {
      "arxiv.org": "arXiv", "nature.com": "Nature", "sciencedirect.com": "ScienceDirect",
      "springer.com": "Springer", "ieee.org": "IEEE", "acm.org": "ACM", "pnas.org": "PNAS",
      "frontiersin.org": "Frontiers", "mdpi.com": "MDPI", "wiley.com": "Wiley",
      "tandfonline.com": "Taylor & Francis", "sagepub.com": "SAGE", "cambridge.org": "Cambridge UP",
      "oup.com": "Oxford UP", "plos.org": "PLOS", "biorxiv.org": "bioRxiv",
      "medrxiv.org": "medRxiv", "ssrn.com": "SSRN",
    };
    for (const [domain, name] of Object.entries(domainMap)) {
      if (hostname.includes(domain)) return name;
    }
    const parts = hostname.split(".");
    const name = parts.length > 2 ? parts.slice(0, -2).join(".") : parts[0];
    if (name.length < 3) return null;
    const derived = name.charAt(0).toUpperCase() + name.slice(1);
    // Don't repeat what's already in authors
    if (authors.some(a => a.toLowerCase() === derived.toLowerCase())) return null;
    return derived;
  } catch { return null; }
}

function VaultCard({
  paper, index, compareMode, isSelected, onSelect,
}: {
  paper: PaperItem; index: number; compareMode?: boolean; isSelected?: boolean; onSelect?: (p: PaperItem) => void;
}) {
  const palette = SOURCE_PALETTES[index % SOURCE_PALETTES.length];
  const url = (paper.sourceUrl || "").toLowerCase();
  const sourceType = url.includes("arxiv") ? "arXiv" : paper.source === "rss" ? "News" : "Paper";
  const journalName = getJournalName(paper.sourceUrl, paper.authors);
  const ruleRef = React.useRef<HTMLDivElement>(null);
  const baseWash = dispersedWash(palette, 0.5);
  const hoverWash = dispersedWash(palette, 0.74);

  return (
    <div
      onClick={() => {
        if (compareMode) { onSelect?.(paper); return; }
        if (paper.sourceUrl) window.open(paper.sourceUrl, "_blank", "noopener,noreferrer");
      }}
      style={{
        ...baseWash,
        border: isSelected ? "2px solid #1a1a1a" : "1px solid #1a1a1a",
        display: "block",
        padding: "16px 18px 18px",
        color: "inherit",
        position: "relative",
        overflow: "hidden",
        transition: "background 320ms",
        cursor: "pointer",
        boxShadow: isSelected ? "4px 4px 0 #1a1a1a" : "none",
      }}
      onMouseEnter={e => {
        Object.assign((e.currentTarget as HTMLElement).style, hoverWash);
        if (ruleRef.current) ruleRef.current.style.transform = "scaleX(1)";
      }}
      onMouseLeave={e => {
        Object.assign((e.currentTarget as HTMLElement).style, baseWash);
        if (ruleRef.current) ruleRef.current.style.transform = "scaleX(0)";
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
        <div style={{ fontFamily: "var(--font-mono), monospace", fontSize: "0.625rem", letterSpacing: "0.12em", fontWeight: 700, color: "#1a1a1a", textTransform: "uppercase", display: "flex", alignItems: "center", gap: "6px" }}>
          <span>{sourceType}</span>
          <span style={{ color: "#aaa" }}>·</span>
          <span>{paper.year || "2025"}</span>
        </div>
        {compareMode ? (
          <div style={{ width: 18, height: 18, border: "2px solid #1a1a1a", borderRadius: "50%", background: isSelected ? "#1a1a1a" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            {isSelected && <div style={{ width: 8, height: 8, borderRadius: "50%", background: "white" }} />}
          </div>
        ) : (
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
            <path d="M6 3h7v7M12.5 3.5L6.5 9.5M11 8v4.5H3.5V5H8" stroke="#1a1a1a" strokeWidth="1.4" strokeLinecap="square" />
          </svg>
        )}
      </div>

      <div ref={ruleRef} style={{ height: 1, background: "#1a1a1a", transform: "scaleX(0)", transformOrigin: "left center", transition: "transform 360ms cubic-bezier(.2,.7,.2,1)", margin: "-8px 0 10px" }} />

      <h3 style={{ margin: "0 0 8px", fontFamily: "var(--font-display), sans-serif", fontSize: "0.875rem", fontWeight: 700, lineHeight: 1.25, letterSpacing: "-0.01em", color: "#1a1a1a", textTransform: "uppercase" }}>
        {paper.title}
      </h3>

      {(paper.authors.length > 0 || journalName) && (
        <div style={{ fontStyle: "italic", color: "#666", fontSize: "0.75rem", lineHeight: 1.4, marginBottom: "10px" }}>
          {paper.authors.length > 0 && (
            paper.authors.length <= 2 ? paper.authors.join(" & ") : `${paper.authors[0]}${paper.authors[1] ? `, ${paper.authors[1]}` : ""} et al.`
          )}
          {paper.authors.length > 0 && journalName ? " — " : ""}
          {journalName && <em>{journalName}</em>}
        </div>
      )}

      {paper.summary && (
        <div style={{ paddingTop: "10px", marginBottom: "12px", borderTop: "1px solid rgba(26,26,26,0.18)", fontSize: "0.8rem", lineHeight: 1.55, color: "#333" }}>
          {paper.summary.length > 160 ? paper.summary.slice(0, 157) + "..." : paper.summary}
        </div>
      )}

      {paper.keywords.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
          {paper.keywords.slice(0, 2).map((kw) => (
            <span key={kw} style={{
              background: "rgba(255,255,255,0.55)", color: "#1a1a1a",
              border: "1px solid rgba(26,26,26,0.35)",
              fontFamily: "var(--font-mono), monospace",
              fontSize: "0.6rem", fontWeight: 600, letterSpacing: "0.08em",
              padding: "4px 9px", textTransform: "uppercase",
              display: "inline-block", lineHeight: 1, whiteSpace: "nowrap",
              backdropFilter: "blur(6px)",
            }}>
              {kw}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

type FilterMode = "all" | "theme" | "domain" | "starred";

export function VaultPage({ session }: VaultPageProps) {
  const [papers, setPapers] = useState<PaperItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [pastThemes, setPastThemes] = useState<DigestTheme[]>([]);
  const [activeDigestId, setActiveDigestId] = useState<string | null>(null);
  const [digestPapers, setDigestPapers] = useState<PaperItem[] | null>(null);
  const [interests, setInterests] = useState<Interest[]>([]);
  const [activeField, setActiveField] = useState<string | null>(null);
  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [compareMode, setCompareMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [comparing, setComparing] = useState(false);
  const [comparisonResult, setComparisonResult] = useState<{ content: string; papers: PaperItem[] } | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  useEffect(() => {
    const timer = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchPapers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
      if (debouncedSearch) params.set("search", debouncedSearch);
      const res = await fetch(`/api/vault?${params}`);
      if (!res.ok) throw new Error("Failed to fetch vault");
      const data = await res.json();
      setPapers(data.papers ?? []);
      setTotal(data.total ?? 0);
    } catch { setPapers([]); setTotal(0); }
    finally { setLoading(false); }
  }, [page, debouncedSearch]);

  useEffect(() => { fetchPapers(); }, [fetchPapers]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/interests");
        const data = await res.json();
        if (res.ok) setInterests(data.interests ?? []);
      } catch { /* non-critical */ }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/digest?all=true");
        if (!res.ok) return;
        const data = await res.json();
        const themes: DigestTheme[] = (data.digests ?? []).map((d: { id: string; date: string; theme?: string; starred?: boolean; synthesisContent: string | null }) => {
          let displayTheme = d.theme || "";
          if (!displayTheme && d.synthesisContent) {
            const firstLine = d.synthesisContent.split("\n").find((l: string) => l.trim()) ?? "";
            displayTheme = firstLine.replace(/^#+\s*/, "").replace(/\*\*/g, "").replace(/^Today[^.!?]*[.!?]\s*/i, "").trim().slice(0, 80);
          }
          return { id: d.id, date: d.date, theme: displayTheme || "Untitled digest", starred: !!d.starred };
        });
        setPastThemes(themes);
      } catch { /* non-critical */ }
    })();
  }, []);

  const handleThemeClick = async (digestId: string) => {
    if (activeDigestId === digestId) { setActiveDigestId(null); setDigestPapers(null); return; }
    setActiveDigestId(digestId);
    try {
      const res = await fetch(`/api/digest?id=${digestId}`);
      if (!res.ok) return;
      const data = await res.json();
      setDigestPapers(data.papers ?? []);
    } catch { setDigestPapers(null); }
  };

  const fieldNames = useMemo(() => {
    const seen = new Set<string>();
    const names: string[] = [];
    for (const i of interests) {
      if (i.source === "dislike") continue;
      const fieldEntry = Object.entries(FIELD_HIERARCHY).find(([, f]) => f.s2Field === i.field);
      const name = fieldEntry ? fieldEntry[0] : i.field;
      if (!seen.has(name)) { seen.add(name); names.push(name); }
    }
    return names;
  }, [interests]);

  const fieldKeywords = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const i of interests) {
      if (i.source === "dislike") continue;
      const fieldEntry = Object.entries(FIELD_HIERARCHY).find(([, f]) => f.s2Field === i.field);
      const name = fieldEntry ? fieldEntry[0] : i.field;
      if (!map.has(name)) map.set(name, []);
      if (!map.get(name)!.includes(i.keyword)) map.get(name)!.push(i.keyword);
    }
    return map;
  }, [interests]);

  const filteredPapers = useMemo(() => {
    const base = activeDigestId && digestPapers ? digestPapers : papers;
    if (!activeField) return base;
    const keywords = fieldKeywords.get(activeField) ?? [];
    if (keywords.length === 0) return base;
    return base.filter(p =>
      p.keywords.some(pk =>
        keywords.some(fk => {
          const pkWords = pk.toLowerCase().split(/\s+/).filter(w => w.length > 3);
          const fkWords = fk.toLowerCase().split(/\s+/).filter(w => w.length > 3);
          return pkWords.some(pw => fkWords.some(fw => pw.includes(fw) || fw.includes(pw)));
        })
      )
    );
  }, [papers, activeField, activeDigestId, digestPapers, fieldKeywords]);

  const visibleThemes = useMemo(() => {
    if (filterMode === "starred") return pastThemes.filter(t => t.starred);
    return pastThemes;
  }, [pastThemes, filterMode]);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < 3) next.add(id);
      return next;
    });
  };

  const runCompare = async () => {
    setComparing(true);
    try {
      const res = await fetch("/api/vault/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paperIds: Array.from(selectedIds), apiKey: session.apiKey, provider: session.provider, model: session.model, baseUrl: session.baseUrl }),
      });
      if (!res.ok) throw new Error("Comparison failed");
      const data = await res.json();
      setComparisonResult({
        content: data.comparison?.content ?? data.comparison ?? "",
        papers: papers.filter(p => selectedIds.has(p.id)),
      });
    } catch { /* non-critical */ }
    finally { setComparing(false); }
  };

  if (comparisonResult) {
    return (
      <CompareView
        content={comparisonResult.content}
        papers={comparisonResult.papers}
        session={session}
        onBack={() => { setComparisonResult(null); setCompareMode(false); setSelectedIds(new Set()); }}
      />
    );
  }

  const navTabStyle = (active: boolean): React.CSSProperties => ({
    padding: "4px 0", fontSize: "0.625rem", fontWeight: 600,
    textTransform: "uppercase", letterSpacing: "0.12em",
    fontFamily: "var(--font-mono), monospace",
    border: "none", background: "transparent",
    color: active ? "#1a1a1a" : "#999",
    borderBottom: active ? "1.5px solid #1a1a1a" : "1.5px solid transparent",
    cursor: "pointer", transition: "color 0.15s",
  });

  const setMode = (mode: FilterMode) => {
    setFilterMode(prev => prev === mode ? "all" : mode);
    setActiveField(null);
    setActiveDigestId(null);
    setDigestPapers(null);
  };

  return (
    <div style={{ maxWidth: 1400, margin: "0 auto" }} className="px-4 md:px-8 pt-8 pb-20">

      {/* ── Filter bar ── */}
      <div
        className="flex flex-wrap items-center gap-4 md:gap-6"
        style={{ borderBottom: "1px solid #1a1a1a", paddingBottom: "12px", marginBottom: "24px" }}
      >
        <div className="flex items-center gap-4 md:gap-6 flex-1 min-w-0">
          <span style={{ fontFamily: "var(--font-display), sans-serif", fontSize: "1.1rem", fontWeight: 800, letterSpacing: "-0.02em", color: "#1a1a1a", flexShrink: 0 }}>
            Vault
          </span>
          <button style={navTabStyle(filterMode === "theme")} onClick={() => setMode("theme")}>By Theme</button>
          <button style={navTabStyle(filterMode === "domain")} onClick={() => setMode("domain")}>By Domain</button>
          <button
            onClick={() => setMode("starred")}
            style={{ ...navTabStyle(filterMode === "starred"), display: "flex", alignItems: "center", gap: "5px" }}
          >
            <Star size={10} className={filterMode === "starred" ? "fill-current" : ""} />
            Starred
          </button>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {compareMode && selectedIds.size >= 2 && (
            <button
              onClick={runCompare}
              disabled={comparing}
              style={{
                border: "1.5px solid #1a1a1a", background: "#1a1a1a", color: "white",
                padding: "5px 12px", fontSize: "0.6rem", fontWeight: 700,
                textTransform: "uppercase", letterSpacing: "1.5px",
                fontFamily: "var(--font-mono), monospace",
                display: "flex", alignItems: "center", gap: "5px",
                opacity: comparing ? 0.5 : 1, cursor: comparing ? "not-allowed" : "pointer",
              }}
            >
              {comparing ? <Loader2 size={11} className="animate-spin" /> : <GitCompare size={11} />}
              Compare ({selectedIds.size})
            </button>
          )}
          <button
            onClick={() => { setCompareMode(v => !v); setSelectedIds(new Set()); }}
            style={{ ...navTabStyle(compareMode), display: "flex", alignItems: "center", gap: "5px" }}
          >
            <GitCompare size={11} />Compare
          </button>
          <div style={{ position: "relative" }}>
            <Search style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", width: 11, height: 11, color: "#999" }} />
            <input
              placeholder="Search..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                border: "1px solid #ccc", background: "transparent",
                paddingLeft: 26, paddingRight: 10, height: 28,
                fontSize: "0.7rem", letterSpacing: "0.5px",
                fontFamily: "var(--font-mono), monospace",
                outline: "none", width: 150, color: "#1a1a1a",
              }}
            />
          </div>
        </div>
      </div>

      {/* ── Secondary filter row: themes ── */}
      {(filterMode === "theme" || filterMode === "starred") && visibleThemes.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-6">
          {visibleThemes.map(theme => {
            const isActive = activeDigestId === theme.id;
            return (
              <button
                key={theme.id}
                onClick={() => handleThemeClick(theme.id)}
                style={{
                  display: "inline-flex", alignItems: "center", gap: "6px",
                  padding: "5px 12px",
                  background: isActive ? "#1a1a1a" : "transparent",
                  border: isActive ? "1px solid #1a1a1a" : "1px solid rgba(26,26,26,0.3)",
                  color: isActive ? "white" : "#1a1a1a",
                  fontFamily: "var(--font-display), sans-serif",
                  fontSize: "0.78rem", fontWeight: isActive ? 700 : 500,
                  cursor: "pointer", transition: "all 120ms",
                  maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}
              >
                {theme.starred && <Star size={10} style={{ flexShrink: 0, fill: isActive ? "white" : "#f59e0b", stroke: isActive ? "white" : "#f59e0b" }} />}
                {theme.theme}
              </button>
            );
          })}
        </div>
      )}

      {/* ── Secondary filter row: domains ── */}
      {filterMode === "domain" && fieldNames.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-6">
          {fieldNames.map(field => {
            const isActive = activeField === field;
            return (
              <button
                key={field}
                onClick={() => setActiveField(isActive ? null : field)}
                style={{
                  padding: "5px 12px",
                  background: isActive ? "#1a1a1a" : "transparent",
                  border: isActive ? "1px solid #1a1a1a" : "1px solid rgba(26,26,26,0.3)",
                  color: isActive ? "white" : "#1a1a1a",
                  fontFamily: "var(--font-mono), monospace",
                  fontSize: "0.6rem", fontWeight: 600,
                  textTransform: "uppercase", letterSpacing: "1px",
                  cursor: "pointer", transition: "all 120ms",
                }}
              >
                {field}
              </button>
            );
          })}
        </div>
      )}

      {/* ── Compare info bar ── */}
      {compareMode && (
        <div style={{
          border: "1px solid #1a1a1a", background: "#fef9c3",
          padding: "10px 16px", marginBottom: "20px",
          display: "flex", alignItems: "center",
        }}>
          <span style={{ fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: "2px", color: "#1a1a1a", fontFamily: "var(--font-mono), monospace", fontWeight: 600 }}>
            Select 2–3 papers to compare · <strong>{selectedIds.size}/3 selected</strong>
          </span>
        </div>
      )}

      {/* ── Paper grid ── */}
      {loading ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "80px 0" }}>
          <Loader2 className="size-6 animate-spin" style={{ color: "#666" }} />
        </div>
      ) : filteredPapers.length === 0 ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "80px 0" }}>
          <span style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "2px", color: "#888", fontFamily: "var(--font-mono), monospace" }}>
            {debouncedSearch ? "No papers match your search" : activeDigestId ? "No papers found for this digest" : "Your vault is empty"}
          </span>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
          {filteredPapers.map((paper, idx) => (
            <VaultCard
              key={paper.id}
              paper={paper}
              index={idx}
              compareMode={compareMode}
              isSelected={selectedIds.has(paper.id)}
              onSelect={p => compareMode ? toggleSelect(p.id) : undefined}
            />
          ))}
        </div>
      )}

      {/* ── Pagination ── */}
      {!loading && totalPages > 1 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "16px", paddingTop: "32px" }}>
          <button
            disabled={page <= 1}
            onClick={() => setPage(p => p - 1)}
            style={{
              border: "1.5px solid #1a1a1a", background: "transparent", padding: "6px 14px",
              fontSize: "0.6rem", textTransform: "uppercase", letterSpacing: "2px",
              fontFamily: "var(--font-mono), monospace", fontWeight: 700,
              display: "flex", alignItems: "center", gap: "4px",
              opacity: page <= 1 ? 0.3 : 1, color: "#1a1a1a", cursor: page <= 1 ? "default" : "pointer",
            }}
          >
            <ChevronLeft style={{ width: 12, height: 12 }} />Prev
          </button>
          <span style={{ fontSize: "0.6rem", textTransform: "uppercase", letterSpacing: "2px", color: "#888", fontFamily: "var(--font-mono), monospace", fontWeight: 700 }}>
            {page} / {totalPages}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage(p => p + 1)}
            style={{
              border: "1.5px solid #1a1a1a", background: "transparent", padding: "6px 14px",
              fontSize: "0.6rem", textTransform: "uppercase", letterSpacing: "2px",
              fontFamily: "var(--font-mono), monospace", fontWeight: 700,
              display: "flex", alignItems: "center", gap: "4px",
              opacity: page >= totalPages ? 0.3 : 1, color: "#1a1a1a", cursor: page >= totalPages ? "default" : "pointer",
            }}
          >
            Next<ChevronRight style={{ width: 12, height: 12 }} />
          </button>
        </div>
      )}
    </div>
  );
}
