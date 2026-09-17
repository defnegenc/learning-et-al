"use client";

/**
 * Prototype: the Paper2Agent trust boundary as a product path.
 *
 * The pipeline behind this page:
 *   paper -> detect runnable method -> wrap it -> reproduce a reported
 *   result -> only then expose it as a callable tool.
 *
 * The paper is Sharma, Wu & Dalal (2005), which publishes its own
 * supplementary test data - 34 CIELAB pairs with expected CIEDE2000
 * differences. The implementation below was validated against all 34
 * pairs (max abs error 0.000049, threshold 0.0001) on Sep 16, 2026,
 * and that validation report is what turns the wrapper from provisional
 * into callable. A wrapper that fails reproduction never ships.
 */
import { useMemo, useState } from "react";
import {
  ACID_GREEN,
  BORDER,
  BODY_STYLE,
  DIM,
  DISPLAY_LG,
  DISPLAY_SM,
  FIELD,
  INK,
  LABEL_STYLE,
  Label,
  MUTED,
  SectionLabel,
  SHADOW,
  SURFACE,
} from "@/components/design-system";
import { deltaE00, hexToLab } from "@/lib/de00";

function ColorInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1, minWidth: 0 }}>
      <span style={{ ...LABEL_STYLE, color: DIM }}>{label}</span>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label={label}
          style={{
            width: 56,
            height: 44,
            padding: 0,
            border: BORDER,
            background: SURFACE,
            cursor: "pointer",
            flexShrink: 0,
          }}
        />
        <span style={{ ...LABEL_STYLE, color: INK, fontSize: 12 }}>{value.toUpperCase()}</span>
      </div>
    </div>
  );
}

export default function RunThePaper() {
  const [colorA, setColorA] = useState("#38b000");
  const [colorB, setColorB] = useState("#ff007f");
  const de00 = useMemo(() => deltaE00(hexToLab(colorA), hexToLab(colorB)), [colorA, colorB]);

  return (
    <>
      <Label>Prototype</Label>
      <h2 style={{ ...DISPLAY_LG, margin: "10px 0 0" }}>Run the paper</h2>
      <p style={{ ...BODY_STYLE, color: DIM, margin: "14px 0 0", maxWidth: 560 }}>
        Some papers ship with runnable code. This path takes one, finds the canonical
        method, and runs the reproduction check before it becomes a tool you can call.
        A generated wrapper stays provisional until it reproduces a reported result.
        Only then is it callable. What fails the check never ships.
      </p>

      <div style={{ marginTop: 28 }}>
        <SectionLabel>The paper</SectionLabel>
        <p style={{ ...BODY_STYLE, color: INK, margin: "10px 0 0", maxWidth: 560 }}>
          Sharma, Wu &amp; Dalal (2005),{" "}
          <em>The CIEDE2000 Color-Difference Formula: Implementation Notes, Supplementary
          Test Data, and Mathematical Observations</em>. Color Research &amp; Application
          30(1), 21-30.{" "}
          <a
            href="https://doi.org/10.1002/col.20070"
            target="_blank"
            rel="noreferrer"
            style={{ color: INK }}
          >
            doi:10.1002/col.20070
          </a>
        </p>
        <p style={{ ...BODY_STYLE, color: DIM, fontSize: 13, margin: "8px 0 0", maxWidth: 560 }}>
          Chosen because the paper publishes its own expected results: 34 CIELAB test
          pairs with reference color differences, the reproduction check built in.
        </p>
      </div>

      <div style={{ marginTop: 28 }}>
        <SectionLabel>The tool</SectionLabel>
        <div
          style={{
            marginTop: 10,
            background: FIELD,
            border: BORDER,
            boxShadow: SHADOW,
            padding: 20,
            maxWidth: 560,
          }}
        >
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <span style={{ ...LABEL_STYLE, color: INK }}>CIEDE2000 color difference</span>
            <span
              style={{
                ...LABEL_STYLE,
                fontSize: 10,
                color: INK,
                background: ACID_GREEN,
                padding: "3px 8px",
                border: BORDER,
              }}
            >
              Validated
            </span>
          </div>
          <div className="flex flex-col md:flex-row md:items-end" style={{ gap: 16, marginTop: 18 }}>
            <ColorInput label="Color A" value={colorA} onChange={setColorA} />
            <ColorInput label="Color B" value={colorB} onChange={setColorB} />
            <div style={{ display: "flex", flexDirection: "column", gap: 8, justifyContent: "flex-end" }}>
              <span style={{ ...LABEL_STYLE, color: DIM }}>Delta E 00</span>
              <span style={{ ...DISPLAY_SM, color: INK, fontSize: 22, letterSpacing: "0.02em" }}>
                {de00.toFixed(4)}
              </span>
            </div>
          </div>
          <p style={{ ...BODY_STYLE, fontSize: 12, color: MUTED, margin: "16px 0 0" }}>
            Runs in your browser. Under 5 is a close match; over 50 reads as opposite.
          </p>
        </div>
      </div>

      <div style={{ marginTop: 28 }}>
        <SectionLabel>The check</SectionLabel>
        <div
          style={{
            marginTop: 10,
            border: BORDER,
            background: SURFACE,
            padding: 20,
            maxWidth: 560,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, borderBottom: `1px solid ${MUTED}`, paddingBottom: 10 }}>
              <span style={{ ...BODY_STYLE, fontSize: 13, color: DIM }}>Reproduction</span>
              <span style={{ ...BODY_STYLE, fontSize: 13, color: INK }}>
                34 of 34 supplementary test pairs
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, borderBottom: `1px solid ${MUTED}`, paddingBottom: 10 }}>
              <span style={{ ...BODY_STYLE, fontSize: 13, color: DIM }}>Max absolute error</span>
              <span style={{ ...BODY_STYLE, fontSize: 13, color: INK }}>0.000049 (limit 0.0001)</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, borderBottom: `1px solid ${MUTED}`, paddingBottom: 10 }}>
              <span style={{ ...BODY_STYLE, fontSize: 13, color: DIM }}>Expected results</span>
              <span style={{ ...BODY_STYLE, fontSize: 13, color: INK }}>Paper, supplementary test data</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, borderBottom: `1px solid ${MUTED}`, paddingBottom: 10 }}>
              <span style={{ ...BODY_STYLE, fontSize: 13, color: DIM }}>Checked</span>
              <span style={{ ...BODY_STYLE, fontSize: 13, color: INK }}>Sep 16, 2026</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
              <span style={{ ...BODY_STYLE, fontSize: 13, color: DIM }}>Test data</span>
              <a
                href="https://www.hajim.rochester.edu/ece/~gsharma/ciede2000/"
                target="_blank"
                rel="noreferrer"
                style={{ ...BODY_STYLE, fontSize: 13, color: INK }}
              >
                Author&apos;s page
              </a>
            </div>
          </div>
        </div>
        <p style={{ ...BODY_STYLE, fontSize: 12, color: MUTED, margin: "12px 0 0", maxWidth: 560 }}>
          This prototype runs verified math in the browser. Generalizing it to arbitrary
          repositories means executing untrusted code, which needs a sandbox - a separate
          product decision, deliberately not made here.
        </p>
      </div>
    </>
  );
}
