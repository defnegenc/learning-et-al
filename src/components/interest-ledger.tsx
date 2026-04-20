"use client";

import { useState } from "react";
import { FIELD_HIERARCHY, type S2Field } from "@/lib/field-hierarchy";

export interface SelectedTopic {
  keyword: string;
  field: S2Field;
  fieldLabel: string;
  color: string;
}

// Per-category 2-color gradient palettes — one distinct family per row,
// so a panel of tags reads as a single family, not a rainbow.
const CATEGORY_PALETTES: Record<string, [string, string]> = {
  "Computer Science":       ["#D0E3F7", "#C8F0D8"], // blue → mint
  "Design & Art":           ["#FFD6E0", "#F7D9E8"], // pink → rose
  "Biology":                ["#C8F0D8", "#FFE89A"], // mint → yellow
  "Medicine":               ["#FFE89A", "#FFD6E0"], // yellow → pink
  "Social Sciences":        ["#E2D6F7", "#D0E3F7"], // lavender → blue
  "Physics & Engineering":  ["#D0E3F7", "#E2D6F7"], // blue → lavender
  "Business & Finance":     ["#FFE89A", "#C8F0D8"], // yellow → mint
  "Sustainability":         ["#C8F0D8", "#D0E3F7"], // mint → blue
  "Philosophy & Ethics":    ["#F7D9E8", "#E2D6F7"], // rose → lavender
  "Education":              ["#FFD6E0", "#FFE89A"], // pink → yellow
};

function palette(category: string): [string, string] {
  return CATEGORY_PALETTES[category] || ["#E2D6F7", "#D0E3F7"];
}

function tagGradient([a, b]: [string, string]) {
  return `linear-gradient(135deg, ${a} 0%, ${b} 100%)`;
}

// Glass tag — inactive = dashed outline, active = gradient fill
function GlassTag({
  label,
  active,
  palette: pal,
  onClick,
  onRemove,
}: {
  label: string;
  active: boolean;
  palette: [string, string];
  onClick?: () => void;
  onRemove?: () => void;
}) {
  return (
    <span
      onClick={onClick}
      style={{
        background: active ? tagGradient(pal) : "transparent",
        color: "#1a1a1a",
        border: active ? "1px solid rgba(26,26,26,0.25)" : "1px dashed rgba(26,26,26,0.4)",
        fontFamily: "var(--font-mono), monospace",
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: 1.2,
        padding: "5px 10px",
        textTransform: "uppercase",
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        lineHeight: 1,
        borderRadius: 3,
        whiteSpace: "nowrap",
        cursor: onClick ? "pointer" : "default",
        transition: "all 120ms",
        boxShadow: active ? "inset 0 1px 0 rgba(255,255,255,0.5)" : "none",
        opacity: active ? 1 : 0.75,
      }}
    >
      {label}
      {onRemove && (
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          style={{
            background: "none",
            border: "none",
            color: "inherit",
            cursor: "pointer",
            padding: 0,
            fontSize: 12,
            lineHeight: 1,
            fontFamily: "inherit",
            opacity: 0.7,
          }}
          aria-label={`Remove ${label}`}
        >×</button>
      )}
    </span>
  );
}

// Inline "+ ADD" button that expands to a small input for custom topics
function RowAdder({ onAdd }: { onAdd: (topic: string) => void }) {
  const [value, setValue] = useState("");
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{
          background: "transparent",
          border: "1px dashed #1a1a1a",
          fontFamily: "var(--font-mono), monospace",
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: 1.2,
          color: "#1a1a1a",
          padding: "5px 10px",
          cursor: "pointer",
          textTransform: "uppercase",
          borderRadius: 3,
        }}
      >+ ADD</button>
    );
  }

  const commit = () => {
    const trimmed = value.trim();
    if (trimmed) onAdd(trimmed);
    setValue("");
    setOpen(false);
  };

  return (
    <input
      autoFocus
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit();
        if (e.key === "Escape") { setValue(""); setOpen(false); }
      }}
      onBlur={commit}
      placeholder="topic…"
      style={{
        background: "rgba(255,255,255,0.55)",
        border: "1px solid rgba(26,26,26,0.35)",
        backdropFilter: "blur(6px)",
        fontFamily: "var(--font-mono), monospace",
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: 1.2,
        color: "#1a1a1a",
        padding: "5px 10px",
        outline: "none",
        borderRadius: 3,
        width: 140,
      }}
    />
  );
}

// Custom topics added by the user per category, keyed by FIELD_HIERARCHY key.
export type CustomTopics = Record<string, string[]>;

