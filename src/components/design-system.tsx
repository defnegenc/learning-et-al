"use client";

import React from "react";

/*
 * Learning et al. — the short menu, in code.
 *
 * The Paper file "Design system — the short menu" is the source of truth; this
 * file is its only implementation. Six neutrals, two acids, a ten-slot
 * spectrum, one gold. Five type styles. Two borders, one shadow, no radius.
 *
 * Rules that keep it short:
 *  - No surface may invent a hex, a type size, a border width or a shadow
 *    offset. If you need one, it goes in the menu first.
 *  - Mono is structure only — section eyebrows and nav tabs. Anything that
 *    names a thing (tags, chips, the venue line) is set in the body face.
 *  - The spectrum has ONE vocabulary read three ways: fields take a fixed slot,
 *    keyword tags take a slot by hash of the word, card washes take a slot by
 *    position in the digest. Never mix the indexes.
 */

/* ────────────────────────────────────────────────────────────────────────────
   Colour
   ──────────────────────────────────────────────────────────────────────────── */

/** Neutrals — six, down from fourteen. */
export const INK = "#1a1a1a";      // text, borders, fills
export const DIM = "#444444";      // bylines, secondary copy
export const MUTED = "#888888";    // every mono label
export const RULE = "#dddddd";     // hairlines, idle borders
export const FIELD = "#e8e8e8";    // the page behind cards
export const SURFACE = "#ffffff";  // cards, panels

/** Acid — two. Ink only, never a fill. The one place this product is loud. */
export const ACID_GREEN = "#38b000"; // confirmation: saved, connected, done
export const ACID_PINK = "#ff007f";  // anything that failed

/** Gold — one. The foundational frame, and nothing else. */
export const GOLD = "#c9a227";

/**
 * The spectrum — ten slots, ordered by hue. Index it three ways and never
 * interchange them: `fieldSlot` (identity), `wordSlot` (keyword tags),
 * `wash` (a card's position in the digest).
 */
export const SPECTRUM = [
  "#fecaca", // 00 Medicine
  "#fed7aa", // 01 Physics & Engineering
  "#fde68a", // 02 Business & Finance
  "#d9f99d", // 03 Education
  "#bbf7d0", // 04 Biology
  "#99f6e4", // 05 Sustainability
  "#bfdbfe", // 06 Computer Science
  "#ddd6fe", // 07 Social Sciences
  "#f5d0fe", // 08 Philosophy & Ethics
  "#fbcfe8", // 09 Design & Art
] as const;

/**
 * A card's two hues. Card i takes slot i×3 and the one next to it: adjacent
 * slots are analogous, so a card reads as one hue with variation, and stepping
 * three slots per card puts the next card a third of the way round the wheel —
 * no two cards on screen are ever close. Card 4, if it exists, lands on 9+0.
 *
 * This one stride replaces the old PALETTES / HOVER_PALETTES / CARD_PALETTES /
 * SOURCE_PALETTES tables, which is why the wash index can no longer drift
 * between two files.
 */
export function washSlots(index: number): [string, string] {
  const i = ((index % SPECTRUM.length) + SPECTRUM.length) % SPECTRUM.length;
  return [SPECTRUM[(i * 3) % SPECTRUM.length], SPECTRUM[(i * 3 + 1) % SPECTRUM.length]];
}

/** Hover darkens the same two hues rather than swapping in a second table. */
const darken = (hex: string) => `color-mix(in oklab, ${hex} 86%, ${INK})`;

/**
 * The card wash — three soft corner blobs on white, sized in absolute pixels so
 * a compact card and a full-width one carry the same weight of colour.
 *
 * The wash is wayfinding, not identity: it is what lets a highlighted paper
 * name in the synthesis match its card. So it is stable per position and, above
 * all, distinct between the cards on screen. If it were field-derived, two
 * Biology papers in one digest would get the same wash and the highlights would
 * stop resolving.
 */
export function wash(index: number, hover = false): React.CSSProperties {
  const [a, b] = washSlots(index);
  return washFromHues(hover ? darken(a) : a, hover ? darken(b) : b);
}

