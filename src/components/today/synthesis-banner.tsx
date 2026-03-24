"use client";

import React, { useState, useCallback, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import { Loader2 } from "lucide-react";
import type { PaperItem } from "./paper-card";

// Quick digest feedback — was this interesting?
function DigestFeedback({ digestId, onRegenerate }: { digestId: string; onRegenerate?: () => void }) {
  const [reaction, setReaction] = useState<"up" | "down" | null>(null);
  const [comment, setComment] = useState("");
  const [showComment, setShowComment] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const storageKey = `digest_feedback_${digestId}`;

  React.useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved) { setSubmitted(true); setReaction(saved as "up" | "down"); }
    else { setSubmitted(false); setReaction(null); setShowComment(false); }
  }, [storageKey]);

  const submit = async (r: "up" | "down") => {
    setReaction(r);
    setSubmitted(true);
    localStorage.setItem(storageKey, r);
    try {
      await fetch("/api/digest/star", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ digestId }),
      });
    } catch { /* non-critical */ }
    if (r === "down") setShowComment(true);
  };

  if (submitted && !showComment) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginTop: "16px" }}>
        {reaction === "up" ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#38b000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ff007f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"/></svg>
        )}
        <span style={{ fontSize: "0.95rem", color: "#555" }}>
          {reaction === "up" ? "Glad you liked it!" : "Noted — we'll do better next time"}
        </span>
        <button onClick={() => { setSubmitted(false); setReaction(null); localStorage.removeItem(storageKey); }} style={{ fontSize: "0.8rem", color: "#bbb", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>
          Undo
        </button>
      </div>
    );
  }

  if (showComment) {
    return (
      <div style={{ marginTop: "16px" }}>
        <p style={{ fontSize: "0.9rem", color: "#555", marginBottom: "10px" }}>
          What didn&apos;t work? We&apos;ll generate a new digest based on your feedback.
        </p>
        <div style={{ display: "flex", gap: "8px" }}>
          <input
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder="e.g. topics weren't relevant, too technical..."
            autoFocus
            style={{ flex: 1, padding: "10px 12px", border: "2px solid #1a1a1a", fontSize: "0.85rem", outline: "none" }}
            onKeyDown={e => { if (e.key === "Enter" && comment.trim()) { setShowComment(false); onRegenerate?.(); } }}
          />
          <button onClick={() => { setShowComment(false); if (comment.trim()) onRegenerate?.(); }}
            style={{ padding: "10px 16px", background: "#1a1a1a", color: "white", border: "2px solid #1a1a1a", fontSize: "0.7rem", fontWeight: 700, cursor: "pointer", textTransform: "uppercase", letterSpacing: "1px", fontFamily: "var(--font-mono), monospace" }}>
            Regenerate
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "14px", marginTop: "16px" }}>
      <span style={{ fontSize: "0.95rem", color: "#999" }}>Did you find this interesting?</span>
      <button onClick={() => submit("up")} style={{ background: "none", border: "1.5px solid #e5e7eb", padding: "7px 12px", cursor: "pointer", lineHeight: 1 }} className="hover:border-[#38b000] transition-colors">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>
      </button>
      <button onClick={() => submit("down")} style={{ background: "none", border: "1.5px solid #e5e7eb", padding: "7px 12px", cursor: "pointer", lineHeight: 1 }} className="hover:border-[#ff007f] transition-colors">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"/></svg>
      </button>
    </div>
  );
}

