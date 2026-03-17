"use client";

import { useState, useEffect, useCallback } from "react";
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

  return (
    <div className="flex gap-0" style={{ minHeight: "calc(100vh - 10rem)" }}>
      {/* Main content area */}
      <div className="flex-1 space-y-4">
        {/* Grid header */}
        <div className="flex items-center justify-between">
          <div>
            <h2
              className="text-sm font-bold uppercase tracking-[3px] text-[#1a1a1a]"
              style={{ fontFamily: '"Courier New", Courier, monospace' }}
            >
              REPORT MATRIX
            </h2>
            <span
              className="text-[0.6rem] uppercase tracking-[2px] text-[#555]"
              style={{ fontFamily: '"Courier New", Courier, monospace' }}
            >
              ACTIVE_REPORTS: {total}
            </span>
          </div>
        </div>

        {/* Search bar + compare toggle */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 size-3 -translate-y-1/2 text-[#555]" />
            <input
              placeholder="SEARCH YOUR VAULT..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full border border-[#1a1a1a] bg-transparent pl-9 pr-3 py-1.5 text-[0.75rem] uppercase tracking-[1px] placeholder:text-[#555] focus:outline-none"
              style={{ borderWidth: "1.5px", fontFamily: '"Courier New", Courier, monospace', borderRadius: 0 }}
            />
          </div>
          <button
            onClick={() => {
              if (compareMode) {
                exitCompareMode();
              } else {
                setCompareMode(true);
              }
            }}
            className={`border border-[#1a1a1a] px-3 py-1.5 text-[0.65rem] uppercase tracking-[2px] flex items-center gap-1.5 transition-colors ${
              compareMode
                ? "bg-[#1a1a1a] text-[#e8e8e8]"
                : "text-[#1a1a1a] hover:bg-[#d8d8d8]"
            }`}
            style={{ borderWidth: "1.5px", fontFamily: '"Courier New", Courier, monospace', cursor: "crosshair" }}
          >
            <GitCompare className="size-3" />
            COMPARE
          </button>
        </div>

        {/* Compare action bar */}
        {compareMode && (
          <div className="flex items-center justify-between border border-[#1a1a1a] px-4 py-2" style={{ borderWidth: "1.5px" }}>
            <p
              className="text-[0.65rem] uppercase tracking-[2px] text-[#555]"
              style={{ fontFamily: '"Courier New", Courier, monospace' }}
            >
              SELECT 2-3 PAPERS TO COMPARE.{" "}
              <span className="text-[#1a1a1a] font-bold">
                {selectedIds.size} SELECTED
              </span>
            </p>
            <button
              disabled={selectedIds.size < 2 || comparing}
              onClick={runCompare}
              className="border border-[#1a1a1a] bg-[#1a1a1a] text-[#e8e8e8] px-3 py-1 text-[0.65rem] uppercase tracking-[2px] disabled:opacity-50 flex items-center gap-1.5"
              style={{ borderWidth: "1.5px", fontFamily: '"Courier New", Courier, monospace', cursor: "crosshair" }}
            >
              {comparing ? (
                <>
                  <Loader2 className="size-3 animate-spin" />
                  COMPARING...
                </>
              ) : (
                <>COMPARE {selectedIds.size} ITEMS</>
              )}
            </button>
          </div>
        )}

        {/* Loading state */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="size-6 animate-spin text-[#555]" />
          </div>
        )}

        {/* Empty state */}
        {!loading && papers.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p
              className="text-[0.7rem] uppercase tracking-[2px] text-[#555]"
              style={{ fontFamily: '"Courier New", Courier, monospace' }}
            >
              {debouncedSearch
                ? "NO_PAPERS_MATCH_YOUR_SEARCH"
                : "VAULT_EMPTY. GENERATE_FIRST_DIGEST_FROM_TODAY_TAB."}
            </p>
          </div>
        )}

        {/* Card grid - square aspect ratio */}
        {!loading && papers.length > 0 && (
          <div
            className="grid gap-3"
            style={{ gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}
          >
            {papers.map((paper, cardIdx) => {
              const isSelected = selectedIds.has(paper.id);
              const accentColor = ACCENT_COLORS[cardIdx % ACCENT_COLORS.length];
              const repNum = String(cardIdx + 1 + (page - 1) * LIMIT).padStart(3, "0");
              return (
                <div
                  key={paper.id}
                  className="group relative border border-[#1a1a1a] p-3 flex flex-col justify-between transition-all duration-150"
                  style={{
                    borderWidth: isSelected ? "2px" : "1.5px",
                    borderColor: isSelected ? "#ff007f" : "#1a1a1a",
                    cursor: "crosshair",
                    aspectRatio: "1 / 1",
                    background: "#e8e8e8",
                    overflow: "hidden",
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
                  {/* Small accent aura blob top-right */}
                  <div
                    className="absolute pointer-events-none"
                    style={{
                      width: "60px",
                      height: "60px",
                      background: accentColor,
                      borderRadius: "50%",
                      filter: "blur(25px)",
                      opacity: 0.15,
                      top: "-10px",
                      right: "-10px",
                    }}
                  />

                  {/* Top section */}
                  <div className="space-y-2 relative z-10">
                    {/* Compare select badge */}
                    {compareMode && (
                      <div className="absolute right-0 top-0 z-10">
                        <span
                          className="px-2 py-0.5 text-[0.55rem] uppercase tracking-[1px]"
                          style={{
                            borderWidth: "1px",
                            borderStyle: "solid",
                            borderColor: isSelected ? "#ff007f" : "#1a1a1a",
                            background: isSelected ? "#ff007f" : "transparent",
                            color: isSelected ? "#fff" : "#1a1a1a",
                            fontFamily: '"Courier New", Courier, monospace',
                          }}
                        >
                          {isSelected ? "SELECTED" : "SELECT"}
                        </span>
                      </div>
                    )}

                    {/* Report number */}
                    <span
                      className="text-[0.6rem] uppercase tracking-[2px] text-[#555]"
                      style={{ fontFamily: '"Courier New", Courier, monospace' }}
                    >
                      REP_{repNum}
                    </span>

                    {/* Category / Source tag */}
                    <div>
                      <span
                        className="inline-block px-1.5 py-0 text-[0.55rem] uppercase tracking-[1px]"
                        style={{
                          borderWidth: "1px",
                          borderStyle: "solid",
                          borderColor: accentColor,
                          color: accentColor,
                          fontFamily: '"Courier New", Courier, monospace',
                        }}
                      >
                        {paper.source === "arxiv" ? "ARXIV" : "RSS"}
                      </span>
                    </div>

                    {/* Title */}
                    <h3
                      className="text-[0.8rem] font-bold uppercase leading-snug line-clamp-3 text-[#1a1a1a]"
                      style={{ fontFamily: '"Courier New", Courier, monospace' }}
                    >
                      {paper.title}
                    </h3>

                    {/* Summary */}
                    {paper.summary && (
                      <p className="text-[0.7rem] text-[#444] line-clamp-2 leading-relaxed">
                        {paper.summary}
                      </p>
                    )}
                  </div>

                  {/* Bottom section */}
                  <div className="relative z-10 space-y-2">
                    {/* Keywords */}
                    {paper.keywords.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {paper.keywords.slice(0, 3).map((kw, kwIdx) => {
                          const kwColor = ACCENT_COLORS[kwIdx % ACCENT_COLORS.length];
                          return (
                            <span
                              key={kw}
                              className="px-1.5 py-0 text-[0.55rem] uppercase tracking-[1px]"
                              style={{
                                borderWidth: "1px",
                                borderStyle: "solid",
                                borderColor: kwColor,
                                color: kwColor,
                                fontFamily: '"Courier New", Courier, monospace',
                              }}
                            >
                              {kw}
                            </span>
                          );
                        })}
                      </div>
                    )}

                    {/* Hover actions */}
                    {!compareMode && (
                      <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                        <button
                          className="p-1 hover:text-[#38b000] transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleFeedback(paper.id, "star");
                          }}
                          style={{ cursor: "crosshair" }}
                        >
                          <Star className="size-3" />
                        </button>
                        <button
                          className="p-1 hover:text-[#ff007f] transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleFeedback(paper.id, "dislike");
                          }}
                          style={{ cursor: "crosshair" }}
                        >
                          <ThumbsDown className="size-3" />
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
          <div className="flex items-center justify-center gap-4 pt-2 pb-4">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="border border-[#1a1a1a] px-3 py-1 text-[0.65rem] uppercase tracking-[2px] text-[#1a1a1a] hover:bg-[#d8d8d8] transition-colors disabled:opacity-30 flex items-center gap-1"
              style={{ borderWidth: "1.5px", fontFamily: '"Courier New", Courier, monospace', cursor: "crosshair" }}
            >
              <ChevronLeft className="size-3" />
              PREV
            </button>
            <span
              className="text-[0.65rem] uppercase tracking-[2px] text-[#555]"
              style={{ fontFamily: '"Courier New", Courier, monospace' }}
            >
              PAGE {page} OF {totalPages}
            </span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="border border-[#1a1a1a] px-3 py-1 text-[0.65rem] uppercase tracking-[2px] text-[#1a1a1a] hover:bg-[#d8d8d8] transition-colors disabled:opacity-30 flex items-center gap-1"
              style={{ borderWidth: "1.5px", fontFamily: '"Courier New", Courier, monospace', cursor: "crosshair" }}
            >
              NEXT
              <ChevronRight className="size-3" />
            </button>
          </div>
        )}
      </div>

      {/* Right sidebar */}
      <aside
        className="shrink-0 border-l border-[#1a1a1a] overflow-y-auto hidden lg:block"
        style={{ width: "300px", borderLeftWidth: "1.5px" }}
      >
        {/* Archive Timeline */}
        <div className="border-b border-[#1a1a1a] px-4 py-2" style={{ borderBottomWidth: "1.5px" }}>
          <h3
            className="text-[0.6rem] font-bold uppercase tracking-[2px] text-[#1a1a1a]"
            style={{ fontFamily: '"Courier New", Courier, monospace' }}
          >
            ARCHIVE_TIMELINE
          </h3>
        </div>
        <div className="px-4 py-3 space-y-3">
          {!loading && papers.length > 0 ? (
            (() => {
              // Group papers by a simple date label
              const today = new Date().toISOString().split("T")[0];
              return (
                <div className="space-y-1">
                  <span
                    className="text-[0.55rem] uppercase tracking-[2px] text-[#555]"
                    style={{ fontFamily: '"Courier New", Courier, monospace' }}
                  >
                    {today}
                  </span>
                  {papers.slice(0, 8).map((p, i) => (
                    <div
                      key={p.id}
                      className="flex items-start gap-2 py-1 hover:bg-[#d8d8d8] px-1 transition-colors"
                      style={{ cursor: "crosshair" }}
                      onClick={() => setSelectedPaper(p)}
                    >
                      <span
                        className="text-[0.55rem] text-[#555] shrink-0 mt-0.5"
                        style={{ fontFamily: '"Courier New", Courier, monospace' }}
                      >
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span className="text-[0.6rem] text-[#1a1a1a] line-clamp-1 uppercase font-medium">
                        {p.title}
                      </span>
                    </div>
                  ))}
                </div>
              );
            })()
          ) : (
            <span
              className="text-[0.55rem] uppercase tracking-[2px] text-[#555]"
              style={{ fontFamily: '"Courier New", Courier, monospace' }}
            >
              NO_ENTRIES
            </span>
          )}
        </div>

        {/* System Logs */}
        <div className="border-t border-[#1a1a1a] px-4 py-2" style={{ borderTopWidth: "1.5px" }}>
          <h3
            className="text-[0.6rem] font-bold uppercase tracking-[2px] text-[#1a1a1a]"
            style={{ fontFamily: '"Courier New", Courier, monospace' }}
          >
            SYSTEM_LOGS
          </h3>
        </div>
        <div className="px-4 py-3 space-y-1">
          <p
            className="text-[0.55rem] text-[#555]"
            style={{ fontFamily: '"Courier New", Courier, monospace' }}
          >
            [{new Date().toLocaleTimeString("en-US", { hour12: false })}] VAULT_LOADED // {total} RECORDS
          </p>
          <p
            className="text-[0.55rem] text-[#555]"
            style={{ fontFamily: '"Courier New", Courier, monospace' }}
          >
            [{new Date().toLocaleTimeString("en-US", { hour12: false })}] PAGE_{page}_OF_{totalPages} // LIMIT_{LIMIT}
          </p>
          {compareMode && (
            <p
              className="text-[0.55rem] text-[#ff007f]"
              style={{ fontFamily: '"Courier New", Courier, monospace' }}
            >
              [ACTIVE] COMPARE_MODE // {selectedIds.size} SELECTED
            </p>
          )}
        </div>
      </aside>
    </div>
  );
}
