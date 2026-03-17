"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { GitCompare, Loader2, Search, ChevronLeft, ChevronRight, Star, ThumbsDown } from "lucide-react";
import { PaperDetail } from "@/components/today/paper-detail";
import { CompareView } from "./compare-view";
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
const ACCENT_COLORS = ["#38b000", "#ff007f", "#7700ff", "#0077ff", "#ff8800"];

export function VaultPage({ session }: VaultPageProps) {
  const [papers, setPapers] = useState<PaperItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [activeKeyword, setActiveKeyword] = useState<string | null>(null);

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

  // Unique keywords from papers
  const allKeywords = useMemo(() => {
    const kws = new Set<string>();
    papers.forEach((p) => p.keywords.forEach((k) => kws.add(k)));
    return Array.from(kws).slice(0, 12);
  }, [papers]);

  // Filter papers by active keyword
  const filteredPapers = useMemo(() => {
    if (!activeKeyword) return papers;
    return papers.filter((p) =>
      p.keywords.some((k) => k.toLowerCase() === activeKeyword.toLowerCase())
    );
  }, [papers, activeKeyword]);

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

  // Group papers by month for sidebar
  const now = new Date();
  const monthLabel = now.toLocaleDateString("en-US", { month: "short", year: "numeric" }).toUpperCase().replace(" ", "_");

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", minHeight: "calc(100vh - 7rem)" }}>
      {/* Main content area */}
      <div style={{ display: "flex", flexDirection: "column" }}>
        {/* Keyword ribbon */}
        <div
          style={{
            borderBottom: "1.5px solid #1a1a1a",
            padding: "8px 40px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            flexWrap: "wrap",
          }}
        >
          <button
            onClick={() => setActiveKeyword(null)}
            style={{
              padding: "3px 10px",
              background: activeKeyword === null ? "#1a1a1a" : "transparent",
              border: "1px solid #1a1a1a",
              color: activeKeyword === null ? "#e8e8e8" : "#1a1a1a",
              fontSize: "0.6rem",
              textTransform: "uppercase",
              letterSpacing: "1px",
              fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
              cursor: "crosshair",
            }}
          >
            All
          </button>
          {allKeywords.map((kw) => (
            <button
              key={kw}
              onClick={() => setActiveKeyword(activeKeyword === kw ? null : kw)}
              style={{
                padding: "3px 10px",
                background: activeKeyword === kw ? "#1a1a1a" : "transparent",
                border: "1px solid #1a1a1a",
                color: activeKeyword === kw ? "#e8e8e8" : "#1a1a1a",
                fontSize: "0.6rem",
                textTransform: "uppercase",
                letterSpacing: "1px",
                fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
                cursor: "crosshair",
              }}
            >
              {kw}
            </button>
          ))}

          {/* Search input in ribbon */}
          <div style={{ marginLeft: "auto", position: "relative" }}>
            <Search
              style={{
                position: "absolute",
                left: "6px",
                top: "50%",
                transform: "translateY(-50%)",
                width: "12px",
                height: "12px",
                color: "#555",
              }}
            />
            <input
              placeholder="SEARCH..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                border: "1.5px solid #1a1a1a",
                background: "transparent",
                paddingLeft: "24px",
                paddingRight: "8px",
                paddingTop: "3px",
                paddingBottom: "3px",
                fontSize: "0.6rem",
                textTransform: "uppercase",
                letterSpacing: "1px",
                fontFamily: '"Courier New", Courier, monospace',
                borderRadius: 0,
                outline: "none",
                width: "160px",
              }}
            />
          </div>
        </div>

        {/* Grid header */}
        <div
          style={{
            padding: "20px 40px 0 40px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <h2
              style={{
                fontSize: "1.2rem",
                fontWeight: 800,
                textTransform: "uppercase",
                letterSpacing: "1px",
                color: "#1a1a1a",
                fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
                margin: 0,
              }}
            >
              Your Vault
            </h2>
            <span
              style={{
                fontSize: "0.65rem",
                color: "#888",
                fontFamily: '"Courier New", Courier, monospace',
              }}
            >
              {total} papers saved
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {compareMode && selectedIds.size >= 2 && (
              <button
                disabled={comparing}
                onClick={runCompare}
                style={{
                  border: "1.5px solid #1a1a1a",
                  background: "#1a1a1a",
                  color: "#e8e8e8",
                  padding: "4px 12px",
                  fontSize: "0.65rem",
                  textTransform: "uppercase",
                  letterSpacing: "2px",
                  fontFamily: '"Courier New", Courier, monospace',
                  cursor: "crosshair",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
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
              style={{
                border: "1.5px solid #1a1a1a",
                background: compareMode ? "#1a1a1a" : "transparent",
                color: compareMode ? "#e8e8e8" : "#1a1a1a",
                padding: "4px 12px",
                fontSize: "0.65rem",
                textTransform: "uppercase",
                letterSpacing: "2px",
                fontFamily: '"Courier New", Courier, monospace',
                cursor: "crosshair",
                display: "flex",
                alignItems: "center",
                gap: "6px",
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
            style={{
              margin: "12px 40px 0 40px",
              border: "1.5px solid #1a1a1a",
              padding: "8px 16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <span
              style={{
                fontSize: "0.65rem",
                textTransform: "uppercase",
                letterSpacing: "2px",
                color: "#555",
                fontFamily: '"Courier New", Courier, monospace',
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
          style={{
            flex: 1,
            background: "#f0f0f0",
            padding: "40px",
          }}
        >
          {loading && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "80px 0" }}>
              <Loader2 className="size-6 animate-spin" style={{ color: "#555" }} />
            </div>
          )}

          {!loading && filteredPapers.length === 0 && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "80px 0" }}>
              <span
                style={{
                  fontSize: "0.7rem",
                  textTransform: "uppercase",
                  letterSpacing: "2px",
                  color: "#555",
                  fontFamily: '"Courier New", Courier, monospace',
                }}
              >
                {debouncedSearch
                  ? "No papers match your search"
                  : "Your vault is empty. Generate your first digest from the Today tab."}
              </span>
            </div>
          )}

          {!loading && filteredPapers.length > 0 && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
                gap: "20px",
              }}
            >
              {filteredPapers.map((paper, cardIdx) => {
                const isSelected = selectedIds.has(paper.id);
                const accentColor = ACCENT_COLORS[cardIdx % ACCENT_COLORS.length];
                const repNum = String(cardIdx + 1 + (page - 1) * LIMIT).padStart(3, "0");
                return (
                  <div
                    key={paper.id}
                    className="group"
                    style={{
                      aspectRatio: "1 / 1",
                      border: isSelected ? "2px solid #ff007f" : "1.5px solid #1a1a1a",
                      background: "#e8e8e8",
                      padding: "20px",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      cursor: "crosshair",
                      position: "relative",
                      overflow: "hidden",
                      transition: "all 0.15s ease",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)";
                      (e.currentTarget as HTMLElement).style.background = "#ffffff";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
                      (e.currentTarget as HTMLElement).style.background = "#e8e8e8";
                    }}
                    onClick={() => {
                      if (compareMode) {
                        toggleSelect(paper.id);
                      } else {
                        setSelectedPaper(paper);
                      }
                    }}
                  >
                    {/* Accent aura blob top-right */}
                    <div
                      style={{
                        position: "absolute",
                        width: "120px",
                        height: "120px",
                        background: accentColor,
                        borderRadius: "50%",
                        filter: "blur(40px)",
                        opacity: 0.4,
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
                            fontSize: "0.6rem",
                            fontFamily: '"Courier New", Courier, monospace',
                            color: "#888",
                          }}
                        >
                          {paper.source === "semantic_scholar" ? "S2" : paper.source === "arxiv" ? "arxiv" : "news"}
                        </span>
                        <span
                          style={{
                            width: "8px",
                            height: "8px",
                            borderRadius: "50%",
                            background: "#38b000",
                            display: "inline-block",
                          }}
                        />
                      </div>

                      {/* Compare badge */}
                      {compareMode && (
                        <div style={{ marginTop: "8px" }}>
                          <span
                            style={{
                              padding: "2px 8px",
                              fontSize: "0.55rem",
                              textTransform: "uppercase",
                              letterSpacing: "1px",
                              border: `1px solid ${isSelected ? "#ff007f" : "#1a1a1a"}`,
                              background: isSelected ? "#ff007f" : "transparent",
                              color: isSelected ? "#fff" : "#1a1a1a",
                              fontFamily: '"Courier New", Courier, monospace',
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
                            <span
                              key={kw}
                              style={{
                                fontSize: "0.5rem",
                                padding: "1px 6px",
                                background: ["#d4edda", "#f8d7da", "#e2d5f1", "#cce5ff", "#ffeeba"][ki % 5],
                                border: "1px solid rgba(26,26,26,0.15)",
                                color: "#1a1a1a",
                                textTransform: "uppercase",
                                letterSpacing: "0.5px",
                              }}
                            >
                              {kw}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Title */}
                      <h3
                        style={{
                          fontSize: "1rem",
                          fontWeight: 800,
                          textTransform: "uppercase",
                          lineHeight: 1.2,
                          color: "#1a1a1a",
                          fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
                          margin: 0,
                          display: "-webkit-box",
                          WebkitLineClamp: 3,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                        }}
                      >
                        {paper.title}
                      </h3>

                      {/* Hover actions */}
                      {!compareMode && (
                        <div className="opacity-0 transition-opacity group-hover:opacity-100" style={{ display: "flex", gap: "4px", marginTop: "8px" }}>
                          <button
                            style={{ padding: "2px", cursor: "crosshair", background: "none", border: "none", color: "#1a1a1a" }}
                            className="hover:text-[#38b000]"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleFeedback(paper.id, "star");
                            }}
                          >
                            <Star style={{ width: "12px", height: "12px" }} />
                          </button>
                          <button
                            style={{ padding: "2px", cursor: "crosshair", background: "none", border: "none", color: "#1a1a1a" }}
                            className="hover:text-[#ff007f]"
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
                style={{
                  border: "1.5px solid #1a1a1a",
                  background: "transparent",
                  padding: "4px 12px",
                  fontSize: "0.65rem",
                  textTransform: "uppercase",
                  letterSpacing: "2px",
                  fontFamily: '"Courier New", Courier, monospace',
                  cursor: "crosshair",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  opacity: page <= 1 ? 0.3 : 1,
                  color: "#1a1a1a",
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
                  color: "#555",
                  fontFamily: '"Courier New", Courier, monospace',
                }}
              >
                PAGE {page} OF {totalPages}
              </span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                style={{
                  border: "1.5px solid #1a1a1a",
                  background: "transparent",
                  padding: "4px 12px",
                  fontSize: "0.65rem",
                  textTransform: "uppercase",
                  letterSpacing: "2px",
                  fontFamily: '"Courier New", Courier, monospace',
                  cursor: "crosshair",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  opacity: page >= totalPages ? 0.3 : 1,
                  color: "#1a1a1a",
                }}
              >
                NEXT
                <ChevronRight style={{ width: "12px", height: "12px" }} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Right sidebar */}
      <aside
        style={{
          borderLeft: "1.5px solid #1a1a1a",
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Archive Timeline header */}
        <div
          style={{
            borderBottom: "1.5px solid #1a1a1a",
            padding: "8px 16px",
          }}
        >
          <h3
            style={{
              fontSize: "0.6rem",
              fontWeight: "bold",
              textTransform: "uppercase",
              letterSpacing: "2px",
              color: "#1a1a1a",
              fontFamily: '"Courier New", Courier, monospace',
              margin: 0,
            }}
          >
            Recent Papers
          </h3>
        </div>

        {/* Archive items */}
        <div style={{ padding: "12px 16px", flex: 1 }}>
          {!loading && papers.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {/* Month group */}
              <span
                style={{
                  fontSize: "0.55rem",
                  textTransform: "uppercase",
                  letterSpacing: "2px",
                  color: "#555",
                  fontFamily: '"Courier New", Courier, monospace',
                }}
              >
                {monthLabel}
              </span>
              {papers.slice(0, 8).map((p, i) => (
                <div
                  key={p.id}
                  onClick={() => setSelectedPaper(p)}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "8px",
                    padding: "4px 6px",
                    cursor: "crosshair",
                    transition: "background 0.1s ease",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.background = "rgba(255,0,127,0.08)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.background = "transparent";
                  }}
                >
                  <span
                    style={{
                      fontSize: "0.55rem",
                      color: "#555",
                      flexShrink: 0,
                      marginTop: "1px",
                      fontFamily: '"Courier New", Courier, monospace',
                    }}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span
                    style={{
                      fontSize: "0.6rem",
                      color: "#1a1a1a",
                      textTransform: "uppercase",
                      fontWeight: 500,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
                    }}
                  >
                    {p.title}
                  </span>
                </div>
              ))}

              {papers.length > 8 && (
                <span
                  style={{
                    fontSize: "0.5rem",
                    color: "#888",
                    textTransform: "uppercase",
                    letterSpacing: "1px",
                    fontFamily: '"Courier New", Courier, monospace',
                    paddingLeft: "6px",
                  }}
                >
                  + {papers.length - 8} MORE
                </span>
              )}
            </div>
          ) : (
            <span
              style={{
                fontSize: "0.55rem",
                textTransform: "uppercase",
                letterSpacing: "2px",
                color: "#555",
                fontFamily: '"Courier New", Courier, monospace',
              }}
            >
              No papers yet
            </span>
          )}
        </div>

        {/* System Logs header */}
        <div
          style={{
            borderTop: "1.5px solid #1a1a1a",
            padding: "8px 16px",
          }}
        >
          <h3
            style={{
              fontSize: "0.6rem",
              fontWeight: "bold",
              textTransform: "uppercase",
              letterSpacing: "2px",
              color: "#1a1a1a",
              fontFamily: '"Courier New", Courier, monospace',
              margin: 0,
            }}
          >
            Activity
          </h3>
        </div>

        {/* System log entries */}
        <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: "4px" }}>
          <p
            style={{
              fontSize: "0.55rem",
              color: "#555",
              fontFamily: '"Courier New", Courier, monospace',
              margin: 0,
            }}
          >
            {total} papers in vault
          </p>
          <p
            style={{
              fontSize: "0.55rem",
              color: "#555",
              fontFamily: '"Courier New", Courier, monospace',
              margin: 0,
            }}
          >
            Page {page} of {totalPages}
          </p>
          {compareMode && (
            <p
              style={{
                fontSize: "0.55rem",
                color: "#ff007f",
                fontFamily: '"Courier New", Courier, monospace',
                margin: 0,
              }}
            >
              Comparing {selectedIds.size} papers
            </p>
          )}
        </div>
      </aside>
    </div>
  );
}