// Paper name highlight with hover tooltip showing summary
function PaperHighlight({ bg, bgHover, summary, onClick, children }: {
  bg: string; bgHover: string; summary: string | null; onClick: () => void; children: React.ReactNode;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <span
      style={{
        position: "relative",
        color: "#111", fontSize: "1.1em", fontWeight: 700,
        background: hovered ? bgHover : bg,
        padding: "1px 4px", margin: "0 -2px",
        cursor: "pointer", transition: "background 0.15s", borderRadius: "2px",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
    >
      {children}
      {hovered && summary && (
        <span style={{
          position: "absolute", bottom: "calc(100% + 8px)", left: "0",
          background: "#1a1a1a", color: "white",
          fontSize: "0.75rem", fontWeight: 400, lineHeight: 1.5,
          padding: "10px 14px", width: "280px", whiteSpace: "normal",
          zIndex: 50, boxShadow: "4px 4px 0px 0px rgba(0,0,0,0.3)",
          borderRadius: "0",
        }}>
          {summary.length > 150 ? summary.slice(0, 147) + "..." : summary}
        </span>
      )}
    </span>
  );
}

// Floating note card — sits right of synthesis text
function DigestNotes({ digestId }: { digestId: string }) {
  const [notes, setNotes] = useState("");
  const storageKey = `digest_notes_${digestId}`;

  React.useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved) setNotes(saved);
  }, [storageKey]);

  const handleBlur = () => {
    if (notes.trim()) localStorage.setItem(storageKey, notes);
  };

  return (
    <div style={{
      width: "220px", flexShrink: 0, marginLeft: "24px",
      border: "2px solid #1a1a1a", boxShadow: "4px 4px 0px 0px rgba(0,0,0,1)",
      background: "white", padding: "14px", alignSelf: "flex-start",
    }}>
      <div style={{ fontSize: "0.6rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "2px", color: "#1a1a1a", fontFamily: "var(--font-mono), monospace", marginBottom: "10px", display: "flex", alignItems: "center", gap: "6px" }}>
        ✦ Note
      </div>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        onBlur={handleBlur}
        placeholder="Jot down your thoughts..."
        style={{
          width: "100%", minHeight: "120px", background: "transparent",
          border: "none", outline: "none", resize: "vertical",
          fontSize: "0.8rem", lineHeight: 1.6, color: "#333",
          fontFamily: "inherit",
        }}
      />
    </div>
  );
}

// Inline tooltip for hard words — shows definition on hover
function DefinitionTooltip({ term, definition, children }: { term: string; definition: string; children: React.ReactNode }) {
  const [show, setShow] = useState(false);
  return (
    <span
      style={{ position: "relative", borderBottom: "1.5px dotted #999", cursor: "help" }}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && (
        <span style={{
          position: "absolute", bottom: "calc(100% + 8px)", left: "50%", transform: "translateX(-50%)",
          background: "#1a1a1a", color: "white", fontSize: "0.78rem", fontWeight: 400,
          lineHeight: 1.5, padding: "8px 12px", whiteSpace: "normal", width: "260px",
          zIndex: 50, pointerEvents: "none", boxShadow: "3px 3px 0px 0px rgba(0,0,0,0.3)",
        }}>
          <strong style={{ display: "block", fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "3px", color: "#999" }}>
            {term}
          </strong>
          {definition}
        </span>
      )}
    </span>
  );
}

// Scan text children for terms that have definitions, wrap them in tooltips
function annotateText(children: React.ReactNode, defs: Record<string, string>): React.ReactNode {
  if (!defs || Object.keys(defs).length === 0) return children;

  return React.Children.map(children, child => {
    if (typeof child !== "string") return child;

    // Build regex from definition terms (sorted longest first to match "extended cognition" before "cognition")
    const terms = Object.keys(defs).sort((a, b) => b.length - a.length);
    if (terms.length === 0) return child;
    const regex = new RegExp(`\\b(${terms.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\b`, "gi");

    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    const matched = new Set<string>(); // only annotate first occurrence
    let match;
    while ((match = regex.exec(child)) !== null) {
      const term = match[1].toLowerCase();
      if (matched.has(term)) continue;
      matched.add(term);
      if (match.index > lastIndex) parts.push(child.slice(lastIndex, match.index));
      parts.push(
        <DefinitionTooltip key={match.index} term={match[1]} definition={defs[term]}>
          {match[1]}
        </DefinitionTooltip>
      );
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < child.length) parts.push(child.slice(lastIndex));
    return parts.length > 0 ? <>{parts}</> : child;
  });
}

