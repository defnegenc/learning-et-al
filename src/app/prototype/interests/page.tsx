"use client";

import { useState } from "react";
import { InterestLedger, useInterestLedger } from "@/components/interest-ledger";
import { INK, DISPLAY, Segmented } from "@/components/design-system";

/*
 * The interest picker, live and unauthenticated — the same component settings
 * and onboarding render, so what you poke at here is what ships. Nothing is
 * saved. Reload and it's empty again.
 *
 * "Phone" pins it to a 375px scroller with a fixed height, so the accordion and
 * the tap targets behave exactly as they do inside the settings sheet without
 * needing a device.
 */
export default function InterestsPrototype() {
  const { selected, custom, toggle, addCustom, removeCustom } = useInterestLedger();
  const [frame, setFrame] = useState<"page" | "phone">("page");

  const ledger = (
    <InterestLedger
      selected={selected}
      custom={custom}
      onToggle={toggle}
      onAddCustom={addCustom}
      onRemoveCustom={removeCustom}
    />
  );

  return (
    <div style={{ minHeight: "100vh", background: "#fff", color: INK }}>
      <div style={{ maxWidth: 880, margin: "0 auto", padding: "48px 24px 80px" }}>
        <h1 style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: "clamp(1.5rem, 6vw, 2rem)", letterSpacing: "-0.03em", margin: "0 0 8px" }}>
          Interest picker
        </h1>
        <p style={{ fontSize: "1rem", color: "#666", margin: "0 0 20px", maxWidth: 560, lineHeight: 1.6 }}>
          Ten fields, eighty topics, one open at a time. A closed field previews what&rsquo;s
          inside it. Nothing here saves.
        </p>

        <Segmented
          size="sm"
          value={frame}
          onChange={setFrame}
          options={[{ key: "page" as const, label: "Full width" }, { key: "phone" as const, label: "Phone · 375px" }]}
          style={{ maxWidth: 300, marginBottom: 32 }}
        />

        {frame === "page" ? (
          <div style={{ maxHeight: "70vh", overflowY: "auto" }}>{ledger}</div>
        ) : (
          <div style={{ width: 375, maxWidth: "100%", border: `2px solid ${INK}`, boxShadow: "6px 6px 0 0 rgba(0,0,0,1)", background: "#fff" }}>
            <div style={{ height: 620, overflowY: "auto", padding: "0 16px 16px" }}>{ledger}</div>
          </div>
        )}
      </div>
    </div>
  );
}