export interface InterestLedgerProps {
  selected: SelectedTopic[];
  custom: CustomTopics;
  onToggle: (topic: string, fieldKey: string) => void;
  onAddCustom: (fieldKey: string, topic: string) => void;
  onRemoveCustom: (fieldKey: string, topic: string) => void;
  /** Optional max selections. Toggling beyond max is ignored. */
  maxSelected?: number;
}

export function InterestLedger({
  selected,
  custom,
  onToggle,
  onAddCustom,
  onRemoveCustom,
}: InterestLedgerProps) {
  const selectedSet = new Set(selected.map(s => s.keyword));
  const entries = Object.entries(FIELD_HIERARCHY);

  return (
    <div style={{ border: "1px solid #1a1a1a", background: "#fff" }}>
      {entries.map(([fieldKey, fieldDef], i) => {
        const pal = palette(fieldKey);
        const customTopics = custom[fieldKey] || [];
        const allTopics = [...fieldDef.topics, ...customTopics];
        const selCount = allTopics.filter((t) => selectedSet.has(t)).length;
        const isLast = i === entries.length - 1;

        return (
          <div
            key={fieldKey}
            style={{
              display: "grid",
              gridTemplateColumns: "160px 1fr",
              gap: 20,
              padding: "22px 24px",
              borderBottom: isLast ? "none" : "1px solid #1a1a1a",
              background: "#fff",
            }}
          >
            {/* Left — category name + count */}
            <div>
              <div
                style={{
                  fontFamily: "var(--font-display), sans-serif",
                  fontSize: 18,
                  fontWeight: 700,
                  letterSpacing: -0.5,
                  lineHeight: 1.15,
                  color: "#1a1a1a",
                }}
              >{fieldKey}</div>
              <div
                style={{
                  fontFamily: "var(--font-mono), monospace",
                  fontSize: 9,
                  letterSpacing: 2,
                  color: "#555",
                  textTransform: "uppercase",
                  fontWeight: 700,
                  marginTop: 6,
                }}
              >{selCount} / {allTopics.length}</div>
            </div>

            {/* Middle — glass tags */}
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 6,
                alignContent: "flex-start",
              }}
            >
              {allTopics.map((topic) => {
                const isCustom = customTopics.includes(topic);
                return (
                  <GlassTag
                    key={topic}
                    label={topic}
                    active={selectedSet.has(topic)}
                    palette={pal}
                    onClick={() => onToggle(topic, fieldKey)}
                    onRemove={isCustom ? () => onRemoveCustom(fieldKey, topic) : undefined}
                  />
                );
              })}
              <RowAdder onAdd={(t) => onAddCustom(fieldKey, t)} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Hook that maintains the canonical SelectedTopic[] + CustomTopics state.
 *  Returns the handlers expected by <InterestLedger />. */
export function useInterestLedger(initialSelected: SelectedTopic[] = []) {
  const [selected, setSelected] = useState<SelectedTopic[]>(initialSelected);
  const [custom, setCustom] = useState<CustomTopics>({});

  const toggle = (topic: string, fieldKey: string) => {
    const fieldDef = FIELD_HIERARCHY[fieldKey];
    if (!fieldDef) return;
    setSelected((prev) => {
      const exists = prev.findIndex((t) => t.keyword === topic);
      if (exists > -1) return prev.filter((t) => t.keyword !== topic);
      if (prev.length >= 20) return prev;
      return [
        ...prev,
        {
          keyword: topic,
          field: fieldDef.s2Field,
          fieldLabel: fieldDef.label,
          color: fieldDef.color,
        },
      ];
    });
  };

  const addCustom = (fieldKey: string, topic: string) => {
    const fieldDef = FIELD_HIERARCHY[fieldKey];
    if (!fieldDef) return;
    const trimmed = topic.trim();
    if (!trimmed) return;
    setCustom((prev) => {
      const existing = prev[fieldKey] || [];
      if (existing.some((x) => x.toLowerCase() === trimmed.toLowerCase())) return prev;
      return { ...prev, [fieldKey]: [...existing, trimmed] };
    });
    setSelected((prev) => {
      if (prev.some((t) => t.keyword === trimmed)) return prev;
      if (prev.length >= 20) return prev;
      return [
        ...prev,
        {
          keyword: trimmed,
          field: fieldDef.s2Field,
          fieldLabel: fieldDef.label,
          color: fieldDef.color,
        },
      ];
    });
  };

  const removeCustom = (fieldKey: string, topic: string) => {
    setCustom((prev) => ({
      ...prev,
      [fieldKey]: (prev[fieldKey] || []).filter((x) => x !== topic),
    }));
    setSelected((prev) => prev.filter((t) => t.keyword !== topic));
  };

  return { selected, custom, toggle, addCustom, removeCustom, setSelected, setCustom };
}
