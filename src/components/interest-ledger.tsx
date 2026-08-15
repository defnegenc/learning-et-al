"use client";

import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { FIELD_HIERARCHY, type S2Field } from "@/lib/field-hierarchy";
import { TopicChip, AddChip, INK, DISPLAY } from "@/components/design-system";

// Max interests a user can select. The digest samples 5 candidates/day from the
// whole pool (see docs/algorithm.md Step 1), so this is only a UI guardrail, not
// an algorithmic constraint. Single source of truth — referenced by the ledger's
// chip dimming AND the guards in settings-dialog + the useInterestLedger hook.
export const MAX_INTERESTS = 30;

export interface SelectedTopic {
  keyword: string;
  field: S2Field;
  fieldLabel: string;
  color: string;
}

// Per-category 2-color gradient palettes — one distinct family per row,
// so a panel of tags reads as a single family, not a rainbow.
export const CATEGORY_PALETTES: Record<string, [string, string]> = {
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

// Custom topics added by the user per category, keyed by FIELD_HIERARCHY key.
export type CustomTopics = Record<string, string[]>;

const HAIRLINE = "1px solid rgba(26,26,26,0.12)";

/** "+ Add" at the end of an open field, expanding in place to a small input.
 *  Only ever one on screen — the field you have open. */
function RowAdder({ onAdd, disabled = false }: { onAdd: (topic: string) => void; disabled?: boolean }) {
  const [value, setValue] = useState("");
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <AddChip
        onClick={() => setOpen(true)}
        disabled={disabled}
        title={disabled ? `Remove an interest to add more (max ${MAX_INTERESTS}).` : undefined}
      />
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
      onChange={e => setValue(e.target.value)}
      onKeyDown={e => {
        if (e.key === "Enter") commit();
        if (e.key === "Escape") { setValue(""); setOpen(false); }
      }}
      onBlur={commit}
      placeholder="Your own topic…"
      aria-label="Add your own topic"
      style={{
        border: `1.5px solid ${INK}`, borderRadius: 6, background: "#fff",
        fontSize: "0.85rem", color: INK, padding: "7px 12px",
        minHeight: 34, width: 180, outline: "none",
      }}
    />
  );
}

export interface InterestLedgerProps {
  selected: SelectedTopic[];
  custom: CustomTopics;
  onToggle: (topic: string, fieldKey: string) => void;
  onAddCustom: (fieldKey: string, topic: string) => void;
  onRemoveCustom: (fieldKey: string, topic: string) => void;
  /** Optional max selections. Toggling beyond max is ignored. */
  maxSelected?: number;
}

/**
 * The interest picker: ten fields, one open at a time.
 *
 * Eighty topics rendered flat was a wall, so fields collapse — a field opens if
 * it holds something you picked, and a closed row previews what's inside it
 * (your picks if you have any, else the first few topics). Nothing else is on
 * screen: no search, no filter, no counter. The row header's geometry is fixed,
 * so opening a field can't shift the swatch or the title.
 */
export function InterestLedger({
  selected,
  custom,
  onToggle,
  onAddCustom,
  onRemoveCustom,
  maxSelected = MAX_INTERESTS,
}: InterestLedgerProps) {
  const selectedSet = useMemo(() => new Set(selected.map(s => s.keyword)), [selected]);
  const entries = Object.entries(FIELD_HIERARCHY);
  const atMax = selected.length >= maxSelected;

  // Open the fields the user already has something in — or the first field, so
  // a brand-new picker doesn't read as ten locked drawers.
  const [open, setOpen] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    let any = false;
    for (const [key, def] of entries) {
      const has = def.topics.some(t => selectedSet.has(t));
      init[key] = has;
      any ||= has;
    }
    if (!any && entries.length) init[entries[0][0]] = true;
    return init;
  });

  return (
    <div>
      {/* The only status line, and only when it applies: past the cap the chips
          stop responding, which needs saying. */}
      {atMax && (
        <p style={{ fontSize: "0.85rem", color: "#666", margin: "0 0 4px", paddingTop: 4 }}>
          You&rsquo;re at {maxSelected} topics. Remove one to add another.
        </p>
      )}

      {entries.map(([fieldKey, fieldDef]) => {
        const customTopics = custom[fieldKey] || [];
        const allTopics = [...fieldDef.topics, ...customTopics];
        const selectedHere = allTopics.filter(t => selectedSet.has(t));
        const isOpen = open[fieldKey];
        const preview = selectedHere.length > 0 ? selectedHere : allTopics.slice(0, 4);

        return (
          <div key={fieldKey} style={{ borderBottom: HAIRLINE }}>
            <button
              onClick={() => setOpen(prev => ({ ...prev, [fieldKey]: !prev[fieldKey] }))}
              aria-expanded={isOpen}
              style={{
                display: "block", width: "100%", padding: "16px 0",
                background: "none", border: "none", textAlign: "left", cursor: "pointer",
              }}
            >
              {/* One fixed-height line holds the swatch, the name and the
                  chevron — so none of them move when the field opens. */}
              <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ width: 10, height: 10, background: fieldDef.color, border: `1px solid ${INK}`, flexShrink: 0 }} />
                <span style={{ flex: 1, minWidth: 0, fontFamily: DISPLAY, fontSize: "1.05rem", fontWeight: 700, letterSpacing: "-0.01em", color: INK }}>
                  {fieldKey}
                </span>
                <ChevronDown
                  size={16}
                  style={{ color: "#999", flexShrink: 0, transform: isOpen ? "rotate(180deg)" : "none", transition: "transform 150ms" }}
                />
              </span>
              {!isOpen && (
                <span
                  style={{
                    display: "block", marginTop: 3, paddingLeft: 20,
                    fontSize: "0.85rem", lineHeight: 1.4,
                    color: selectedHere.length > 0 ? "#444" : "#999",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}
                >
                  {preview.join(", ")}
                </span>
              )}
            </button>

            {isOpen && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, paddingBottom: 18 }}>
                {allTopics.map(topic => {
                  const isSelected = selectedSet.has(topic);
                  return (
                    <TopicChip
                      key={topic}
                      label={topic}
                      selected={isSelected}
                      tint={fieldDef.color}
                      onClick={() => onToggle(topic, fieldKey)}
                      onRemove={customTopics.includes(topic) ? () => onRemoveCustom(fieldKey, topic) : undefined}
                      disabled={atMax && !isSelected}
                      title={atMax && !isSelected ? `Remove an interest to add more (max ${maxSelected}).` : undefined}
                    />
                  );
                })}
                <RowAdder onAdd={t => onAddCustom(fieldKey, t)} disabled={atMax} />
              </div>
            )}
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
      if (prev.length >= MAX_INTERESTS) return prev;
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
      if (prev.length >= MAX_INTERESTS) return prev;
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
