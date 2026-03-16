"use client";

import { useState, useEffect, useCallback } from "react";
import { GitCompare, Loader2, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

  // If viewing a single paper detail
  if (selectedPaper) {
    return (
      <PaperDetail
        paper={selectedPaper}
        session={session}
        onBack={() => setSelectedPaper(null)}
        onStar={() => {}}
        onDislike={() => {}}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Search bar + compare toggle */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search your vault..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button
          variant={compareMode ? "default" : "outline"}
          size="sm"
          onClick={() => {
            if (compareMode) {
              exitCompareMode();
            } else {
              setCompareMode(true);
            }
          }}
        >
          <GitCompare className="size-4" />
          Compare
        </Button>
      </div>

      {/* Compare action bar */}
      {compareMode && (
        <div className="flex items-center justify-between rounded-lg border bg-muted/50 px-4 py-2">
          <p className="text-sm text-muted-foreground">
            Select 2-3 papers to compare.{" "}
            <span className="font-medium text-foreground">
              {selectedIds.size} selected
            </span>
          </p>
          <Button
            size="sm"
            disabled={selectedIds.size < 2 || comparing}
            onClick={runCompare}
          >
            {comparing ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Comparing...
              </>
            ) : (
              <>Compare {selectedIds.size} items</>
            )}
          </Button>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Empty state */}
      {!loading && papers.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-sm text-muted-foreground">
            {debouncedSearch
              ? "No papers match your search."
              : "Your vault is empty. Generate your first digest from the Today tab!"}
          </p>
        </div>
      )}

      {/* Card grid */}
      {!loading && papers.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {papers.map((paper) => {
            const isSelected = selectedIds.has(paper.id);
            return (
              <Card
                key={paper.id}
                className={`group relative cursor-pointer transition-shadow hover:shadow-md ${
                  isSelected ? "ring-2 ring-primary" : ""
                }`}
                onClick={() => {
                  if (compareMode) {
                    toggleSelect(paper.id);
                  } else {
                    setSelectedPaper(paper);
                  }
                }}
              >
                {compareMode && (
                  <div className="absolute right-2 top-2 z-10">
                    <Badge variant={isSelected ? "default" : "secondary"}>
                      {isSelected ? "Selected" : "Select"}
                    </Badge>
                  </div>
                )}
                <CardHeader className="pb-0">
                  <div className="flex items-start gap-2">
                    <Badge
                      variant={
                        paper.source === "arxiv" ? "default" : "secondary"
                      }
                    >
                      {paper.source === "arxiv" ? "arXiv" : "News"}
                    </Badge>
                  </div>
                  <CardTitle className="line-clamp-2 text-sm leading-snug">
                    {paper.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {paper.summary && (
                    <p className="line-clamp-2 text-xs text-muted-foreground">
                      {paper.summary}
                    </p>
                  )}
                  {paper.keywords.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {paper.keywords.slice(0, 3).map((kw) => (
                        <Badge
                          key={kw}
                          variant="outline"
                          className="text-[10px] px-1.5 py-0 h-4"
                        >
                          {kw}
                        </Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 pt-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            <ChevronLeft className="size-4" />
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
            <ChevronRight className="size-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
