"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { FIELD_HIERARCHY, type S2Field } from "@/lib/field-hierarchy";
import {
  ActionButton, BODY_STYLE, BODY_SM, DIM, DISPLAY_SM, HAIRLINE, INK, LABEL_STYLE,
  MUTED, Segmented, SURFACE, TopicChip,
} from "@/components/design-system";

// Max interests a user can select. The digest samples 5 candidates/day from the
// whole pool (see docs/algorithm.md Step 1), so this is only a UI guardrail, not
// an algorithmic constraint. Single source of truth — referenced by the ledger's
// capacity line + chip dimming AND the guards in settings-dialog + the
// useInterestLedger hook.
export const MAX_INTERESTS = 30;

export interface SelectedTopic {
  keyword: string;
  field: S2Field;
  fieldLabel: string;
  color: string;
}

// Custom topics added by the user per category, keyed by FIELD_HIERARCHY key.
// (CATEGORY_PALETTES is gone: a field's colour is its one fixed spectrum slot
// in FIELD_HIERARCHY, not a gradient pair kept in a second table here.)
export type CustomTopics = Record<string, string[]>;

/**
 * How full the picker is, and how spread. The number is the graphic; the bar
 * underneath answers the question the subtitle actually asks — am I across
 * several fields, or stacked in one corner? Nothing fills toward a percentage
 * the code can't know: every unit here is a topic the user picked.
 */
