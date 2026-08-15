"use client";

import React, { useState, useCallback, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import { BookOpen, Loader2, MessageCircle, Star, PenLine, Check } from "lucide-react";
import type { PaperItem } from "@/lib/types";
import {
  ACID_GREEN, ActionButton, BODY_STYLE, BODY_SM, BORDER, DIM, DISPLAY_LG, DISPLAY_SM,
  HAIRLINE, INK, InkTip, Label, LABEL_STYLE, MUTED, SURFACE, Tag, TextInput, wash, washSlots, wordSlot,
} from "@/components/design-system";

// A paper's name in the prose. An ink underline, not a coloured highlight:
// the card's wash already carries the colour that makes the match, so a second
// colour on the word was saying the same thing twice.
function PaperHighlight({ summary, onClick, children }: {
  summary: string | null; onClick: () => void; children: React.ReactNode;
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
        color: INK, fontWeight: 600,
        textDecoration: "underline",
        textDecorationThickness: showTooltip ? "3px" : "2px",
        textUnderlineOffset: "3px",
        cursor: "pointer", transition: "text-decoration-thickness 140ms",
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
        <span style={{ ...tooltipStyle, pointerEvents: "none" }}>
          <InkTip style={{ width: "100%" }}>
            {summary.length > 150 ? summary.slice(0, 147) + "…" : summary}
          </InkTip>
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
      style={{ position: "relative", borderBottom: `2px dotted ${MUTED}`, cursor: "help" }}
      onMouseEnter={() => { setShow(true); updateTooltip(); }}
      onMouseLeave={() => setShow(false)}
      onClick={() => { setShow(v => !v); updateTooltip(); }}
      onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { setShow(v => !v); updateTooltip(); } }}
    >
      {children}
      {show && (
        <span style={{ ...tooltipStyle, pointerEvents: "none" }}>
          <InkTip label={term} style={{ width: "100%" }}>{definition}</InkTip>
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


import { splitSynthesisTheme, resolvePaperFromBold, flattenSynthesis } from "./synthesis-text";

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
                  borderBottom: expanded === i ? "none" : `1px solid ${INK}`,
                }}
              >
                <div style={{ width: 4, alignSelf: "stretch", flexShrink: 0, background: washSlots(i)[0], border: `1px solid ${INK}` }} />
                <div style={{ ...DISPLAY_SM, flex: 1 }}>
                  {q.replace(/\*\*/g, "")}
                </div>
                <span style={{ ...LABEL_STYLE, marginTop: 3, flexShrink: 0 }}>
                  {expanded === i ? "▲" : "Ask →"}
                </span>
              </button>
              {expanded === i && (
                <div style={{ borderBottom: `1px solid ${INK}`, paddingBottom: 16, paddingLeft: 16 }}>
                  <Label style={{ margin: "12px 0 8px" }}>Insight</Label>
                  <div style={{ ...BODY_STYLE, color: DIM, borderLeft: `2px solid ${INK}`, paddingLeft: 14 }}>
                    <ReactMarkdown
                      components={{
                        p: ({ children }) => <p style={{ marginBottom: "0.5em" }}>{children}</p>,
                        strong: ({ children }) => <strong style={{ fontWeight: 600, color: INK }}>{children}</strong>,
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
      <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap", marginTop: pairs.length > 0 ? 20 : 0 }}>
        <span style={{ ...BODY_STYLE, color: MUTED }}>Sign in to ask your own questions.</span>
        <ActionButton variant="primary" onClick={onSignIn}>Sign in</ActionButton>
      </div>
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
          return <strong key={i} style={{ fontWeight: 600, color: INK }}>{seg.slice(2, -2)}</strong>;
        }
        const citMatch = seg.match(/^\[(\d+)\]$/);
        if (citMatch && paperLinks && paperLinks.length > 0) {
          const n = parseInt(citMatch[1], 10);
          const paper = paperLinks[n - 1];
          if (paper) {
            const citStyle: React.CSSProperties = {
              background: washSlots(n - 1)[0],
              border: `1px solid ${INK}`,
              padding: "0 5px",
              fontSize: "0.85em",
              fontWeight: 600,
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
      <p style={{ ...DISPLAY_SM, margin: "0 0 12px" }}>{entry.q}</p>

      <Label style={{ marginBottom: 8 }}>Insight</Label>

      {/* Answer — one sentence per line for scannability */}
      <div style={{ ...BODY_STYLE, color: DIM, borderLeft: `2px solid ${INK}`, paddingLeft: 14, marginBottom: 12 }}>
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
          ...LABEL_STYLE,
          display: "inline-flex", alignItems: "center", gap: 6,
          background: "none", border: "none", cursor: "pointer", padding: 0,
          color: added ? ACID_GREEN : MUTED,
          transition: "color 140ms",
        }}
      >
        {added ? <Check size={12} /> : <PenLine size={12} />}
        {added ? "Added" : "Add to notes"}
      </button>

      {showDivider && <div style={{ borderBottom: HAIRLINE, marginTop: 20 }} />}
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
        <h1 style={{ ...DISPLAY_LG, maxWidth: 840, margin: 0 }}>{displayTheme}</h1>
      )}

      {/* Date */}
      {!hideHeader && <Label>{today}</Label>}

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
                return <strong style={{ color: INK, fontWeight: 600 }}>{displayText}</strong>;
              }
              seenPaperIndices.add(paperIdx);
              const capitalised = displayText.charAt(0).toUpperCase() + displayText.slice(1);
              return (
                <PaperHighlight summary={matchedPaper.summary} onClick={() => onSelectPaper(matchedPaper!)}>
                  {capitalised}
                </PaperHighlight>
              );
            }
            return <strong style={{ color: INK, fontWeight: 600 }}>{displayText}</strong>;
          };

        // Single readable synthesis: render every section as flowing prose.
        // Structured digests (per-paper bullets with labelled details) are
        // flattened into one paragraph per source so the page just reads,
        // while paper-name highlights and concept defs are preserved.
        const proseRenderer = makeStrongRenderer(new Set<number>());
        const paragraphs = flattenSynthesis(bodyText);

        return (
          <div style={{ ...BODY_STYLE, lineHeight: "26px" }}>
            {paragraphs.map((text, i) => (
              <p key={i} style={{ margin: "0 0 1em 0" }}>
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
            const term = concept.includes(": ") ? concept.split(": ")[0] : concept;
            return (
              <Tag
                key={concept}
                label={term}
                tint={wordSlot(term)}
                title={concept.includes(": ") ? concept.split(": ").slice(1).join(": ") : undefined}
              />
            );
          })}
        </div>
      )}

      {!hideInteractionUI && isLoggedIn && papers.length > 0 && (
        <div style={{ marginTop: 24, borderTop: HAIRLINE, paddingTop: 20 }}>
          <Label style={{ marginBottom: 12 }}>Pick a source</Label>
          <div style={{ display: "grid", gap: "8px" }}>
            {papers.map((paper, index) => (
              <div
                key={paper.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr auto",
                  gap: "10px",
                  alignItems: "center",
                  border: BORDER,
                  background: SURFACE,
                  padding: "12px 14px",
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
                    color: INK,
                  }}
                >
                  <span style={{ ...LABEL_STYLE, display: "block", marginBottom: 4 }}>
                    Source {index + 1}
                  </span>
                  <span style={{ ...DISPLAY_SM, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {paper.title}
                  </span>
                </button>
                <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
                  <button
                    onClick={() => handleDigDeeper(`Summarize Source ${index + 1}: "${paper.title}" in plain English. What did it study, what did it find, and why does it matter for "${theme || displayTheme}"?`)}
                    disabled={digDeeperLoading}
                    title="Summarize this source"
                    style={{
                      width: 38,
                      height: 38,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      border: BORDER,
                      background: SURFACE,
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
                      width: 38,
                      height: 38,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      border: BORDER,
                      background: SURFACE,
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
                    ...BODY_STYLE, padding: "10px 14px", border: BORDER, background: SURFACE,
                    textAlign: "left", cursor: "pointer",
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
            <div style={{ display: "flex", alignItems: "center", gap: 10, color: MUTED, marginBottom: 14 }}>
              <Loader2 size={15} className="animate-spin" />
              <Label>Thinking…</Label>
            </div>
          )}

          {/* Text input bar */}
          <div style={{
            display: "flex", gap: 10, alignItems: "center",
            border: BORDER, padding: "10px 14px", background: SURFACE,
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
                ...BODY_STYLE, flex: 1, border: "none", outline: "none", background: "transparent",
              }}
            />
            <button
              onClick={() => { if (customQuestion.trim()) { handleDigDeeper(customQuestion); setCustomQuestion(""); } }}
              disabled={!customQuestion.trim() || digDeeperLoading}
              aria-label="Ask"
              style={{
                padding: 9, border: "none",
                background: INK,
                opacity: customQuestion.trim() && !digDeeperLoading ? 1 : 0.4,
                cursor: customQuestion.trim() && !digDeeperLoading ? "pointer" : "not-allowed",
                display: "flex", alignItems: "center", transition: "opacity 140ms",
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