/**
 * The foundational card's two hues — fixed slots 02 + 01. It isn't competing for
 * wayfinding, because the gold frame already says which card it is.
 *
 * This is the pair a foundational paper marks type with, and it is deliberately
 * NOT `GOLD`. Gold is a line colour: the frame, its shadow, the reason rule and
 * the eye. Behind a word it is far too dark to read a highlight through, and it
 * made a foundational paper's marks look like a different species from every
 * other paper's pastel ones. Slots 02 + 01 are the light gold and light orange
 * the card is already washed in, so the mark matches its own card exactly the
 * way `washSlots` does for everything else.
 */
export function foundationalSlots(): [string, string] {
  return [SPECTRUM[2], SPECTRUM[1]];
}

export function foundationalWash(hover = false): React.CSSProperties {
  const [a, b] = foundationalSlots();
  const c1 = hover ? darken(a) : a;
  const c2 = hover ? darken(b) : b;
  return {
    background: [
      `radial-gradient(circle 180px at 0 0, ${c1} 0%, transparent 48%)`,
      `radial-gradient(circle 190px at 100% 6px, ${c2} 0%, transparent 48%)`,
      `radial-gradient(circle 170px at calc(100% - 10px) 100%, ${c1} 0%, transparent 46%)`,
      `linear-gradient(135deg, color-mix(in oklab, ${c1} 34%, ${SURFACE}) 0%, ${SURFACE} 48%, color-mix(in oklab, ${c2} 32%, ${SURFACE}) 100%)`,
      SURFACE,
    ].join(", "),
  };
}

function washFromHues(c1: string, c2: string): React.CSSProperties {
  return {
    background: [
      `radial-gradient(circle 170px at 6px 6px, ${c1} 0%, transparent 42%)`,
      `radial-gradient(circle 170px at calc(100% - 6px) 12px, ${c2} 0%, transparent 42%)`,
      `radial-gradient(circle 156px at calc(100% - 12px) 100%, ${c1} 0%, transparent 42%)`,
      SURFACE,
    ].join(", "),
  };
}

/**
 * A keyword's slot — by hash of the word, so the same concept is the same
 * colour everywhere it appears, in any digest, on any surface.
 */
export function wordSlot(word: string): string {
  const s = word.toLowerCase().trim();
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 1000003;
  return SPECTRUM[h % SPECTRUM.length];
}

/* ────────────────────────────────────────────────────────────────────────────
   Type — five styles
   ──────────────────────────────────────────────────────────────────────────── */

export const DISPLAY = "var(--font-display)";
export const BODY = "var(--font-body)";
export const MONO = "var(--font-mono)";

/** The digest's question, page titles, the hero line on a card. */
export const DISPLAY_LG: React.CSSProperties = {
  fontFamily: DISPLAY, fontSize: 32, fontWeight: 700, letterSpacing: "-0.02em", lineHeight: "40px", color: INK,
};

/** Card titles, lens labels and every button. Upper. */
export const DISPLAY_SM: React.CSSProperties = {
  fontFamily: DISPLAY, fontSize: 16, fontWeight: 700, letterSpacing: "-0.01em", lineHeight: "20px",
  textTransform: "uppercase", color: INK,
};

/**
 * Section eyebrows and nav tabs — nothing else. If it names a thing rather than
 * the machinery, it is not a Label.
 */
export const LABEL_STYLE: React.CSSProperties = {
  fontFamily: MONO, fontSize: 12, fontWeight: 700, letterSpacing: "0.12em", lineHeight: "16px",
  textTransform: "uppercase", color: MUTED,
};

export const BODY_STYLE: React.CSSProperties = {
  fontFamily: BODY, fontSize: 15, fontWeight: 400, lineHeight: "24px", color: INK,
};

/** Tags, chips, bylines. Weight 600 and italic are modifiers, not extra styles. */
export const BODY_SM: React.CSSProperties = {
  fontFamily: BODY, fontSize: 13, fontWeight: 400, lineHeight: "20px", color: INK,
};

/* ────────────────────────────────────────────────────────────────────────────
   Geometry — two borders, one shadow, no radius
   ──────────────────────────────────────────────────────────────────────────── */

