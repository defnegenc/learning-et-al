"use client";

import React, { useEffect, useRef, useState } from "react";
import { Bookmark } from "lucide-react";
import type { PaperItem } from "@/lib/types";
import { journalName } from "@/lib/venue-name";
import {
  BODY, BODY_SM, BODY_STYLE, BORDER, DIM, DISPLAY, DISPLAY_SM, GOLD, INK, LABEL_STYLE,
  InkTip, SHADOW, SHADOW_GOLD, SURFACE, foundationalWash, wash, washSlots,
} from "@/components/design-system";

/*
 * The paper card — ONE component, two sizes.
 *
 * `digest` is the full card in the reading column: title, byline, the hero
 * line, and the tiles behind one expand control. `compact` is the same card
 * smaller — title, byline, tags — and it is what "Referenced sources" and the
 * vault render. There is no second card component: the old SourceCard (its own
 * four palettes, a 1.5px border, a soft shadow and a glass-tag variant) is
 * deleted, which is why the wash index can no longer drift between two files.
 *
 * Anatomy, in order: TITLE (Display/SM, upper) · BYLINE (Body/SM italic —
 * authors, venue and year on one line) · everything else. "Paper · 2026" was
 * never information anyone needed as a heading: the year belongs with the
 * journal, and the source type is already carried by the venue name.
 */

export function paperByline(paper: PaperItem): string {
  const journal = journalName(paper.sourceUrl, paper.authors);
  const authors = paper.authors.length === 0
    ? ""
    : paper.authors.length <= 2
      ? paper.authors.join(" & ")
      : `${paper.authors[0]}${paper.authors[1] ? `, ${paper.authors[1]}` : ""} et al.`;
  const venue = [journal, paper.year ? String(paper.year) : ""].filter(Boolean).join(", ");
  return [authors, venue].filter(Boolean).join(" · ");
}

/** The bookmark — the acid green fill is the only colour on the card's chrome. */
function BookmarkToggle({ paper, initial, onUnsaved }: {
  paper: PaperItem;
  initial?: boolean;
  onUnsaved?: (id: string) => void;
}) {
  const [saved, setSaved] = useState(!!initial);

  async function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const next = !saved;
    setSaved(next);
    try {
      await fetch(`/api/papers/${paper.id}/feedback`, {
        method: next ? "POST" : "DELETE",
        headers: next ? { "Content-Type": "application/json" } : undefined,
        body: next ? JSON.stringify({ type: "star" }) : undefined,
      });
      if (next) {
        // Reading prep runs in the background so the companion and the citing
        // work are ready by the time the reading list is opened.
        fetch(`/api/papers/${paper.id}/companion`, { method: "POST" }).catch(() => {});
        fetch(`/api/papers/${paper.id}/homework`, { method: "POST" }).catch(() => {});
      } else {
        onUnsaved?.(paper.id);
      }
    } catch {
      setSaved(!next);
    }
  }

  return (
    <button
      onClick={toggle}
      title={saved ? "Remove from your reading list" : "Save to your reading list"}
      aria-label={saved ? "Remove from your reading list" : "Save to your reading list"}
      style={{ background: "none", border: "none", padding: 0, cursor: "pointer", display: "flex", flexShrink: 0, lineHeight: 1 }}
    >
      <Bookmark size={16} style={{ fill: saved ? "currentColor" : "none", stroke: "currentColor", color: saved ? INK : DIM }} />
    </button>
  );
}

/* ── The tiles behind the expand control ─────────────────────────────────── */

// Render the pipeline's **bold** emphasis without changing the tile's type.
function emphasize(text: string): React.ReactNode[] {
  return text.split(/\*\*(.+?)\*\*/g).map((part, i) =>
    !part ? null : i % 2 === 1
      ? <strong key={i} style={{ fontWeight: 600 }}>{part}</strong>
      : <span key={i}>{part}</span>
  );
}

// Some older digests stored detail copy with a lower-case first word.
function startCap(text: string): string {
  return text.replace(/[A-Za-z]/, (letter) => letter.toUpperCase());
}

function BriefTile({ heading, background = SURFACE, fullWidth = false, children }: {
  heading: string;
  background?: string;
  fullWidth?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section style={{ background, border: BORDER, padding: "16px 18px", gridColumn: fullWidth ? "1 / -1" : undefined }}>
      <h3 style={{ ...DISPLAY_SM, margin: "0 0 10px" }}>{heading}</h3>
      <div style={BODY_SM}>{children}</div>
    </section>
  );
}

