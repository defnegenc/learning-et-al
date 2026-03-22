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
    <div className="flex flex-col md:grid md:min-h-[calc(100vh-3.5rem)]" style={{ gridTemplateColumns: "1fr 300px" }}>
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
        {/* Field filter ribbon — wraps naturally, no scroll, no dropdowns */}
        <div
          style={{
            borderBottom: "4px solid #1a1a1a",
            padding: "8px 16px",
            display: "flex",
            alignItems: "center",
            gap: "6px",
            flexWrap: "wrap",
          }}
          className="md:px-10"
        >
          <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap", flex: 1 }}>
            <button
              onClick={() => setActiveField(null)}
              style={{
                padding: "4px 12px",
                background: activeField === null ? "#1a1a1a" : "transparent",
                border: "2px solid #1a1a1a",
                boxShadow: activeField === null ? "2px 2px 0px 0px rgba(0,0,0,1)" : "none",
                color: activeField === null ? "white" : "#1a1a1a",
                fontSize: "0.65rem",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "1px",
                fontFamily: "var(--font-mono), monospace",
                whiteSpace: "nowrap",
              }}
            >
              All
            </button>

            {Array.from(fieldGroups.keys()).map((field) => (
              <button
                key={field}
                onClick={() => setActiveField(activeField === field ? null : field)}
                style={{
                  padding: "4px 12px",
                  background: activeField === field ? "#1a1a1a" : "transparent",
                  border: "2px solid #1a1a1a",
                  boxShadow: activeField === field ? "2px 2px 0px 0px rgba(0,0,0,1)" : "none",
                  color: activeField === field ? "white" : "#1a1a1a",
                  fontSize: "0.65rem",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "1px",
                  fontFamily: "var(--font-mono), monospace",
                  whiteSpace: "nowrap",
                }}
              >
                {field}
              </button>
            ))}
          </div>

          {/* Papers / News toggle */}
          <div style={{ display: "flex", gap: "4px", flexShrink: 0 }}>
            {(["all", "papers", "news"] as const).map((f) => (
              <button
                key={f}
                onClick={() => { setSourceFilter(f); setPage(1); }}
                style={{
                  padding: "4px 10px",
                  background: sourceFilter === f ? "#1a1a1a" : "transparent",
                  border: "2px solid #1a1a1a",
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

          {/* Search input */}
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
                paddingTop: "6px",
                paddingBottom: "6px",
                fontSize: "0.75rem",
                textTransform: "uppercase",
                letterSpacing: "1px",
                fontFamily: 'var(--font-mono), monospace',
                borderRadius: 0,
                outline: "none",
              }}
            />
          </div>
        </div>

        {/* Grid header */}
        <div
          className="px-4 md:px-10 pt-5"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "8px",
          }}
        >
          <div>
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
                fontSize: "0.65rem",
                color: "#888",
                fontFamily: 'var(--font-mono), monospace',
              }}
            >
              {total} papers saved
            </span>
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
                  padding: "6px 14px",
                  fontSize: "0.65rem",
                  textTransform: "uppercase",
                  letterSpacing: "2px",
                  fontFamily: 'var(--font-mono), monospace',
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  boxShadow: "3px 3px 0px 0px rgba(0,0,0,0.12)",
                  opacity: comparing ? 0.5 : 1,
                }}
              >
                {comparing ? (
                  <>
                    <Loader2 style={{ width: "12px", height: "12px", animation: "spin 1s linear infinite" }} />
                    COMPARING...
                  </>
                ) : (
                  <>COMPARE {selectedIds.size} ITEMS</>
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
                padding: "6px 14px",
                fontSize: "0.65rem",
                textTransform: "uppercase",
                letterSpacing: "2px",
                fontFamily: 'var(--font-mono), monospace',
                display: "flex",
                alignItems: "center",
                gap: "6px",
                boxShadow: compareMode ? "2px 2px 0px 0px rgba(0,0,0,1)" : "none",
              }}
            >
              <GitCompare style={{ width: "12px", height: "12px" }} />
              {compareMode ? "EXIT COMPARE" : "COMPARE"}
            </button>
          </div>
        </div>

        {/* Compare info bar */}
        {compareMode && (
          <div
            className="mx-4 md:mx-10 mt-3"
            style={{
              border: "2px solid #1a1a1a",
              padding: "8px 16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              boxShadow: "2px 2px 0px 0px rgba(0,0,0,0.15)",
            }}
          >
            <span
              style={{
                fontSize: "0.65rem",
                textTransform: "uppercase",
                letterSpacing: "2px",
                color: "#666",
                fontFamily: 'var(--font-mono), monospace',
              }}
            >
              SELECT 2-3 PAPERS TO COMPARE.{" "}
              <span style={{ color: "#1a1a1a", fontWeight: "bold" }}>
                {selectedIds.size} SELECTED
              </span>
            </span>
          </div>
        )}

        {/* Card grid */}
        <div
          className="flex-1 p-4 md:p-10"
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

      {/* Right sidebar - below main content on mobile */}
      <aside
        className="border-t md:border-t-0 md:border-l border-[#1a1a1a]"
        style={{
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          background: "#f9fafb",
        }}
      >
        <style>{`
          @media (min-width: 768px) {
            .vault-sidebar { border-left-width: 4px !important; border-top-width: 0 !important; }
          }
          @media (max-width: 767px) {
            .vault-sidebar { border-top-width: 4px !important; border-left-width: 0 !important; }
          }
        `}</style>
        <div className="vault-sidebar flex flex-col h-full">
          {/* Past Themes header */}
          <div
            style={{
              borderBottom: "4px solid #1a1a1a",
              padding: "10px 16px",
            }}
          >
            <h3
              style={{
                fontSize: "0.7rem",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "2px",
                color: "#1a1a1a",
                fontFamily: 'var(--font-mono), monospace',
                margin: 0,
              }}
            >
              Past Themes
            </h3>
            <button
              onClick={() => setStarFilter(!starFilter)}
              title={starFilter ? "Show all" : "Show starred only"}
              style={{
                background: "none", border: "none", cursor: "pointer", padding: "2px",
                color: starFilter ? "#f59e0b" : "#ccc", transition: "color 0.15s",
              }}
            >
              <Star size={14} className={starFilter ? "fill-current" : ""} />
            </button>
          </div>

          {/* Theme list */}
          <div style={{ padding: "12px 16px", flex: 1 }}>
            {pastThemes.length > 0 ? (
              <div className="flex flex-row md:flex-col gap-2 md:gap-1.5 overflow-x-auto md:overflow-x-visible pb-2 md:pb-0">
                {pastThemes
                  .filter(t => !starFilter || t.starred)
                  .map((theme) => (
                  <div
                    key={theme.id}
                    onClick={() => handleThemeClick(theme.id)}
                    className="shrink-0 md:shrink"
                    style={{
                      padding: "6px 8px",
                      transition: "background 0.1s ease",
                      background: activeDigestId === theme.id ? "#f3f4f6" : "transparent",
                      borderLeft: activeDigestId === theme.id ? "4px solid #1a1a1a" : "4px solid transparent",
                      minWidth: "140px",
                      cursor: "pointer",
                    }}
                    onMouseEnter={(e) => {
                      if (activeDigestId !== theme.id) {
                        (e.currentTarget as HTMLElement).style.background = "#f9fafb";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (activeDigestId !== theme.id) {
                        (e.currentTarget as HTMLElement).style.background = "transparent";
                      }
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "4px", marginBottom: "2px" }}>
                      <span
                        style={{
                          fontSize: "0.6rem",
                          color: "#888",
                          fontFamily: "var(--font-mono), monospace",
                        }}
                      >
                        {theme.date}
                      </span>
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          const newStarred = !theme.starred;
                          setPastThemes(prev => prev.map(t => t.id === theme.id ? { ...t, starred: newStarred } : t));
                          try { await fetch("/api/digest/star", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ digestId: theme.id }) }); } catch { setPastThemes(prev => prev.map(t => t.id === theme.id ? { ...t, starred: !newStarred } : t)); }
                        }}
                        style={{ background: "none", border: "none", cursor: "pointer", padding: "0", flexShrink: 0, color: theme.starred ? "#f59e0b" : "#ddd", transition: "color 0.15s" }}
                        className="hover:text-[#f59e0b]"
                      >
                        <Star size={10} className={theme.starred ? "fill-current" : ""} />
                      </button>
                    </div>
                    <span
                      style={{
                        fontSize: "0.8rem",
                        color: "#1a1a1a",
                        fontWeight: 600,
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                        lineHeight: 1.3,
                        fontFamily: "var(--font-display), sans-serif",
                      }}
                    >
                      {theme.theme}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <span
                style={{
                  fontSize: "0.6rem",
                  textTransform: "uppercase",
                  letterSpacing: "2px",
                  color: "#888",
                  fontFamily: "var(--font-mono), monospace",
                }}
              >
                {starFilter ? "No starred themes" : "No past themes yet"}
              </span>
            )}
          </div>

          {/* Stats footer */}
          <div
            style={{
              borderTop: "4px solid #1a1a1a",
              padding: "12px 16px",
              display: "flex",
              flexDirection: "column",
              gap: "4px",
            }}
          >
            <p
              style={{
                fontSize: "0.6rem",
                color: "#666",
                fontFamily: 'var(--font-mono), monospace',
                margin: 0,
              }}
            >
              {total} papers saved
            </p>
            {totalPages > 1 && (
              <p
                style={{
                  fontSize: "0.6rem",
                  color: "#666",
                  fontFamily: 'var(--font-mono), monospace',
                  margin: 0,
                }}
              >
                Page {page} of {totalPages}
              </p>
            )}
          </div>
        </div>
      </aside>

    </div>
  );
}