export const HAIRLINE = `1px solid ${RULE}`;        // rules between rows
export const BORDER_HAIR = `1px solid ${INK}`;      // tags
export const BORDER = `2px solid ${INK}`;           // everything structural
export const SHADOW = `5px 5px 0 0 ${INK}`;         // anything that lifts
export const SHADOW_GOLD = `5px 5px 0 0 ${GOLD}`;

/* ────────────────────────────────────────────────────────────────────────────
   Primitives
   ──────────────────────────────────────────────────────────────────────────── */

/**
 * The ONE full-page loading indicator — "the stamp". A hard square turns in 90°
 * steps while its offset shadow walks the spectrum, so the wait carries the
 * product's own colour rather than a generic spinner.
 *
 * Every surface that waits on a first load renders this as its sole page
 * content, so it pins to the viewport centre — auth → digest holds the stamp on
 * the same pixel across the handoff. Don't add a second page-level loader
 * shape, and don't animate it toward a percentage.
 *
 * `travelling` is the ONE variant, for the one wait long enough to deserve a
 * show: a new user's first digest. Same stamp, same 90° turn, but it walks a
 * track while the shadow steps the FULL spectrum in hue order, 00 → 09, one
 * slot per hop. At the end it snaps back to the left like a carriage return —
 * the loop is meant to be visible as a loop. It is still indeterminate: ten
 * hops are ten hops, not ten percent each, and the pipeline's percent-done is
 * genuinely unknown. Inline, not fixed, because it sits above a headline
 * rather than owning the page.
 */
const STAMP_SLOTS = [SPECTRUM[0], SPECTRUM[3], SPECTRUM[6], SPECTRUM[9]];

const STAMP = 30;                 // the stamp's edge
const HOP = 26;                   // one step of the walk — just under the stamp's
                                  // width, so it reads as walking, not jumping
const SHADOW_OFFSET = 5;          // the one shadow, and the extra extent it paints
const TRACK = HOP * (SPECTRUM.length - 1) + STAMP + SHADOW_OFFSET;

/**
 * Ten keyframes, one per spectrum slot. `steps(1, end)` holds each frame for its
 * whole interval and never renders the 100% frame, so 100% only exists to close
 * the loop. Rotating 90° per hop lands on 900° at the wrap, which for a square is
 * the same face as 0° — the turn reads continuous across the carriage return.
 */
const travelFrames = SPECTRUM.map((hue, i) =>
  `${(i / SPECTRUM.length) * 100}% { transform: translateX(${i * HOP}px) rotate(${i * 90}deg); box-shadow: ${SHADOW_OFFSET}px ${SHADOW_OFFSET}px 0 0 ${hue} }`
).join("\n        ");

export function PageLoader({ travelling = false }: { travelling?: boolean } = {}) {
  const stamp = { width: STAMP, height: STAMP, border: BORDER, background: SURFACE };

  if (travelling) {
    return (
      <div
        role="status"
        aria-label="Generating your first digest"
        style={{ width: TRACK, maxWidth: "100%", height: STAMP + SHADOW_OFFSET }}
      >
        <style>{`
        @keyframes dsStampWalk {
        ${travelFrames}
          100% { transform: translateX(0) rotate(0deg); box-shadow: ${SHADOW_OFFSET}px ${SHADOW_OFFSET}px 0 0 ${SPECTRUM[0]} }
        }
        .ds-stamp-walk { animation: dsStampWalk 2s steps(1, end) infinite; }
        @media (prefers-reduced-motion: reduce) {
          .ds-stamp-walk { animation: none; box-shadow: ${SHADOW_OFFSET}px ${SHADOW_OFFSET}px 0 0 ${SPECTRUM[0]}; }
        }
      `}</style>
        <div className="ds-stamp-walk" style={stamp} />
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-10 flex items-center justify-center pointer-events-none"
      role="status"
      aria-label="Loading"
    >
      <style>{`
        @keyframes dsStamp {
          0%   { transform: rotate(0deg);   box-shadow: 5px 5px 0 0 ${STAMP_SLOTS[0]} }
          25%  { transform: rotate(90deg);  box-shadow: 5px 5px 0 0 ${STAMP_SLOTS[1]} }
          50%  { transform: rotate(180deg); box-shadow: 5px 5px 0 0 ${STAMP_SLOTS[2]} }
          75%  { transform: rotate(270deg); box-shadow: 5px 5px 0 0 ${STAMP_SLOTS[3]} }
          100% { transform: rotate(360deg); box-shadow: 5px 5px 0 0 ${STAMP_SLOTS[0]} }
        }
        .ds-stamp { animation: dsStamp 1.8s steps(1, end) infinite; }
        @media (prefers-reduced-motion: reduce) {
          .ds-stamp { animation: none; box-shadow: 5px 5px 0 0 ${STAMP_SLOTS[0]}; }
        }
      `}</style>
      <div className="ds-stamp" style={stamp} />
    </div>
  );
}

/**
 * The wordmark. A lockup, not a type style — Display/SM with the label's
 * tracking opened up. (The menu retired "Wordmark" as a style of its own,
 * which is what took Space Grotesk out of the product entirely.)
 */
export function Wordmark({ compact = false }: { compact?: boolean }) {
  return (
    <span
      style={{
        ...DISPLAY_SM,
        fontSize: compact ? 14 : 16,
        letterSpacing: "0.12em",
        whiteSpace: "nowrap",
      }}
    >
      Learning et al.
    </span>
  );
}

/**
 * The mono eyebrow — one of the two sanctioned mono uses. Name the machinery
 * (a section, a mode, a step), never the content.
 */
export function Label({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ ...LABEL_STYLE, ...style }}>{children}</div>;
}

