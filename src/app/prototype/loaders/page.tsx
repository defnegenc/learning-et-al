"use client";

import React, { useState } from "react";
import { SOURCE_PALETTES } from "@/components/today/palettes";

/*
 * Loader candidates — pick one and it becomes PageLoader in design-system.tsx.
 *
 * Rules every candidate follows:
 *  - No dependencies. CSS keyframes only; a loader must never cost bundle.
 *  - No fake progress. Nothing fills toward a percentage it can't know.
 *  - Palette comes from SOURCE_PALETTES, the same four pairs the cards use, so
 *    the rainbow reads as the product's and not as decoration.
 *  - Hard edges, no rounded corners, no easing that feels soft.
 */

const DISPLAY = "var(--font-display), sans-serif";
const INK = "#1a1a1a";
const FLAT = SOURCE_PALETTES.map(([a]) => a); // one flat colour per pair

/* ── 1. Scanline ──────────────────────────────────────────────────────────
   A rainbow bar sweeps down a bordered sheet, like a page being copied. */
function Scanline() {
  return (
    <div style={{ position: "relative", width: 132, height: 92, border: `2px solid ${INK}`, background: "#fff", overflow: "hidden" }}>
      {[0, 1, 2, 3].map(i => (
        <div key={i} style={{ position: "absolute", left: 14, right: 14, top: 16 + i * 18, height: 6, background: "rgba(26,26,26,0.10)" }} />
      ))}
      <div
        className="ld-scan"
        style={{
          position: "absolute", left: 0, right: 0, height: 10,
          background: `linear-gradient(90deg, ${FLAT[0]}, ${FLAT[1]}, ${FLAT[2]}, ${FLAT[3]})`,
          borderTop: `2px solid ${INK}`, borderBottom: `2px solid ${INK}`,
        }}
      />
    </div>
  );
}

/* ── 2. Punch card ────────────────────────────────────────────────────────
   Five hard squares fill left to right on steps() — mechanical, no easing. */
function PunchCard() {
  return (
    <div style={{ display: "flex", gap: 8 }}>
      {[0, 1, 2, 3, 4].map(i => (
        <div key={i} style={{ position: "relative", width: 20, height: 20, border: `2px solid ${INK}`, background: "#fff" }}>
          <div
            className="ld-punch"
            style={{ position: "absolute", inset: 0, background: FLAT[i % FLAT.length], animationDelay: `${i * 0.16}s` }}
          />
        </div>
      ))}
    </div>
  );
}

/* ── 3. Stamp ─────────────────────────────────────────────────────────────
   A square rotates in 90° steps, its hard shadow cycling through the palette. */
function Stamp() {
  return (
    <div style={{ width: 64, height: 64, display: "grid", placeItems: "center" }}>
      <div className="ld-stamp" style={{ width: 34, height: 34, border: `3px solid ${INK}`, background: "#fff" }} />
    </div>
  );
}

/* ── 4. Draw-on ───────────────────────────────────────────────────────────
   A square draws itself in, then erases. The line is a rainbow gradient. */
function DrawOn() {
  return (
    <svg width="60" height="60" viewBox="0 0 60 60" fill="none">
      <defs>
        <linearGradient id="ldGrad" x1="0" y1="0" x2="60" y2="60" gradientUnits="userSpaceOnUse">
          {FLAT.map((c, i) => <stop key={i} offset={i / (FLAT.length - 1)} stopColor={c} />)}
        </linearGradient>
      </defs>
      <rect x="6" y="6" width="48" height="48" stroke="rgba(26,26,26,0.12)" strokeWidth="4" />
      <rect className="ld-draw" x="6" y="6" width="48" height="48" stroke="url(#ldGrad)" strokeWidth="4" pathLength={100} />
    </svg>
  );
}

/* ── 5. Sweep ─────────────────────────────────────────────────────────────
   The digest title's own sweep, reused: a word with a bar wiping under it. */
function Sweep() {
  return (
    <span className="ld-sweep" style={{ fontFamily: DISPLAY, fontSize: "1.5rem", fontWeight: 700, color: INK, display: "inline", paddingBottom: 8 }}>
      Reading
    </span>
  );
}

const CANDIDATES = [
  { key: "scanline", name: "Scanline", note: "A page being copied. Most literally 'research archive'.", el: <Scanline /> },
  { key: "punch", name: "Punch card", note: "Mechanical, no easing. Reads as machinery, not as waiting.", el: <PunchCard /> },
  { key: "stamp", name: "Stamp", note: "90° steps with the palette cycling through the hard shadow.", el: <Stamp /> },
  { key: "draw", name: "Draw-on", note: "The border language, drawing itself. Quietest of the five.", el: <DrawOn /> },
  { key: "sweep", name: "Sweep", note: "Reuses the digest title's sweep — most obviously 'ours'.", el: <Sweep /> },
];

