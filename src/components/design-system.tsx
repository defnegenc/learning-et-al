"use client";

import React from "react";

/*
 * Learning et al. design system — the shared primitives every surface composes.
 * The Today page is the reference look; Vault, Settings, and Onboarding use
 * these instead of restyling their own. Component → usage map lives in
 * docs/design-style.md ("Shared components").
 */

export const INK = "#1a1a1a";
export const MONO = "var(--font-mono), monospace";
export const DISPLAY = "var(--font-display), sans-serif";
export const LOGO = "var(--font-logo), sans-serif";

/**
 * The ONE full-page loading indicator — "the stamp". A hard square turns in 90°
 * steps while its offset shadow cycles the four card palette colours, so the
 * wait carries the product's own rainbow rather than a generic spinner.
 *
 * Every surface that waits on a first load (auth resolving, digest fetching,
 * vault opening) renders this, in the same place under the header, so a
 * multi-step load reads as a single wait. Don't add another page-level loader
 * shape, and don't animate it toward a percentage — see docs/design-style.md.
 */
const STAMP_COLORS = ["#6EE9A8", "#FF85A8", "#60AAE8", "#FFD020"];

export function PageLoader() {
  return (
    <div className="flex items-center justify-center py-20" role="status" aria-label="Loading">
      <style>{`
        @keyframes dsStamp {
          0%   { transform: rotate(0deg);   box-shadow: 5px 5px 0 0 ${STAMP_COLORS[0]} }
          25%  { transform: rotate(90deg);  box-shadow: 5px 5px 0 0 ${STAMP_COLORS[1]} }
          50%  { transform: rotate(180deg); box-shadow: 5px 5px 0 0 ${STAMP_COLORS[2]} }
          75%  { transform: rotate(270deg); box-shadow: 5px 5px 0 0 ${STAMP_COLORS[3]} }
          100% { transform: rotate(360deg); box-shadow: 5px 5px 0 0 ${STAMP_COLORS[0]} }
        }
        .ds-stamp { animation: dsStamp 1.8s steps(1, end) infinite; }
        @media (prefers-reduced-motion: reduce) {
          .ds-stamp { animation: none; box-shadow: 5px 5px 0 0 ${STAMP_COLORS[0]}; }
        }
      `}</style>
      <div className="ds-stamp" style={{ width: 30, height: 30, border: `3px solid ${INK}`, background: "#fff" }} />
    </div>
  );
}

/** Site logo lockup — Space Grotesk, wide tracking. Same everywhere it appears. */
export function Wordmark({ compact = false }: { compact?: boolean }) {
  return (
    <span
      style={{
        fontSize: compact ? "0.95rem" : "1.25rem",
        fontWeight: 700,
        letterSpacing: compact ? "0.12em" : "0.2em",
        textTransform: "uppercase",
        color: INK,
        fontFamily: LOGO,
        whiteSpace: "nowrap",
      }}
    >
      Learning et al.
    </span>
  );
}

/** Mono uppercase tab with an active underline — header nav, settings tabs, vault filters. */
export function NavTab({ active, onClick, children }: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "4px 0",
        fontSize: "0.625rem",
        fontWeight: 600,
        textTransform: "uppercase",
        letterSpacing: "0.12em",
        fontFamily: MONO,
        border: "none",
        background: "transparent",
        color: active ? INK : "#999",
        borderBottom: active ? `1.5px solid ${INK}` : "1.5px solid transparent",
        cursor: "pointer",
        transition: "color 0.15s",
        display: "flex",
        alignItems: "center",
        gap: 5,
      }}
    >
      {children}
    </button>
  );
}

/**
 * Small section heading — display face, sentence case. Replaced the mono
 * uppercase eyebrow (0.6rem, 2px tracking, #888): see the anti-patterns list in
 * docs/design-style.md. Use it where a section genuinely needs a name.
 */
export function SectionLabel({ children, style }: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        fontFamily: DISPLAY,
        fontSize: "0.95rem",
        fontWeight: 700,
        letterSpacing: "-0.01em",
        color: INK,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/** Display-face heading (Cabinet Grotesk) — same voice as the digest title. */
export function PageTitle({ children, size = "md", style }: {
  children: React.ReactNode;
  size?: "sm" | "md" | "lg";
  style?: React.CSSProperties;
}) {
  const fs = size === "lg" ? "2rem" : size === "md" ? "1.4rem" : "1.1rem";
  return (
    <h2
      style={{
        fontFamily: DISPLAY,
        fontSize: fs,
        fontWeight: size === "sm" ? 800 : 700,
        letterSpacing: "-0.02em",
        color: INK,
        margin: 0,
        ...style,
      }}
    >
      {children}
    </h2>
  );
}

/** Brutalist button — same voice as Today's "NEXT SOURCE →" control. */
export function ActionButton({ children, onClick, variant = "outline", size = "md", disabled = false, shadow = true, style }: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "outline";
  size?: "sm" | "md";
  disabled?: boolean;
  shadow?: boolean;
  style?: React.CSSProperties;
}) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      style={{
        fontFamily: DISPLAY,
        fontSize: size === "md" ? "0.9rem" : "0.78rem",
        fontWeight: 700,
        padding: size === "md" ? "10px 18px" : "6px 12px",
        background: variant === "primary" ? INK : "#fff",
        color: variant === "primary" ? "#fff" : INK,
        border: `2px solid ${INK}`,
        boxShadow: shadow ? (size === "md" ? "4px 4px 0 0 rgba(0,0,0,1)" : "2px 2px 0 0 rgba(0,0,0,1)") : "none",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.4 : 1,
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        lineHeight: 1.1,
        transition: "opacity 0.15s",
        ...style,
      }}
    >
      {children}
    </button>
  );
}