/** Nav tab — the other sanctioned mono use. Active gets an ink underline. */
export function NavTab({ active, onClick, children }: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        ...LABEL_STYLE,
        padding: "4px 0",
        border: "none",
        background: "transparent",
        color: active ? INK : MUTED,
        borderBottom: `2px solid ${active ? INK : "transparent"}`,
        cursor: "pointer",
        transition: "color 140ms",
        display: "flex",
        alignItems: "center",
        gap: 5,
      }}
    >
      {children}
    </button>
  );
}

/** Small section heading — Display/SM. Use where a section genuinely needs a name. */
export function SectionLabel({ children, style }: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return <div style={{ ...DISPLAY_SM, ...style }}>{children}</div>;
}

/** Display heading. `lg` is the hero; `sm` is Display/SM, the card-title voice. */
export function PageTitle({ children, size = "lg", style }: {
  children: React.ReactNode;
  size?: "sm" | "lg";
  style?: React.CSSProperties;
}) {
  return (
    <h2 style={{ ...(size === "lg" ? DISPLAY_LG : DISPLAY_SM), margin: 0, ...style }}>
      {children}
    </h2>
  );
}

/**
 * The button. Folded into Display/SM — one size, upper, no tracking of its own.
 * `primary` fills with ink, `outline` stays white; `plain` drops the frame for
 * the quiet third action ("Clear all", "Done") that shouldn't compete.
 */
export function ActionButton({ children, onClick, variant = "outline", disabled = false, shadow = true, style, type, title }: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "outline" | "plain";
  disabled?: boolean;
  shadow?: boolean;
  style?: React.CSSProperties;
  type?: "button" | "submit";
  title?: string;
}) {
  const plain = variant === "plain";
  return (
    <button
      type={type ?? "button"}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      title={title}
      className={shadow && !plain && !disabled ? "ds-lift" : undefined}
      style={{
        ...DISPLAY_SM,
        padding: plain ? "8px 4px" : "12px 22px",
        background: variant === "primary" ? INK : plain ? "transparent" : SURFACE,
        color: variant === "primary" ? SURFACE : INK,
        border: plain ? "none" : BORDER,
        boxShadow: shadow && !plain ? SHADOW : "none",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.4 : 1,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        ...style,
      }}
    >
      {children}
    </button>
  );
}

/**
 * The top bar. One geometry — 52px, an ink hairline, wordmark left — with
 * whatever controls the surface needs on the right, so the bar never shifts
 * between signed-out, signed-in and loading.
 */
export function SiteHeader({ right, style }: { right?: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <header
      className="sticky top-0 z-40 flex items-center justify-between px-4 md:px-8"
      style={{ borderBottom: `1px solid ${INK}`, background: SURFACE, height: 52, ...style }}
    >
      <h1 className="hidden md:block" style={{ margin: 0 }}><Wordmark /></h1>
      <span className="block md:hidden"><Wordmark compact /></span>
      {right}
    </header>
  );
}

