"use client";

import { FIELD_HIERARCHY } from "@/lib/field-hierarchy";

const MONO = "var(--font-mono), monospace";
const BODY = "var(--font-inter), sans-serif";

// Stored interest field is an S2Field ("Computer Science", "Art", …). Match it to a
// FIELD_HIERARCHY entry's color; fall back to the key, then a neutral grey.
function fieldColor(field: string): string {
  for (const def of Object.values(FIELD_HIERARCHY)) {
    if (def.s2Field === field) return def.color;
  }
  return FIELD_HIERARCHY[field]?.color || "#e5e7eb";
}

/**
 * The zero-click header under the central question: domain chips (which of your
 * interests seeded this), the gist (the one-line answer), and a faint curatorial
 * framing line. Renders nothing if the digest predates these fields.
 */
export function DigestHeader({ seedInterests, gist, framing }: {
  seedInterests?: { keyword: string; field: string }[];
  gist?: string | null;
  framing?: string | null;
}) {
  const chips = (seedInterests || []).filter((c) => c.keyword);
  if (!chips.length && !gist && !framing) return null;

  return (
    <div style={{ marginTop: 16, marginBottom: 4 }}>
      {chips.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: gist || framing ? 16 : 0 }}>
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
        <p style={{ fontFamily: BODY, fontSize: "1.06rem", lineHeight: 1.55, color: "#1a1a1a", fontWeight: 500, margin: 0 }}>
          {gist}
        </p>
      )}
      {framing && (
        <p style={{ fontFamily: BODY, fontSize: "0.8rem", fontStyle: "italic", color: "#8a8a8a", lineHeight: 1.5, margin: gist ? "10px 0 0" : 0 }}>
          {framing}
        </p>
      )}
    </div>
  );
}
