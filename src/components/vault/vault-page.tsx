"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { GitCompare, Loader2, Search, ChevronLeft, ChevronRight, Star } from "lucide-react";
import { PaperDetail } from "@/components/today/paper-detail";
import { CompareView } from "./compare-view";
import { PaperCard, type PaperItem } from "@/components/today/paper-card";

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

const LIMIT = 12;
const PASTEL_COLORS = ["#fef3c7", "#bae6fd", "#d8b4fe", "#fed7aa", "#a5f3fc"];

// Category colors for field filter tags — gives visual hierarchy matching the brutalist tag style
const FIELD_COLORS: Record<string, string> = {
  CS: "#dbeafe",
  Art: "#fce7f3",
  Bio: "#dcfce7",
  Med: "#fef9c3",
  Physics: "#e2d5f1",
  Math: "#e0e7ff",
  "Social Sci": "#fed7aa",
  "Env Sci": "#d1fae5",
  Business: "#fef3c7",
  Econ: "#fef3c7",
  "Pol Sci": "#fee2e2",
  Phil: "#ede9fe",
  Ling: "#fbcfe8",
  Law: "#e5e7eb",
  Edu: "#ccfbf1",
  Sociology: "#fce7f3",
  Design: "#fbcfe8",
  Psychology: "#e9d5ff",
};

interface Interest {
  id: string;
  keyword: string;
  field: string;
  weight: number | null;
  source: string;
}

interface DigestTheme {
  id: string;
  date: string;
  theme: string;
  starred: boolean;
  synthesisContent: string | null;
}

