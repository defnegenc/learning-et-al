"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { GitCompare, Loader2, Search, ChevronLeft, ChevronRight, Star, ThumbsDown } from "lucide-react";
import { PaperDetail } from "@/components/today/paper-detail";
import { CompareView } from "./compare-view";
import { KeywordTag } from "@/components/keyword-tag";
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

const LIMIT = 12;
const ACCENT_COLORS = ["#bbf7d0", "#fbcfe8", "#e9d5ff", "#bfdbfe", "#fef08a"];

interface DigestTheme {
  id: string;
  date: string;
  theme: string;
  synthesisContent: string | null;
}

export function VaultPage({ session }: VaultPageProps) {
  const [papers, setPapers] = useState<PaperItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [activeKeyword, setActiveKeyword] = useState<string | null>(null);
  const [pastThemes, setPastThemes] = useState<DigestTheme[]>([]);
  const [activeDigestId, setActiveDigestId] = useState<string | null>(null);
  const [digestPapers, setDigestPapers] = useState<PaperItem[] | null>(null);

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
  }, [page, debouncedSearch]);

  useEffect(() => {
    fetchPapers();
  }, [fetchPapers]);

  // Fetch past themes
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/digest?all=true");
        if (!res.ok) return;
        const data = await res.json();
        const themes: DigestTheme[] = (data.digests ?? []).map((d: { id: string; date: string; synthesisContent: string | null }) => {
          const firstLine = d.synthesisContent?.split("\n").find((l: string) => l.trim()) ?? "Untitled digest";
          // Strip markdown heading markers
          const theme = firstLine.replace(/^#+\s*/, "").replace(/^Today['']s thread:\s*/i, "").trim();
          return { id: d.id, date: d.date, theme, synthesisContent: d.synthesisContent };
        });
        setPastThemes(themes);
      } catch (err) {
        console.error("Failed to fetch past themes:", err);
      }
    })();
  }, []);

  // Fetch papers for a specific digest
  const handleThemeClick = async (digestId: string) => {
    if (activeDigestId === digestId) {
      setActiveDigestId(null);
      setDigestPapers(null);
      return;
    }
    setActiveDigestId(digestId);
    try {
      const theme = pastThemes.find((t) => t.id === digestId);
      if (!theme) return;
      const res = await fetch(`/api/digest?date=${theme.date}`);
      if (!res.ok) return;
      const data = await res.json();
      setDigestPapers(data.papers ?? []);
    } catch (err) {
      console.error("Failed to fetch digest papers:", err);
      setDigestPapers(null);
    }
  };

  // Unique keywords from papers
  const allKeywords = useMemo(() => {
    const kws = new Set<string>();
    papers.forEach((p) => p.keywords.forEach((k) => kws.add(k)));
    return Array.from(kws).slice(0, 12);
  }, [papers]);

  // Filter papers by active keyword or active digest
  const filteredPapers = useMemo(() => {
    const base = activeDigestId && digestPapers ? digestPapers : papers;
    if (!activeKeyword) return base;
    return base.filter((p) =>
      p.keywords.some((k) => k.toLowerCase() === activeKeyword.toLowerCase())
    );
  }, [papers, activeKeyword, activeDigestId, digestPapers]);

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

  // If viewing a single paper detail
  if (selectedPaper) {
    return (
      <PaperDetail
        paper={selectedPaper}
        session={session}
        onBack={() => setSelectedPaper(null)}
        onStar={(id) => handleFeedback(id, "star")}
        onDislike={(id) => handleFeedback(id, "dislike")}
      />
    );
  }

  return (
    <div className="flex flex-col md:grid md:min-h-[calc(100vh-2.75rem)]" style={{ gridTemplateColumns: "1fr 300px" }}>
      {/* Main content area */}
      <div style={{ display: "flex", flexDirection: "column" }}>
        {/* Keyword ribbon */}
        <div
          className="overflow-x-auto md:overflow-x-visible"
          style={{
            borderBottom: "4px solid #1a1a1a",
            padding: "8px 16px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            flexWrap: "nowrap",
          }}
        >
          <style>{`
            @media (min-width: 768px) {
              .vault-keyword-ribbon { flex-wrap: wrap !important; padding-left: 40px !important; padding-right: 40px !important; }
            }
          `}</style>
          <div className="vault-keyword-ribbon flex items-center gap-2 flex-nowrap md:flex-wrap min-w-0">
            <button
              onClick={() => setActiveKeyword(null)}
              className="shrink-0"
              style={{
                padding: "4px 12px",
                background: activeKeyword === null ? "#1a1a1a" : "transparent",
                border: "2px solid #1a1a1a",
                boxShadow: activeKeyword === null ? "2px 2px 0px 0px rgba(0,0,0,1)" : "none",
                color: activeKeyword === null ? "white" : "#1a1a1a",
                fontSize: "0.65rem",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "1px",
                fontFamily: "var(--font-mono), monospace",
              }}
            >
              All
            </button>
            {allKeywords.map((kw) => (
              <button
                key={kw}
                onClick={() => setActiveKeyword(activeKeyword === kw ? null : kw)}
                className="shrink-0"
                style={{
                  padding: "4px 12px",
                  background: activeKeyword === kw ? "#1a1a1a" : "transparent",
                  border: "2px solid #1a1a1a",
                  boxShadow: activeKeyword === kw ? "2px 2px 0px 0px rgba(0,0,0,1)" : "none",
                  color: activeKeyword === kw ? "white" : "#1a1a1a",
                  fontSize: "0.65rem",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "1px",
                  fontFamily: "var(--font-mono), monospace",
                }}
              >
                {kw}
              </button>
            ))}
          </div>

          {/* Search input in ribbon */}
          <div className="shrink-0 md:ml-auto relative">
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
              className="w-[160px] md:w-[200px]"
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
                  boxShadow: "4px 4px 0px 0px rgba(0,0,0,1)",
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
              boxShadow: "2px 2px 0px 0px rgba(0,0,0,1)",
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
              {filteredPapers.map((paper, cardIdx) => {
                const isSelected = selectedIds.has(paper.id);
                const accentColor = ACCENT_COLORS[cardIdx % ACCENT_COLORS.length];
                return (
                  <div
                    key={paper.id}
                    className="group"
                    style={{
                      aspectRatio: "1 / 1",
                      border: isSelected ? "4px solid #ff007f" : "2px solid #1a1a1a",
                      background: "white",
                      padding: "16px",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      position: "relative",
                      overflow: "hidden",
                      transition: "all 0.15s ease",
                      boxShadow: isSelected ? "4px 4px 0px 0px rgba(255,0,127,1)" : "4px 4px 0px 0px rgba(0,0,0,1)",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.transform = "translate(-2px, -2px)";
                      (e.currentTarget as HTMLElement).style.boxShadow = isSelected ? "6px 6px 0px 0px rgba(255,0,127,1)" : "6px 6px 0px 0px rgba(0,0,0,1)";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.transform = "translate(0, 0)";
                      (e.currentTarget as HTMLElement).style.boxShadow = isSelected ? "4px 4px 0px 0px rgba(255,0,127,1)" : "4px 4px 0px 0px rgba(0,0,0,1)";
                    }}
                    onClick={() => {
                      if (compareMode) {
                        toggleSelect(paper.id);
                      } else {
                        setSelectedPaper(paper);
                      }
                    }}
                  >
                    {/* Accent aura blob top-right — subtle */}
                    <div
                      style={{
                        position: "absolute",
                        width: "120px",
                        height: "120px",
                        background: accentColor,
                        borderRadius: "50%",
                        filter: "blur(40px)",
                        opacity: 0.3,
                        top: "-20px",
                        right: "-20px",
                        pointerEvents: "none",
                      }}
                    />

                    {/* Top section */}
                    <div style={{ position: "relative", zIndex: 2 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <span
                          style={{
                            fontSize: "0.65rem",
                            fontFamily: 'var(--font-mono), monospace',
                            fontWeight: 700,
                            color: "#666",
                            border: "1px solid #d1d5db",
                            padding: "2px 6px",
                          }}
                        >
                          {paper.source === "rss" ? "NEWS" : "PAPER"}{paper.year ? ` \u00b7 ${paper.year}` : ""}
                        </span>
                      </div>

                      {/* Compare badge */}
                      {compareMode && (
                        <div style={{ marginTop: "8px" }}>
                          <span
                            style={{
                              padding: "3px 10px",
                              fontSize: "0.6rem",
                              fontWeight: 700,
                              textTransform: "uppercase",
                              letterSpacing: "1px",
                              border: `2px solid ${isSelected ? "#ff007f" : "#1a1a1a"}`,
                              background: isSelected ? "#ff007f" : "transparent",
                              color: isSelected ? "#fff" : "#1a1a1a",
                              fontFamily: 'var(--font-mono), monospace',
                              boxShadow: isSelected ? "2px 2px 0px 0px rgba(255,0,127,1)" : "none",
                            }}
                          >
                            {isSelected ? "SELECTED" : "SELECT"}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Bottom section */}
                    <div style={{ position: "relative", zIndex: 2 }}>
                      {/* Keywords */}
                      {paper.keywords.length > 0 && (
                        <div style={{ display: "flex", gap: "4px", marginBottom: "6px", flexWrap: "wrap" }}>
                          {paper.keywords.slice(0, 2).map((kw, ki) => (
                            <KeywordTag
                              key={kw}
                              keyword={kw}
                              color={ACCENT_COLORS[ki % ACCENT_COLORS.length]}
                            />
                          ))}
                        </div>
                      )}

                      {/* Title */}
                      <h3
                        className="text-sm md:text-base group-hover:underline"
                        style={{
                          fontWeight: 800,
                          textTransform: "uppercase",
                          lineHeight: 1.2,
                          color: "#1a1a1a",
                          fontFamily: "var(--font-display), sans-serif",
                          margin: 0,
                          display: "-webkit-box",
                          WebkitLineClamp: 3,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                        }}
                      >
                        {paper.title}
                      </h3>

                      {/* Hover actions - always visible on mobile */}
                      {!compareMode && (
                        <div className="md:opacity-0 md:transition-opacity md:group-hover:opacity-100" style={{ display: "flex", gap: "4px", marginTop: "8px" }}>
                          <button
                            style={{ padding: "2px", background: "none", border: "none", color: "#1a1a1a" }}
                            className="hover:text-[#38b000] min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0 flex items-center justify-center"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleFeedback(paper.id, "star");
                            }}
                          >
                            <Star style={{ width: "12px", height: "12px" }} />
                          </button>
                          <button
                            style={{ padding: "2px", background: "none", border: "none", color: "#1a1a1a" }}
                            className="hover:text-[#ff007f] min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0 flex items-center justify-center"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleFeedback(paper.id, "dislike");
                            }}
                          >
                            <ThumbsDown style={{ width: "12px", height: "12px" }} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
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
                  boxShadow: "2px 2px 0px 0px rgba(0,0,0,1)",
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
                  boxShadow: "2px 2px 0px 0px rgba(0,0,0,1)",
                }}
              >
                NEXT
                <ChevronRight style={{ width: "12px", height: "12px" }} />
              </button>
            </div>
          )}
        </div>
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
          </div>

          {/* Theme list */}
          <div style={{ padding: "12px 16px", flex: 1 }}>
            {pastThemes.length > 0 ? (
              <div className="flex flex-row md:flex-col gap-2 md:gap-1.5 overflow-x-auto md:overflow-x-visible pb-2 md:pb-0">
                {pastThemes.map((theme) => (
                  <div
                    key={theme.id}
                    onClick={() => handleThemeClick(theme.id)}
                    className="shrink-0 md:shrink"
                    style={{
                      padding: "6px 8px",
                      transition: "background 0.1s ease",
                      background: activeDigestId === theme.id ? "rgba(255,0,127,0.1)" : "transparent",
                      borderLeft: activeDigestId === theme.id ? "4px solid #ff007f" : "4px solid transparent",
                      minWidth: "140px",
                    }}
                    onMouseEnter={(e) => {
                      if (activeDigestId !== theme.id) {
                        (e.currentTarget as HTMLElement).style.background = "rgba(255,0,127,0.05)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (activeDigestId !== theme.id) {
                        (e.currentTarget as HTMLElement).style.background = "transparent";
                      }
                    }}
                  >
                    <span
                      style={{
                        fontSize: "0.65rem",
                        color: "#666",
                        fontFamily: 'var(--font-mono), monospace',
                        display: "block",
                        marginBottom: "2px",
                      }}
                    >
                      {theme.date}
                    </span>
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
                  color: "#666",
                  fontFamily: 'var(--font-mono), monospace',
                }}
              >
                No past themes yet
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
