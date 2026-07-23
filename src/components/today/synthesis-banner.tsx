"use client";

import React, { useState, useCallback, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import { BookOpen, Loader2, MessageCircle, Star, PenLine, Check } from "lucide-react";
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
      role="button"
      tabIndex={0}
      style={{ position: "relative", borderBottom: "1.5px dotted #999", cursor: "help" }}
      onMouseEnter={() => { setShow(true); updateTooltip(); }}
      onMouseLeave={() => setShow(false)}
      onClick={() => { setShow(v => !v); updateTooltip(); }}
      onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { setShow(v => !v); updateTooltip(); } }}
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
  | { kind: "bullet"; text: string; sourceIdx: number | null; details: { label: string; text: string }[] }
  | { kind: "bridge"; text: string };

export function parseBodySections(text: string): BodySection[] {
  const sections: BodySection[] = [];
  let paraLines: string[] = [];
  let activeBullet: Extract<BodySection, { kind: "bullet" }> | null = null;
  const flushPara = () => {
    if (paraLines.length > 0) {
      sections.push({ kind: "paragraph", text: paraLines.join("\n") });
      paraLines = [];
    }
  };
  for (const line of text.split("\n")) {
    const nestedBulletMatch = line.match(/^\s{2,}[-*]\s+(.*)/);
    const bulletMatch = line.match(/^[-*]\s+(.*)/);
    const bridgeMatch = line.match(/^\s*>\s+(.*)/);
    if (nestedBulletMatch && activeBullet) {
      const t = nestedBulletMatch[1].trim();
      const labelMatch = t.match(/^([^:]{2,42}):\s*(.*)$/);
      activeBullet.details.push(labelMatch
        ? { label: labelMatch[1], text: labelMatch[2] }
        : { label: "Note", text: t });
    } else if (bulletMatch) {
      flushPara();
      const t = bulletMatch[1];
      const m = t.match(/\*\*\[(?:source\s*)?(\d+)\]/i);
      activeBullet = { kind: "bullet", text: t, sourceIdx: m ? parseInt(m[1], 10) - 1 : null, details: [] };
      sections.push(activeBullet);
    } else if (bridgeMatch) {
      flushPara();
      activeBullet = null;
      sections.push({ kind: "bridge", text: bridgeMatch[1] });
    } else if (line.trim()) {
      activeBullet = null;
      paraLines.push(line);
    } else {
      // Keep activeBullet across blank lines: bodyText joins every source line
      // with "\n\n", so a bullet and its indented details are always separated
      // by a blank. Any non-blank, non-nested line still resets it above.
      flushPara();
    }
  }
  flushPara();
  return sections;
}

// Split a raw synthesis into the display theme and the body text below it.
// Mirrors the long-standing first-line heuristics (old digests carry a
// "Today we're exploring:" prefix; new ones get the theme as a column).
export function splitSynthesisTheme(synthesis: string, theme?: string): { displayTheme: string; bodyText: string } {
  const lines = synthesis.split("\n").filter(l => l.trim());
  let displayTheme = theme || "";
  let bodyLines = lines;

  if (!displayTheme) {
    const firstLine = lines[0] || "";
    const prefixMatch = firstLine.match(/^today(?:'s\s+\w+| we're exploring):\s*/i);
    if (prefixMatch) {
      const after = firstLine.slice(prefixMatch[0].length).trim();
      const sentenceEnd = after.match(/^(.+?[?!.])/);
      displayTheme = sentenceEnd ? sentenceEnd[1] : after;
      bodyLines = lines.slice(1);
    } else {
      const sentenceEnd = firstLine.match(/^(.+?[?!.])/);
      if (sentenceEnd) {
        displayTheme = sentenceEnd[1];
        const remainder = firstLine.slice(sentenceEnd[0].length).trim();
        bodyLines = remainder ? [remainder, ...lines.slice(1)] : lines.slice(1);
      } else {
        displayTheme = firstLine;
        bodyLines = lines.slice(1);
      }
    }
  } else {
    const firstLine = lines[0] || "";
    if (/^today/i.test(firstLine)) {
      bodyLines = lines.slice(1);
    }
  }
  return { displayTheme, bodyText: bodyLines.join("\n\n") };
}

function splitSourceHeading(text: string) {
  const match = text.match(/^(\*\*\[(?:source\s*)?\d+\][^*]+\*\*)(?:\s+[-–—]\s+(.+))?$/i);
  return match ? { source: match[1], role: match[2] || "" } : { source: text, role: "" };
}

