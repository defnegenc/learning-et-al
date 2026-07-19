"use client";

import { fieldColor } from "@/lib/field-hierarchy";

const MONO = "var(--font-mono), monospace";
const BODY = "var(--font-inter), sans-serif";

/**
 * The zero-click header under the central question: domain chips (which of your
 * interests seeded this) and the gist (the one-line answer). Renders nothing if
 * the digest predates these fields.
 */
export function DigestHeader({ seedInterests, gist }: {
  seedInterests?: { keyword: string; field: string }[];
  gist?: string | null;
}) {
  const chips = (seedInterests || []).filter((c) => c.keyword);
  if (!chips.length && !gist) return null;

  return (
    <div style={{ marginTop: 8, marginBottom: 4 }}>
      {chips.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: gist ? 26 : 0 }}>
          {chips.map((c) => (
            <span
              key={c.keyword}
              style={{
                fontFamily: MONO,
                fontSize: "0.6rem",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                background: fieldColor(c.field),
                border: "1.5px solid #1a1a1a",
                padding: "3px 9px",
                color: "#1a1a1a",
                whiteSpace: "nowrap",
              }}
            >
              {c.keyword}
            </span>
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