interface SynthesisBannerProps {
  synthesis: string;
  theme?: string;
  keyConcepts: string[];
  activeConcept: string | null;
  onConceptClick: (concept: string) => void;
  digestId?: string;
  digestStarred?: boolean;
  papers?: PaperItem[];
  onSelectPaper?: (paper: PaperItem) => void;
  onAddInterest?: (keyword: string) => void;
  onRegenerate?: () => void;
  generating?: boolean;
  session?: {
    apiKey: string;
    provider: string;
    model: string;
    baseUrl: string;
  };
}

const PASTEL_COLORS = ["#fce7f3", "#dcfce7", "#dbeafe", "#fef9c3", "#ede9fe"];

export function SynthesisBanner({
  synthesis,
  theme,
  keyConcepts,
  activeConcept,
  onConceptClick,
  digestId,
  digestStarred = false,
  papers = [],
  onSelectPaper,
  onAddInterest,
  onRegenerate,
  generating = false,
  session,
}: SynthesisBannerProps) {
  // Build concept definition map from keyConcepts ("term: definition" format)
  const conceptDefs = useMemo(() => {
    const defs: Record<string, string> = {};
    for (const concept of keyConcepts) {
      const colonIdx = concept.indexOf(": ");
      if (colonIdx > 0) {
        defs[concept.slice(0, colonIdx).toLowerCase().trim()] = concept.slice(colonIdx + 2).trim();
      }
    }
    return defs;
  }, [keyConcepts]);

  const [digDeeperHistory, setDigDeeperHistory] = useState<{ q: string; a: string }[]>([]);
  const [digDeeperLoading, setDigDeeperLoading] = useState(false);
  const [customQuestion, setCustomQuestion] = useState("");
  const [showQuestions, setShowQuestions] = useState(true);

  // Load history from localStorage + reset on digest change
  const historyKey = digestId ? `digest_chat_${digestId}` : "";
  React.useEffect(() => {
    if (!historyKey) return;
    const saved = localStorage.getItem(historyKey);
    if (saved) {
      try { setDigDeeperHistory(JSON.parse(saved)); setShowQuestions(false); } catch { /* ignore */ }
    } else {
      setDigDeeperHistory([]);
      setShowQuestions(true);
    }
  }, [historyKey]);
  const [addedConcepts, setAddedConcepts] = useState<Set<string>>(new Set());
  const [addingConcept, setAddingConcept] = useState<string | null>(null);

  const handleAddConcept = useCallback(async (concept: string) => {
    if (addedConcepts.has(concept) || addingConcept) return;
    setAddingConcept(concept);
    try {
      const conceptName = concept.includes(": ") ? concept.split(": ")[0] : concept;
      const res = await fetch("/api/interests/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyword: conceptName }),
      });
      const data = await res.json();
      if (data.added) {
        setAddedConcepts(prev => new Set([...prev, concept]));
        onAddInterest?.(conceptName);
      }
    } catch { /* silent */ }
    setAddingConcept(null);
  }, [addedConcepts, addingConcept, onAddInterest]);

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  // Extract theme headline + body from synthesis text
  const lines = synthesis.split("\n").filter(l => l.trim());
  let displayTheme = theme || "";
  let bodyLines = lines;

  if (!displayTheme) {
    // Try to extract from synthesis first line (old digests with prefix)
    const firstLine = lines[0] || "";
    const prefixMatch = firstLine.match(/^today(?:'s\s+\w+| we're exploring):\s*/i);
    if (prefixMatch) {
      const after = firstLine.slice(prefixMatch[0].length).trim();
      const sentenceEnd = after.match(/^(.+?[?!.])/);
      displayTheme = sentenceEnd ? sentenceEnd[1] : after;
      bodyLines = lines.slice(1);
    } else {
      // No prefix — use the first sentence as the headline
      const sentenceEnd = firstLine.match(/^(.+?[?!.])/);
      if (sentenceEnd) {
        displayTheme = sentenceEnd[1];
        const remainder = firstLine.slice(sentenceEnd[0].length).trim();
        bodyLines = remainder ? [remainder, ...lines.slice(1)] : lines.slice(1);
      } else {
        // Entire first line is the headline
        displayTheme = firstLine;
        bodyLines = lines.slice(1);
      }
    }
  } else {
    // Theme prop exists — strip first line if it's a prefix or repeats the theme
    const firstLine = lines[0] || "";
    if (/^today/i.test(firstLine)) {
      bodyLines = lines.slice(1);
    }
  }
  const bodyText = bodyLines.join("\n\n");

  // Extract the "look into X" suggestion from the synthesis to use as first dig deeper prompt
  const lookIntoMatch = useMemo(() => {
    const match = synthesis.match(/look into\s+(.+?)(?:\s*[,.]|\s+because)/i);
    return match ? match[1].trim() : null;
  }, [synthesis]);

  // Dig deeper prompts — one per source + a cross-cutting question
  const digDeeperPrompts = useMemo(() => {
    if (papers.length === 0) return [];
    const shortName = (p: PaperItem) => {
      const words = p.title.split(/\s+/).slice(0, 5).join(" ");
      return words.length > 40 ? words.slice(0, 37) + "..." : words;
    };

    const prompts: string[] = [];
    // One question per source
    for (const p of papers) {
      prompts.push(`Tell me more about "${shortName(p)}"`);
    }
    // Cross-cutting
    prompts.push("What would a skeptic say about all this?");
    return prompts;
  }, [papers]);

  const handleDigDeeper = async (question: string) => {
    if (!session || digDeeperLoading) return;
    setDigDeeperLoading(true);
    setShowQuestions(false);
    try {
      const res = await fetch("/api/digest/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: `Keep your answer to 3-4 sentences max. Be specific and concrete.\n\n${question}`,
          digestId: digestId || papers[0]?.id,
          apiKey: session.apiKey,
          provider: session.provider,
          model: session.model,
          baseUrl: session.baseUrl,
        }),
      });
      const data = await res.json();
      const answer = data.answer || data.error || "Couldn't get an answer.";
      const newHistory = [...digDeeperHistory, { q: question, a: answer }];
      setDigDeeperHistory(newHistory);
      if (historyKey) localStorage.setItem(historyKey, JSON.stringify(newHistory));
    } catch {
      const newHistory = [...digDeeperHistory, { q: question, a: "Something went wrong. Try again." }];
      setDigDeeperHistory(newHistory);
    }
    setDigDeeperLoading(false);
  };

  return (
    <div className="space-y-5">
      {/* Theme — big, bold, Space Grotesk */}
      {displayTheme && (
        <h1
          style={{
            fontSize: "clamp(2.5rem, 5.5vw, 3.75rem)",
            fontWeight: 700,
            lineHeight: 1.1,
            color: "#111",
            fontFamily: "var(--font-display), sans-serif",
            letterSpacing: "-0.025em",
            maxWidth: "840px",
          }}
        >
          {displayTheme}
        </h1>
      )}

      {/* Date under theme */}
      <span
        style={{
          fontSize: "0.75rem",
          color: "#aaa",
          fontFamily: "var(--font-mono), monospace",
          textTransform: "uppercase",
          letterSpacing: "0.1em",
        }}
      >
        {today}
      </span>

      {/* Synthesis body */}
      <div
        className="text-[0.95rem] md:text-[1.05rem] text-gray-700"
        style={{ lineHeight: "1.85", fontFamily: "inherit" }}
      >
        <ReactMarkdown
          components={{
            p: ({ children }) => (
              <p style={{ marginBottom: "1.25em" }}>{annotateText(children, conceptDefs)}</p>
            ),
            strong: ({ children }) => {
              const text = String(children).toLowerCase();
              // Match bold text to a paper — handle plurals, stems, and short names
              const stem = (w: string) => w.replace(/(ing|tion|ment|ness|ity|ies|es|ed|ly|s)$/i, "");
              const matchedPaper = papers.find(p => {
                const title = p.title.toLowerCase();
                // Direct substring match
                if (title.includes(text) || text.includes(title.slice(0, 30))) return true;
                // Keyword match (from paper's keywords)
                // Check keyword overlap (any keyword word appears in bold text)
                const kwWords = p.keywords.flatMap(kw => kw.toLowerCase().split(/\s+/).filter(w => w.length > 3));
                if (kwWords.some(w => text.includes(w))) return true;
                // Stem-based word overlap
                const boldStems = text.split(/\s+/).filter(w => w.length > 3).map(stem);
                const titleStems = title.split(/\s+/).filter(w => w.length > 3).map(stem);
                const overlap = boldStems.filter(bs => titleStems.some(ts => ts === bs || ts.includes(bs) || bs.includes(ts)));
                return overlap.length >= 1;
              });
              // Highlight colors from paper card blob palettes
              const HIGHLIGHT_COLORS = ["rgba(249,168,212,0.3)", "rgba(147,197,253,0.3)", "rgba(196,181,253,0.3)"];
              const HIGHLIGHT_HOVER = ["rgba(249,168,212,0.5)", "rgba(147,197,253,0.5)", "rgba(196,181,253,0.5)"];
              if (matchedPaper && onSelectPaper) {
                const paperIdx = papers.indexOf(matchedPaper);
                const bg = HIGHLIGHT_COLORS[paperIdx % HIGHLIGHT_COLORS.length];
                const bgHover = HIGHLIGHT_HOVER[paperIdx % HIGHLIGHT_HOVER.length];
                return (
                  <PaperHighlight
                    bg={bg}
                    bgHover={bgHover}
                    summary={matchedPaper.summary}
                    onClick={() => onSelectPaper(matchedPaper)}
                  >
                    {children}
                  </PaperHighlight>
                );
              }
              return <strong style={{ color: "#111", fontWeight: 700 }}>{children}</strong>;
            },
          }}
        >
          {bodyText}
        </ReactMarkdown>
      </div>

      {/* Key concepts — display only */}
      {keyConcepts.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-2">
          {keyConcepts.map((concept, idx) => {
            const pastel = PASTEL_COLORS[idx % 5];
            return (
              <span
                key={concept}
                title={concept.includes(": ") ? concept.split(": ").slice(1).join(": ") : undefined}
                style={{
                  display: "inline-block",
                  padding: "5px 12px",
                  background: pastel,
                  border: "2px solid #1a1a1a",
                  boxShadow: "2px 2px 0px 0px rgba(0,0,0,1)",
                  color: "#1a1a1a",
                  fontSize: "0.7rem",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                  fontFamily: "var(--font-mono), monospace",
                }}
              >
                {concept.includes(": ") ? concept.split(": ")[0] : concept}
              </span>
            );
          })}
        </div>
      )}

      {/* Quick feedback */}
      {digestId && session && <DigestFeedback digestId={digestId} onRegenerate={onRegenerate} />}

      {/* Dig deeper */}
      {papers.length > 0 && session && (
        <div
          style={{
            border: "2px solid #1a1a1a",
            boxShadow: "6px 6px 0px 0px rgba(0,0,0,1)",
            overflow: "hidden",
            marginTop: "20px",
          }}
        >
          {/* Header */}
          <div style={{ background: "#1a1a1a", padding: "14px 20px", display: "flex", alignItems: "center", gap: "8px" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
            <span style={{ fontSize: "0.85rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "2px", fontFamily: "var(--font-mono), monospace", color: "white" }}>
              Dig Deeper
            </span>
          </div>

          {/* Suggested explorations — full-width rows */}
          {showQuestions && !digDeeperLoading && (
            <div style={{ padding: "16px 20px" }}>
              <span style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "2px", color: "#555", fontFamily: "var(--font-mono), monospace", display: "block", marginBottom: "12px" }}>
                What do you want to dig deeper into?
              </span>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {digDeeperPrompts.map((prompt, i) => (
                  <button
                    key={i}
                    onClick={() => { handleDigDeeper(prompt); setShowQuestions(false); }}
                    className="hover:translate-x-1 hover:-translate-y-px hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] transition-all group"
                    style={{
                      width: "100%", padding: "10px 14px", border: "2px solid #1a1a1a", background: "white",
                      fontSize: "0.82rem", fontWeight: 500,
                      color: "#1a1a1a", textAlign: "left", cursor: "pointer",
                      lineHeight: 1.4,
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                    }}
                  >
                    <span>{prompt.replace(/\*\*/g, "")}</span>
                    <span style={{ color: "#1a1a1a", fontSize: "0.85rem" }} className="group-hover:translate-x-1 transition-transform">→</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Conversation history */}
          {digDeeperHistory.length > 0 && (
            <div style={{ padding: "16px 20px", maxHeight: "400px", overflowY: "auto" }}>
              {digDeeperHistory.map((entry, i) => (
                <div key={i} style={{ marginBottom: i < digDeeperHistory.length - 1 ? "16px" : "0" }}>
                  <p style={{ fontSize: "0.8rem", fontWeight: 700, color: "#1a1a1a", marginBottom: "8px", fontFamily: "var(--font-mono), monospace" }}>
                    {entry.q}
                  </p>
                  <div style={{ fontSize: "0.92rem", lineHeight: 1.7, color: "#444" }}>
                    <ReactMarkdown
                      components={{
                        p: ({ children }) => <p style={{ marginBottom: "0.5em" }}>{children}</p>,
                        strong: ({ children }) => <strong style={{ fontWeight: 700, color: "#111" }}>{children}</strong>,
                      }}
                    >
                      {entry.a}
                    </ReactMarkdown>
                  </div>
                  {i < digDeeperHistory.length - 1 && <div style={{ borderBottom: "1px solid #e5e7eb", marginTop: "16px" }} />}
                </div>
              ))}
            </div>
          )}

          {/* Loading indicator */}
          {digDeeperLoading && (
            <div className="flex items-center gap-2 text-[#888]" style={{ padding: "12px 20px" }}>
              <Loader2 className="size-3.5 animate-spin" />
              <span style={{ fontSize: "0.75rem", fontFamily: "var(--font-mono), monospace" }}>Thinking...</span>
            </div>
          )}

          {/* Input */}
          <div style={{
            borderTop: "2px solid #1a1a1a", padding: "14px 20px",
            display: "flex", gap: "10px", alignItems: "center", background: "#fafafa",
          }}>
            <input
              value={customQuestion}
              onChange={(e) => setCustomQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && customQuestion.trim()) {
                  handleDigDeeper(customQuestion);
                  setCustomQuestion("");
                }
              }}
              placeholder="Ask anything about these papers..."
              style={{
                flex: 1, border: "none", outline: "none", fontSize: "0.9rem",
                color: "#1a1a1a", background: "transparent",
              }}
            />
            <button
              onClick={() => { if (customQuestion.trim()) { handleDigDeeper(customQuestion); setCustomQuestion(""); } }}
              disabled={!customQuestion.trim() || digDeeperLoading}
              style={{
                padding: "8px", border: "none",
                background: customQuestion.trim() && !digDeeperLoading ? "#1a1a1a" : "#d1d5db",
                cursor: customQuestion.trim() && !digDeeperLoading ? "pointer" : "not-allowed",
                display: "flex", alignItems: "center", transition: "background 0.15s",
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M7 17L17 7"/><path d="M7 7h10v10"/></svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
