"use client";

import React, { useState, useCallback, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import { Loader2 } from "lucide-react";
import type { PaperItem } from "./paper-card";
import { CATEGORY_PALETTES } from "@/components/interest-ledger";

const CONCEPT_GRADIENTS = Object.values(CATEGORY_PALETTES);



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

// Inline tooltip for hard words — shows definition on hover (position:fixed to avoid mobile overflow)
function DefinitionTooltip({ term, definition, children }: { term: string; definition: string; children: React.ReactNode }) {
  const [show, setShow] = useState(false);
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({});
  const ref = React.useRef<HTMLSpanElement>(null);

  const updateTooltip = React.useCallback(() => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const pad = 10;
    const tooltipW = Math.min(260, vw - pad * 2);
    const above = rect.top > 150;
    setTooltipStyle({
      position: "fixed",
      left: Math.max(pad, Math.min(rect.left + rect.width / 2 - tooltipW / 2, vw - tooltipW - pad)),
      top: above ? rect.top - 12 : rect.bottom + 8,
      transform: above ? "translateY(-100%)" : "none",
      width: tooltipW,
      zIndex: 9999,
    });
  }, []);

  return (
    <span
      ref={ref}
      style={{ position: "relative", borderBottom: "1.5px dotted #999", cursor: "help" }}
      onMouseEnter={() => { setShow(true); updateTooltip(); }}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && (
        <span style={{
          ...tooltipStyle,
          background: "#1a1a1a", color: "white", fontSize: "0.78rem", fontWeight: 400,
          lineHeight: 1.5, padding: "8px 12px", whiteSpace: "normal",
          pointerEvents: "none", boxShadow: "3px 3px 0px 0px rgba(0,0,0,0.3)",
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

const SOURCE_PALETTES: [string, string][] = [
  ["#C8F0D8", "#F0F5A8"],
  ["#FFD6E0", "#FFE89A"],
  ["#D0E3F7", "#E2D6F7"],
  ["#FFE89A", "#FFD6E0"],
];
const HIGHLIGHT_GRADIENTS: [string, string][] = [
  ["#C8F0D8", "#F0F5A8"],
  ["#FFD6E0", "#FFE89A"],
  ["#D0E3F7", "#E2D6F7"],
  ["#FFE89A", "#FFD6E0"],
];
const HIGHLIGHT_HOVER_GRADIENTS: [string, string][] = [
  ["#A4E0BC", "#DCF060"],
  ["#FFB0C8", "#FFD870"],
  ["#B0CCF0", "#C8B4F0"],
  ["#FFD870", "#FFB0C8"],
];

type BodySection =
  | { kind: "paragraph"; text: string }
  | { kind: "bullet"; text: string; sourceIdx: number | null }
  | { kind: "bridge"; text: string };

function parseBodySections(text: string): BodySection[] {
  const sections: BodySection[] = [];
  let paraLines: string[] = [];
  const flushPara = () => {
    if (paraLines.length > 0) {
      sections.push({ kind: "paragraph", text: paraLines.join("\n") });
      paraLines = [];
    }
  };
  for (const line of text.split("\n")) {
    const bulletMatch = line.match(/^\s*[-*]\s+(.*)/);
    const bridgeMatch = line.match(/^\s*>\s+(.*)/);
    if (bulletMatch) {
      flushPara();
      const t = bulletMatch[1];
      const m = t.match(/\*\*\[(?:source\s*)?(\d+)\]/i);
      sections.push({ kind: "bullet", text: t, sourceIdx: m ? parseInt(m[1], 10) - 1 : null });
    } else if (bridgeMatch) {
      flushPara();
      sections.push({ kind: "bridge", text: bridgeMatch[1] });
    } else if (line.trim()) {
      paraLines.push(line);
    } else {
      flushPara();
    }
  }
  flushPara();
  return sections;
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
  renderPaperCard?: (paper: PaperItem, index: number) => React.ReactNode;
  session?: {
    apiKey: string;
    provider: string;
    model: string;
    baseUrl: string;
  };
  onSignIn?: () => void;
  hideHeader?: boolean;
  hideInteractionUI?: boolean;
}

// Guest dig deeper — shows pre-generated Q&A, prompts sign-in for more
export function GuestDigDeeper({ questions, answers, onSignIn }: {
  questions: string[];
  answers: string[];
  onSignIn?: () => void;
}) {
  const pairs = questions
    .map((q, i) => ({ q, a: answers[i] || "" }))
    .filter(p => p.a.trim().length > 0)
    .slice(0, 3);

  return (
    <div>
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

      {/* Sign-in CTA */}
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

// Renders a text segment with [N] citation markers as superscript links.
// Also handles **bold** inline so we don't need ReactMarkdown for simple answer text.
export function CitedAnswer({ text, paperLinks }: { text: string; paperLinks?: { title: string; sourceUrl: string | null }[] }) {
  // Split on **bold** and [N] citations together
  const segments = text.split(/(\*\*[^*]+\*\*|\[\d+\])/g);
  return (
    <>
      {segments.map((seg, i) => {
        if (seg.startsWith("**") && seg.endsWith("**")) {
          return <strong key={i} style={{ fontWeight: 700, color: "#111" }}>{seg.slice(2, -2)}</strong>;
        }
        const citMatch = seg.match(/^\[(\d+)\]$/);
        if (citMatch && paperLinks && paperLinks.length > 0) {
          const n = parseInt(citMatch[1], 10);
          const paper = paperLinks[n - 1];
          if (paper) {
            const badge = (
              <sup key={i} style={{
                fontSize: "0.6em", fontWeight: 700, color: "white",
                background: "#1a1a1a", padding: "1px 4px",
                fontFamily: "var(--font-mono), monospace",
                letterSpacing: "0.5px", lineHeight: 1,
              }}>{n}</sup>
            );
            return paper.sourceUrl ? (
              <a key={i} href={paper.sourceUrl} target="_blank" rel="noopener noreferrer" title={paper.title} style={{ textDecoration: "none" }}>{badge}</a>
            ) : badge;
          }
        }
        return seg;
      })}
    </>
  );
}

// Renders a full dig deeper answer — paragraphs split on newlines, CitedAnswer handles inline markup.
export function AnswerBlock({ text, paperLinks }: { text: string; paperLinks?: { title: string; sourceUrl: string | null }[] }) {
  const paragraphs = text.split(/\n+/).filter(p => p.trim());
  return (
    <>
      {paragraphs.map((para, i) => (
        <p key={i} style={{ marginBottom: i < paragraphs.length - 1 ? "0.5em" : 0 }}>
          <CitedAnswer text={para} paperLinks={paperLinks} />
        </p>
      ))}
    </>
  );
}


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
  renderPaperCard,
  session,
  onSignIn,
  hideHeader = false,
  hideInteractionUI = false,
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

  // Pull quote: find shortest sentence with a stat — skip sentences from the lede to avoid repetition
  const pullQuote = useMemo(() => {
    const ledeParagraph = (parseBodySections(bodyText).find(s => s.kind === "paragraph")?.text || "").replace(/\*\*/g, "");
    const clean = bodyText.replace(/\*\*/g, "").replace(/\n/g, " ");
    const sentences = clean.match(/[^.!?]+[.!?]+/g) || [];
    const candidates = sentences
      .map(s => s.trim())
      .filter(s => /\d/.test(s) && s.length > 55 && s.length < 200 && !ledeParagraph.includes(s.trim().slice(0, 30)));
    return candidates.sort((a, b) => a.length - b.length)[0] || null;
  }, [bodyText]);

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
      {!hideHeader && displayTheme && (
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
      {!hideHeader && (
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
        </div>
      )}

      {/* Synthesis body — numbered timeline layout */}
      {(() => {
        const sections = parseBodySections(bodyText);
        const totalBullets = sections.filter(s => s.kind === "bullet").length;
        let bulletIdx = 0;
        let isFirstParagraph = true;

        const extractText = (node: React.ReactNode): string => {
          if (typeof node === "string") return node;
          if (typeof node === "number") return String(node);
          if (Array.isArray(node)) return node.map(extractText).join("");
          if (node && typeof node === "object" && "props" in node) return extractText((node as React.ReactElement<{ children?: React.ReactNode }>).props.children);
          return "";
        };

        const StrongRenderer = ({ children }: { children?: React.ReactNode }) => {
          const text = extractText(children);
          const textLower = text.toLowerCase();
          const indexMatch = text.match(/^\[(?:source\s*)?(\d+)\]\s*/i);
          let matchedPaper: (typeof papers)[number] | null = null;
          let displayText = text;

          if (indexMatch) {
            const idx = parseInt(indexMatch[1], 10) - 1;
            if (idx >= 0 && idx < papers.length) {
              matchedPaper = papers[idx];
              displayText = text.slice(indexMatch[0].length);
            }
          }

          if (!matchedPaper) {
            const cleanText = textLower.replace(/\s*\(.*?\)\s*/g, " ").trim();
            let bestPaper: (typeof papers)[number] | null = null;
            let bestScore = 0;
            let secondBestScore = 0;
            const stem = (w: string) => w.replace(/(ing|tion|ment|ness|ity|ies|es|ed|ly|s)$/i, "");
            const STOP_WORDS = new Set(["the", "this", "that", "with", "from", "about", "what", "when", "where", "which", "their", "these", "those", "been", "have", "will", "would", "could", "should", "into", "over", "under", "between", "through", "after", "before", "more", "most", "some", "also", "than", "them", "were", "here", "there", "then", "each", "every", "both", "such", "very", "just", "only", "other", "found", "shows", "study", "paper", "research", "report", "review"]);
            const boldWords = cleanText.split(/\s+/).filter(w => (w.length > 2 || w === "ai") && !STOP_WORDS.has(w));
            const boldStems = boldWords.map(stem);
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
              if (title.includes(cleanText) || cleanText.includes(title.slice(0, 30))) score += 10;
              for (const acronym of acronyms) { if (matchesAcronym(acronym, p.title)) score += 8; }
              for (const bs of boldStems) {
                const titleStems = title.split(/\s+/).filter(w => w.length > 2).map(stem);
                if (titleStems.some(ts => ts === bs || ts.includes(bs) || bs.includes(ts))) score += 3;
                if (authorStr.includes(bs)) score += 4;
                if (kwStr.includes(bs)) score += 1;
              }
              if (score > bestScore) { secondBestScore = bestScore; bestScore = score; bestPaper = p; }
              else if (score > secondBestScore) { secondBestScore = score; }
            }
            matchedPaper = bestScore >= 4 && bestScore - secondBestScore >= 2 ? bestPaper : null;
          }

          if (matchedPaper && onSelectPaper) {
            const paperIdx = papers.indexOf(matchedPaper);
            const [ha, hb] = HIGHLIGHT_GRADIENTS[paperIdx % HIGHLIGHT_GRADIENTS.length];
            const [hha, hhb] = HIGHLIGHT_HOVER_GRADIENTS[paperIdx % HIGHLIGHT_HOVER_GRADIENTS.length];
            return (
              <PaperHighlight
                bg={`linear-gradient(135deg, ${ha} 0%, ${hb} 100%)`}
                bgHover={`linear-gradient(135deg, ${hha} 0%, ${hhb} 100%)`}
                summary={matchedPaper.summary}
                onClick={() => onSelectPaper(matchedPaper!)}
              >
                {displayText}
              </PaperHighlight>
            );
          }
          return <strong style={{ color: "#111", fontWeight: 700 }}>{displayText}</strong>;
        };

        return (
          <div className="text-[0.95rem] md:text-[1.05rem]" style={{ lineHeight: "1.85", fontFamily: "inherit", color: "#222", maxWidth: "980px" }}>
            {sections.map((section, i) => {
              if (section.kind === "paragraph") {
                const isLede = isFirstParagraph;
                isFirstParagraph = false;
                return (
                  <React.Fragment key={i}>
                    <p style={{ marginBottom: "1.25em", ...(isLede ? { fontSize: "1.06em", fontWeight: 500, color: "#111" } : {}) }}>
                      <ReactMarkdown components={{ p: ({ children }) => <>{annotateText(children, conceptDefs)}</>, strong: StrongRenderer }}>
                        {section.text}
                      </ReactMarkdown>
                    </p>
                    {isLede && pullQuote && (
                      <blockquote style={{ borderLeft: "3px solid #1a1a1a", paddingLeft: "20px", margin: "0 0 1.75em", fontFamily: "var(--font-display), sans-serif", fontSize: "1.15rem", fontWeight: 700, lineHeight: 1.35, color: "#1a1a1a", fontStyle: "normal" }}>
                        &ldquo;{pullQuote}&rdquo;
                      </blockquote>
                    )}
                  </React.Fragment>
                );
              }

              if (section.kind === "bridge") {
                return (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: "14px", margin: "4px 0" }}>
                    <div style={{ flex: 1, height: 1, background: "#e8e8e8" }} />
                    <span style={{ fontSize: "0.75rem", color: "#aaa", fontStyle: "italic", flexShrink: 0, letterSpacing: "0.01em" }}>
                      {section.text}
                    </span>
                    <div style={{ flex: 1, height: 1, background: "#e8e8e8" }} />
                  </div>
                );
              }

              if (section.kind === "bullet") {
                const idx = bulletIdx++;
                const isLast = idx === totalBullets - 1;
                const palette = SOURCE_PALETTES[idx % SOURCE_PALETTES.length];
                const resolvedPaperIdx = section.sourceIdx !== null && section.sourceIdx >= 0 && section.sourceIdx < papers.length
                  ? section.sourceIdx
                  : idx < papers.length ? idx : -1;
                const paper = resolvedPaperIdx >= 0 ? papers[resolvedPaperIdx] : null;

                return (
                  <div key={i} style={{ display: "flex", gap: "16px" }}>
                    {/* Number circle + connecting line */}
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0, width: 28 }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: "50%",
                        border: "2px solid #1a1a1a", background: palette[0],
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontFamily: "var(--font-mono), monospace",
                        fontSize: "0.65rem", fontWeight: 700, color: "#1a1a1a",
                        flexShrink: 0,
                      }}>
                        {idx + 1}
                      </div>
                      {!isLast && <div style={{ flex: 1, width: 1, background: "#ddd", minHeight: 24, marginTop: 4 }} />}
                    </div>

                    {/* Content: text + card */}
                    <div
                      className={`flex-1 flex flex-col gap-3 md:flex-row md:gap-5 md:items-start ${isLast ? "pb-6" : "pb-4"}`}
                    >
                      <div className="flex-1 min-w-0" style={{ paddingTop: "3px" }}>
                        <ReactMarkdown components={{
                          p: ({ children }) => <p style={{ margin: 0, lineHeight: 1.75 }}>{annotateText(children, conceptDefs)}</p>,
                          strong: StrongRenderer,
                        }}>
                          {section.text}
                        </ReactMarkdown>
                      </div>

                      {paper && renderPaperCard && (
                        <div className="w-full md:w-[400px] flex-shrink-0">
                          {renderPaperCard(paper, resolvedPaperIdx)}
                        </div>
                      )}
                    </div>
                  </div>
                );
              }

              return null;
            })}
          </div>
        );
      })()}

      {/* Key concepts — display only */}
      {keyConcepts.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-2">
          {keyConcepts.map((concept, idx) => {
            const [a, b] = CONCEPT_GRADIENTS[idx % CONCEPT_GRADIENTS.length];
            return (
              <span
                key={concept}
                title={concept.includes(": ") ? concept.split(": ").slice(1).join(": ") : undefined}
                style={{
                  display: "inline-flex", alignItems: "stretch",
                  background: "white",
                  border: "1.5px solid #1a1a1a",
                  borderRadius: 0,
                  overflow: "hidden",
                  whiteSpace: "nowrap",
                }}
              >
                <span style={{ width: 3, flexShrink: 0, background: `linear-gradient(to bottom, ${a} 0%, ${b} 100%)` }} />
                <span style={{
                  padding: "5px 9px",
                  color: "#111",
                  fontSize: "0.625rem",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "1.2px",
                  fontFamily: "var(--font-mono), monospace",
                  lineHeight: 1,
                }}
              >
                  {concept.includes(": ") ? concept.split(": ")[0] : concept}
                </span>
              </span>
            );
          })}
        </div>
      )}

      {/* Dig deeper — logged-in: live Q&A, logged-out: pre-generated answers */}
      {!hideInteractionUI && papers.length > 0 && !session && (
        <GuestDigDeeper
          questions={suggestedQuestions || []}
          answers={suggestedAnswers || []}
          onSignIn={onSignIn}
        />
      )}
      {!hideInteractionUI && papers.length > 0 && session && (
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
                    <AnswerBlock text={entry.a} paperLinks={entry.paperLinks} />
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
