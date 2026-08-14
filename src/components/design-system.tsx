"use client";

import React from "react";
import { Loader2 } from "lucide-react";

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
 * The ONE full-page loading indicator. Every surface that waits on a first load
 * (auth resolving, digest fetching, vault opening) renders this, in the same
 * place under the header, so a multi-step load reads as a single wait instead of
 * a chain of different spinners. Don't add another page-level spinner shape.
 */
export function PageLoader() {
  return (
    <div className="flex items-center justify-center py-20" role="status" aria-label="Loading">
      <Loader2 className="size-6 animate-spin" style={{ color: "#666" }} />
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

/** Mono uppercase eyebrow above a section — "Delivery cadence", drawer titles, etc. */
export function SectionLabel({ children, style }: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        fontFamily: MONO,
        fontSize: "0.6rem",
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "2px",
        color: "#888",
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
        fontSize: size === "md" ? "0.8rem" : "0.65rem",
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.04em",
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