// Resolve a bold synthesis run to the paper it names. Handles the explicit
// "[Source N] name" prefix first, then falls back to fuzzy title/author/keyword
// overlap (older digests name papers inline without a source marker).
// Returns the matched paper index (or -1) plus the display text with any prefix stripped.
const MATCH_STOP_WORDS = new Set(["the", "this", "that", "with", "from", "about", "what", "when", "where", "which", "their", "these", "those", "been", "have", "will", "would", "could", "should", "into", "over", "under", "between", "through", "after", "before", "more", "most", "some", "also", "than", "them", "were", "here", "there", "then", "each", "every", "both", "such", "very", "just", "only", "other", "found", "shows", "study", "paper", "research", "report", "review"]);

export function resolvePaperFromBold(
  text: string,
  papers: { title: string; keywords: string[]; authors: string[] }[]
): { paperIdx: number; displayText: string } {
  const indexMatch = text.match(/^\[(?:source\s*)?(\d+)\]\s*/i);
  if (indexMatch) {
    const idx = parseInt(indexMatch[1], 10) - 1;
    if (idx >= 0 && idx < papers.length) return { paperIdx: idx, displayText: text.slice(indexMatch[0].length) };
  }

  const cleanText = text.toLowerCase().replace(/\s*\(.*?\)\s*/g, " ").trim();
  const stem = (w: string) => w.replace(/(ing|tion|ment|ness|ity|ies|es|ed|ly|s)$/i, "");
  const boldWords = cleanText.split(/\s+/).filter(w => (w.length > 2 || w === "ai") && !MATCH_STOP_WORDS.has(w));
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
  let bestIdx = -1;
  let bestScore = 0;
  let secondBestScore = 0;
  papers.forEach((p, i) => {
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
    if (score > bestScore) { secondBestScore = bestScore; bestScore = score; bestIdx = i; }
    else if (score > secondBestScore) { secondBestScore = score; }
  });
  const matched = bestScore >= 4 && bestScore - secondBestScore >= 2;
  return { paperIdx: matched ? bestIdx : -1, displayText: text };
}

// Flatten a structured synthesis (per-paper bullets with labelled details,
// bridges) into one prose paragraph per source. Paper-name markers survive.
export function flattenSynthesis(bodyText: string): string[] {
  const sections = parseBodySections(bodyText);
  // Drop intro paragraphs that precede the first source bullet — the gist already
  // serves as the hook, so standalone intro text is redundant.
  const firstBullet = sections.findIndex(s => s.kind === "bullet");
  const trimmed = firstBullet > 0
    ? sections.filter((s, i) => !(i < firstBullet && s.kind === "paragraph"))
    : sections;
  const paragraphs: string[] = [];
  let pendingBridge = "";
  for (const section of trimmed) {
    if (section.kind === "bridge") { pendingBridge = section.text.trim(); continue; }
    let text: string;
    if (section.kind === "bullet") {
      const { source } = splitSourceHeading(section.text);
      const detailText = section.details
        .filter(d => !/understand/i.test(d.label)) // drop the "if you want to understand" navigation phrase
        .map(d => {
          let t = d.text.trim();
          if (!t) return "";
          t = t.charAt(0).toUpperCase() + t.slice(1);       // sentence-case each detail
          if (!/[.!?]$/.test(t)) t += ".";                  // terminate so they don't run together
          return t;
        })
        .filter(Boolean)
        .join(" ");
      text = detailText ? `${source}: ${detailText}` : source;
    } else {
      text = section.text;
    }
    if (pendingBridge) { text = `${pendingBridge} ${text}`; pendingBridge = ""; }
    paragraphs.push(text);
  }
  if (pendingBridge) paragraphs.push(pendingBridge);
  return paragraphs;
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
  papers?: PaperItem[];
  onSelectPaper?: (paper: PaperItem) => void;
  onAddInterest?: (keyword: string) => void;
  onRegenerate?: () => void;
  generating?: boolean;
  renderPaperCard?: (paper: PaperItem, index: number) => React.ReactNode;
  isLoggedIn?: boolean;
  onSignIn?: () => void;
  onAppendNote?: (text: string) => void;
  hideHeader?: boolean;
  hideInteractionUI?: boolean;
}

