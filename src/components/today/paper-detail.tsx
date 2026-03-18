"use client";

import { useState, useEffect } from "react";
import {
  Star,
  ThumbsDown,
  ExternalLink,
  Loader2,
} from "lucide-react";
import { QAThread } from "./qa-thread";
import { KeywordTag } from "@/components/keyword-tag";
import type { PaperItem } from "./paper-card";

interface RelatedPaper {
  id: string;
  title: string;
  keywords: string[];
  source: string;
}

interface PaperDetailProps {
  paper: PaperItem;
  session: {
    apiKey: string;
    provider: string;
    model: string;
    baseUrl: string;
  };
  isStarred?: boolean;
  onBack: () => void;
  onStar: (paperId: string) => void;
  onDislike: (paperId: string) => void;
  onSelectPaper?: (paper: PaperItem) => void;
}

const PASTEL_COLORS = ["#bbf7d0", "#fbcfe8", "#e9d5ff", "#bfdbfe", "#fef08a"];

const TAG_PASTELS: Record<string, string> = {
  source: "#bfdbfe",
  year: "#fef08a",
  citations: "#e9d5ff",
  category: "#fbcfe8",
};

export function PaperDetail({
  paper,
  session,
  isStarred = false,
  onBack,
  onStar,
  onDislike,
}: PaperDetailProps) {
  const [starred, setStarred] = useState(isStarred);
  const [dislikeState, setDislikeState] = useState<
    "idle" | "input" | "submitting" | "done"
  >("idle");
  const [dislikeReason, setDislikeReason] = useState("");
  const [relatedPapers, setRelatedPapers] = useState<RelatedPaper[]>([]);
  const [relatedLoading, setRelatedLoading] = useState(true);

  // Fetch related papers
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/papers/${paper.id}/related`);
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setRelatedPapers(data.related ?? []);
      } catch {
        // silent
      } finally {
        if (!cancelled) setRelatedLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [paper.id]);

  const handleStar = () => {
    setStarred((prev) => !prev);
    onStar(paper.id);
  };

  const handleDislikeClick = () => {
    if (dislikeState === "idle") {
      setDislikeState("input");
    }
  };

  const handleDislikeSubmit = async () => {
    setDislikeState("submitting");
    try {
      await fetch(`/api/papers/${paper.id}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "dislike",
          reason: dislikeReason,
          apiKey: session.apiKey,
          provider: session.provider,
          model: session.model,
          baseUrl: session.baseUrl,
        }),
      });
      onDislike(paper.id);
    } catch (err) {
      console.error("Failed to submit dislike:", err);
    }
    setDislikeState("done");
  };

  const sourceLabel =
    paper.source === "semantic_scholar"
      ? "SEMANTIC SCHOLAR"
      : paper.source === "arxiv"
        ? "ARXIV"
        : "NEWS";

  const categoryLabel = paper.category
    ? paper.category.toUpperCase()
    : paper.source === "rss"
      ? "NEWS"
      : "RECENT";

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 md:px-0">
      {/* Back button */}
      <button
        onClick={onBack}
        className="text-[0.7rem] uppercase tracking-[2px] text-[#1a1a1a] hover:text-[#ff007f] transition-colors min-h-[44px] md:min-h-0 flex items-center"
        style={{
          fontFamily: "var(--font-mono), monospace",
          background: "none",
          border: "none",
          padding: 0,
        }}
      >
        &larr; BACK
      </button>

      {/* Title area with blobs */}
      <div
        style={{
          position: "relative",
          overflow: "hidden",
          padding: "24px 0",
        }}
      >
        {/* Blobs behind title */}
        <div
          style={{
            position: "absolute",
            width: "200px",
            height: "200px",
            background: "#7700ff",
            borderRadius: "50%",
            filter: "blur(80px)",
            opacity: 0.1,
            top: "-40px",
            right: "10%",
            pointerEvents: "none",
          }}
        />
        <div
          style={{
            position: "absolute",
            width: "160px",
            height: "160px",
            background: "#ff007f",
            borderRadius: "50%",
            filter: "blur(70px)",
            opacity: 0.08,
            bottom: "-30px",
            left: "5%",
            pointerEvents: "none",
          }}
        />
        <div
          style={{
            position: "absolute",
            width: "140px",
            height: "140px",
            background: "#38b000",
            borderRadius: "50%",
            filter: "blur(60px)",
            opacity: 0.07,
            top: "20%",
            left: "50%",
            pointerEvents: "none",
          }}
        />

        <h1
          className="text-2xl font-extrabold uppercase leading-tight text-[#1a1a1a]"
          style={{
            fontFamily: "var(--font-display), sans-serif",
            letterSpacing: "-0.01em",
            position: "relative",
            zIndex: 1,
          }}
        >
          {paper.title}
        </h1>

        {/* Authors */}
        {paper.authors.length > 0 && (
          <p
            className="text-[0.75rem] italic text-[#666] mt-2"
            style={{
              position: "relative",
              zIndex: 1,
              fontFamily: "var(--font-inter), sans-serif",
            }}
          >
            {paper.authors.join(", ")}
          </p>
        )}
      </div>

      {/* Metadata tags row */}
      <div className="flex flex-wrap gap-2">
        {/* Source tag */}
        <span
          style={{
            display: "inline-block",
            padding: "4px 10px",
            background: TAG_PASTELS.source,
            border: "2px solid #1a1a1a",
            boxShadow: "2px 2px 0px 0px rgba(0,0,0,1)",
            fontSize: "0.6rem",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "1px",
            fontFamily: "var(--font-mono), monospace",
            color: "#1a1a1a",
          }}
        >
          {sourceLabel}
        </span>

        {/* Year tag */}
        {paper.year && (
          <span
            style={{
              display: "inline-block",
              padding: "4px 10px",
              background: TAG_PASTELS.year,
              border: "2px solid #1a1a1a",
              boxShadow: "2px 2px 0px 0px rgba(0,0,0,1)",
              fontSize: "0.6rem",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "1px",
              fontFamily: "var(--font-mono), monospace",
              color: "#1a1a1a",
            }}
          >
            {paper.year}
          </span>
        )}

        {/* Category tag */}
        <span
          style={{
            display: "inline-block",
            padding: "4px 10px",
            background: TAG_PASTELS.category,
            border: "2px solid #1a1a1a",
            boxShadow: "2px 2px 0px 0px rgba(0,0,0,1)",
            fontSize: "0.6rem",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "1px",
            fontFamily: "var(--font-mono), monospace",
            color: "#1a1a1a",
          }}
        >
          {categoryLabel}
        </span>
      </div>

      {/* Abstract section */}
      <section className="space-y-2">
        <h2
          className="text-[0.65rem] font-bold uppercase tracking-[2px] text-[#1a1a1a]"
          style={{ fontFamily: "var(--font-mono), monospace" }}
        >
          ABSTRACT
        </h2>
        <p
          className="text-[0.85rem] leading-relaxed text-[#333] whitespace-pre-wrap"
          style={{ fontFamily: "var(--font-inter), sans-serif" }}
        >
          {paper.abstract || "No abstract available"}
        </p>
      </section>

      <div className="h-[1.5px] bg-[#1a1a1a]" />

      {/* AI Summary */}
      {paper.summary && (
        <>
          <section className="space-y-2">
            <h2
              className="text-[0.65rem] font-bold uppercase tracking-[2px] text-[#1a1a1a]"
              style={{ fontFamily: "var(--font-mono), monospace" }}
            >
              AI SUMMARY
            </h2>
            <p
              className="text-[0.85rem] leading-relaxed text-[#1a1a1a] whitespace-pre-wrap"
              style={{ fontFamily: "var(--font-inter), sans-serif" }}
            >
              {paper.summary}
            </p>
          </section>
          <div className="h-[1.5px] bg-[#1a1a1a]" />
        </>
      )}

      {/* Keywords */}
      {paper.keywords.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {paper.keywords.map((kw, idx) => (
            <KeywordTag
              key={kw}
              keyword={kw}
              color={PASTEL_COLORS[idx % PASTEL_COLORS.length]}
            />
          ))}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={handleStar}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            padding: "8px 14px",
            background: starred ? "#1a1a1a" : "white",
            color: starred ? "#e8e8e8" : "#1a1a1a",
            border: "2px solid #1a1a1a",
            boxShadow: "2px 2px 0px 0px rgba(0,0,0,1)",
            fontSize: "0.65rem",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "2px",
            fontFamily: "var(--font-mono), monospace",
            cursor: "pointer",
            transition: "all 0.15s ease",
            minHeight: "44px",
          }}
        >
          <Star className={`size-3 ${starred ? "fill-current" : ""}`} />
          {starred ? "STARRED" : "STAR"}
        </button>

        <button
          onClick={handleDislikeClick}
          disabled={dislikeState !== "idle"}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            padding: "8px 14px",
            background: "white",
            color: "#1a1a1a",
            border: "2px solid #1a1a1a",
            boxShadow: "2px 2px 0px 0px rgba(0,0,0,1)",
            fontSize: "0.65rem",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "2px",
            fontFamily: "var(--font-mono), monospace",
            cursor: dislikeState === "idle" ? "pointer" : "default",
            opacity: dislikeState !== "idle" ? 0.5 : 1,
            transition: "all 0.15s ease",
            minHeight: "44px",
          }}
        >
          <ThumbsDown className="size-3" />
          DISLIKE
        </button>

        {paper.sourceUrl && (
          <button
            onClick={() =>
              window.open(paper.sourceUrl!, "_blank", "noopener,noreferrer")
            }
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 14px",
              background: "white",
              color: "#1a1a1a",
              border: "2px solid #1a1a1a",
              boxShadow: "2px 2px 0px 0px rgba(0,0,0,1)",
              fontSize: "0.65rem",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "2px",
              fontFamily: "var(--font-mono), monospace",
              cursor: "pointer",
              transition: "all 0.15s ease",
              minHeight: "44px",
            }}
          >
            VIEW SOURCE <ExternalLink className="size-3" />
          </button>
        )}
      </div>

      {/* Dislike flow */}
      {dislikeState === "input" && (
        <div
          className="flex flex-col md:flex-row items-stretch md:items-center gap-2"
        >
          <input
            placeholder="WHY DIDN'T YOU LIKE THIS?"
            value={dislikeReason}
            onChange={(e) => setDislikeReason(e.target.value)}
            className="flex-1 bg-transparent px-3 py-2 text-[0.75rem] placeholder:text-[#666] focus:outline-none"
            style={{
              border: "2px solid #1a1a1a",
              fontFamily: "var(--font-mono), monospace",
              borderRadius: 0,
            }}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") handleDislikeSubmit();
            }}
          />
          <button
            onClick={handleDislikeSubmit}
            style={{
              padding: "8px 14px",
              border: "2px solid #1a1a1a",
              background: "#1a1a1a",
              color: "#e8e8e8",
              fontSize: "0.65rem",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "2px",
              fontFamily: "var(--font-mono), monospace",
              boxShadow: "2px 2px 0px 0px rgba(0,0,0,1)",
              minHeight: "44px",
            }}
          >
            SUBMIT
          </button>
        </div>
      )}
      {dislikeState === "submitting" && (
        <div className="flex items-center gap-2 text-[0.75rem] text-[#666]">
          <Loader2 className="size-3 animate-spin" />
          <span
            className="text-[0.65rem] uppercase tracking-[2px]"
            style={{ fontFamily: "var(--font-mono), monospace" }}
          >
            SUBMITTING...
          </span>
        </div>
      )}
      {dislikeState === "done" && (
        <p
          className="text-[0.7rem] text-[#666]"
          style={{ fontFamily: "var(--font-mono), monospace" }}
        >
          FEEDBACK RECORDED. THANK YOU.
        </p>
      )}

      <div className="h-[1.5px] bg-[#1a1a1a]" />

      {/* Q&A Thread */}
      <QAThread
        paperId={paper.id}
        apiKey={session.apiKey}
        provider={session.provider}
        model={session.model}
        baseUrl={session.baseUrl}
      />

      {/* Related papers */}
      {!relatedLoading && relatedPapers.length > 0 && (
        <>
          <div className="h-[1.5px] bg-[#1a1a1a]" />
          <section className="space-y-3 pb-8">
            <h2
              className="text-[0.65rem] font-bold uppercase tracking-[2px] text-[#1a1a1a]"
              style={{ fontFamily: "var(--font-mono), monospace" }}
            >
              RELATED IN YOUR VAULT
            </h2>
            <div className="flex flex-col gap-2">
              {relatedPapers.map((rp) => (
                <div
                  key={rp.id}
                  style={{
                    padding: "12px 16px",
                    border: "2px solid #1a1a1a",
                    background: "white",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.transform =
                      "translate(-1px, -1px)";
                    (e.currentTarget as HTMLElement).style.boxShadow =
                      "3px 3px 0px 0px rgba(0,0,0,1)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.transform =
                      "translate(0, 0)";
                    (e.currentTarget as HTMLElement).style.boxShadow = "none";
                  }}
                  onClick={() => {
                    // Navigate to the paper detail by opening in vault
                    window.location.href = `/vault?paper=${rp.id}`;
                  }}
                >
                  <p
                    className="text-[0.8rem] font-bold uppercase leading-snug text-[#1a1a1a] line-clamp-2"
                    style={{
                      fontFamily: "var(--font-display), sans-serif",
                    }}
                  >
                    {rp.title}
                  </p>
                  {rp.keywords.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {rp.keywords.map((kw, i) => (
                        <span
                          key={kw}
                          style={{
                            display: "inline-block",
                            padding: "2px 6px",
                            background: PASTEL_COLORS[i % PASTEL_COLORS.length],
                            border: "2px solid #1a1a1a",
                            fontSize: "0.5rem",
                            fontWeight: 700,
                            textTransform: "uppercase",
                            letterSpacing: "0.3px",
                            fontFamily: "var(--font-mono), monospace",
                            color: "#1a1a1a",
                          }}
                        >
                          {kw}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