function CapacityMeter({ selected, max, fieldCounts }: {
  selected: number;
  max: number;
  fieldCounts: { key: string; count: number; color: string }[];
}) {
  const atMax = selected >= max;
  return (
    <div style={{ padding: "16px 0 14px" }}>
      {/* No bar at zero — an empty meter is a shape with nothing to say. */}
      {selected > 0 && (
        <div style={{ display: "flex", height: 10, border: `2px solid ${INK}`, background: SURFACE, overflow: "hidden", marginBottom: 8 }}>
          {fieldCounts.map((f, i) => (
            <div
              key={f.key}
              title={`${f.key} · ${f.count}`}
              style={{
                width: `${(f.count / max) * 100}%`,
                background: f.color,
                borderRight: i === fieldCounts.length - 1 ? undefined : `1px solid ${INK}`,
                transition: "width 180ms",
              }}
            />
          ))}
        </div>
      )}
      <p style={{ ...BODY_STYLE, margin: 0, color: MUTED }}>
        <strong style={{ color: INK, fontWeight: 600 }}>{selected} of {max} topics</strong>
        {fieldCounts.length > 0 && <> · across {fieldCounts.length} of 10 {fieldCounts.length === 1 ? "field" : "fields"}</>}
        {atMax && <> · <span style={{ color: INK, fontWeight: 600 }}>full — remove one to add another</span></>}
      </p>
    </div>
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
 * The interest picker. Eighty topics is too many to show flat, so the ten
 * fields collapse: a field opens when it holds something you picked, and the
 * search box across the top reaches everything at once. Typing a phrase that
 * doesn't exist turns the same box into the custom-topic adder — one control,
 * rather than a "+ Add" repeated down every row.
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

  const [query, setQuery] = useState("");
  const [view, setView] = useState<"all" | "selected">("all");
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
  const [addField, setAddField] = useState(entries[0][0]);

  const q = query.trim().toLowerCase();

  const rows = entries.map(([fieldKey, fieldDef]) => {
    const customTopics = custom[fieldKey] || [];
    const allTopics = [...fieldDef.topics, ...customTopics];
    const selectedHere = allTopics.filter(t => selectedSet.has(t));
    let visible = allTopics;
    if (view === "selected") visible = selectedHere;
    if (q) visible = visible.filter(t => t.toLowerCase().includes(q));
    return { fieldKey, fieldDef, customTopics, allTopics, selectedHere, visible };
  }).filter(r => !((q || view === "selected") && r.visible.length === 0));

  // Searching or filtering overrides the accordion — you asked to see these.
  const forceOpen = q.length > 0 || view === "selected";

  const fieldCounts = entries
    .map(([fieldKey, fieldDef]) => ({
      key: fieldKey,
      color: fieldDef.color,
      count: [...fieldDef.topics, ...(custom[fieldKey] || [])].filter(t => selectedSet.has(t)).length,
    }))
    .filter(f => f.count > 0);

  // The adder is the empty state, not a permanent control: a phrase that
  // matches nothing in eighty topics is exactly the phrase you want to add.
  const noMatches = q.length > 1 && rows.length === 0 && view === "all";
  const canAddCustom = noMatches && !atMax;

  const commitCustom = () => {
    if (!canAddCustom) return;
    onAddCustom(addField, query.trim());
    setQuery("");
    setOpen(prev => ({ ...prev, [addField]: true }));
  };

  return (
    <div>
      <CapacityMeter selected={selected.length} max={maxSelected} fieldCounts={fieldCounts} />

      {/* Toolbar — sticks to the top of whatever scroller renders the ledger. */}
      <div
        className="flex flex-col md:flex-row md:items-center gap-2 sticky top-0 z-10"
        style={{ background: SURFACE, paddingBottom: 10, borderBottom: HAIRLINE }}
      >
        <div style={{ position: "relative", flex: 1 }}>
          <Search size={16} style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: MUTED, pointerEvents: "none" }} />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") commitCustom(); if (e.key === "Escape") setQuery(""); }}
            placeholder="Search topics, or type your own…"
            aria-label="Search topics"
            style={{
              ...BODY_STYLE, width: "100%", border: `2px solid ${INK}`, background: SURFACE,
              padding: "10px 13px 10px 38px", outline: "none", minHeight: 44,
            }}
          />
        </div>
        <div className="w-full md:w-auto md:min-w-[280px]" style={{ flexShrink: 0 }}>
          <Segmented
            value={view}
            onChange={setView}
            options={[
              { key: "all" as const, label: "All topics" },
              { key: "selected" as const, label: `Selected · ${selected.length}` },
            ]}
          />
        </div>
      </div>

      {/* Empty state — and, when nothing matched, the custom-topic adder. A
          phrase that isn't in any of the ten fields is the one you want to add. */}
      {rows.length === 0 && (
        <div style={{ padding: "22px 0" }}>
          <p style={{ ...BODY_STYLE, color: MUTED, margin: 0 }}>
            {view === "selected"
              ? "Nothing picked yet — switch to all topics to start."
              : <>Nothing matches <strong style={{ color: INK, fontWeight: 600 }}>&ldquo;{query.trim()}&rdquo;</strong>.{atMax && " You're at the maximum — remove one to add your own."}</>}
          </p>
          {canAddCustom && (
            <div className="flex flex-wrap items-center gap-2" style={{ marginTop: 12 }}>
              <span style={{ ...BODY_STYLE, color: MUTED }}>Add it to</span>
              <select
                value={addField}
                onChange={e => setAddField(e.target.value)}
                aria-label="Category for the new topic"
                style={{
                  ...BODY_STYLE, border: `2px solid ${INK}`, background: SURFACE,
                  padding: "9px 12px", outline: "none", minHeight: 42,
                }}
              >
                {entries.map(([key]) => <option key={key} value={key}>{key}</option>)}
              </select>
              <ActionButton variant="primary" shadow={false} onClick={commitCustom}>Add</ActionButton>
            </div>
          )}
        </div>
      )}

      {rows.map(({ fieldKey, fieldDef, customTopics, allTopics, selectedHere, visible }) => {
        const isOpen = forceOpen || open[fieldKey];
        const preview = selectedHere.length > 0 ? selectedHere : allTopics.slice(0, 4);

        return (
          <div key={fieldKey} style={{ borderBottom: HAIRLINE }}>
            {/* The field's own spectrum slot in the swatch, its name at
                Display/SM, and the count as the row's one mono label. */}
            <button
              onClick={() => !forceOpen && setOpen(prev => ({ ...prev, [fieldKey]: !prev[fieldKey] }))}
              aria-expanded={isOpen}
              style={{
                display: "flex", alignItems: "center", gap: 12, width: "100%",
                background: "none", border: "none", padding: "18px 0", textAlign: "left",
                cursor: forceOpen ? "default" : "pointer",
              }}
            >
              <span style={{ width: 12, height: 12, background: fieldDef.color, border: `1px solid ${INK}`, flexShrink: 0 }} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ ...DISPLAY_SM, display: "block" }}>{fieldKey}</span>
                {!isOpen && (
                  <span
                    style={{
                      ...BODY_SM, display: "block", marginTop: 4,
                      color: selectedHere.length > 0 ? DIM : MUTED,
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}
                  >
                    {preview.join(", ")}
                  </span>
                )}
              </span>
              <span style={{ ...LABEL_STYLE, color: selectedHere.length ? INK : MUTED, flexShrink: 0 }}>
                {selectedHere.length} / {allTopics.length}
              </span>
              {!forceOpen && (
                <ChevronDown
                  size={16}
                  style={{ color: MUTED, flexShrink: 0, transform: isOpen ? "rotate(180deg)" : "none", transition: "transform 150ms" }}
                />
              )}
            </button>

            {isOpen && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, paddingBottom: 20 }}>
                {visible.map(topic => {
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
