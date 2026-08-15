"use client";

import { useState } from "react";
import { InterestLedger, useInterestLedger } from "@/components/interest-ledger";
import { BODY_STYLE, DIM, DISPLAY_LG, INK, Segmented, SHADOW, SURFACE } from "@/components/design-system";

/*
 * The interest picker, live and unauthenticated — the same component settings
 * and onboarding render, so what you poke at here is what ships. Nothing is
 * saved; reload and it's empty again.
 *
 * "Phone" pins it to a 375px scroller with a fixed height so the sticky
 * toolbar, the accordion and the tap targets behave exactly as they do inside
 * the settings sheet, without needing a device.
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
    <div style={{ minHeight: "100vh", background: SURFACE, color: INK }}>
      <div style={{ maxWidth: 880, margin: "0 auto", padding: "48px 24px 80px" }}>
        <h1 style={{ ...DISPLAY_LG, margin: "0 0 10px" }}>
          Interest picker
        </h1>
        <p style={{ ...BODY_STYLE, color: DIM, margin: "0 0 24px", maxWidth: 560 }}>
          Ten fields, eighty topics. Fields open when they hold something you picked;
          the search box reaches all of them at once, and typing a phrase that doesn&rsquo;t
          exist turns it into the custom-topic adder. Nothing here saves.
        </p>

        <Segmented
          value={frame}
          onChange={setFrame}
          options={[{ key: "page" as const, label: "Full width" }, { key: "phone" as const, label: "Phone · 375px" }]}
          style={{ maxWidth: 300, marginBottom: 32 }}
        />

        {frame === "page" ? (
          <div style={{ maxHeight: "70vh", overflowY: "auto" }}>{ledger}</div>
        ) : (
          <div style={{ width: 375, maxWidth: "100%", border: `2px solid ${INK}`, boxShadow: SHADOW, background: SURFACE }}>
            <div style={{ height: 620, overflowY: "auto", padding: "0 16px 16px" }}>{ledger}</div>
          </div>
        )}
      </div>
    </div>
  );
}
