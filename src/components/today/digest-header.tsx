"use client";

import { useState } from "react";
import { fieldColor } from "@/lib/field-hierarchy";
import { BODY_STYLE, INK, SURFACE, Tag } from "@/components/design-system";

/**
 * A digest topic that isn't one of your interests yet — click + to follow it.
 * Idle is white; adding it fills with the topic's own spectrum slot, which is
 * the same fill the chip will have in the interest picker afterwards.
 */
function AddableTopic({ topic, field, isLoggedIn, onSignIn }: {
  topic: string;
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
    <Tag
      label={topic}
      tint={state === "added" ? fieldColor(field) : SURFACE}
      onClick={state === "idle" ? add : undefined}
      title={state === "added" ? "Added to your interests" : "Add to your interests"}
      trailing={<span aria-hidden style={{ fontWeight: 700 }}>{state === "added" ? "✓" : "+"}</span>}
      style={{ opacity: state === "saving" ? 0.5 : 1 }}
    />
  );
}

/**
 * The zero-click header under the central question: domain chips (interests
 * that seeded this digest), the digest's other topics (addable via +), and the
 * gist — the one-line answer. Renders nothing if the digest predates these
 * fields.
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
  // Dead-simple digest: the tag row stays hidden (flip SHOW_TAGS to bring it
  // back). The gist one-liner lands the digest's closing answer right under the
  // question instead of making you read to the end for it.
  const SHOW_TAGS = false;
  const SHOW_GIST = true;
  const showTags = SHOW_TAGS && (chips.length > 0 || extraTopics.length > 0);
  const showGist = SHOW_GIST && !!gist;
  if (!showTags && !showGist) return null;

  return (
    <div style={{ marginTop: 8 }}>
      {showTags && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: showGist ? 28 : 0 }}>
          {chips.map((c) => (
            <Tag key={c.keyword} label={c.keyword} tint={fieldColor(c.field)} />
          ))}
          {extraTopics.map((t) => (
            <AddableTopic key={t} topic={t} field={defaultField} isLoggedIn={isLoggedIn} onSignIn={onSignIn} />
          ))}
        </div>
      )}
      {showGist && (
        <p style={{ ...BODY_STYLE, fontWeight: 600, color: INK, margin: 0 }}>{gist}</p>
      )}
    </div>
  );
}
