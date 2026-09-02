"use client";

import React, { useEffect, useRef, useState } from "react";
import { Bookmark } from "lucide-react";
import type { PaperItem } from "@/lib/types";
import { journalName } from "@/lib/venue-name";
import { announceSave } from "@/lib/save-nux";
import {
  BODY_SM, BODY_STYLE, BORDER, DIM, DISPLAY, DISPLAY_SM, GOLD, INK,
  foundationalSlots, foundationalWash, InkTip, SHADOW, SHADOW_GOLD, SURFACE, wash, washSlots,
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

/**
 * The save control.
 *
 * One name for one action: "Save", "Saved", and the place it lands is "your
 * library". The three names this used to have — "Save to your reading list" in
 * the tooltip, "Save for later" on foundational cards, "Read later" in the
 * vault's empty state — were three names for the same button, and none of them
 * was visible on the cards a signed-in reader actually meets, which is why the
 * feature read as missing in production.
 *
 * `showLabel` renders the word beside the icon. It is on for every digest and
 * shelf card now, not just foundational ones: an icon-only bookmark teaches
 * nobody what saving does, and saving is what starts the librarian reading.
 */
function BookmarkToggle({ paper, initial, onUnsaved, showLabel, onSignedOutSaveChange }: {
  paper: PaperItem;
  initial?: boolean;
  onUnsaved?: (id: string) => void;
  showLabel?: boolean;
  onSignedOutSaveChange?: (paper: PaperItem, saved: boolean) => void | Promise<void>;
}) {
  const [saved, setSaved] = useState(!!initial);

  // Bookmark ids often arrive just after the digest. Reflect that hydration,
  // including device-backed saves on a public permalink.
  useEffect(() => setSaved(!!initial), [initial]);

  async function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const next = !saved;
    setSaved(next);
    try {
      if (onSignedOutSaveChange) {
        await onSignedOutSaveChange(paper, next);
        if (!next) onUnsaved?.(paper.id);
        return;
      }
      const response = await fetch(`/api/papers/${paper.id}/feedback`, {
          method: next ? "POST" : "DELETE",
          headers: next ? { "Content-Type": "application/json" } : undefined,
          body: next ? JSON.stringify({ type: "star" }) : undefined,
        });
      if (!response.ok) throw new Error("Bookmark failed");
      if (next) {
        // Reading prep runs in the background so the companion and the citing
        // work are ready by the time the library is opened. On a reader's first
        // save this is also the only thing they are ever told about it.
        fetch(`/api/papers/${paper.id}/companion`, { method: "POST" }).catch(() => {});
        fetch(`/api/papers/${paper.id}/follow-ups`, { method: "POST" }).catch(() => {});
        announceSave({ paperId: paper.id, title: paper.plainName || paper.title });
      } else {
        onUnsaved?.(paper.id);
      }
    } catch {
      setSaved(!next);
    }
  }

  const name = saved ? "Remove from your library" : "Save to your library";

  return (
    <button
      onClick={toggle}
      title={name}
      aria-label={name}
      style={{
        // The word is Body/SM, not Display/SM: it names a thing rather than the
        // machinery, so it is not a Label and it is not a button voice either.
        ...(showLabel ? { ...BODY_SM, fontWeight: 600 } : {}),
        background: "none",
        border: "none",
        padding: showLabel ? "2px 0" : 0,
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        gap: 7,
        flexShrink: 0,
        lineHeight: 1,
        color: saved ? INK : DIM,
        whiteSpace: "nowrap",
      }}
    >
      <Bookmark size={16} style={{ fill: saved ? "currentColor" : "none", stroke: "currentColor" }} />
      {showLabel && <span>{saved ? "Saved" : "Save"}</span>}
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

/**
 * Drop the pipeline's `**bold**` without drawing it.
 *
 * The metadata call only asks for bold inside `findings`, but the model writes
 * all of a paper's copy in one response and carries the convention across. The
 * takeaway already has a mark — the hue highlight on its claim — so a second one
 * would be noise; nothing strips the markers before the DB, so unrendered they
 * would reach the card as literal asterisks.
 */
function unmark(text: string): string {
  return text.replace(/\*\*(.+?)\*\*/g, "$1");
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
  /** Public permalink only: persist a signed-out bookmark on this device. */
  onSignedOutSaveChange?: (paper: PaperItem, saved: boolean) => void | Promise<void>;
  onUnsaved?: (id: string) => void;
  /** Compact only: what a click does. Falls back to opening the source. */
  onOpen?: (p: PaperItem) => void;
  /** Compact only: the vault's compare mode. */
  compareMode?: boolean;
  isSelected?: boolean;
  onSelect?: (p: PaperItem) => void;
  /** Digest only: a chip click in the prose bumps this to scroll the card here. */
  expandTick?: number;
  /**
   * Compact only: one line of substance under the byline — the reading list
   * passes the companion's "remember". Absent, the card is title and byline as
   * before, which is what "Referenced sources" still wants.
   */
  preview?: string | null;
  /** Compact only: the quiet line at the foot — where the paper came from. */
  footnote?: React.ReactNode;
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
function DigestCard({ paper, index, loggedIn, initialBookmarked, onSignedOutSaveChange, expandTick }: PaperCardProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (expandTick) ref.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [expandTick]);

  const foundational = paper.category === "foundational";
  // The mark is a wash hue, never GOLD — gold is a line colour and is far too
  // dark to read a highlight through. See `foundationalSlots`.
  const mark = foundational ? foundationalSlots()[0] : washSlots(index)[0];
  // The spoken line that opens a foundational card, with the phrase the card
  // draws as a defined term guaranteed to be in it. Legacy rows with no reason
  // stored fall through to the paper's own hero at 22, as before.
  const opening = foundational && paper.foundationalReason
    ? foundationalLead(paper.foundationalReason)
    : null;

  const body = (paper.summary || paper.abstract || "").trim();
  const hero = body.match(/[^.!?]+[.!?]+["')\]]?/)?.[0]?.trim() || body;
  const byline = paperByline(paper);

  const isNews = paper.source === "rss";
  const claim = unmark((paper.claim || paper.takeawayHook || "").trim());
  const findings = (paper.keyFindings ?? []).slice(0, 3);
  const findingsLabel = isNews ? "Key points" : "Findings";
  const takeaway = unmark((paper.takeawayLine || paper.takeawayHook || paper.takeawayStat || "").trim());
  // The claim wears the mark and the spoken line follows it plain — one
  // conclusion, with the highlight on the sentence that earns it.
  const lead = startCap(claim || takeaway);
  const rest = claim && takeaway && takeaway !== claim ? takeaway : "";

  const hasSplit = findings.length > 0 && !!lead;

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
        gap: 18,
        overflow: "hidden",
      }}
    >
      <div>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14 }}>
          <h3 style={{ ...DISPLAY_SM, margin: 0, flex: 1 }}>
            {paper.plainName || paper.title}
          </h3>
          {(loggedIn || onSignedOutSaveChange) && (
            <BookmarkToggle paper={paper} initial={initialBookmarked} showLabel onSignedOutSaveChange={onSignedOutSaveChange} />
          )}
        </div>
        {byline && <div style={{ ...BODY_SM, fontStyle: "italic", color: DIM, marginTop: 2 }}>{byline}</div>}
        {opening ? (
          <>
            <FoundationalLead text={opening} style={heroStyle(22)} />
            {/* The paper's own opening sentence, demoted: on a foundational card
                the line worth setting large is why it still matters. */}
            {hero && <p style={{ ...BODY_STYLE, color: DIM, margin: "12px 0 0" }}>{hero}</p>}
          </>
        ) : (
          hero && <p style={heroStyle(foundational ? 22 : 18)}>{hero}</p>
        )}
      </div>

      {(findings.length > 0 || lead) && (
        <div className={hasSplit ? "paper-card-split" : undefined}>
          {findings.length > 0 && (
            <CardColumn heading={findingsLabel}>
              <FindingList items={findings} />
            </CardColumn>
          )}
          {lead && (
            <CardColumn heading="Takeaway">
              <p style={{ ...READING_BODY, margin: 0 }}>
                <span style={{ background: mark, boxDecorationBreak: "clone", WebkitBoxDecorationBreak: "clone", padding: "2px 4px", fontWeight: 600 }}>
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
 * Title, byline, and optionally one line of substance. No hero, no tiles, no
 * metadata rail.
 *
 * The reading list passes `preview` (the companion's "remember") and a
 * `footnote`, because a shelf of titles alone tells you nothing about why any
 * of them is worth an evening. The preview is clamped to three lines so a grid
 * row stays even; the card lifts on hover like every other clickable frame.
 */
function CompactCard({ paper, index, loggedIn, initialBookmarked, onSignedOutSaveChange, onOpen, onUnsaved, compareMode, isSelected, onSelect, preview, footnote }: PaperCardProps) {
  const foundational = paper.category === "foundational";
  const byline = paperByline(paper);
  // On the shelf the lead takes the preview's place. A foundational paper on the
  // vault grid used to say nothing about itself at all beyond the gold frame.
  const opening = foundational && paper.foundationalReason
    ? foundationalLead(paper.foundationalReason)
    : null;

  const activate = () => {
    if (compareMode) return onSelect?.(paper);
    if (onOpen) return onOpen(paper);
    if (paper.sourceUrl) window.open(paper.sourceUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <div
      onClick={activate}
      className="ds-lift"
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
        ) : (loggedIn || onSignedOutSaveChange) ? (
          <BookmarkToggle
            paper={paper}
            initial={initialBookmarked}
            onUnsaved={onUnsaved}
            showLabel
            onSignedOutSaveChange={onSignedOutSaveChange}
          />
        ) : null}
      </div>

      {byline && <div style={{ ...BODY_SM, fontStyle: "italic", color: DIM }}>{byline}</div>}

      {opening ? (
        <FoundationalLead text={opening} style={{ ...BODY_STYLE, margin: "2px 0 0", ...CLAMP_3 }} />
      ) : preview ? (
        <p style={{ ...BODY_STYLE, margin: "2px 0 0", ...CLAMP_3 }}>{preview}</p>
      ) : null}

      {footnote && <div style={{ marginTop: "auto", paddingTop: 4 }}>{footnote}</div>}
    </div>
  );
}

/**
 * The foundational lead.
 *
 * There is no eyebrow and no Significance panel any more. Between them they put
 * a mono all-caps Label and a Display/SM heading over a filled box around one
 * sentence, on a card that already carries a title, a byline, a hero, findings
 * and a takeaway: two headings for one sentence, and the label said the same
 * thing the gold frame already says.
 *
 * The card now says what it is in the course of saying why it matters. The
 * pipeline writes one spoken line ("Today you have a Foundational Text: ...")
 * which takes the hero's place, and the paper's own summary drops to Body 15
 * underneath it. The phrase inside that line is the label, the explanation and
 * the whole treatment: capitals, a gold underline, and the same ink tooltip a
 * hard word in the synthesis opens.
 */
const FOUNDATIONAL_TERM = "Foundational Text";

/**
 * The lead sentence, guaranteed to contain the phrase the card draws.
 *
 * The prompt asks for it and gives five worked openings, but the phrase is what
 * carries the entire treatment, so a model that forgets it cannot be allowed to
 * take the label off the card with it. A miscased "foundational text" is
 * recased in place; a line without the phrase at all gets the plainest of the
 * five openings in front of it. Same shape as the banned-words ban: a rule in
 * the prompt and a mechanism after it.
 */
export function foundationalLead(reason: string): string {
  const text = reason.trim();
  if (text.includes(FOUNDATIONAL_TERM)) return text;
  const loose = text.match(/foundational text/i);
  if (loose) return text.replace(loose[0], FOUNDATIONAL_TERM);
  return `Today you have a ${FOUNDATIONAL_TERM}. ${startCap(text)}`;
}

/** The phrase, as a defined term: gold underline, ink tooltip, no icon. */
function FoundationalTerm() {
  const [open, setOpen] = useState(false);
  return (
    <span
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      onClick={(e) => { e.stopPropagation(); setOpen(v => !v); }}
      tabIndex={0}
      role="button"
      aria-label="What is a foundational text?"
      style={{ position: "relative", cursor: "help", borderBottom: `2px solid ${GOLD}`, whiteSpace: "nowrap" }}
    >
      {FOUNDATIONAL_TERM}
      {open && (
        <span style={{ position: "absolute", top: "calc(100% + 8px)", left: 0, zIndex: 40, pointerEvents: "none" }}>
          <InkTip>
            Earlier thinking that set the terms of the argument, giving today&rsquo;s newer work something to build on, revise, or push against.
          </InkTip>
        </span>
      )}
    </span>
  );
}

function FoundationalLead({ text, style }: { text: string; style: React.CSSProperties }) {
  const at = text.indexOf(FOUNDATIONAL_TERM);
  if (at < 0) return <p style={style}>{text}</p>;
  return (
    <p style={style}>
      {text.slice(0, at)}
      <FoundationalTerm />
      {text.slice(at + FOUNDATIONAL_TERM.length)}
    </p>
  );
}

/** The card's big line: the foundational lead, or the paper's own first sentence. */
function heroStyle(size: 18 | 22): React.CSSProperties {
  return {
    fontFamily: DISPLAY, fontSize: size, fontWeight: 700, letterSpacing: "-0.02em",
    lineHeight: size === 22 ? "28px" : "26px", color: INK, margin: "14px 0 0",
  };
}

/** Three lines, so a shelf row stays even whatever it is holding. */
const CLAMP_3: React.CSSProperties = {
  display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden",
};

/** Body text at the reading size — exported so surfaces don't restate it. */
export const READING_BODY: React.CSSProperties = { ...BODY_STYLE, lineHeight: "26px" };