export function VaultPage({ session }: VaultPageProps) {
  const [papers, setPapers] = useState<PaperItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [pastThemes, setPastThemes] = useState<DigestTheme[]>([]);
  const [activeDigestId, setActiveDigestId] = useState<string | null>(null);
  const [starFilter, setStarFilter] = useState(false);
  const [digestPapers, setDigestPapers] = useState<PaperItem[] | null>(null);

  const [interests, setInterests] = useState<Interest[]>([]);
  const [activeField, setActiveField] = useState<string | null>(null);
  const [sourceFilter, setSourceFilter] = useState<"all" | "papers" | "news">("all");

  const [compareMode, setCompareMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [selectedPaper, setSelectedPaper] = useState<PaperItem | null>(null);

  const [comparing, setComparing] = useState(false);
  const [comparisonResult, setComparisonResult] = useState<{
    content: string;
    papers: PaperItem[];
  } | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Fetch papers
  const fetchPapers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(LIMIT),
      });
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (sourceFilter !== "all") params.set("source", sourceFilter);

      const res = await fetch(`/api/vault?${params}`);
      if (!res.ok) throw new Error("Failed to fetch vault");
      const data = await res.json();
      setPapers(data.papers ?? []);
      setTotal(data.total ?? 0);
    } catch (err) {
      console.error("Vault fetch error:", err);
      setPapers([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, sourceFilter]);

  useEffect(() => {
    fetchPapers();
  }, [fetchPapers]);

  // Fetch interests for field-based filtering
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/interests");
        if (!res.ok) return;
        const data = await res.json();
        setInterests(data.interests ?? []);
      } catch (err) {
        console.error("Failed to fetch interests:", err);
      }
    })();
  }, []);

  // Fetch past themes
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
            displayTheme = firstLine
              .replace(/^#+\s*/, "")
              .replace(/\*\*/g, "")
              .replace(/^Today[^.!?]*[.!?]\s*/i, "")
              .trim()
              .slice(0, 80);
          }
          return { id: d.id, date: d.date, theme: displayTheme || "Untitled digest", starred: !!d.starred, synthesisContent: d.synthesisContent };
        });
        setPastThemes(themes);
      } catch (err) {
        console.error("Failed to fetch past themes:", err);
      }
    })();
  }, []);

  // Fetch papers for a specific digest by ID
  const handleThemeClick = async (digestId: string) => {
    if (activeDigestId === digestId) {
      setActiveDigestId(null);
      setDigestPapers(null);
      return;
    }
    setActiveDigestId(digestId);
    try {
      const res = await fetch(`/api/digest?id=${digestId}`);
      if (!res.ok) return;
      const data = await res.json();
      setDigestPapers(data.papers ?? []);
    } catch (err) {
      console.error("Failed to fetch digest papers:", err);
      setDigestPapers(null);
    }
  };

  // Group interests by field for top-level tabs
  const fieldGroups = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const i of interests) {
      if (i.source === "dislike") continue;
      const field = i.field || "Other";
      // Shorten field name for display
      const shortField = field
        .replace("Computer Science", "CS")
        .replace("Biology", "Bio")
        .replace("Medicine", "Med")
        .replace("Physics", "Physics")
        .replace("Mathematics", "Math")
        .replace("Social Sciences", "Social Sci")
        .replace("Environmental Science", "Env Sci")
        .replace("Business", "Business")
        .replace("Economics", "Econ")
        .replace("Political Science", "Pol Sci")
        .replace("Philosophy", "Phil")
        .replace("Linguistics", "Ling")
        .replace("Law", "Law")
        .replace("Education", "Edu");
      if (!map.has(shortField)) map.set(shortField, []);
      if (!map.get(shortField)!.includes(i.keyword)) {
        map.get(shortField)!.push(i.keyword);
      }
    }
    return map;
  }, [interests]);

  // Filter papers by active field (keyword overlap with user's interests in that field) or active digest
  const filteredPapers = useMemo(() => {
    const base = activeDigestId && digestPapers ? digestPapers : papers;
    if (!activeField) return base;
    const fieldKeywords = fieldGroups.get(activeField) ?? [];
    if (fieldKeywords.length === 0) return base;
    return base.filter((p) =>
      p.keywords.some((pk) =>
        fieldKeywords.some((fk) => {
          const pkWords = pk.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
          const fkWords = fk.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
          return pkWords.some((pw) => fkWords.some((fw) => pw.includes(fw) || fw.includes(pw)));
        })
      )
    );
  }, [papers, activeField, activeDigestId, digestPapers, fieldGroups]);

  // Toggle card selection in compare mode
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else if (next.size < 3) {
        next.add(id);
      }
      return next;
    });
  };

  // Run comparison
  const runCompare = async () => {
    setComparing(true);
    try {
      const res = await fetch("/api/vault/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paperIds: Array.from(selectedIds),
          apiKey: session.apiKey,
          provider: session.provider,
          model: session.model,
          baseUrl: session.baseUrl,
        }),
      });
      if (!res.ok) throw new Error("Comparison failed");
      const data = await res.json();
      const comparedPapers = papers.filter((p) => selectedIds.has(p.id));
      setComparisonResult({
        content: data.comparison?.content ?? data.comparison ?? "",
        papers: comparedPapers,
      });
    } catch (err) {
      console.error("Compare error:", err);
    } finally {
      setComparing(false);
    }
  };

  // Exit compare mode
  const exitCompareMode = () => {
    setCompareMode(false);
    setSelectedIds(new Set());
  };

  // If viewing a comparison result
  if (comparisonResult) {
    return (
      <CompareView
        content={comparisonResult.content}
        papers={comparisonResult.papers}
        session={session}
        onBack={() => {
          setComparisonResult(null);
          exitCompareMode();
        }}
      />
    );
  }

  // Feedback handlers
  const handleFeedback = async (paperId: string, type: "star" | "dislike") => {
    try {
      await fetch(`/api/papers/${paperId}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      });
    } catch (err) {
      console.error("Failed to submit feedback:", err);
    }
  };

  return (
    <div className="flex flex-col md:min-h-[calc(100vh-3.5rem)]">
      {/* Shared filter bar spanning full width — ensures aligned borders */}
      <div className="hidden md:grid" style={{ gridTemplateColumns: "260px 1fr", borderBottom: "4px solid #1a1a1a" }}>
        {/* Sidebar header (inside shared bar for alignment) */}
        <div style={{ borderRight: "4px solid #1a1a1a", padding: "12px 16px", display: "flex", flexDirection: "column", justifyContent: "center", gap: "10px", background: "#f9fafb" }}>
          <h3 style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "2px", color: "#1a1a1a", fontFamily: "var(--font-mono), monospace", margin: 0 }}>
            Past Themes
          </h3>
          <div style={{ display: "flex", border: "2px solid #1a1a1a" }}>
            <button
              onClick={() => setStarFilter(false)}
              style={{
                flex: 1, padding: "5px 0", border: "none", cursor: "pointer",
                background: !starFilter ? "#1a1a1a" : "transparent",
                color: !starFilter ? "white" : "#1a1a1a",
                fontSize: "0.6rem", fontWeight: 700, textTransform: "uppercase",
                letterSpacing: "1.5px", fontFamily: "var(--font-mono), monospace",
              }}
            >
              All
            </button>
            <button
              onClick={() => setStarFilter(true)}
              style={{
                flex: 1, padding: "5px 0", border: "none", borderLeft: "2px solid #1a1a1a", cursor: "pointer",
                background: starFilter ? "#1a1a1a" : "transparent",
                color: starFilter ? "#f59e0b" : "#999",
                fontSize: "0.6rem", fontWeight: 700, textTransform: "uppercase",
                letterSpacing: "1.5px", fontFamily: "var(--font-mono), monospace",
                display: "flex", alignItems: "center", justifyContent: "center", gap: "4px",
              }}
            >
              <Star size={10} className={starFilter ? "fill-current" : ""} />
              Starred
            </button>
          </div>
        </div>

        {/* Filter rows (inside shared bar for alignment) */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          {/* Row 1: Field filters */}
          {fieldGroups.size > 0 && (
            <div
              className="px-6"
              style={{
                padding: "8px 24px",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                flexWrap: "wrap",
                borderBottom: "1px solid #e5e7eb",
              }}
            >
              <button
                onClick={() => setActiveField(null)}
                style={{
                  padding: "0 10px", height: "28px",
                  background: activeField === null ? "#1a1a1a" : "transparent",
                  border: "2px solid #1a1a1a",
                  boxShadow: activeField === null ? "2px 2px 0px 0px rgba(0,0,0,1)" : "none",
                  color: activeField === null ? "white" : "#1a1a1a",
                  fontSize: "0.6rem",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "1px",
                  fontFamily: "var(--font-mono), monospace",
                  whiteSpace: "nowrap",
                  cursor: "pointer",
                }}
              >
                All
              </button>

              {Array.from(fieldGroups.keys()).map((field) => {
                const isActive = activeField === field;
                const fieldColor = FIELD_COLORS[field] || "#e5e7eb";
                return (
                  <button
                    key={field}
                    onClick={() => setActiveField(isActive ? null : field)}
                    style={{
                      padding: "0 10px", height: "28px",
                      background: isActive ? "#1a1a1a" : fieldColor,
                      border: "2px solid #1a1a1a",
                      boxShadow: isActive ? "2px 2px 0px 0px rgba(0,0,0,1)" : "none",
                      color: isActive ? "white" : "#1a1a1a",
                      fontSize: "0.6rem",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "1px",
                      fontFamily: "var(--font-mono), monospace",
                      whiteSpace: "nowrap",
                      cursor: "pointer",
                    }}
                  >
                    {field}
                  </button>
                );
              })}
            </div>
          )}
          {/* Row 2: Source filter + Search */}
          <div
            className="px-6"
            style={{
              padding: "8px 24px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "12px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div style={{ display: "flex", border: "2px solid #1a1a1a" }}>
                {(["all", "papers", "news"] as const).map((f, i) => (
                  <button
                    key={f}
                    onClick={() => { setSourceFilter(f); setPage(1); }}
                    style={{
                      padding: "0 12px", height: "28px",
                      background: sourceFilter === f ? "#1a1a1a" : "transparent",
                      border: "none",
                      borderLeft: i > 0 ? "2px solid #1a1a1a" : "none",
                      color: sourceFilter === f ? "white" : "#1a1a1a",
                      fontSize: "0.6rem", fontWeight: 700, textTransform: "uppercase",
                      letterSpacing: "1px", fontFamily: "var(--font-mono), monospace",
                      whiteSpace: "nowrap", cursor: "pointer",
                    }}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            <div className="shrink-0 relative">
              <Search
                style={{
                  position: "absolute",
                  left: "8px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  width: "12px",
                  height: "12px",
                  color: "#666",
                }}
              />
              <input
                placeholder="SEARCH..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-[140px] md:w-[200px]"
                style={{
                  border: "2px solid #1a1a1a",
                  background: "transparent",
                  paddingLeft: "28px",
                  paddingRight: "12px",
                  height: "28px",
                  fontSize: "0.7rem",
                  textTransform: "uppercase",
                  letterSpacing: "1px",
                  fontFamily: 'var(--font-mono), monospace',
                  borderRadius: 0,
                  outline: "none",
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Mobile filter bar */}
      <div className="flex md:hidden flex-col" style={{ borderBottom: "4px solid #1a1a1a" }}>
        {fieldGroups.size > 0 && (
          <div className="px-4" style={{ padding: "8px 16px", display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap", borderBottom: "1px solid #e5e7eb" }}>
            <button
              onClick={() => setActiveField(null)}
              style={{
                padding: "0 10px", height: "28px",
                background: activeField === null ? "#1a1a1a" : "transparent",
                border: "2px solid #1a1a1a",
                color: activeField === null ? "white" : "#1a1a1a",
                fontSize: "0.6rem", fontWeight: 700, textTransform: "uppercase",
                letterSpacing: "1px", fontFamily: "var(--font-mono), monospace",
                cursor: "pointer",
              }}
            >
              All
            </button>
            {Array.from(fieldGroups.keys()).map((field) => {
              const isActive = activeField === field;
              const fieldColor = FIELD_COLORS[field] || "#e5e7eb";
              return (
                <button
                  key={field}
                  onClick={() => setActiveField(isActive ? null : field)}
                  style={{
                    padding: "0 10px", height: "28px",
                    background: isActive ? "#1a1a1a" : fieldColor,
                    border: "2px solid #1a1a1a",
                    color: isActive ? "white" : "#1a1a1a",
                    fontSize: "0.6rem", fontWeight: 700, textTransform: "uppercase",
                    letterSpacing: "1px", fontFamily: "var(--font-mono), monospace",
                    cursor: "pointer",
                  }}
                >
                  {field}
                </button>
              );
            })}
          </div>
        )}
        <div className="px-4" style={{ padding: "8px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
          <div style={{ display: "flex", border: "2px solid #1a1a1a" }}>
            {(["all", "papers", "news"] as const).map((f, i) => (
              <button
                key={f}
                onClick={() => { setSourceFilter(f); setPage(1); }}
                style={{
                  padding: "0 12px", height: "28px",
                  background: sourceFilter === f ? "#1a1a1a" : "transparent",
                  border: "none",
                  borderLeft: i > 0 ? "2px solid #1a1a1a" : "none",
                  color: sourceFilter === f ? "white" : "#1a1a1a",
                  fontSize: "0.6rem", fontWeight: 700, textTransform: "uppercase",
                  letterSpacing: "1px", fontFamily: "var(--font-mono), monospace",
                  cursor: "pointer",
                }}
              >
                {f}
              </button>
            ))}
          </div>
          <div className="shrink-0 relative">
            <Search style={{ position: "absolute", left: "8px", top: "50%", transform: "translateY(-50%)", width: "12px", height: "12px", color: "#666" }} />
            <input
              placeholder="SEARCH..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-[140px]"
              style={{ border: "2px solid #1a1a1a", background: "transparent", paddingLeft: "28px", paddingRight: "12px", height: "28px", fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "1px", fontFamily: 'var(--font-mono), monospace', borderRadius: 0, outline: "none" }}
            />
          </div>
        </div>
      </div>

      {/* Main body: sidebar + content */}
      <div className="flex flex-col md:grid flex-1" style={{ gridTemplateColumns: "260px 1fr" }}>
        {/* Left sidebar — Past Themes (desktop) */}
        <aside className="hidden md:flex flex-col" style={{ background: "#f9fafb", overflowY: "auto", borderRight: "4px solid #1a1a1a" }}>
          <div style={{ padding: "4px 0", flex: 1 }}>
            {pastThemes.filter(t => !starFilter || t.starred).map(theme => (
              <div
                key={theme.id}
                onClick={() => handleThemeClick(theme.id)}
                style={{
                  padding: "10px 16px", cursor: "pointer", transition: "background 0.1s",
                  background: activeDigestId === theme.id ? "#e5e7eb" : "transparent",
                  borderLeft: activeDigestId === theme.id ? "4px solid #1a1a1a" : "4px solid transparent",
                }}
                className="hover:bg-gray-100"
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "3px" }}>
                  <span style={{ fontSize: "0.6rem", color: "#888", fontFamily: "var(--font-mono), monospace" }}>{theme.date}</span>
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      const s = !theme.starred;
                      setPastThemes(prev => prev.map(t => t.id === theme.id ? { ...t, starred: s } : t));
                      try { await fetch("/api/digest/star", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ digestId: theme.id }) }); } catch { setPastThemes(prev => prev.map(t => t.id === theme.id ? { ...t, starred: !s } : t)); }
                    }}
                    style={{ background: "none", border: "none", cursor: "pointer", padding: "2px", color: theme.starred ? "#f59e0b" : "#ddd" }}
                    className="hover:text-[#f59e0b]"
                  >
                    <Star size={12} className={theme.starred ? "fill-current" : ""} />
                  </button>
                </div>
                <span style={{ fontSize: "0.78rem", color: "#1a1a1a", fontWeight: 600, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", lineHeight: 1.3, fontFamily: "var(--font-display), sans-serif" }}>
                  {theme.theme}
                </span>
              </div>
            ))}
            {pastThemes.filter(t => !starFilter || t.starred).length === 0 && (
              <div style={{ padding: "24px 16px", textAlign: "center" }}>
                <span style={{ fontSize: "0.6rem", textTransform: "uppercase", letterSpacing: "2px", color: "#888", fontFamily: "var(--font-mono), monospace" }}>
                  {starFilter ? "No starred themes" : "No past themes yet"}
                </span>
              </div>
            )}
          </div>
        </aside>

        {/* Main content area */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          {selectedPaper ? (
            <PaperDetail
              paper={selectedPaper}
              session={session}
              inline
              onBack={() => setSelectedPaper(null)}
              onStar={(id) => handleFeedback(id, "star")}
              onDislike={(id) => handleFeedback(id, "dislike")}
            />
          ) : (
          <>
          {/* Grid header */}
          <div
            className="px-4 md:px-6 pt-5"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "8px",
            }}
          >
            <div>
              <div style={{ display: "flex", alignItems: "baseline", gap: "10px" }}>
                <h2
                  style={{
                    fontSize: "1.3rem",
                    fontWeight: 800,
                    textTransform: "uppercase",
                    letterSpacing: "1px",
                    color: "#1a1a1a",
                    fontFamily: "var(--font-display), sans-serif",
                    margin: 0,
                  }}
                >
                  Your Vault
                </h2>
                <span
                  style={{
                    fontSize: "0.6rem",
                    color: "#999",
                    fontFamily: 'var(--font-mono), monospace',
                    textTransform: "uppercase",
                    letterSpacing: "1px",
                  }}
                >
                  {total} papers
                </span>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
              {compareMode && selectedIds.size >= 2 && (
                <button
                  disabled={comparing}
                  onClick={runCompare}
                  className="min-h-[44px] md:min-h-0"
                  style={{
                    border: "2px solid #1a1a1a",
                    background: "#1a1a1a",
                    color: "white",
                    padding: "8px 16px",
                    fontSize: "0.7rem",
                    textTransform: "uppercase",
                    letterSpacing: "2px",
                    fontFamily: 'var(--font-mono), monospace',
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    boxShadow: "4px 4px 0px 0px rgba(0,0,0,1)",
                    opacity: comparing ? 0.5 : 1,
                  }}
                >
                  {comparing ? (
                    <>
                      <Loader2 style={{ width: "14px", height: "14px", animation: "spin 1s linear infinite" }} />
                      Comparing...
                    </>
                  ) : (
                    <>Run comparison ({selectedIds.size})</>
                  )}
                </button>
              )}
              <button
                onClick={() => {
                  if (compareMode) {
                    exitCompareMode();
                  } else {
                    setCompareMode(true);
                  }
                }}
                className="min-h-[44px] md:min-h-0"
                style={{
                  border: "2px solid #1a1a1a",
                  background: compareMode ? "#1a1a1a" : "transparent",
                  color: compareMode ? "white" : "#1a1a1a",
                  padding: "8px 16px",
                  fontSize: "0.65rem",
                  textTransform: "uppercase",
                  letterSpacing: "2px",
                  fontFamily: 'var(--font-mono), monospace',
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  boxShadow: compareMode ? "3px 3px 0px 0px rgba(0,0,0,1)" : "none",
                }}
              >
                <GitCompare style={{ width: "14px", height: "14px" }} />
                {compareMode ? "Cancel" : "Compare papers"}
              </button>
            </div>
          </div>

          {/* Compare info bar */}
          {compareMode && (
            <div
              className="mx-4 md:mx-6 mt-3"
              style={{
                border: "2px solid #1a1a1a",
                background: "#fef9c3",
                padding: "10px 16px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                boxShadow: "2px 2px 0px 0px rgba(0,0,0,1)",
              }}
            >
              <span
                style={{
                  fontSize: "0.65rem",
                  textTransform: "uppercase",
                  letterSpacing: "2px",
                  color: "#1a1a1a",
                  fontFamily: 'var(--font-mono), monospace',
                  fontWeight: 600,
                }}
              >
                Click 2-3 papers to select them for comparison.{" "}
                <span style={{ fontWeight: 800 }}>
                  {selectedIds.size}/3 selected
                </span>
              </span>
            </div>
          )}

        {/* Card grid */}
        <div
          className="flex-1 p-4 md:px-6 md:py-5"
          style={{
            background: "white",
          }}
        >
          {loading && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "80px 0" }}>
              <Loader2 className="size-6 animate-spin" style={{ color: "#666" }} />
            </div>
          )}

          {!loading && filteredPapers.length === 0 && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "80px 0" }}>
              <span
                style={{
                  fontSize: "0.7rem",
                  textTransform: "uppercase",
                  letterSpacing: "2px",
                  color: "#666",
                  fontFamily: 'var(--font-mono), monospace',
                }}
              >
                {debouncedSearch
                  ? "No papers match your search"
                  : "Your vault is empty. Papers appear here after you generate a digest from the Today tab."}
              </span>
            </div>
          )}

          {!loading && filteredPapers.length > 0 && (
            <div
              style={{
                display: "grid",
                gap: "20px",
              }}
              className="grid-cols-[repeat(auto-fill,minmax(160px,1fr))] md:grid-cols-[repeat(auto-fill,minmax(240px,1fr))]"
            >
              {filteredPapers.map((paper, cardIdx) => (
                <PaperCard
                  key={paper.id}
                  paper={paper}
                  index={cardIdx}
                  compact
                  compareMode={compareMode}
                  isCompareSelected={selectedIds.has(paper.id)}
                  onSelect={(p) => compareMode ? toggleSelect(p.id) : setSelectedPaper(p)}
                  onStar={(id) => handleFeedback(id, "star")}
                  onDislike={(id) => handleFeedback(id, "dislike")}
                />
              ))}
            </div>
          )}

          {/* Pagination */}
          {!loading && totalPages > 1 && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "16px",
                paddingTop: "24px",
              }}
            >
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="min-h-[44px] md:min-h-0"
                style={{
                  border: "2px solid #1a1a1a",
                  background: "transparent",
                  padding: "6px 14px",
                  fontSize: "0.65rem",
                  textTransform: "uppercase",
                  letterSpacing: "2px",
                  fontFamily: 'var(--font-mono), monospace',
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  opacity: page <= 1 ? 0.3 : 1,
                  color: "#1a1a1a",
                  boxShadow: "2px 2px 0px 0px rgba(0,0,0,0.15)",
                }}
              >
                <ChevronLeft style={{ width: "12px", height: "12px" }} />
                PREV
              </button>
              <span
                style={{
                  fontSize: "0.65rem",
                  textTransform: "uppercase",
                  letterSpacing: "2px",
                  color: "#666",
                  fontFamily: 'var(--font-mono), monospace',
                  fontWeight: 700,
                }}
              >
                PAGE {page} OF {totalPages}
              </span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="min-h-[44px] md:min-h-0"
                style={{
                  border: "2px solid #1a1a1a",
                  background: "transparent",
                  padding: "6px 14px",
                  fontSize: "0.65rem",
                  textTransform: "uppercase",
                  letterSpacing: "2px",
                  fontFamily: 'var(--font-mono), monospace',
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  opacity: page >= totalPages ? 0.3 : 1,
                  color: "#1a1a1a",
                  boxShadow: "2px 2px 0px 0px rgba(0,0,0,0.15)",
                }}
              >
                NEXT
                <ChevronRight style={{ width: "12px", height: "12px" }} />
              </button>
            </div>
          )}
        </div>
          </>
          )}
        </div>
      </div>
    </div>
  );
}
