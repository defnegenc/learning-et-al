"use client";

import React, { useState, useCallback, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import { Loader2 } from "lucide-react";
import type { PaperItem } from "./paper-card";

// Quick digest feedback — was this interesting?
function DigestFeedback({ digestId, onRegenerate, generating = false }: { digestId: string; onRegenerate?: () => void; generating?: boolean }) {
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
      await fetch("/api/papers/" + digestId + "/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: r === "up" ? "star" : "dislike", digestFeedback: true }),
      });
    } catch { /* non-critical */ }
    if (r === "down") setShowComment(true);
  };

  if (submitted && !showComment) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
        {reaction === "up" ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#38b000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ff007f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"/></svg>
        )}
        <button onClick={() => { setSubmitted(false); setReaction(null); localStorage.removeItem(storageKey); }} style={{ fontSize: "0.6rem", color: "#ccc", background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-mono), monospace" }}>
          undo
        </button>
      </div>
    );
  }

  if (showComment) {
    const triggerRegenerate = () => {
      if (comment.trim() && !generating) {
        onRegenerate?.();
      }
    };
    return (
      <div style={{ position: "absolute", right: 0, top: "calc(100% + 8px)", zIndex: 40, background: "white", border: "2px solid #1a1a1a", padding: "12px", boxShadow: "4px 4px 0px 0px rgba(0,0,0,1)", width: "320px" }}>
        {generating ? (
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Loader2 size={12} className="animate-spin" style={{ color: "#888" }} />
            <span style={{ fontSize: "0.75rem", color: "#555" }}>Regenerating...</span>
          </div>
        ) : (
          <>
            <p style={{ fontSize: "0.75rem", color: "#555", marginBottom: "8px" }}>
              What didn&apos;t work?
            </p>
            <div style={{ display: "flex", gap: "6px" }}>
              <input
                value={comment}
                onChange={e => setComment(e.target.value)}
                placeholder="e.g. too technical..."
                autoFocus
                style={{ flex: 1, padding: "6px 8px", border: "2px solid #1a1a1a", fontSize: "0.75rem", outline: "none" }}
                onKeyDown={e => { if (e.key === "Enter") triggerRegenerate(); }}
              />
              <button onClick={triggerRegenerate}
                disabled={!comment.trim()}
                style={{ padding: "6px 10px", background: "#1a1a1a", color: "white", border: "2px solid #1a1a1a", fontSize: "0.6rem", fontWeight: 700, cursor: "pointer", textTransform: "uppercase", letterSpacing: "1px", fontFamily: "var(--font-mono), monospace", opacity: comment.trim() ? 1 : 0.5 }}>
                Go
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
      <button onClick={() => submit("up")} style={{ background: "none", border: "none", padding: "4px", cursor: "pointer", lineHeight: 1, color: "#ccc" }} className="hover:text-[#38b000] transition-colors">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>
      </button>
      <button onClick={() => submit("down")} style={{ background: "none", border: "none", padding: "4px", cursor: "pointer", lineHeight: 1, color: "#ccc" }} className="hover:text-[#ff007f] transition-colors">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"/></svg>
      </button>
    </div>
  );
}

// Paper name highlight with hover tooltip showing summary
function PaperHighlight({ bg, bgHover, summary, onClick, children }: {
  bg: string; bgHover: string; summary: string | null; onClick: () => void; children: React.ReactNode;
}) {
  const [hovered, setHovered] = useState(false);
  const [tapped, setTapped] = useState(false);
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({});
  const ref = React.useRef<HTMLSpanElement>(null);

  const updateTooltip = React.useCallback(() => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const above = rect.top > 120;
    const vw = window.innerWidth;
    const pad = 8;
    const tooltipW = Math.min(280, vw - pad * 2);
    setTooltipStyle({
      position: "fixed",
      left: Math.max(pad, Math.min(rect.left, vw - tooltipW - pad)),
      top: above ? rect.top - 8 : rect.bottom + 8,
      transform: above ? "translateY(-100%)" : "none",
      width: tooltipW,
      zIndex: 9999,
    });
  }, []);

  // Dismiss mobile tooltip when tapping elsewhere
  React.useEffect(() => {
    if (!tapped) return;
    const dismiss = (e: TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setTapped(false);
    };
    document.addEventListener("touchstart", dismiss);
    return () => document.removeEventListener("touchstart", dismiss);
  }, [tapped]);

  const showTooltip = hovered || tapped;

  return (
    <span
      ref={ref}
      style={{
        position: "relative",
        color: "#111", fontSize: "1.1em", fontWeight: 700,
        background: showTooltip ? bgHover : bg,
        padding: "1px 4px", margin: "0 -2px",
        cursor: "pointer", transition: "background 0.15s", borderRadius: "2px",
        WebkitBoxDecorationBreak: "clone",
        boxDecorationBreak: "clone" as React.CSSProperties["boxDecorationBreak"],
        borderBottom: "2px solid currentColor",
      }}
      onMouseEnter={() => { setHovered(true); updateTooltip(); }}
      onMouseLeave={() => setHovered(false)}
      onClick={(e) => {
        // On touch devices: first tap shows tooltip, second tap navigates
        if ("ontouchstart" in window) {
          if (!tapped) {
            e.preventDefault();
            setTapped(true);
            updateTooltip();
            return;
          }
        }
        onClick();
      }}
    >
      {children}
      {showTooltip && summary && (
        <span style={{
          ...tooltipStyle,
          background: "#1a1a1a", color: "white",
          fontSize: "0.75rem", fontWeight: 400, lineHeight: 1.5,
          padding: "10px 14px", whiteSpace: "normal",
          boxShadow: "4px 4px 0px 0px rgba(0,0,0,0.3)",
          pointerEvents: "none",
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
  suggestedQuestions?: string[];
  suggestedAnswers?: string[];
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
  onSignIn?: () => void;
}

// Guest dig deeper — shows all pre-generated Q&A inline, prompts sign-in for more
function GuestDigDeeper({ questions, answers, onSignIn }: {
  questions: string[];
  answers: string[];
  onSignIn?: () => void;
}) {
  // Only render Q&A pairs where we actually have an answer
  const pairs = questions
    .map((q, i) => ({ q, a: answers[i] || "" }))
    .filter(p => p.a.trim().length > 0);

  return (
    <div style={{ marginTop: "28px" }}>
      {pairs.length > 0 && (
        <div style={{ marginBottom: "16px" }}>
          {pairs.map(({ q, a }, i) => (
            <div key={i} style={{ marginBottom: i < pairs.length - 1 ? "16px" : "0" }}>
              <p style={{ fontSize: "0.8rem", fontWeight: 700, color: "#1a1a1a", marginBottom: "8px", fontFamily: "var(--font-mono), monospace" }}>
                {q.replace(/\*\*/g, "")}
              </p>
              <div style={{ fontSize: "0.92rem", lineHeight: 1.7, color: "#444" }}>
                <ReactMarkdown
                  components={{
                    p: ({ children }) => <p style={{ marginBottom: "0.5em" }}>{children}</p>,
                    strong: ({ children }) => <strong style={{ fontWeight: 700, color: "#111" }}>{children}</strong>,
                  }}
                >
                  {a}
                </ReactMarkdown>
              </div>
              {i < pairs.length - 1 && <div style={{ borderBottom: "1px solid #e5e7eb", marginTop: "16px" }} />}
            </div>
          ))}
        </div>
      )}

      {/* Sign-in CTA — always visible under the answers */}
      <button
        onClick={onSignIn}
        style={{
          display: "flex", gap: "10px", alignItems: "center", width: "100%",
          border: "2px solid #1a1a1a", padding: "12px 14px", background: "white",
          cursor: "pointer",
          marginTop: pairs.length > 0 ? "16px" : "0",
        }}
        className="hover:bg-[#fafafa] transition-colors"
      >
        <span style={{ flex: 1, fontSize: "0.85rem", color: "#888", textAlign: "left" }}>
          Sign in to ask your own questions...
        </span>
        <span style={{
          padding: "6px 14px", background: "#1a1a1a", color: "white",
          fontSize: "0.6rem", fontWeight: 700, textTransform: "uppercase",
          letterSpacing: "1.5px", fontFamily: "var(--font-mono), monospace",
        }}>
          Sign In
        </span>
      </button>
    </div>
  );
}

function CitedAnswer({ text, paperLinks }: { text: string; paperLinks?: { title: string; sourceUrl: string | null }[] }) {
  if (!paperLinks || paperLinks.length === 0) return <>{text}</>;
  const parts: React.ReactNode[] = [];
  const regex = /\[(\d+)\]/g;
  let last = 0;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const n = parseInt(match[1], 10);
    const paper = paperLinks[n - 1];
    if (match.index > last) parts.push(text.slice(last, match.index));
    if (paper) {
      const badge = (
        <sup key={match.index} style={{
          fontSize: "0.6em", fontWeight: 700, color: "white",
          background: "#1a1a1a", padding: "1px 4px",
          fontFamily: "var(--font-mono), monospace",
          letterSpacing: "0.5px", lineHeight: 1,
        }}>{n}</sup>
      );
      parts.push(paper.sourceUrl ? (
        <a key={match.index} href={paper.sourceUrl} target="_blank" rel="noopener noreferrer" title={paper.title} style={{ textDecoration: "none" }}>
          {badge}
        </a>
      ) : badge);
    } else {
      parts.push(match[0]);
    }
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}

const PASTEL_COLORS = ["#fce7f3", "#dcfce7", "#dbeafe", "#fef9c3", "#ede9fe"];

export function SynthesisBanner({
  synthesis,
  theme,
  keyConcepts,
  suggestedQuestions,
  suggestedAnswers,
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
  onSignIn,
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

  const [digDeeperHistory, setDigDeeperHistory] = useState<{ q: string; a: string; paperLinks?: { title: string; sourceUrl: string | null }[] }[]>([]);
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

  // Dig deeper prompts — prefer LLM-generated, fall back to heuristic
  const digDeeperPrompts = useMemo(() => {
    if (suggestedQuestions && suggestedQuestions.length > 0) return suggestedQuestions;
    if (papers.length === 0) return [];
    // Fallback: one cross-cutting question
    return [theme ? `Where do these papers disagree on "${theme}"?` : "Where do these papers contradict each other?"];
  }, [suggestedQuestions, papers, theme]);

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
      const newHistory = [...digDeeperHistory, { q: question, a: answer, paperLinks: data.paperLinks }];
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

      {/* Date + feedback inline */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", position: "relative" }}>
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
        {digestId && session && <DigestFeedback digestId={digestId} onRegenerate={onRegenerate} generating={generating} />}
      </div>

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
              // Extract text robustly — String(children) breaks on React element arrays
              const extractText = (node: React.ReactNode): string => {
                if (typeof node === "string") return node;
                if (typeof node === "number") return String(node);
                if (Array.isArray(node)) return node.map(extractText).join("");
                if (node && typeof node === "object" && "props" in node) return extractText((node as React.ReactElement<{ children?: React.ReactNode }>).props.children);
                return "";
              };
              const text = extractText(children);
              const textLower = text.toLowerCase();

              // Primary: match by "[N]" prefix — e.g. "**[1] the Alzheimer's study**"
              // The synthesis prompt tells the LLM to prefix with [Source N].
              // We strip the prefix before rendering.
              const indexMatch = text.match(/^\[(?:source\s*)?(\d+)\]\s*/i);
              let matchedPaper: (typeof papers)[number] | null = null;
              let displayText = text;

              if (indexMatch) {
                const idx = parseInt(indexMatch[1], 10) - 1; // 0-indexed
                if (idx >= 0 && idx < papers.length) {
                  matchedPaper = papers[idx];
                  displayText = text.slice(indexMatch[0].length); // strip "[N] " prefix
                }
              }

              // Fallback: fuzzy match for syntheses generated before the [N] format
              if (!matchedPaper) {
                const cleanText = textLower.replace(/\s*\(.*?\)\s*/g, " ").trim();
                let bestPaper: (typeof papers)[number] | null = null;
                let bestScore = 0;
                const stem = (w: string) => w.replace(/(ing|tion|ment|ness|ity|ies|es|ed|ly|s)$/i, "");
                const STOP_WORDS = new Set(["the", "this", "that", "with", "from", "about", "what", "when", "where", "which", "their", "these", "those", "been", "have", "will", "would", "could", "should", "into", "over", "under", "between", "through", "after", "before", "more", "most", "some", "also", "than", "them", "were", "here", "there", "then", "each", "every", "both", "such", "very", "just", "only", "other", "found", "shows", "study", "paper", "research", "report", "review"]);
                const boldWords = cleanText.split(/\s+/).filter(w => (w.length > 2 || w === "ai") && !STOP_WORDS.has(w));
                const boldStems = boldWords.map(stem);

                // Check if any word in the bold text is an uppercase acronym (e.g. "JIT", "XAI")
                const acronyms = cleanText.split(/\s+/).filter(w => /^[A-Z]{2,6}$/.test(w));
                const matchesAcronym = (acronym: string, title: string) => {
                  const words = title.split(/[\s\-]+/).filter(w => w.length > 0);
                  for (let start = 0; start <= words.length - acronym.length; start++) {
                    const initials = words.slice(start, start + acronym.length).map(w => w[0].toUpperCase()).join("");
                    if (initials === acronym) return true;
                  }
                  return false;
                };

                for (const p of papers) {
                  let score = 0;
                  const title = p.title.toLowerCase();
                  const kwStr = p.keywords.join(" ").toLowerCase();
                  const authorStr = p.authors.join(" ").toLowerCase();
                  const summaryStr = (p.summary || "").toLowerCase();
                  const connectionStr = (p.connectionReason || "").toLowerCase();

                  if (title.includes(cleanText) || cleanText.includes(title.slice(0, 30))) score += 10;
                  for (const acronym of acronyms) {
                    if (matchesAcronym(acronym, p.title)) score += 8;
                  }
                  for (const bs of boldStems) {
                    const titleStems = title.split(/\s+/).filter(w => w.length > 2).map(stem);
                    if (titleStems.some(ts => ts === bs || ts.includes(bs) || bs.includes(ts))) score += 3;
                    if (authorStr.includes(bs)) score += 4;
                    if (kwStr.includes(bs)) score += 2;
                    if (summaryStr.includes(bs)) score += 2;
                    if (connectionStr.includes(bs)) score += 2;
                  }
                  if (score > bestScore) { bestScore = score; bestPaper = p; }
                }
                matchedPaper = bestScore >= 2 ? bestPaper : null;
              }
              // Highlight colors from paper card blob palettes
              const HIGHLIGHT_COLORS = ["rgba(249,168,212,0.45)", "rgba(147,197,253,0.45)", "rgba(196,181,253,0.45)"];
              const HIGHLIGHT_HOVER = ["rgba(249,168,212,0.65)", "rgba(147,197,253,0.65)", "rgba(196,181,253,0.65)"];
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
                    {displayText}
                  </PaperHighlight>
                );
              }
              return <strong style={{ color: "#111", fontWeight: 700 }}>{displayText}</strong>;
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

      {/* Dig deeper — logged-in: live Q&A, logged-out: pre-generated answers */}
      {papers.length > 0 && !session && (
        <GuestDigDeeper
          questions={suggestedQuestions || []}
          answers={suggestedAnswers || []}
          onSignIn={onSignIn}
        />
      )}
      {papers.length > 0 && session && (
        <div style={{ marginTop: "28px" }}>
          {/* Suggested questions as inline buttons */}
          {showQuestions && !digDeeperLoading && digDeeperPrompts.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "16px" }}>
              {digDeeperPrompts.map((prompt, i) => (
                <button
                  key={i}
                  onClick={() => { handleDigDeeper(prompt); setShowQuestions(false); }}
                  className="hover:-translate-y-0.5 hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] transition-all"
                  style={{
                    padding: "8px 14px", border: "2px solid #1a1a1a", background: "white",
                    fontSize: "0.8rem", fontWeight: 500,
                    color: "#1a1a1a", textAlign: "left", cursor: "pointer",
                    lineHeight: 1.4,
                  }}
                >
                  {prompt.replace(/\*\*/g, "")}
                </button>
              ))}
            </div>
          )}

          {/* Conversation history */}
          {digDeeperHistory.length > 0 && (
            <div style={{ marginBottom: "16px", maxHeight: "400px", overflowY: "auto" }}>
              {digDeeperHistory.map((entry, i) => (
                <div key={i} style={{ marginBottom: i < digDeeperHistory.length - 1 ? "16px" : "0" }}>
                  <p style={{ fontSize: "0.8rem", fontWeight: 700, color: "#1a1a1a", marginBottom: "8px", fontFamily: "var(--font-mono), monospace" }}>
                    {entry.q}
                  </p>
                  <div style={{ fontSize: "0.92rem", lineHeight: 1.7, color: "#444" }}>
                    <ReactMarkdown
                      components={{
                        p: ({ children }) => {
                          // Intercept plain text nodes to inject citation links
                          const processed = React.Children.map(children, child =>
                            typeof child === "string"
                              ? <CitedAnswer text={child} paperLinks={entry.paperLinks} />
                              : child
                          );
                          return <p style={{ marginBottom: "0.5em" }}>{processed}</p>;
                        },
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
            <div className="flex items-center gap-2 text-[#888]" style={{ marginBottom: "12px" }}>
              <Loader2 className="size-3.5 animate-spin" />
              <span style={{ fontSize: "0.75rem", fontFamily: "var(--font-mono), monospace" }}>Thinking...</span>
            </div>
          )}

          {/* Text input bar */}
          <div style={{
            display: "flex", gap: "10px", alignItems: "center",
            border: "2px solid #1a1a1a", padding: "10px 14px", background: "white",
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
