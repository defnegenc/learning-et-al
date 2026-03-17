"use client";

import { useState } from "react";
import {
  Star,
  ThumbsDown,
  ExternalLink,
  Loader2,
} from "lucide-react";
import { QAThread } from "./qa-thread";
import type { PaperItem } from "./paper-card";

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
}

const ACCENT_COLORS = ["#38b000", "#ff007f", "#7700ff", "#0077ff", "#ff8800"];

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

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Back button */}
      <button
        onClick={onBack}
        className="text-[0.7rem] uppercase tracking-[2px] text-[#1a1a1a] hover:text-[#ff007f] transition-colors"
        style={{ fontFamily: '"Courier New", Courier, monospace', cursor: "crosshair", background: "none", border: "none", padding: 0 }}
      >
        &larr; BACK
      </button>

      {/* Source label */}
      <span
        className="inline-block border border-[#1a1a1a] px-2 py-0.5 text-[0.6rem] uppercase tracking-[2px] text-[#555]"
        style={{ borderWidth: "1.5px", fontFamily: '"Courier New", Courier, monospace' }}
      >
        {paper.source === "semantic_scholar" ? "S2" : paper.source === "arxiv" ? "ARXIV" : "RSS"} // {new Date().getFullYear()}
      </span>

      {/* Title */}
      <h1
        className="text-xl font-bold uppercase leading-tight text-[#1a1a1a]"
        style={{ fontFamily: '"Courier New", Courier, monospace', letterSpacing: "1px" }}
      >
        {paper.title}
      </h1>

      {/* Authors */}
      {paper.authors.length > 0 && (
        <p className="text-[0.75rem] italic text-[#555]">
          {paper.authors.join(", ")}
        </p>
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-2">
        <button
          onClick={handleStar}
          className={`border border-[#1a1a1a] px-3 py-1 text-[0.65rem] uppercase tracking-[2px] transition-colors flex items-center gap-1.5 ${
            starred
              ? "bg-[#1a1a1a] text-[#e8e8e8]"
              : "text-[#1a1a1a] hover:bg-[#d8d8d8]"
          }`}
          style={{ borderWidth: "1.5px", fontFamily: '"Courier New", Courier, monospace', cursor: "crosshair" }}
        >
          <Star className={`size-3 ${starred ? "fill-current" : ""}`} />
          {starred ? "STARRED" : "STAR"}
        </button>

        <button
          onClick={handleDislikeClick}
          disabled={dislikeState !== "idle"}
          className="border border-[#1a1a1a] px-3 py-1 text-[0.65rem] uppercase tracking-[2px] text-[#1a1a1a] hover:bg-[#d8d8d8] transition-colors flex items-center gap-1.5 disabled:opacity-50"
          style={{ borderWidth: "1.5px", fontFamily: '"Courier New", Courier, monospace', cursor: "crosshair" }}
        >
          <ThumbsDown className="size-3" />
          DISLIKE
        </button>

        {paper.sourceUrl && (
          <button
            onClick={() => window.open(paper.sourceUrl!, "_blank", "noopener,noreferrer")}
            className="border border-[#1a1a1a] px-3 py-1 text-[0.65rem] uppercase tracking-[2px] text-[#1a1a1a] hover:bg-[#d8d8d8] transition-colors flex items-center gap-1.5"
            style={{ borderWidth: "1.5px", fontFamily: '"Courier New", Courier, monospace', cursor: "crosshair" }}
          >
            <ExternalLink className="size-3" />
            OPEN_SOURCE
          </button>
        )}
      </div>

      {/* Dislike flow */}
      {dislikeState === "input" && (
        <div className="flex items-center gap-2">
          <input
            placeholder="WHY DIDN'T YOU LIKE THIS?"
            value={dislikeReason}
            onChange={(e) => setDislikeReason(e.target.value)}
            className="flex-1 border border-[#1a1a1a] bg-transparent px-2 py-1 text-[0.75rem] placeholder:text-[#555] focus:outline-none"
            style={{ borderWidth: "1.5px", fontFamily: '"Courier New", Courier, monospace', borderRadius: 0 }}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") handleDislikeSubmit();
            }}
          />
          <button
            onClick={handleDislikeSubmit}
            className="border border-[#1a1a1a] bg-[#1a1a1a] text-[#e8e8e8] px-3 py-1 text-[0.65rem] uppercase tracking-[2px]"
            style={{ borderWidth: "1.5px", fontFamily: '"Courier New", Courier, monospace', cursor: "crosshair" }}
          >
            SUBMIT
          </button>
        </div>
      )}
      {dislikeState === "submitting" && (
        <div className="flex items-center gap-2 text-[0.75rem] text-[#555]">
          <Loader2 className="size-3 animate-spin" />
          <span
            className="text-[0.65rem] uppercase tracking-[2px]"
            style={{ fontFamily: '"Courier New", Courier, monospace' }}
          >
            SUBMITTING...
          </span>
        </div>
      )}
      {dislikeState === "done" && (
        <p
          className="text-[0.7rem] text-[#555]"
          style={{ fontFamily: '"Courier New", Courier, monospace' }}
        >
          FEEDBACK_RECORDED. THANK_YOU.
        </p>
      )}

      {/* Keywords with accent colors */}
      {paper.keywords.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {paper.keywords.map((kw, idx) => {
            const color = ACCENT_COLORS[idx % ACCENT_COLORS.length];
            return (
              <span
                key={kw}
                className="px-2 py-0.5 text-[0.6rem] uppercase tracking-[1px]"
                style={{
                  borderWidth: "1px",
                  borderStyle: "solid",
                  borderColor: color,
                  color: color,
                  fontFamily: '"Courier New", Courier, monospace',
                }}
              >
                {kw}
              </span>
            );
          })}
        </div>
      )}

      {/* Separator */}
      <div className="h-[1.5px] bg-[#1a1a1a]" />

      {/* AI Summary */}
      {paper.summary && (
        <>
          <section className="space-y-2">
            <h2
              className="text-[0.65rem] font-bold uppercase tracking-[2px] text-[#1a1a1a]"
              style={{ fontFamily: '"Courier New", Courier, monospace' }}
            >
              AI_SUMMARY
            </h2>
            <p className="text-[0.85rem] leading-relaxed text-[#1a1a1a] whitespace-pre-wrap">
              {paper.summary}
            </p>
          </section>
          <div className="h-[1.5px] bg-[#1a1a1a]" />
        </>
      )}

      {/* Q&A Thread */}
      <QAThread
        paperId={paper.id}
        apiKey={session.apiKey}
        provider={session.provider}
        model={session.model}
        baseUrl={session.baseUrl}
      />
    </div>
  );
}