// Guest dig deeper — shows pre-generated Q&A, prompts sign-in for more
export function GuestDigDeeper({ questions, answers, onSignIn }: {
  questions: string[];
  answers: string[];
  onSignIn?: () => void;
}) {
  const [expanded, setExpanded] = useState<number | null>(null);
  const pairs = questions
    .map((q, i) => ({ q, a: answers[i] || "" }))
    .filter(p => p.a.trim().length > 0)
    .slice(0, 3);

  return (
    <div>
      {pairs.length > 0 && (
        <div style={{ marginBottom: "16px" }}>
          {pairs.map(({ q, a }, i) => (
            <div key={i}>
              <button
                onClick={() => setExpanded(prev => prev === i ? null : i)}
                style={{
                  textAlign: "left", cursor: "pointer", background: "transparent", border: "none",
                  padding: "14px 4px", width: "100%", display: "flex", gap: "12px", alignItems: "flex-start",
                  borderBottom: expanded === i ? "none" : "1px solid #1a1a1a",
                }}
              >
                <div style={{ width: 4, alignSelf: "stretch", flexShrink: 0, borderRadius: 2, background: `linear-gradient(to bottom, ${HIGHLIGHT_GRADIENTS[i % HIGHLIGHT_GRADIENTS.length][0]} 0%, ${HIGHLIGHT_GRADIENTS[i % HIGHLIGHT_GRADIENTS.length][1]} 100%)`, border: "1px solid rgba(26,26,26,0.12)" }} />
                <div style={{ fontFamily: "var(--font-display), sans-serif", fontSize: "1rem", fontWeight: 600, letterSpacing: -0.2, lineHeight: 1.4, color: "#1a1a1a", flex: 1 }}>
                  {q.replace(/\*\*/g, "")}
                </div>
                <span style={{ fontFamily: "var(--font-mono), monospace", fontSize: "0.6rem", letterSpacing: "1.5px", color: "#888", marginTop: 3, flexShrink: 0 }}>
                  {expanded === i ? "▲" : "Ask →"}
                </span>
              </button>
              {expanded === i && (
                <div style={{ borderBottom: "1px solid #1a1a1a", paddingBottom: "14px", paddingLeft: "16px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "5px", margin: "10px 0 6px" }}>
                    <Star size={11} style={{ fill: "#FFD700", stroke: "#FFD700", flexShrink: 0 }} />
                    <span style={{ fontSize: "0.6rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "1.5px", fontFamily: "var(--font-mono), monospace", color: "#1a1a1a" }}>Insight</span>
                  </div>
                  <div style={{ fontSize: "0.92rem", lineHeight: 1.7, color: "#333", borderLeft: "2px solid #e5e7eb", paddingLeft: "12px" }}>
                    <ReactMarkdown
                      components={{
                        p: ({ children }) => <p style={{ marginBottom: "0.5em" }}>{children}</p>,
                        strong: ({ children }) => <strong style={{ fontWeight: 700, color: "#111" }}>{children}</strong>,
                      }}
                    >
                      {a}
                    </ReactMarkdown>
                  </div>
                </div>
              )}
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
            const [ha, hb] = HIGHLIGHT_GRADIENTS[(n - 1) % HIGHLIGHT_GRADIENTS.length];
            const citStyle: React.CSSProperties = {
              background: `linear-gradient(135deg, ${ha} 0%, ${hb} 100%)`,
              padding: "1px 5px",
              fontSize: "0.75em",
              fontWeight: 700,
              fontFamily: "var(--font-mono), monospace",
              letterSpacing: "0.5px",
              borderRadius: "2px",
            };
            return paper.sourceUrl ? (
              <a key={i} href={paper.sourceUrl} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
                <span style={citStyle}>[{n}]</span>
              </a>
            ) : (
              <span key={i} style={citStyle}>[{n}]</span>
            );
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


function AnswerEntry({
  entry,
  onAppendNote,
  showDivider,
}: {
  entry: { q: string; a: string; paperLinks?: { title: string; sourceUrl: string | null }[] };
  onAppendNote?: (text: string) => void;
  showDivider: boolean;
}) {
  const [added, setAdded] = useState(false);

  function addToNotes() {
    if (!onAppendNote) return;
    onAppendNote(`Q: ${entry.q}\n${entry.a}`);
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  }

  const sentences = entry.a.split(/(?<=[.!?])\s+/).filter(s => s.trim());

  return (
    <div style={{ marginBottom: showDivider ? "20px" : "0" }}>
      <p style={{ fontSize: "0.8rem", fontWeight: 500, color: "#1a1a1a", marginBottom: "10px", fontFamily: "var(--font-mono), monospace" }}>
        {entry.q}
      </p>

      {/* Insight label */}
      <div style={{ display: "flex", alignItems: "center", gap: "5px", marginBottom: "8px" }}>
        <Star size={11} style={{ fill: "#FFD700", stroke: "#FFD700", flexShrink: 0 }} />
        <span style={{ fontSize: "0.6rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "1.5px", fontFamily: "var(--font-mono), monospace", color: "#1a1a1a" }}>
          Insight
        </span>
      </div>

      {/* Answer — one sentence per line for scannability */}
      <div style={{ fontSize: "0.92rem", lineHeight: 1.7, color: "#333", borderLeft: "2px solid #e5e7eb", paddingLeft: "12px", marginBottom: "10px" }}>
        {sentences.length > 1 ? (
          sentences.map((s, i) => (
            <p key={i} style={{ margin: i < sentences.length - 1 ? "0 0 0.5em 0" : "0" }}>
              <CitedAnswer text={s} paperLinks={entry.paperLinks} />
            </p>
          ))
        ) : (
          <AnswerBlock text={entry.a} paperLinks={entry.paperLinks} />
        )}
      </div>

      {/* Add to notes */}
      <button
        onClick={addToNotes}
        style={{
          display: "inline-flex", alignItems: "center", gap: "5px",
          background: "none", border: "none", cursor: "pointer", padding: 0,
          fontSize: "0.6rem", fontWeight: 700, textTransform: "uppercase",
          letterSpacing: "1px", fontFamily: "var(--font-mono), monospace",
          color: added ? "#38b000" : "#888",
          transition: "color 0.15s",
        }}
      >
        {added ? <Check size={10} /> : <PenLine size={10} />}
        {added ? "Added" : "Add to notes"}
      </button>

      {showDivider && <div style={{ borderBottom: "1px solid #e5e7eb", marginTop: "16px" }} />}
    </div>
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
  papers = [],
  onSelectPaper,
  onAddInterest,
  onRegenerate,
  generating = false,
  renderPaperCard,
  isLoggedIn,
  onSignIn,
  onAppendNote,
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
  const { displayTheme, bodyText } = splitSynthesisTheme(synthesis, theme);


  // Dig deeper prompts — prefer LLM-generated, fall back to heuristic
  const digDeeperPrompts = useMemo(() => {
    if (suggestedQuestions && suggestedQuestions.length > 0) return suggestedQuestions;
    if (papers.length === 0) return [];
    // Fallback: one cross-cutting question
    return [theme ? `Where do these papers disagree on "${theme}"?` : "Where do these papers contradict each other?"];
  }, [suggestedQuestions, papers, theme]);

  const handleDigDeeper = async (question: string) => {
    if (!isLoggedIn || digDeeperLoading) return;
    setDigDeeperLoading(true);
    setShowQuestions(false);
    try {
      const res = await fetch("/api/digest/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: `Keep your answer to 3-4 sentences max. Be specific and concrete.\n\n${question}`,
          digestId: digestId || papers[0]?.id,
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
            fontWeight: 800,
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
        const extractText = (node: React.ReactNode): string => {
          if (typeof node === "string") return node;
          if (typeof node === "number") return String(node);
          if (Array.isArray(node)) return node.map(extractText).join("");
          if (node && typeof node === "object" && "props" in node) return extractText((node as React.ReactElement<{ children?: React.ReactNode }>).props.children);
          return "";
        };

        const makeStrongRenderer = (seenPaperIndices: Set<number>) =>
          function StrongRenderer({ children }: { children?: React.ReactNode }) {
            const text = extractText(children);
            const { paperIdx: matchedIdx, displayText } = resolvePaperFromBold(text, papers);
            const matchedPaper = matchedIdx >= 0 ? papers[matchedIdx] : null;

            if (matchedPaper && onSelectPaper) {
              const paperIdx = matchedIdx;
              // Don't highlight the same paper twice in one block (fuzzy collisions)
              if (seenPaperIndices.has(paperIdx)) {
                return <strong style={{ color: "#111", fontWeight: 700 }}>{displayText}</strong>;
              }
              seenPaperIndices.add(paperIdx);
              const [ha, hb] = HIGHLIGHT_GRADIENTS[paperIdx % HIGHLIGHT_GRADIENTS.length];
              const [hha, hhb] = HIGHLIGHT_HOVER_GRADIENTS[paperIdx % HIGHLIGHT_HOVER_GRADIENTS.length];
              const capitalised = displayText.charAt(0).toUpperCase() + displayText.slice(1);
              return (
                <PaperHighlight
                  bg={`linear-gradient(135deg, ${ha} 0%, ${hb} 100%)`}
                  bgHover={`linear-gradient(135deg, ${hha} 0%, ${hhb} 100%)`}
                  summary={matchedPaper.summary}
                  onClick={() => onSelectPaper(matchedPaper!)}
                >
                  {capitalised}
                </PaperHighlight>
              );
            }
            return <strong style={{ color: "#111", fontWeight: 700 }}>{displayText}</strong>;
          };

        // Single readable synthesis: render every section as flowing prose.
        // Structured digests (per-paper bullets with labelled details) are
        // flattened into one paragraph per source so the page just reads,
        // while paper-name highlights and concept defs are preserved.
        const proseRenderer = makeStrongRenderer(new Set<number>());
        const paragraphs = flattenSynthesis(bodyText);

        return (
          <div className="text-[0.97rem] md:text-[1.08rem]" style={{ lineHeight: "1.8", fontFamily: "inherit", color: "#1a1a1a" }}>
            {paragraphs.map((text, i) => (
              <p key={i} style={{ margin: "0 0 0.95em 0", lineHeight: 1.8 }}>
                <ReactMarkdown components={{ p: ({ children }) => <>{annotateText(children, conceptDefs)}</>, strong: proseRenderer }}>
                  {text}
                </ReactMarkdown>
              </p>
            ))}
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

      {!hideInteractionUI && isLoggedIn && papers.length > 0 && (
        <div style={{
          marginTop: "22px",
          borderTop: "1px solid #e5e5e5",
          paddingTop: "18px",
        }}>
          <div style={{
            fontFamily: "var(--font-mono), monospace",
            fontSize: "0.62rem",
            fontWeight: 800,
            letterSpacing: "1.8px",
            textTransform: "uppercase",
            color: "#888",
            marginBottom: "10px",
          }}>
            Pick a source
          </div>
          <div style={{ display: "grid", gap: "8px" }}>
            {papers.map((paper, index) => (
              <div
                key={paper.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr auto",
                  gap: "10px",
                  alignItems: "center",
                  border: "1.5px solid #1a1a1a",
                  background: "white",
                  padding: "10px 12px",
                }}
              >
                <button
                  onClick={() => onSelectPaper?.(paper)}
                  style={{
                    minWidth: 0,
                    background: "none",
                    border: "none",
                    padding: 0,
                    cursor: onSelectPaper ? "pointer" : "default",
                    textAlign: "left",
                    color: "#111",
                  }}
                >
                  <span style={{
                    display: "block",
                    fontFamily: "var(--font-mono), monospace",
                    fontSize: "0.58rem",
                    fontWeight: 800,
                    letterSpacing: "1.2px",
                    textTransform: "uppercase",
                    color: "#999",
                    marginBottom: "3px",
                  }}>
                    Source {index + 1}
                  </span>
                  <span style={{
                    display: "block",
                    fontSize: "0.82rem",
                    fontWeight: 700,
                    lineHeight: 1.35,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}>
                    {paper.title}
                  </span>
                </button>
                <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
                  <button
                    onClick={() => handleDigDeeper(`Summarize Source ${index + 1}: "${paper.title}" in plain English. What did it study, what did it find, and why does it matter for "${theme || displayTheme}"?`)}
                    disabled={digDeeperLoading}
                    title="Summarize this source"
                    style={{
                      width: 32,
                      height: 32,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      border: "1.5px solid #1a1a1a",
                      background: "white",
                      cursor: digDeeperLoading ? "wait" : "pointer",
                    }}
                  >
                    <BookOpen size={14} />
                  </button>
                  <button
                    onClick={() => handleDigDeeper(`Dig deeper into Source ${index + 1}: "${paper.title}". What is the most interesting question this paper raises?`)}
                    disabled={digDeeperLoading}
                    title="Dig deeper into this source"
                    style={{
                      width: 32,
                      height: 32,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      border: "1.5px solid #1a1a1a",
                      background: "white",
                      cursor: digDeeperLoading ? "wait" : "pointer",
                    }}
                  >
                    <MessageCircle size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Dig deeper — logged-in: live Q&A, logged-out: pre-generated answers */}
      {!hideInteractionUI && papers.length > 0 && !isLoggedIn && (
        <GuestDigDeeper
          questions={suggestedQuestions || []}
          answers={suggestedAnswers || []}
          onSignIn={onSignIn}
        />
      )}
      {!hideInteractionUI && papers.length > 0 && isLoggedIn && (
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
            <div style={{ marginBottom: "16px" }}>
              {digDeeperHistory.map((entry, i) => (
                <AnswerEntry
                  key={i}
                  entry={entry}
                  onAppendNote={onAppendNote}
                  showDivider={i < digDeeperHistory.length - 1}
                />
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
