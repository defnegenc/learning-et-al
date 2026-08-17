"use client";

import React, { useEffect, useRef, useState } from "react";
import { Bookmark } from "lucide-react";
import type { PaperItem } from "@/lib/types";
import { journalName } from "@/lib/venue-name";
import {
  BODY_SM, BODY_STYLE, BORDER, DIM, DISPLAY, DISPLAY_LG, DISPLAY_SM, GOLD, INK, LABEL_STYLE,
  InkTip, SHADOW, SURFACE, wash, washSlots,
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

/* ── The two columns ─────────────────────────────────────────────────────── */

/** The pipeline's `**bold**` markers, rendered as bold weight. */
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

/** A column of the split: a Display/SM heading in ink over body at reading size. */
function CardColumn({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 style={{ ...DISPLAY_SM, margin: "0 0 10px" }}>{heading}</h3>
      {children}
    </section>
  );
}

/**
 * Findings as a list, not as three adjacent paragraphs: a 5px dot in an 18px
 * gutter with the text hanging beside it.
 */
function FindingList({ items }: { items: string[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {items.map((f, i) => (
        <div key={i} style={{ display: "flex" }}>
          <span aria-hidden style={{ width: 18, flexShrink: 0, display: "flex" }}>
            <span style={{ width: 5, height: 5, marginTop: 10, background: INK, borderRadius: "50%" }} />
          </span>
          <p style={{ ...READING_BODY, margin: 0 }}>{emphasize(startCap(f))}</p>
        </div>
      ))}
    </div>
  );
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
 * The full card, as one open page rather than a lid: title, byline, the hero
 * line, then the evidence and the point side by side behind one 2px rule.
 *
 * There is no expand control. "See more" was hiding two short lists and a
 * button, and the reason for hiding them — that they were 13px inside two
 * nested boxes and unpleasant to read — is gone: both columns are Body 15 with
 * no box at all. `expandTick` still scrolls the card into view when a paper
 * name in the synthesis is clicked; there is just nothing left to expand.
 *
 * Findings read left because the card argues toward its conclusion. The
 * takeaway's claim is the only place colour lands on type, marked in the same
 * hue as the card's own wash so the mark is wayfinding, not decoration.
 */
function DigestCard({ paper, index, loggedIn, initialBookmarked, expandTick }: PaperCardProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (expandTick) ref.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [expandTick]);

  const foundational = paper.category === "foundational";
  const mark = foundational ? GOLD : washSlots(index)[0];

  const body = (paper.summary || paper.abstract || "").trim();
  const hero = body.match(/[^.!?]+[.!?]+["')\]]?/)?.[0]?.trim() || body;
  const byline = paperByline(paper);

  const isNews = paper.source === "rss";
  const claim = (paper.claim || paper.takeawayHook || "").trim();
  const findings = (paper.keyFindings ?? []).slice(0, 3);
  const findingsLabel = isNews ? "Key points" : "Findings";
  const takeaway = (paper.takeawayLine || paper.takeawayHook || paper.takeawayStat || "").trim();
  // The claim wears the mark and the spoken line follows it plain — one
  // conclusion, with the highlight on the sentence that earns it.
  const lead = startCap(claim || takeaway);
  const rest = claim && takeaway && takeaway !== claim ? takeaway : "";

  const hasSplit = findings.length > 0 && !!lead;

  return (
    <div
      ref={ref}
      style={{
        ...(foundational ? { background: SURFACE } : wash(index)),
        border: `2px solid ${foundational ? GOLD : INK}`,
        boxShadow: SHADOW,
        padding: "22px 24px",
        display: "flex",
        flexDirection: "column",
        gap: 18,
        overflow: "hidden",
      }}
    >
      {/* Foundational eyebrow — label + eye only; sits above the title */}
      {foundational && <FoundationalMark />}

      <div>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14 }}>
          {/* Foundational leads with a large title (Display/LG); regular cards use Display/SM (uppercase) */}
          <h3 style={{ ...(foundational ? DISPLAY_LG : DISPLAY_SM), margin: 0, flex: 1 }}>
            {paper.plainName || paper.title}
          </h3>
          {loggedIn && <BookmarkToggle paper={paper} initial={initialBookmarked} />}
        </div>
        {byline && <div style={{ ...BODY_SM, fontStyle: "italic", color: DIM, marginTop: 2 }}>{byline}</div>}
        {/* Hero only for non-foundational — the large title + reason block serve that role */}
        {!foundational && hero && <p style={{ fontFamily: DISPLAY, fontSize: 18, fontWeight: 700, letterSpacing: "-0.02em", lineHeight: "26px", color: INK, margin: "14px 0 0" }}>{hero}</p>}
      </div>

      {/* Reason — plain body text below title+byline, foundational only */}
      {foundational && paper.foundationalReason && (
        <p style={{ ...BODY_STYLE, color: DIM, margin: 0 }}>{paper.foundationalReason}</p>
      )}

      {/* Findings + takeaway only for non-foundational papers */}
      {!foundational && (findings.length > 0 || lead) && (
        <div className={hasSplit ? "paper-card-split" : undefined}>
          {findings.length > 0 && (
            <CardColumn heading={findingsLabel}>
              <FindingList items={findings} />
            </CardColumn>
          )}
          {lead && (
            <CardColumn heading="Takeaway">
              <p style={{ ...READING_BODY, margin: 0 }}>
                <span style={{ background: mark, boxDecorationBreak: "clone", WebkitBoxDecorationBreak: "clone", padding: "2px 4px" }}>
                  {lead}
                </span>
                {rest ? ` ${rest}` : ""}
              </p>
            </CardColumn>
          )}
        </div>
      )}

      {paper.sourceUrl && (
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <a
            href={paper.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="ds-lift"
            style={{ ...DISPLAY_SM, display: "inline-flex", alignItems: "center", gap: 8, background: INK, color: SURFACE, border: BORDER, boxShadow: SHADOW, padding: "9px 16px", textDecoration: "none" }}
          >
            Read paper ↗
          </a>
        </div>
      )}

      <style>{`
        .paper-card-split { display: grid; grid-template-columns: 1.15fr 1fr; gap: 24px; }
        .paper-card-split > section + section { border-left: ${BORDER}; padding-left: 24px; }
        @media (max-width: 720px) {
          .paper-card-split { grid-template-columns: 1fr; gap: 20px; }
          .paper-card-split > section + section { border-left: none; border-top: ${BORDER}; padding-left: 0; padding-top: 20px; }
        }
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
        ...(foundational ? { background: SURFACE } : wash(index)),
        border: `2px solid ${foundational ? GOLD : INK}`,
        boxShadow: SHADOW,
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

// Eye icon at rest reads as part of the gold lockup; goes to ink on hover.
const GOLD_EYE = "#8C6D1F";

/**
 * The foundational eyebrow — label + eye only.
 * One gold moment: the 2px frame. No gold shadow, no gradient, no gold underline.
 * The reason block lives below the title, not inside this lockup.
 */
function FoundationalMark() {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 8, alignSelf: "flex-start", position: "relative" }}>
      <span style={{ ...LABEL_STYLE, color: INK }}>Foundational text</span>
      <button
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onClick={() => setOpen(v => !v)}
        aria-label="What is a foundational text?"
        style={{ background: "none", border: "none", padding: 0, cursor: "help", display: "flex", lineHeight: 1 }}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={open ? INK : GOLD_EYE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
  );
}

/** Body text at the reading size — exported so surfaces don't restate it. */
export const READING_BODY: React.CSSProperties = { ...BODY_STYLE, lineHeight: "26px" };