function tileListLabel(labels: string[]): string {
  if (labels.length === 1) return `See the ${labels[0].toLowerCase()}`;
  return "See more";
}

/* ── The card ────────────────────────────────────────────────────────────── */

export interface PaperCardProps {
  paper: PaperItem;
  /** Position in the digest — the wash index. Never the field. */
  index: number;
  size?: "digest" | "compact";
  loggedIn?: boolean;
  initialBookmarked?: boolean;
  onUnsaved?: (id: string) => void;
  /** Compact only: what a click does. Falls back to opening the source. */
  onOpen?: (p: PaperItem) => void;
  /** Compact only: the vault's compare mode. */
  compareMode?: boolean;
  isSelected?: boolean;
  onSelect?: (p: PaperItem) => void;
  /** Digest only: a chip click in the prose bumps this to open + scroll here. */
  expandTick?: number;
}

export function PaperCard(props: PaperCardProps) {
  return props.size === "compact" ? <CompactCard {...props} /> : <DigestCard {...props} />;
}

/**
 * The full card. Hero is the summary's first sentence at Display/LG; everything
 * else about the source lives behind one expand line, so the resting card is a
 * title, a byline and one idea.
 */
function DigestCard({ paper, index, loggedIn, initialBookmarked, expandTick }: PaperCardProps) {
  const [expanded, setExpanded] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Expansion is adjusted during render (not in the effect) so the scroll effect
  // fires after the tiles have laid out.
  const [seenTick, setSeenTick] = useState(0);
  if (expandTick && expandTick !== seenTick) {
    setSeenTick(expandTick);
    setExpanded(true);
  }
  useEffect(() => {
    if (expandTick) ref.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [expandTick]);

  const foundational = paper.category === "foundational";
  // The Takeaway tile fills solid with the card's first hue — the one place the
  // wash stops being a wash and becomes a fill.
  const takeawayFill = foundational ? GOLD : washSlots(index)[0];

  const body = (paper.summary || paper.abstract || "").trim();
  const hero = body.match(/[^.!?]+[.!?]+["')\]]?/)?.[0]?.trim() || body;
  const byline = paperByline(paper);

  const isNews = paper.source === "rss";
  const claim = (paper.claim || paper.takeawayHook || "").trim();
  const findings = (paper.keyFindings ?? []).slice(0, 3);
  const findingsLabel = isNews ? "Key points" : "Findings";
  const takeaway = (paper.takeawayLine || paper.takeawayHook || paper.takeawayStat || "").trim();
  // Claim folds into the takeaway — one punchy conclusion tile instead of two.
  const combinedTakeaway = [claim, takeaway !== claim ? takeaway : ""].filter(Boolean).join(" ");
  const tileLabels = [findings.length > 0 ? findingsLabel : "", combinedTakeaway ? "Takeaway" : ""].filter(Boolean);

  return (
    <div
      ref={ref}
      style={{
        ...(foundational ? foundationalWash() : wash(index)),
        border: `2px solid ${foundational ? GOLD : INK}`,
        boxShadow: foundational ? SHADOW_GOLD : SHADOW,
        padding: "22px 24px",
        display: "flex",
        flexDirection: "column",
        gap: 12,
        overflow: "hidden",
      }}
    >
      {foundational && <FoundationalMark reason={paper.foundationalReason} />}

      {/* Hero is the TL;DR — reads first at display weight. Title and byline
          are supporting metadata underneath in the body face. */}
      {hero && <p style={{ fontFamily: DISPLAY, fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em", lineHeight: "28px", color: INK, margin: 0 }}>{hero}</p>}

      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14 }}>
        <button
          onClick={() => setExpanded(v => !v)}
          style={{ fontFamily: BODY, fontSize: 13, fontWeight: 600, lineHeight: "18px", textAlign: "left", background: "none", border: "none", padding: 0, cursor: "pointer", flex: 1, color: INK }}
        >
          {paper.plainName || paper.title}
        </button>
        {loggedIn && <BookmarkToggle paper={paper} initial={initialBookmarked} />}
      </div>

      {byline && (
        <div style={{ ...BODY_SM, fontStyle: "italic", color: DIM, marginTop: -4 }}>{byline}</div>
      )}

      {(tileLabels.length > 0 || paper.sourceUrl) && (
        <div>
          <button
            onClick={() => setExpanded(v => !v)}
            style={{ ...DISPLAY_SM, background: "none", border: "none", padding: 0, cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 4 }}
          >
            {expanded ? "See less ↑" : tileLabels.length > 0 ? `${tileListLabel(tileLabels)} ↓` : "Read paper ↓"}
          </button>

          {expanded && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 14 }}>
              {findings.length > 0 && (
                <BriefTile heading={findingsLabel} fullWidth>
                  <ul className="paper-tile-list">
                    {findings.map((f, i) => <li key={i}>{emphasize(startCap(f))}</li>)}
                  </ul>
                </BriefTile>
              )}
              {combinedTakeaway && (
                <BriefTile heading="Takeaway" background={takeawayFill} fullWidth>
                  {emphasize(startCap(combinedTakeaway))}
                </BriefTile>
              )}
              {paper.sourceUrl && (
                <a
                  href={paper.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ds-lift"
                  style={{ ...DISPLAY_SM, display: "inline-flex", alignItems: "center", gap: 8, background: INK, color: SURFACE, border: BORDER, boxShadow: SHADOW, padding: "12px 22px", textDecoration: "none", alignSelf: "flex-start" }}
                >
                  Read paper ↗
                </a>
              )}
            </div>
          )}
        </div>
      )}

      <style>{`
        .paper-tile-list { margin: 0; padding-left: 1rem; display: grid; gap: 10px; list-style: disc outside; text-align: left; }
        .paper-tile-list li { display: list-item; padding-left: 0; }
        .paper-tile-list li::marker { font-size: 0.8em; color: ${INK}; }
      `}</style>
    </div>
  );
}

/**
 * The same card, smaller — what "Referenced sources" and the vault render.
 * Title, byline, tags. No hero, no tiles, no metadata rail.
 */
function CompactCard({ paper, index, loggedIn, initialBookmarked, onOpen, onUnsaved, compareMode, isSelected, onSelect }: PaperCardProps) {
  const foundational = paper.category === "foundational";
  const byline = paperByline(paper);

  const activate = () => {
    if (compareMode) return onSelect?.(paper);
    if (onOpen) return onOpen(paper);
    if (paper.sourceUrl) window.open(paper.sourceUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <div
      onClick={activate}
      style={{
        ...(foundational ? foundationalWash() : wash(index)),
        border: `2px solid ${foundational ? GOLD : INK}`,
        boxShadow: foundational ? SHADOW_GOLD : SHADOW,
        padding: "16px 18px",
        display: "flex",
        flexDirection: "column",
        gap: 10,
        height: "100%",
        cursor: "pointer",
        overflow: "hidden",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <h3 style={{ ...DISPLAY_SM, margin: 0, flex: 1 }}>{paper.title}</h3>
        {compareMode ? (
          <span
            aria-hidden
            style={{ width: 18, height: 18, border: BORDER, background: isSelected ? INK : "transparent", flexShrink: 0 }}
          />
        ) : loggedIn ? (
          <BookmarkToggle paper={paper} initial={initialBookmarked} onUnsaved={onUnsaved} />
        ) : null}
      </div>

      {byline && <div style={{ ...BODY_SM, fontStyle: "italic", color: DIM }}>{byline}</div>}
    </div>
  );
}

/**
 * The foundational lockup — the label, the eye, and the reason.
 *
 * The label stays constant so the lane is recognisable the third time you meet
 * it; the eye carries the explanation for the first. One gold moment: the frame
 * and the reason's rule. The border-image gradient, the glow and the gold
 * underline under the label are all retired.
 */
function FoundationalMark({ reason }: { reason?: string | null }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "inline-flex", alignItems: "center", gap: 8, alignSelf: "flex-start", position: "relative" }}>
        <span style={{ ...LABEL_STYLE, color: INK }}>Foundational text</span>
        <button
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
          onClick={() => setOpen(v => !v)}
          aria-label="What is a foundational text?"
          style={{ background: "none", border: "none", padding: 0, cursor: "help", display: "flex", lineHeight: 1 }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={open ? INK : GOLD} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </button>
        {open && (
          <span style={{ position: "absolute", top: "calc(100% + 8px)", left: 0, zIndex: 40, pointerEvents: "none" }}>
            <InkTip>
              Some days you&rsquo;ll get a foundational text — the paper that shaped how this field or this question came to be thought about at all.
            </InkTip>
          </span>
        )}
      </div>
      {reason && (
        <div style={{ display: "flex", gap: 10 }}>
          <span style={{ width: 2, flexShrink: 0, background: GOLD }} />
          <p style={{ ...BODY_SM, color: DIM, margin: 0 }}>{reason}</p>
        </div>
      )}
    </div>
  );
}

/** Body text at the reading size — exported so surfaces don't restate it. */
export const READING_BODY: React.CSSProperties = { ...BODY_STYLE, lineHeight: "26px" };