/**
 * Page header — the title-and-one-sentence opening every full page uses.
 * No mono eyebrow above the title, no rule under it: the whitespace separates.
 */
export function PageHeader({ title, children, action }: {
  title: React.ReactNode;
  children?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 20, marginBottom: 40, flexWrap: "wrap" }}>
      <div>
        <h1 style={{ ...DISPLAY_LG, margin: "0 0 8px" }}>{title}</h1>
        {children && (
          <p style={{ ...BODY_STYLE, color: DIM, margin: 0, maxWidth: 560 }}>{children}</p>
        )}
      </div>
      {action}
    </div>
  );
}

/**
 * The frame. A 2px ink border and one unblurred 5px offset — the single
 * container shape in the product. `media` renders a flush top region divided by
 * a border; everything else is body.
 */
export function Card({ children, media, onClick, style }: {
  children?: React.ReactNode;
  media?: React.ReactNode;
  onClick?: () => void;
  style?: React.CSSProperties;
}) {
  return (
    <div
      onClick={onClick}
      className={onClick ? "ds-lift" : undefined}
      style={{
        border: BORDER,
        background: SURFACE,
        boxShadow: SHADOW,
        cursor: onClick ? "pointer" : undefined,
        ...style,
      }}
    >
      {media && (
        <div style={{ display: "grid", placeItems: "center", borderBottom: BORDER, padding: 24 }}>
          {media}
        </div>
      )}
      {children && <div style={{ padding: "18px 20px" }}>{children}</div>}
    </div>
  );
}

