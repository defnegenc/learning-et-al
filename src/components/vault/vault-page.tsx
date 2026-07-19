"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { GitCompare, Loader2, Search, ChevronLeft, ChevronRight, Star, X, Bookmark } from "lucide-react";
import { CompareView } from "./compare-view";
import { FIELD_HIERARCHY } from "@/lib/field-hierarchy";
import type { PaperItem } from "@/components/today/paper-card";
import { SourceCard } from "@/components/today/source-card";
import { NavTab, PageTitle, SectionLabel, ActionButton } from "@/components/design-system";

interface VaultPageProps {
  session: {
    userId: string | null;
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

type FilterMode = "all" | "theme" | "domain" | "starred" | "bookmarked";

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
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [compareMode, setCompareMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [comparing, setComparing] = useState(false);
  const [comparisonResult, setComparisonResult] = useState<{ content: string; papers: PaperItem[] } | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  useEffect(() => {
    const timer = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Reset page when domain filter changes
  useEffect(() => { setPage(1); }, [activeField]);

  const fetchPapers = useCallback(async () => {
    setLoading(true);
    try {
      if (filterMode === "bookmarked") {
        const res = await fetch(`/api/vault?bookmarked=true&page=${page}&limit=${LIMIT}`);
        if (!res.ok) throw new Error("Failed to fetch bookmarks");
        const data = await res.json();
        setPapers(data.papers ?? []);
        setTotal(data.total ?? 0);
        return;
      }
      // When domain filter is active, fetch all papers so client-side filtering works
      // across the full dataset rather than just one page
      const fetchAll = !!activeField;
      const params = new URLSearchParams({
        page: fetchAll ? "1" : String(page),
        limit: fetchAll ? "500" : String(LIMIT),
      });
      if (debouncedSearch) params.set("search", debouncedSearch);
      const res = await fetch(`/api/vault?${params}`);
      if (!res.ok) throw new Error("Failed to fetch vault");
      const data = await res.json();
      setPapers(data.papers ?? []);
      setTotal(data.total ?? 0);
    } catch { setPapers([]); setTotal(0); }
    finally { setLoading(false); }
  }, [page, debouncedSearch, activeField, filterMode]);

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
    setDrawerOpen(false);
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

  const DISPLAY_LIMIT = LIMIT;
  const displayedPapers = activeField ? filteredPapers.slice((page - 1) * DISPLAY_LIMIT, page * DISPLAY_LIMIT) : filteredPapers;
  const displayTotalPages = activeField ? Math.max(1, Math.ceil(filteredPapers.length / DISPLAY_LIMIT)) : totalPages;

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
        body: JSON.stringify({ paperIds: Array.from(selectedIds) }),
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
        onBack={() => { setComparisonResult(null); setCompareMode(false); setSelectedIds(new Set()); }}
      />
    );
  }

  const setMode = (mode: FilterMode) => {
    const isToggleOff = filterMode === mode;
    setFilterMode(isToggleOff ? "all" : mode);
    setActiveField(null);
    setActiveDigestId(null);
    setDigestPapers(null);
    if (mode === "theme" || mode === "starred") {
      setDrawerOpen(!isToggleOff);
    } else {
      setDrawerOpen(false);
    }
  };

  return (
    <div style={{ maxWidth: 1400, margin: "0 auto" }} className="px-4 md:px-8 pt-8 pb-20">

      {/* ── Digest drawer ── */}
      {drawerOpen && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 40, background: "rgba(0,0,0,0.18)" }}
          onClick={() => setDrawerOpen(false)}
        />
      )}
      <div style={{
        position: "fixed", top: 0, left: drawerOpen ? 0 : "-320px", bottom: 0,
        width: 300, background: "white", borderRight: "2px solid #1a1a1a",
        zIndex: 50, transition: "left 220ms cubic-bezier(0.2,0,0,1)",
        display: "flex", flexDirection: "column", overflow: "hidden",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", borderBottom: "1px solid rgba(26,26,26,0.12)", flexShrink: 0 }}>
          <SectionLabel style={{ color: "#1a1a1a" }}>
            {filterMode === "starred" ? "Starred Digests" : "All Digests"}
          </SectionLabel>
          <button onClick={() => setDrawerOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#888", padding: 4, display: "flex" }}>
            <X size={14} />
          </button>
        </div>
        <div style={{ flex: 1, overflowY: "auto" }}>
          {visibleThemes.length === 0 ? (
            <div style={{ padding: "32px 20px", fontSize: "0.7rem", color: "#aaa", fontFamily: "var(--font-mono), monospace", textTransform: "uppercase", letterSpacing: "1px" }}>
              No digests yet
            </div>
          ) : visibleThemes.map((theme, i) => {
            const isActive = activeDigestId === theme.id;
            const isLast = i === visibleThemes.length - 1;
            return (
              <button
                key={theme.id}
                onClick={() => handleThemeClick(theme.id)}
                style={{
                  display: "flex", flexDirection: "column", gap: "4px",
                  width: "100%", padding: "12px 20px", textAlign: "left",
                  background: isActive ? "#1a1a1a" : "transparent",
                  border: "none", borderBottom: isLast ? "none" : "1px solid rgba(26,26,26,0.08)",
                  color: isActive ? "white" : "#1a1a1a",
                  cursor: "pointer", transition: "background 100ms",
                }}
                className={isActive ? "" : "hover:bg-[#f5f5f5]"}
              >
                <span style={{ fontFamily: "var(--font-mono), monospace", fontSize: "0.55rem", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: isActive ? "rgba(255,255,255,0.5)" : "#aaa", display: "flex", alignItems: "center", gap: "6px" }}>
                  {theme.date}
                  {theme.starred && <Star size={8} style={{ fill: isActive ? "rgba(255,255,255,0.5)" : "#f59e0b", stroke: "none" }} />}
                </span>
                <span style={{ fontFamily: "var(--font-display), sans-serif", fontSize: "0.8rem", fontWeight: isActive ? 700 : 500, lineHeight: 1.3 }}>
                  {theme.theme}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Filter bar ── */}
      <div
        className="flex flex-wrap items-center gap-4 md:gap-6"
        style={{ borderBottom: "1px solid #1a1a1a", paddingBottom: "12px", marginBottom: "16px" }}
      >
        <div className="flex items-center gap-4 md:gap-6 flex-1 min-w-0">
          <PageTitle size="sm" style={{ flexShrink: 0 }}>Vault</PageTitle>
          <NavTab active={filterMode === "theme"} onClick={() => setMode("theme")}>By Digest</NavTab>
          <NavTab active={filterMode === "domain"} onClick={() => setMode("domain")}>By Domain</NavTab>
          <NavTab active={filterMode === "starred"} onClick={() => setMode("starred")}>
            <Star size={10} className={filterMode === "starred" ? "fill-current" : ""} />
            Starred
          </NavTab>
          <NavTab active={filterMode === "bookmarked"} onClick={() => setMode("bookmarked")}>
            <Bookmark size={10} className={filterMode === "bookmarked" ? "fill-current" : ""} />
            Bookmarked
          </NavTab>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {compareMode && selectedIds.size >= 2 && (
            <ActionButton size="sm" variant="primary" disabled={comparing} onClick={runCompare}>
              {comparing ? <Loader2 size={11} className="animate-spin" /> : <GitCompare size={11} />}
              Compare ({selectedIds.size})
            </ActionButton>
          )}
          <NavTab active={compareMode} onClick={() => { setCompareMode(v => !v); setSelectedIds(new Set()); }}>
            <GitCompare size={11} />Compare
          </NavTab>
        </div>
      </div>

      {/* ── Search bar — matches today's question box style ── */}
      <div style={{
        display: "flex", gap: "10px", alignItems: "center",
        border: "2px solid #1a1a1a", padding: "10px 14px", background: "white",
        marginBottom: "24px",
      }}>
        <Search style={{ width: 14, height: 14, color: "#aaa", flexShrink: 0 }} />
        <input
          placeholder="Search papers, topics, authors..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            flex: 1, border: "none", outline: "none", fontSize: "0.9rem",
            color: "#1a1a1a", background: "transparent",
          }}
        />
        {search && (
          <button onClick={() => setSearch("")} style={{ background: "none", border: "none", cursor: "pointer", color: "#aaa", fontSize: "0.75rem", fontFamily: "var(--font-mono), monospace", padding: 0 }}>
            ✕
          </button>
        )}
      </div>

      {/* ── Active digest indicator ── */}
      {activeDigestId && (() => {
        const active = pastThemes.find(t => t.id === activeDigestId);
        return active ? (
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
            <span style={{ fontSize: "0.6rem", fontFamily: "var(--font-mono), monospace", fontWeight: 600, textTransform: "uppercase", letterSpacing: "1px", color: "#888" }}>Showing digest:</span>
            <span style={{ fontSize: "0.75rem", fontFamily: "var(--font-display), sans-serif", fontWeight: 600, color: "#1a1a1a" }}>{active.theme}</span>
            <button onClick={() => { setActiveDigestId(null); setDigestPapers(null); }} style={{ background: "none", border: "none", cursor: "pointer", color: "#aaa", display: "flex", padding: 2 }}>
              <X size={12} />
            </button>
          </div>
        ) : null;
      })()}

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
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "80px 0", gap: "12px" }}>
          <Loader2 className="size-6 animate-spin" style={{ color: "#666" }} />
          {activeField && <span style={{ fontSize: "0.6rem", fontFamily: "var(--font-mono), monospace", color: "#aaa", textTransform: "uppercase", letterSpacing: "1px" }}>Loading all papers for domain filter…</span>}
        </div>
      ) : displayedPapers.length === 0 ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "80px 0" }}>
          <span style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "2px", color: "#888", fontFamily: "var(--font-mono), monospace" }}>
            {debouncedSearch ? "No papers match your search" : activeDigestId ? "No papers found for this digest" : "Your vault is empty"}
          </span>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
          {displayedPapers.map((paper, idx) => (
            <SourceCard
              key={paper.id}
              paper={paper}
              index={idx}
              loggedIn={!!session.userId}
              compareMode={compareMode}
              isSelected={selectedIds.has(paper.id)}
              onSelect={p => toggleSelect(p.id)}
            />
          ))}
        </div>
      )}

      {/* ── Pagination ── */}
      {!loading && displayTotalPages > 1 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "16px", paddingTop: "32px" }}>
          <ActionButton size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
            <ChevronLeft style={{ width: 12, height: 12 }} />Prev
          </ActionButton>
          <span style={{ fontSize: "0.6rem", textTransform: "uppercase", letterSpacing: "2px", color: "#888", fontFamily: "var(--font-mono), monospace", fontWeight: 700 }}>
            {page} / {displayTotalPages}
          </span>
          <ActionButton size="sm" disabled={page >= displayTotalPages} onClick={() => setPage(p => p + 1)}>
            Next<ChevronRight style={{ width: 12, height: 12 }} />
          </ActionButton>
        </div>
      )}
    </div>
  );
}
