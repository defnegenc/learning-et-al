"use client";

import { useState, type KeyboardEvent } from "react";
import { X } from "lucide-react";
import { FIELD_HIERARCHY, type InterestEntry } from "@/lib/field-hierarchy";

interface InterestPickerProps {
  interests: InterestEntry[];
  onChange: (interests: InterestEntry[]) => void;
  maxInterests?: number;
}

export function InterestPicker({ interests, onChange, maxInterests = 12 }: InterestPickerProps) {
  const [expandedField, setExpandedField] = useState<string | null>(null);
  const [customInput, setCustomInput] = useState("");

  const addedKeywords = new Set(interests.map((i) => i.keyword));

  function addInterest(keyword: string, fieldKey?: string) {
    const key = keyword.toLowerCase().trim();
    if (!key || addedKeywords.has(key) || interests.length >= maxInterests) return;
    const fieldDef = fieldKey
      ? FIELD_HIERARCHY[fieldKey]
      : expandedField
        ? FIELD_HIERARCHY[expandedField]
        : null;
    onChange([
      ...interests,
      {
        keyword: key,
        field: fieldDef?.s2Field ?? "Computer Science",
        fieldLabel: fieldDef?.label ?? "CS",
        level: "beginner",
      },
    ]);
  }

  function cycleLevel(keyword: string) {
    const order: InterestEntry["level"][] = ["beginner", "intermediate", "expert"];
    onChange(
      interests.map((i) =>
        i.keyword === keyword
          ? { ...i, level: order[(order.indexOf(i.level) + 1) % order.length] }
          : i
      )
    );
  }

  const levelLabel: Record<InterestEntry["level"], string> = {
    beginner: "BEG",
    intermediate: "INT",
    expert: "EXP",
  };
  const levelColor: Record<InterestEntry["level"], string> = {
    beginner: "#bbf7d0",
    intermediate: "#bfdbfe",
    expert: "#fce7f3",
  };

  function removeInterest(keyword: string) {
    onChange(interests.filter((i) => i.keyword !== keyword));
  }

  function handleCustomKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && customInput.trim()) {
      e.preventDefault();
      addInterest(customInput.trim());
      setCustomInput("");
    }
  }

  return (
    <div className="flex flex-col md:flex-row gap-4">
      {/* Left: selected chips + custom input */}
      <div className="md:w-44 flex-shrink-0 flex flex-col gap-3">
        <div
          style={{
            fontSize: "0.55rem",
            textTransform: "uppercase",
            letterSpacing: "2px",
            color: "#999",
            fontFamily: "var(--font-mono), monospace",
          }}
        >
          {interests.length}/{maxInterests} selected
        </div>

        {interests.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {interests.map((i) => {
              const fieldDef = Object.values(FIELD_HIERARCHY).find(
                (f) => f.s2Field === i.field
              );
              return (
                <span
                  key={i.keyword}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                    padding: "4px 8px",
                    background: fieldDef?.color ?? "#f3f4f6",
                    border: "2px solid #1a1a1a",
                    fontSize: "0.6rem",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                    fontFamily: "var(--font-mono), monospace",
                    color: "#1a1a1a",
                  }}
                >
                  <span style={{ fontSize: "0.45rem", color: "#666" }}>
                    {i.fieldLabel}
                  </span>
                  {i.keyword}
                  <button
                    onClick={() => cycleLevel(i.keyword)}
                    title="Click to change expertise level"
                    style={{
                      background: levelColor[i.level],
                      border: "1.5px solid #1a1a1a",
                      padding: "1px 4px",
                      cursor: "pointer",
                      fontSize: "0.45rem",
                      fontWeight: 700,
                      fontFamily: "var(--font-mono), monospace",
                      color: "#1a1a1a",
                      lineHeight: 1.4,
                    }}
                  >
                    {levelLabel[i.level]}
                  </button>
                  <button
                    onClick={() => removeInterest(i.keyword)}
                    style={{
                      background: "none",
                      border: "none",
                      padding: 0,
                      cursor: "pointer",
                      color: "#999",
                      lineHeight: 1,
                      display: "flex",
                    }}
                  >
                    <X style={{ width: "10px", height: "10px" }} />
                  </button>
                </span>
              );
            })}
          </div>
        ) : (
          <p
            style={{
              fontSize: "0.6rem",
              color: "#aaa",
              fontFamily: "var(--font-mono), monospace",
            }}
          >
            Select topics from the grid →
          </p>
        )}

        {/* Custom input — always visible */}
        <div>
          <input
            placeholder={
              expandedField
                ? `Add ${expandedField.toLowerCase()} topic...`
                : "Type a custom topic..."
            }
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            onKeyDown={handleCustomKey}
            className="w-full bg-transparent px-3 py-1.5 text-[0.8rem] placeholder:text-[#aaa] focus:outline-none"
            style={{
              border: "2px solid rgba(26,26,26,0.3)",
              fontFamily: "var(--font-mono), monospace",
            }}
          />
          <p
            style={{
              fontSize: "0.55rem",
              color: "#aaa",
              marginTop: "4px",
              fontFamily: "var(--font-mono), monospace",
            }}
          >
            Press Enter to add
          </p>
        </div>
      </div>

      {/* Right: field grid + accordion expansion */}
      <div className="flex-1 space-y-2">
        <div className="grid grid-cols-3 gap-1.5">
          {Object.entries(FIELD_HIERARCHY).map(([field, def]) => {
            const isExpanded = expandedField === field;
            return (
              <button
                key={field}
                onClick={() => setExpandedField(isExpanded ? null : field)}
                style={{
                  padding: "10px 8px",
                  background: isExpanded ? "#1a1a1a" : def.color,
                  color: isExpanded ? "white" : "#1a1a1a",
                  border: "2px solid #1a1a1a",
                  textAlign: "left",
                  cursor: "pointer",
                  transition: "all 0.1s ease",
                }}
              >
                <div
                  style={{
                    fontSize: "0.5rem",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "1px",
                    color: isExpanded ? "#aaa" : "#666",
                    fontFamily: "var(--font-mono), monospace",
                    marginBottom: "2px",
                  }}
                >
                  {def.label}
                </div>
                <div
                  style={{
                    fontSize: "0.65rem",
                    fontWeight: 700,
                    fontFamily: "var(--font-display), sans-serif",
                    lineHeight: 1.2,
                  }}
                >
                  {field}
                </div>
              </button>
            );
          })}
        </div>

        {/* Expanded subfields + topics */}
        {expandedField && (
          <div
            style={{
              border: "2px solid #1a1a1a",
              padding: "14px",
              background: "#fafafa",
            }}
          >
            <div
              style={{
                fontSize: "0.55rem",
                textTransform: "uppercase",
                letterSpacing: "2px",
                color: "#666",
                fontFamily: "var(--font-mono), monospace",
                marginBottom: "12px",
                fontWeight: 700,
              }}
            >
              {expandedField} — tap to add
            </div>
            <div className="space-y-3">
              {Object.entries(FIELD_HIERARCHY[expandedField].subfields).map(
                ([subfield, topics]) => (
                  <div key={subfield}>
                    <div
                      style={{
                        fontSize: "0.5rem",
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: "1px",
                        color: "#999",
                        fontFamily: "var(--font-mono), monospace",
                        marginBottom: "6px",
                      }}
                    >
                      {subfield}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {topics.map((topic) => {
                        const isAdded = addedKeywords.has(topic);
                        return (
                          <button
                            key={topic}
                            onClick={() =>
                              isAdded
                                ? removeInterest(topic)
                                : addInterest(topic, expandedField)
                            }
                            style={{
                              padding: "3px 9px",
                              background: isAdded
                                ? "#1a1a1a"
                                : FIELD_HIERARCHY[expandedField].color,
                              color: isAdded ? "white" : "#1a1a1a",
                              border: "2px solid #1a1a1a",
                              fontSize: "0.6rem",
                              fontWeight: 700,
                              textTransform: "uppercase",
                              letterSpacing: "0.5px",
                              fontFamily: "var(--font-mono), monospace",
                              cursor: "pointer",
                              transition: "all 0.1s ease",
                            }}
                          >
                            {isAdded ? "✓ " : ""}{topic}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