export default function LoadersPrototype() {
  const [dark, setDark] = useState(false);

  return (
    <div style={{ minHeight: "100vh", background: dark ? "#1a1a1a" : "#fff", color: dark ? "#fff" : INK }}>
      <style>{`
        @keyframes ldScan { 0% { top: -10px } 100% { top: 92px } }
        .ld-scan { animation: ldScan 1.5s linear infinite; }

        @keyframes ldPunch { 0%, 100% { transform: scale(0) } 45%, 70% { transform: scale(1) } }
        .ld-punch { animation: ldPunch 1.6s steps(1, end) infinite; }

        @keyframes ldStamp {
          0%   { transform: rotate(0deg);   box-shadow: 5px 5px 0 0 ${FLAT[0]} }
          25%  { transform: rotate(90deg);  box-shadow: 5px 5px 0 0 ${FLAT[1]} }
          50%  { transform: rotate(180deg); box-shadow: 5px 5px 0 0 ${FLAT[2]} }
          75%  { transform: rotate(270deg); box-shadow: 5px 5px 0 0 ${FLAT[3]} }
          100% { transform: rotate(360deg); box-shadow: 5px 5px 0 0 ${FLAT[0]} }
        }
        .ld-stamp { animation: ldStamp 1.8s steps(1, end) infinite; }

        @keyframes ldDraw {
          0%   { stroke-dasharray: 0 100;   stroke-dashoffset: 0 }
          50%  { stroke-dasharray: 100 100; stroke-dashoffset: 0 }
          100% { stroke-dasharray: 100 100; stroke-dashoffset: -100 }
        }
        .ld-draw { animation: ldDraw 1.8s ease-in-out infinite; }

        @keyframes ldSweep {
          0%   { background-size: 0% 9px;   background-position: left bottom }
          45%  { background-size: 100% 9px; background-position: left bottom }
          55%  { background-size: 100% 9px; background-position: right bottom }
          100% { background-size: 0% 9px;   background-position: right bottom }
        }
        .ld-sweep {
          background-image: linear-gradient(90deg, ${FLAT[0]}, ${FLAT[1]}, ${FLAT[2]});
          background-repeat: no-repeat;
          animation: ldSweep 2s ease-in-out infinite;
        }

        /* Anyone who asked the OS to stop animations gets a static mark. */
        @media (prefers-reduced-motion: reduce) {
          .ld-scan, .ld-punch, .ld-stamp, .ld-draw, .ld-sweep { animation: none !important; }
        }
      `}</style>

      <div style={{ maxWidth: 880, margin: "0 auto", padding: "48px 24px 80px" }}>
        <h1 style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: "2rem", letterSpacing: "-0.03em", margin: "0 0 8px" }}>
          Loader candidates
        </h1>
        <p style={{ fontSize: "1rem", color: dark ? "#aaa" : "#666", margin: "0 0 8px", maxWidth: 560, lineHeight: 1.6 }}>
          Pick one and it replaces <code>PageLoader</code> everywhere. All CSS, no library,
          no fake progress bar. Palette is the four card pairs.
        </p>
        <button
          onClick={() => setDark(d => !d)}
          style={{ fontFamily: DISPLAY, fontSize: "0.85rem", fontWeight: 700, background: dark ? "#fff" : INK, color: dark ? INK : "#fff", border: `2px solid ${dark ? "#fff" : INK}`, padding: "8px 14px", cursor: "pointer", margin: "12px 0 40px" }}
        >
          {dark ? "Light background" : "Dark background"}
        </button>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 24 }}>
          {CANDIDATES.map(c => (
            <div key={c.key} style={{ border: `2px solid ${dark ? "#fff" : INK}`, background: dark ? "#1a1a1a" : "#fff", boxShadow: `6px 6px 0 0 ${dark ? "#fff" : INK}` }}>
              <div style={{ height: 150, display: "grid", placeItems: "center", borderBottom: `2px solid ${dark ? "#fff" : INK}` }}>
                {c.el}
              </div>
              <div style={{ padding: "14px 16px" }}>
                <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: "1.05rem", marginBottom: 4 }}>{c.name}</div>
                <p style={{ fontSize: "0.85rem", lineHeight: 1.5, color: dark ? "#aaa" : "#666", margin: 0 }}>{c.note}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