/**
 * The top bar. One geometry — 52px, 1px ink rule, wordmark left — with whatever
 * controls the surface needs on the right. Signed-out (sign in), signed-in (nav
 * + settings) and the loading state all use this, so the bar never shifts.
 */
export function SiteHeader({ right }: { right?: React.ReactNode }) {
  return (
    <header
      className="sticky top-0 z-40 flex items-center justify-between px-4 md:px-8"
      style={{ borderBottom: `1px solid ${INK}`, background: "white", height: "52px" }}
    >
      <h1 className="hidden md:block" style={{ margin: 0 }}><Wordmark /></h1>
      <span className="block md:hidden"><Wordmark compact /></span>
      {right}
    </header>
  );
}

/**
 * Page header — the title-and-one-sentence opening every full page uses.
 * Display 2rem, sentence case, with a single plain-language line under it at a
 * readable size. No mono eyebrow above the title, no rule under it.
 */
export function PageHeader({ title, children, action }: {
  title: React.ReactNode;
  children?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 20, marginBottom: 40 }}>
      <div>
        <h1 style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: "2rem", letterSpacing: "-0.03em", color: INK, margin: "0 0 8px" }}>
          {title}
        </h1>
        {children && (
          <p style={{ fontSize: "1rem", color: "#666", margin: 0, maxWidth: 560, lineHeight: 1.6 }}>{children}</p>
        )}
      </div>
      {action}
    </div>
  );
}

/**
 * The frame. A hard 2px border and an unblurred offset shadow — the single
 * container shape in the product. `media` renders a flush top region divided by
 * a border (how the loader cards show their subject); everything else is body.
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
      style={{
        border: `2px solid ${INK}`,
        background: "#fff",
        boxShadow: "6px 6px 0 0 rgba(0,0,0,1)",
        cursor: onClick ? "pointer" : undefined,
        ...style,
      }}
    >
      {media && (
        <div style={{ display: "grid", placeItems: "center", borderBottom: `2px solid ${INK}`, padding: 24 }}>
          {media}
        </div>
      )}
      {children && <div style={{ padding: "16px 18px" }}>{children}</div>}
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

/** Soften a field pastel toward white — the chip fill from the 2026-07-19 reference mock. */
export function chipTint(color?: string | null): string {
  return color ? `color-mix(in srgb, ${color} 45%, white)` : "#fff";
}

/**
 * Topic chip — the interest-picker unit (reference mock, 2026-07-19):
 * idle = white with dashed grey border; selected = soft field tint with solid border.
 * The only place in the system with rounded corners.
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
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      title={title}
      style={{
        background: selected ? chipTint(tint) : "#fff",
        border: selected ? "1.5px solid rgba(26,26,26,0.45)" : "1.5px dashed #c2c2c2",
        borderRadius: 6,
        fontFamily: MONO,
        fontSize: 11,
        fontWeight: selected ? 700 : 600,
        letterSpacing: 1.2,
        textTransform: "uppercase",
        color: selected ? INK : "#444",
        padding: "8px 14px",
        lineHeight: 1,
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        whiteSpace: "nowrap",
        cursor: disabled ? "not-allowed" : onClick ? "pointer" : "default",
        transition: "all 120ms",
        opacity: disabled ? 0.35 : 1,
      }}
    >
      {label}
      {onRemove && (
        <span
          role="button"
          aria-label={`Remove ${label}`}
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          style={{ fontSize: 12, lineHeight: 1, opacity: 0.7, cursor: "pointer" }}
        >×</span>
      )}
    </button>
  );
}

/** The "+ ADD" chip — dashed ink border, bold, same geometry as TopicChip. */
export function AddChip({ onClick, disabled = false, title, label = "+ Add" }: {
  onClick: () => void;
  disabled?: boolean;
  title?: string;
  label?: string;
}) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      title={title}
      style={{
        background: "#fff",
        border: `1.5px dashed ${INK}`,
        borderRadius: 6,
        fontFamily: MONO,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: 1.2,
        textTransform: "uppercase",
        color: INK,
        padding: "8px 14px",
        lineHeight: 1,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.35 : 1,
        transition: "all 120ms",
      }}
    >
      {label}
    </button>
  );
}
