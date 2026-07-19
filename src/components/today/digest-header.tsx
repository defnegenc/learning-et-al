"use client";

import { useState } from "react";
import { fieldColor, topicColor } from "@/lib/field-hierarchy";

const MONO = "var(--font-mono), monospace";
const BODY = "var(--font-inter), sans-serif";

const CHIP: React.CSSProperties = {
  fontFamily: MONO,
  fontSize: "0.6rem",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  border: "1.5px solid #1a1a1a",
  padding: "3px 9px",
  color: "#1a1a1a",
  whiteSpace: "nowrap",
};

// Topic chips rotate through the actual field colors from FIELD_HIERARCHY
// (CS blue, Design pink, Bio green, Physics yellow, Psych purple, Econ orange) —
// the exact palette the interests tab uses.
const TOPIC_COLORS = ["#bfdbfe", "#fbcfe8", "#bbf7d0", "#fef08a", "#e9d5ff", "#fed7aa"];

// A digest topic that isn't one of your interests yet — click + to follow it.
function TopicChip({ topic, color, field, isLoggedIn, onSignIn }: {
  topic: string;
  color: string;
  field: string;
  isLoggedIn: boolean;
  onSignIn?: () => void;
}) {
  const [state, setState] = useState<"idle" | "saving" | "added">("idle");

  const add = async () => {
    if (state !== "idle") return;
    if (!isLoggedIn) { onSignIn?.(); return; }
    setState("saving");
    try {
      const res = await fetch("/api/interests/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyword: topic, field }),
      });
      setState(res.ok ? "added" : "idle");
    } catch {
      setState("idle");
    }
  };

  return (
    <button
      onClick={add}
      title={state === "added" ? "Added to your interests" : "Add to your interests"}
      style={{
        ...CHIP,
        background: color,
        cursor: state === "added" ? "default" : "pointer",
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        opacity: state === "saving" ? 0.5 : 1,
      }}
    >
      {topic}
      <span style={{ fontWeight: 700, fontSize: "0.7rem", lineHeight: 1 }}>{state === "added" ? "✓" : "+"}</span>
    </button>
  );
}

/**
 * The zero-click header under the central question: domain chips (interests that
 * seeded this digest), the digest's other topics (addable via +), and the gist
 * (the one-line answer). Renders nothing if the digest predates these fields.
 */
export function DigestHeader({ seedInterests, gist, topics, isLoggedIn = false, onSignIn }: {
  seedInterests?: { keyword: string; field: string }[];
  gist?: string | null;
  topics?: string[];
  isLoggedIn?: boolean;
  onSignIn?: () => void;
}) {
  const chips = (seedInterests || []).filter((c) => c.keyword);
  const extraTopics = topics || [];
  const defaultField = chips[0]?.field || "Computer Science";
  if (!chips.length && !extraTopics.length && !gist) return null;

  return (
    <div style={{ marginTop: 8 }}>
      {(chips.length > 0 || extraTopics.length > 0) && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: gist ? 28 : 0 }}>
          {chips.map((c) => (
            <span key={c.keyword} style={{ ...CHIP, background: fieldColor(c.field) }}>
              {c.keyword}
            </span>
          ))}
          {extraTopics.map((t, i) => (
            <TopicChip key={t} topic={t} color={topicColor(t) || TOPIC_COLORS[i % TOPIC_COLORS.length]} field={defaultField} isLoggedIn={isLoggedIn} onSignIn={onSignIn} />
          ))}
        </div>
      )}
      {gist && (
        <p style={{ fontFamily: BODY, fontSize: "1.12rem", lineHeight: 1.5, color: "#1a1a1a", fontWeight: 700, margin: 0 }}>
          {gist}
        </p>
      )}
    </div>
  );
}
