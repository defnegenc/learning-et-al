"use client";

import { useState, useEffect } from "react";
import { Star, ThumbsDown, ExternalLink, Loader2, X, Send } from "lucide-react";
import { QAThread } from "./qa-thread";
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
  inline?: boolean;
  onBack: () => void;
  onStar: (paperId: string) => void;
  onDislike: (paperId: string) => void;
}

const GLASS_TAG: React.CSSProperties = {
  background: "rgba(255, 255, 255, 0.45)",
  backdropFilter: "blur(8px)",
  WebkitBackdropFilter: "blur(8px)",
  border: "1px solid rgba(255, 255, 255, 0.8)",
  padding: "6px 14px",
  borderRadius: "999px",
  fontSize: "0.6rem",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "1.5px",
  fontFamily: "var(--font-mono), monospace",
  color: "#1a1a1a",
  display: "inline-block",
};

export function PaperDetail({
  paper,
  session,
  isStarred = false,
  inline = false,
  onBack,
  onStar,
  onDislike,
}: PaperDetailProps) {
  const [starred, setStarred] = useState(isStarred);
  const [dislikeState, setDislikeState] = useState<"idle" | "input" | "submitting" | "done">("idle");
  const [dislikeReason, setDislikeReason] = useState("");
  const [relatedPapers, setRelatedPapers] = useState<RelatedPaper[]>([]);
  const [relatedLoading, setRelatedLoading] = useState(true);
  const [notes, setNotes] = useState("");
  const [notesSaved, setNotesSaved] = useState(false);
  const [inlineMessages, setInlineMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [inlineInput, setInlineInput] = useState("");
  const [loading, setLoading] = useState(false);

  const handleInlineAsk = async (question: string) => {
    if (!question.trim() || loading) return;
    setInlineMessages(prev => [...prev, { role: "user", content: question }]);
    setInlineInput("");
    setLoading(true);
    try {
      const res = await fetch(`/api/papers/${paper.id}/qa`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, apiKey: session.apiKey, provider: session.provider, model: session.model, baseUrl: session.baseUrl }),
      });
      const data = await res.json();
      const answer = data.qaPair?.answer || data.answer || "Couldn't get an answer.";
      setInlineMessages(prev => [...prev, { role: "assistant", content: answer }]);
    } catch {
      setInlineMessages(prev => [...prev, { role: "assistant", content: "Something went wrong. Try again." }]);
    } finally {
      setLoading(false);
    }
  };

  // Load saved notes from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(`paper_notes_${paper.id}`);
    if (saved) setNotes(saved);
  }, [paper.id]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/papers/${paper.id}/related`);
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setRelatedPapers(data.related ?? []);
      } catch { /* silent */ } finally {
        if (!cancelled) setRelatedLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [paper.id]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onBack(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onBack]);

  const handleStar = () => {
    setStarred(prev => !prev);
    onStar(paper.id);
  };

  const handleSaveNotes = () => {
    localStorage.setItem(`paper_notes_${paper.id}`, notes);
    setNotesSaved(true);
    setTimeout(() => setNotesSaved(false), 2000);
  };

  const handleDislikeSubmit = async () => {
    setDislikeState("submitting");
    try {
      await fetch(`/api/papers/${paper.id}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "dislike", reason: dislikeReason,
          apiKey: session.apiKey, provider: session.provider,
          model: session.model, baseUrl: session.baseUrl,
        }),
      });
      onDislike(paper.id);
    } catch { /* silent */ }
    setDislikeState("done");
  };

  const isNews = paper.source === "rss";
  const sourceLabel = paper.source === "arxiv" ? "ARXIV" : isNews ? "NEWS" : "PAPER";
  const paperId = `${sourceLabel}-${paper.year ?? "??"}`;
  // For news articles, prefer fullText (full article) over abstract (snippet)
  const articleText = isNews
    ? (paper.fullText && paper.fullText.length > 200 ? paper.fullText : paper.abstract)
    : paper.abstract;

  // Blob colors from the card style system — reused for detail bg
  const DETAIL_BLOBS = [
    { color: "#f9a8d4", w: 120, h: 120, top: "60px", right: "-30px" },
    { color: "#86efac", w: 90, h: 90, bottom: "200px", left: "-20px" },
  ];

  // ── Inline mode: renders directly in the canvas area, no modal ──
  if (inline) {
    const topic = paper.keywords.length > 0 ? paper.keywords[0].toLowerCase() : paper.title.split(" ").slice(0, 3).join(" ").toLowerCase();
    const paperQuestions = [
      `Why does this matter for ${topic}?`,
      `How does this connect to the other papers today?`,
      `What should I read next about ${topic}?`,
    ];

    return (
      <div className="flex-1 overflow-y-auto" style={{ padding: "40px", position: "relative" }}>
        {/* Subtle blobs in background */}
        {DETAIL_BLOBS.map((blob, i) => (
          <div key={i} style={{
            position: "absolute", width: `${blob.w}px`, height: `${blob.h}px`,
            background: blob.color, borderRadius: "50%", filter: "blur(50px)",
            opacity: 0.4, top: blob.top, right: blob.right, bottom: blob.bottom, left: blob.left,
            pointerEvents: "none",
          }} />
        ))}
        <div className="max-w-3xl mx-auto" style={{ position: "relative", zIndex: 1 }}>
          {/* Back + source row */}
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={onBack}
              className="flex items-center gap-2 hover:text-[#7700ff] transition-colors"
              style={{
                fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase",
                letterSpacing: "2px", fontFamily: "var(--font-mono), monospace",
                background: "none", border: "none", padding: 0, cursor: "pointer",
                color: "#888",
              }}
            >
              ← Back to synthesis
            </button>
            <div className="flex items-center gap-3">
              {paper.year && (
                <span style={{
                  background: "#1a1a1a", color: "white", padding: "3px 10px",
                  fontSize: "0.65rem", fontWeight: 700, fontFamily: "var(--font-mono), monospace",
                }}>
                  {sourceLabel} · {paper.year}
                </span>
              )}
              {paper.sourceUrl && (
                <button onClick={() => window.open(paper.sourceUrl!, "_blank", "noopener,noreferrer")} style={{
                  padding: "3px 10px", border: "2px solid #1a1a1a", background: "white",
                  fontSize: "0.6rem", fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase",
                  fontFamily: "var(--font-mono), monospace", cursor: "pointer",
                  display: "inline-flex", alignItems: "center", gap: "4px",
                }}>
                  <ExternalLink size={10} /> Source
                </button>
              )}
            </div>
          </div>

          {/* Title */}
          <h2 style={{
            fontSize: "clamp(1.6rem, 4vw, 2.5rem)", fontWeight: 700,
            lineHeight: 1.1, fontFamily: "var(--font-display), sans-serif",
            color: "#111", marginBottom: "8px", letterSpacing: "-0.02em",
          }}>
            {paper.title}
          </h2>

          {/* Authors */}
          {paper.authors.length > 0 && (
            <p style={{ fontSize: "0.75rem", color: "#888", fontFamily: "var(--font-mono), monospace", fontStyle: "italic", marginBottom: "10px" }}>
              {paper.authors.join(", ")}{paper.year ? `, ${paper.year}` : ""}
            </p>
          )}

          {/* Actions */}
          <div className="flex gap-2 mb-8">
            <button onClick={handleStar} style={{
              padding: "5px 14px", fontSize: "9px", fontWeight: 700,
              textTransform: "uppercase", fontFamily: "var(--font-mono), monospace",
              background: starred ? "#1a1a1a" : "white", border: "2px solid #1a1a1a",
              boxShadow: "2px 2px 0px 0px rgba(0,0,0,1)",
              color: starred ? "white" : "#1a1a1a", cursor: "pointer",
            }}>
              <Star size={10} className={`inline mr-1 ${starred ? "fill-current" : ""}`} />
              {starred ? "Starred" : "Star"}
            </button>
            <button onClick={() => dislikeState === "idle" && setDislikeState("input")} style={{
              padding: "5px 14px", fontSize: "9px", fontWeight: 700,
              textTransform: "uppercase", fontFamily: "var(--font-mono), monospace",
              background: "white", border: "2px solid #1a1a1a",
              boxShadow: "2px 2px 0px 0px rgba(0,0,0,1)",
              color: "#1a1a1a", cursor: "pointer", opacity: dislikeState !== "idle" ? 0.5 : 1,
            }}>
              <ThumbsDown size={10} className="inline mr-1" /> Not for me
            </button>
          </div>

          {/* Dislike flow */}
          {dislikeState === "input" && (
            <div className="flex gap-2 mb-6">
              <input placeholder="Why didn't you like this?" value={dislikeReason}
                onChange={e => setDislikeReason(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleDislikeSubmit()} autoFocus
                className="flex-1 bg-white px-3 py-2 text-[0.75rem] focus:outline-none"
                style={{ border: "2px solid #1a1a1a", fontFamily: "var(--font-mono), monospace" }} />
              <button onClick={handleDislikeSubmit} style={{
                padding: "8px 14px", background: "#1a1a1a", color: "white",
                fontSize: "0.6rem", fontWeight: 700, letterSpacing: "2px",
                textTransform: "uppercase", fontFamily: "var(--font-mono), monospace",
              }}>Submit</button>
            </div>
          )}

          {/* Summary — styled like synthesis prose */}
          {paper.summary && (
            <div
              className="mb-10 text-[0.95rem] text-gray-700"
              style={{ lineHeight: "1.8", fontFamily: "inherit" }}
            >
              {paper.summary}
            </div>
          )}

          {/* Key Findings */}
          {paper.keyFindings && paper.keyFindings.length > 0 && (
            <div className="mb-10 pb-8" style={{ borderBottom: "2px solid #e5e7eb" }}>
              <h3 style={{ fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "3px", color: "#999", fontFamily: "var(--font-mono), monospace", marginBottom: "16px" }}>
                {isNews ? "What You Need to Know" : "Key Findings"}
              </h3>
              <ul className="space-y-4">
                {paper.keyFindings.map((finding, i) => (
                  <li key={i} className="flex gap-4 items-start">
                    <span style={{ flexShrink: 0, width: "22px", height: "22px", background: "#f3f4f6", border: "2px solid #1a1a1a", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.6rem", fontWeight: 700, fontFamily: "var(--font-mono), monospace", marginTop: "2px" }}>{i + 1}</span>
                    <p style={{ fontSize: "0.95rem", lineHeight: 1.7, fontFamily: "inherit", color: "#333" }}>{finding}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Abstract / Full Article */}
          <div className="mb-10">
            <h3 style={{ fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "3px", color: "#999", fontFamily: "var(--font-mono), monospace", marginBottom: "16px" }}>
              {isNews ? "Full Article" : "Abstract"}
            </h3>
            <div
              className="text-[0.95rem] text-gray-700"
              style={{ lineHeight: "1.8", fontFamily: "inherit", whiteSpace: "pre-wrap" }}
            >
              {articleText || "No content available."}
            </div>
          </div>

          {/* Q&A — chat style matching synthesis chat */}
          <div
            style={{
              border: "3px solid #1a1a1a",
              background: "white",
              boxShadow: "6px 6px 0px 0px rgba(0,0,0,1)",
              overflow: "hidden",
            }}
          >
            <div style={{ background: "#1a1a1a", padding: "14px 20px" }}>
              <span style={{
                fontSize: "0.85rem", fontWeight: 700, textTransform: "uppercase",
                letterSpacing: "2px", fontFamily: "var(--font-mono), monospace", color: "white",
              }}>
                Ask about this paper
              </span>
            </div>

            {/* Prepared question buttons */}
            <div style={{ padding: "16px 20px", borderBottom: "2px solid #e5e7eb" }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                {paperQuestions.map((q) => (
                  <button
                    key={q}
                    onClick={() => handleInlineAsk(q)}
                    disabled={loading}
                    style={{
                      padding: "8px 16px", border: "2px solid #1a1a1a", background: "white",
                      fontSize: "0.8rem", fontWeight: 600, fontFamily: "inherit",
                      color: "#1a1a1a", textAlign: "left", cursor: loading ? "not-allowed" : "pointer",
                      transition: "background 0.1s, color 0.1s", lineHeight: 1.4,
                      opacity: loading ? 0.5 : 1, boxShadow: "3px 3px 0px 0px rgba(0,0,0,1)",
                    }}
                    onMouseEnter={(e) => { if (!loading) { (e.currentTarget as HTMLElement).style.background = "#1a1a1a"; (e.currentTarget as HTMLElement).style.color = "white"; } }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "white"; (e.currentTarget as HTMLElement).style.color = "#1a1a1a"; }}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>

            {/* Chat messages */}
            {inlineMessages.length > 0 && (
              <div style={{ maxHeight: "300px", overflowY: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: "12px" }}>
                {inlineMessages.map((msg, i) => (
                  <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: msg.role === "user" ? "flex-end" : "flex-start" }}>
                    <div style={{
                      maxWidth: "85%", padding: "10px 14px",
                      background: msg.role === "user" ? "#1a1a1a" : "#f5f5f5",
                      border: msg.role === "user" ? "none" : "2px solid #e5e7eb",
                      color: msg.role === "user" ? "white" : "#1a1a1a",
                      fontSize: "0.9rem", lineHeight: 1.7,
                      fontFamily: msg.role === "user" ? "var(--font-mono), monospace" : "inherit",
                    }}>
                      {msg.content}
                    </div>
                  </div>
                ))}
                {loading && (
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <Loader2 style={{ width: "14px", height: "14px", animation: "spin 1s linear infinite", color: "#888" }} />
                    <span style={{ fontSize: "0.7rem", color: "#888", fontFamily: "var(--font-mono), monospace" }}>thinking...</span>
                  </div>
                )}
              </div>
            )}

            {/* Input */}
            <div style={{ borderTop: "3px solid #1a1a1a", padding: "14px 20px", display: "flex", gap: "10px", alignItems: "center", background: "#fafafa" }}>
              <input
                value={inlineInput}
                onChange={(e) => setInlineInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleInlineAsk(inlineInput); } }}
                placeholder="Ask anything about this paper..."
                disabled={loading}
                style={{ flex: 1, border: "none", outline: "none", fontSize: "0.9rem", fontFamily: "inherit", color: "#1a1a1a", background: "transparent" }}
              />
              <button
                onClick={() => handleInlineAsk(inlineInput)}
                disabled={loading || !inlineInput.trim()}
                style={{
                  padding: "8px", border: "none",
                  background: inlineInput.trim() && !loading ? "#1a1a1a" : "#d1d5db",
                  cursor: inlineInput.trim() && !loading ? "pointer" : "not-allowed",
                  display: "flex", alignItems: "center", transition: "background 0.15s",
                }}
              >
                <Send style={{ width: "14px", height: "14px", color: "white" }} />
              </button>
            </div>
          </div>

          <div style={{ height: "40px" }} />
        </div>
      </div>
    );
  }

  // ── Modal mode: full overlay (used on mobile + vault) ──
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-10"
      style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}
      onClick={onBack}
    >
      <div
        className="w-full h-full flex flex-col overflow-hidden"
        style={{
          maxWidth: "1100px",
          maxHeight: "90vh",
          border: "4px solid #1a1a1a",
          boxShadow: "12px 12px 0px 0px rgba(0,0,0,1)",
          background: "white",
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Modal header */}
        <div
          className="flex items-center justify-between px-6 shrink-0"
          style={{ height: "52px", background: "#1a1a1a" }}
        >
          <span
            className="text-white/50 tracking-widest uppercase"
            style={{ fontSize: "0.6rem", fontFamily: "var(--font-mono), monospace" }}
          >
            Paper Detail · {paperId}
          </span>
          <button
            onClick={onBack}
            className="text-white hover:text-[#ff007f] transition-colors"
          >
            <X size={20} strokeWidth={2.5} />
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden">
          {/* ── Left panel ── */}
          <div
            className="flex-1 overflow-y-auto p-8 md:p-10"
            style={{
              background: "linear-gradient(to bottom right, #F3E8FF, #FCE7F3, #EFF6FF)",
              borderRight: "3px solid #1a1a1a",
            }}
          >
            <div className="max-w-2xl">
              {/* Meta row */}
              <div className="flex items-center gap-3 mb-7">
                {paper.year && (
                  <span
                    style={{
                      background: "#1a1a1a", color: "white",
                      padding: "3px 10px",
                      fontSize: "0.65rem", fontWeight: 700,
                      fontFamily: "var(--font-mono), monospace",
                      letterSpacing: "1px",
                    }}
                  >
                    {paper.year}
                  </span>
                )}
                {paper.sourceUrl && (
                  <span style={{ fontSize: "0.6rem", color: "#888", fontFamily: "var(--font-mono), monospace" }}>
                    {sourceLabel}
                  </span>
                )}
                <div className="flex gap-2 ml-auto">
                  <button
                    onClick={handleStar}
                    style={{
                      ...GLASS_TAG,
                      background: starred ? "rgba(56,176,0,0.15)" : "rgba(255,255,255,0.45)",
                      color: starred ? "#38b000" : "#1a1a1a",
                    }}
                  >
                    <Star size={10} className={`inline mr-1 ${starred ? "fill-current" : ""}`} />
                    {starred ? "Starred" : "Star"}
                  </button>
                  <button
                    onClick={() => dislikeState === "idle" && setDislikeState("input")}
                    disabled={dislikeState !== "idle"}
                    style={{ ...GLASS_TAG, opacity: dislikeState !== "idle" ? 0.5 : 1 }}
                  >
                    <ThumbsDown size={10} className="inline mr-1" />
                    Not for me
                  </button>
                </div>
              </div>

              {/* Title */}
              <h2
                style={{
                  fontSize: "clamp(1.4rem, 3vw, 2rem)",
                  fontWeight: 800,
                  textTransform: "uppercase",
                  lineHeight: 1.1,
                  letterSpacing: "-0.01em",
                  fontFamily: "var(--font-display), sans-serif",
                  color: "#1a1a1a",
                  marginBottom: "20px",
                }}
              >
                {paper.title}
              </h2>

              {/* Authors + keywords */}
              <div className="flex flex-wrap gap-2 mb-8">
                {paper.authors.length > 0 && (
                  <span style={{ ...GLASS_TAG, fontStyle: "italic" }}>
                    {paper.authors.length === 1 ? paper.authors[0]
                      : `${paper.authors[0].split(" ").pop()} et al.`}
                  </span>
                )}
                {paper.keywords.slice(0, 3).map(kw => (
                  <span key={kw} style={GLASS_TAG}>{kw}</span>
                ))}
              </div>

              {/* Dislike flow */}
              {dislikeState === "input" && (
                <div className="flex gap-2 mb-6">
                  <input
                    placeholder="Why didn't you like this?"
                    value={dislikeReason}
                    onChange={e => setDislikeReason(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleDislikeSubmit()}
                    autoFocus
                    className="flex-1 bg-white/70 px-3 py-2 text-[0.75rem] focus:outline-none"
                    style={{ border: "2px solid #1a1a1a", fontFamily: "var(--font-mono), monospace" }}
                  />
                  <button
                    onClick={handleDislikeSubmit}
                    style={{
                      padding: "8px 14px", background: "#1a1a1a", color: "white",
                      fontSize: "0.6rem", fontWeight: 700, letterSpacing: "2px",
                      textTransform: "uppercase", fontFamily: "var(--font-mono), monospace",
                    }}
                  >
                    Submit
                  </button>
                </div>
              )}
              {dislikeState === "submitting" && (
                <div className="flex items-center gap-2 mb-6 text-[0.7rem] text-[#666]">
                  <Loader2 size={12} className="animate-spin" />
                  <span style={{ fontFamily: "var(--font-mono), monospace" }}>Submitting...</span>
                </div>
              )}

              {/* TL;DR Summary — shown first for all types */}
              {paper.summary && (
                <div className="mb-8" style={{ background: "rgba(255,255,255,0.5)", padding: "16px 20px", border: "1px solid rgba(0,0,0,0.08)" }}>
                  <h3 style={{
                    fontSize: "0.6rem", fontWeight: 700, textTransform: "uppercase",
                    letterSpacing: "3px", color: "#888",
                    fontFamily: "var(--font-mono), monospace", marginBottom: "8px",
                  }}>
                    TL;DR
                  </h3>
                  <p style={{ fontSize: "0.88rem", lineHeight: 1.65, fontFamily: "inherit", color: "#1a1a1a" }}>
                    {paper.summary}
                  </p>
                </div>
              )}

              {/* Key Findings */}
              {paper.keyFindings && paper.keyFindings.length > 0 && (
                <div className="mb-8">
                  <h3
                    style={{
                      fontSize: "0.6rem", fontWeight: 700, textTransform: "uppercase",
                      letterSpacing: "3px", color: "#888",
                      fontFamily: "var(--font-mono), monospace", marginBottom: "12px",
                    }}
                  >
                    {isNews ? "What You Need to Know" : "Key Findings"}
                  </h3>
                  <ul className="space-y-3">
                    {paper.keyFindings.map((finding, i) => (
                      <li key={i} className="flex gap-3 items-start">
                        <span
                          style={{
                            flexShrink: 0, width: "20px", height: "20px",
                            background: ["rgba(255,255,255,0.8)", "rgba(255,255,255,0.6)", "rgba(255,255,255,0.7)"][i % 3],
                            border: "2px solid #1a1a1a",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: "0.55rem", fontWeight: 700,
                            fontFamily: "var(--font-mono), monospace", marginTop: "2px",
                          }}
                        >
                          {i + 1}
                        </span>
                        <p style={{ fontSize: "0.85rem", lineHeight: 1.6, fontFamily: "inherit", color: "#1a1a1a" }}>
                          {finding}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Full article / Abstract */}
              <div className="mb-8">
                <h3 style={{
                  fontSize: "0.6rem", fontWeight: 700, textTransform: "uppercase",
                  letterSpacing: "3px", color: "#888",
                  fontFamily: "var(--font-mono), monospace", marginBottom: "12px",
                }}>
                  {isNews ? "Full Article" : "Abstract"}
                </h3>
                <div style={{
                  fontSize: "0.88rem", lineHeight: 1.75,
                  fontFamily: "inherit", color: "#333",
                  whiteSpace: "pre-wrap",
                }}>
                  {articleText || "No content available."}
                </div>
              </div>

              {/* Citation + AI summary */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-6" style={{ borderTop: "1px solid rgba(0,0,0,0.1)" }}>
                {paper.authors.length > 0 && (
                  <div>
                    <h3 style={{
                      fontSize: "0.6rem", fontWeight: 700, textTransform: "uppercase",
                      letterSpacing: "3px", color: "#888",
                      fontFamily: "var(--font-mono), monospace", marginBottom: "8px",
                    }}>
                      Citation
                    </h3>
                    <p style={{ fontSize: "0.75rem", fontFamily: "var(--font-mono), monospace", color: "#555", lineHeight: 1.6 }}>
                      {paper.authors.join(", ")}{paper.year ? `, ${paper.year}` : ""}
                    </p>
                  </div>
                )}
              </div>

              {/* Q&A Thread */}
              <div className="mt-8 pt-6" style={{ borderTop: "1px solid rgba(0,0,0,0.1)" }}>
                <QAThread
                  paperId={paper.id}
                  apiKey={session.apiKey}
                  provider={session.provider}
                  model={session.model}
                  baseUrl={session.baseUrl}
                />
              </div>
            </div>
          </div>

          {/* ── Right panel ── */}
          <div className="w-[360px] shrink-0 flex flex-col overflow-hidden" style={{ background: "#f9f9f9" }}>
            {/* Notes */}
            <div className="flex-1 overflow-y-auto p-7" style={{ borderBottom: "2px solid #e5e5e5" }}>
              <h3
                style={{
                  fontSize: "0.6rem", fontWeight: 700, textTransform: "uppercase",
                  letterSpacing: "3px", fontFamily: "var(--font-mono), monospace",
                  color: "#1a1a1a", marginBottom: "16px",
                  display: "flex", alignItems: "center", gap: "8px",
                }}
              >
                <span style={{ width: "6px", height: "6px", background: "#1a1a1a", display: "inline-block" }} />
                My Notes
              </h3>
              <textarea
                className="w-full resize-none bg-white focus:outline-none"
                style={{
                  height: "180px",
                  border: "2px solid #1a1a1a",
                  padding: "14px",
                  fontFamily: "var(--font-mono), monospace",
                  fontSize: "0.78rem",
                  lineHeight: 1.6,
                  boxShadow: "3px 3px 0px 0px rgba(0,0,0,0.08)",
                }}
                placeholder="Your synthesis, critiques, connections..."
                value={notes}
                onChange={e => setNotes(e.target.value)}
              />
              <div className="flex justify-end mt-3">
                <button
                  onClick={handleSaveNotes}
                  style={{
                    background: "#1a1a1a", color: "white",
                    padding: "7px 16px",
                    fontSize: "0.6rem", fontWeight: 700,
                    textTransform: "uppercase", letterSpacing: "2px",
                    fontFamily: "var(--font-mono), monospace",
                    border: "none", cursor: "pointer",
                    transition: "background 0.15s",
                  }}
                >
                  {notesSaved ? "Saved!" : "Save Notes"}
                </button>
              </div>
            </div>

            {/* Related in vault */}
            <div className="flex-1 overflow-y-auto p-7 bg-white">
              <h3
                style={{
                  fontSize: "0.6rem", fontWeight: 700, textTransform: "uppercase",
                  letterSpacing: "3px", fontFamily: "var(--font-mono), monospace",
                  color: "#aaa", marginBottom: "14px",
                }}
              >
                Related in Vault
              </h3>
              {relatedLoading ? (
                <Loader2 size={14} className="animate-spin text-[#888]" />
              ) : relatedPapers.length === 0 ? (
                <p style={{ fontSize: "0.7rem", color: "#aaa", fontFamily: "var(--font-mono), monospace" }}>
                  Nothing yet
                </p>
              ) : (
                <div className="space-y-3">
                  {relatedPapers.map(rp => (
                    <div
                      key={rp.id}
                      className="cursor-pointer group"
                      style={{ padding: "10px 12px", border: "2px solid #e5e5e5", background: "white", transition: "border-color 0.15s" }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = "#1a1a1a"}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = "#e5e5e5"}
                      onClick={() => { window.location.href = `/vault?paper=${rp.id}`; }}
                    >
                      <p
                        style={{
                          fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase",
                          lineHeight: 1.3, fontFamily: "var(--font-display), sans-serif",
                          color: "#1a1a1a",
                        }}
                        className="line-clamp-2 group-hover:text-[#7700ff] transition-colors"
                      >
                        {rp.title}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Bottom action bar */}
            <div
              className="shrink-0 p-5"
              style={{ background: "#1a1a1a", borderTop: "3px solid #1a1a1a" }}
            >
              {paper.sourceUrl ? (
                <button
                  onClick={() => window.open(paper.sourceUrl!, "_blank", "noopener,noreferrer")}
                  className="w-full flex items-center justify-center gap-3 py-3 transition-all hover:bg-white/10"
                  style={{
                    border: "1px solid rgba(255,255,255,0.25)",
                    color: "white", fontWeight: 700,
                    fontSize: "0.65rem", letterSpacing: "2px",
                    textTransform: "uppercase", fontFamily: "var(--font-mono), monospace",
                  }}
                >
                  <ExternalLink size={14} />
                  View Source
                </button>
              ) : (
                <p style={{ fontSize: "0.6rem", color: "rgba(255,255,255,0.3)", fontFamily: "var(--font-mono), monospace", textAlign: "center" }}>
                  No source link
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