/** Card grid — the standard responsive shelf. Same geometry everywhere. */
export function CardGrid({ children, min = 260 }: { children: React.ReactNode; min?: number }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fill, minmax(${min}px, 1fr))`, gap: 24 }}>
      {children}
    </div>
  );
}

/**
 * A tag. Body face, sentence case, 1px border, no radius, no shadow — the
 * change that stopped each card shouting eleven small things.
 *
 * `glass` sits on a card wash and stays translucent white, because the wash is
 * already carrying the colour. `solid` sits on white and takes its fill from
 * the keyword's own spectrum slot, so the same concept is the same colour
 * wherever it turns up.
 */
export function Tag({ label, variant = "solid", tint, onClick, title, trailing, style }: {
  label: string;
  variant?: "glass" | "solid";
  /** Override the hash-derived fill (e.g. a field's fixed slot). */
  tint?: string;
  onClick?: () => void;
  title?: string;
  trailing?: React.ReactNode;
  style?: React.CSSProperties;
}) {
  const glass = variant === "glass";
  const base: React.CSSProperties = {
    ...BODY_SM,
    fontWeight: 600,
    background: glass ? "rgba(255,255,255,0.55)" : (tint ?? wordSlot(label)),
    border: glass ? "1px solid rgba(26,26,26,0.35)" : BORDER_HAIR,
    padding: "4px 10px",
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    whiteSpace: "nowrap",
    cursor: onClick ? "pointer" : "default",
    ...style,
  };
  if (!onClick) return <span style={base} title={title}>{label}{trailing}</span>;
  return <button style={base} title={title} onClick={onClick}>{label}{trailing}</button>;
}

/**
 * Topic chip — the interest-picker unit. Sentence case in the body face, so a
 * panel of eighty reads as a vocabulary rather than a control array. Idle is
 * white with a dashed rule border; selected takes the field's own spectrum slot
 * at full strength behind a solid ink border. No radius: the 6px on TopicChip
 * and AddChip was the last rounded corner in the product.
 */
export function TopicChip({ label, selected, tint, onClick, onRemove, disabled = false, title }: {
  label: string;
  selected: boolean;
  tint?: string;
  onClick?: () => void;
  onRemove?: () => void;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      className="ds-chip"
      data-selected={selected ? "" : undefined}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      title={title}
      aria-pressed={onClick ? selected : undefined}
      style={{
        ...BODY_SM,
        fontWeight: selected ? 600 : 400,
        background: selected ? (tint ?? SURFACE) : SURFACE,
        border: selected ? BORDER : `2px dashed ${RULE}`,
        color: INK,
        padding: "7px 13px",
        minHeight: 34,
        textAlign: "left",
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        cursor: disabled ? "not-allowed" : onClick ? "pointer" : "default",
        transition: "background 140ms, border-color 140ms",
        opacity: disabled ? 0.35 : 1,
      }}
    >
      {label}
      {onRemove && (
        <span
          role="button"
          aria-label={`Remove ${label}`}
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          style={{ fontSize: 15, lineHeight: 1, opacity: 0.55, cursor: "pointer" }}
        >×</span>
      )}
    </button>
  );
}

/** The "+ Add" chip — dashed ink border, same geometry as TopicChip. */
export function AddChip({ onClick, disabled = false, title, label = "+ Add" }: {
  onClick: () => void;
  disabled?: boolean;
  title?: string;
  label?: string;
}) {
  return (
    <button
      className="ds-chip"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      title={title}
      style={{
        ...BODY_SM,
        fontWeight: 600,
        background: SURFACE,
        border: `2px dashed ${INK}`,
        color: INK,
        padding: "7px 13px",
        minHeight: 34,
        display: "inline-flex",
        alignItems: "center",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.35 : 1,
        transition: "background 140ms",
      }}
    >
      {label}
    </button>
  );
}

/**
 * Segmented control — the one "pick exactly one of these" shape. Cells share a
 * 2px ink frame via -2px margins so the group reads as a single object; the
 * active cell inverts to ink.
 */
export function Segmented<T extends string>({ options, value, onChange, style }: {
  options: { key: T; label: React.ReactNode }[];
  value: T;
  onChange: (key: T) => void;
  style?: React.CSSProperties;
}) {
  return (
    <div style={{ display: "flex", ...style }}>
      {options.map(opt => {
        const active = opt.key === value;
        return (
          <button
            key={opt.key}
            onClick={() => onChange(opt.key)}
            aria-pressed={active}
            style={{
              ...DISPLAY_SM,
              flex: 1,
              padding: "10px 12px",
              border: BORDER,
              marginRight: -2,
              background: active ? INK : SURFACE,
              color: active ? SURFACE : INK,
              cursor: "pointer",
              minHeight: 42,
              transition: "background 140ms, color 140ms",
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * The ink tooltip — one object for every "what does this mean" in the product:
 * hard-word definitions in the synthesis, a paper's gist behind its name, and
 * the foundational card's eye. Square, no radius, hard shadow.
 *
 * `BODY_SM` is spread FIRST and `color` set after it. Every type style in this
 * file carries its own colour, and `BODY_SM`'s is `INK` — spread last, it
 * overwrote the white and every tooltip in the product rendered ink on ink. A
 * black box with invisible text is what that looked like. Any inverted surface
 * added here must set its colour after the type style for the same reason.
 */
export function InkTip({ children, label, style }: {
  children: React.ReactNode;
  /** Optional mono line above the body — the venue, the term, the source. */
  label?: string;
  style?: React.CSSProperties;
}) {
  return (
    <span
      style={{
        ...BODY_SM,
        display: "block",
        width: 280,
        maxWidth: "80vw",
        background: INK,
        padding: "10px 14px",
        boxShadow: SHADOW,
        ...style,
        color: SURFACE,
      }}
    >
      {label && (
        <span style={{ ...LABEL_STYLE, display: "block", color: RULE, marginBottom: 5 }}>{label}</span>
      )}
      <span style={{ color: SURFACE }}>{children}</span>
    </span>
  );
}

/** Text input — an ink frame, body face. The one input shape. */
export function TextInput({ value, onChange, onKeyDown, placeholder, ariaLabel, autoFocus, type = "text", style }: {
  value: string;
  onChange: (v: string) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  placeholder?: string;
  ariaLabel?: string;
  autoFocus?: boolean;
  type?: "text" | "password";
  style?: React.CSSProperties;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      onKeyDown={onKeyDown}
      placeholder={placeholder}
      aria-label={ariaLabel}
      autoFocus={autoFocus}
      style={{
        ...BODY_STYLE,
        width: "100%",
        border: BORDER,
        background: SURFACE,
        padding: "10px 13px",
        minHeight: 44,
        outline: "none",
        ...style,
      }}
    />
  );
}
