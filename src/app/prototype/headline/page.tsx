"use client";

import React, { useState } from "react";
import { washSlots } from "@/components/today/palettes";
import { BODY_STYLE, DISPLAY, DISPLAY_LG, DISPLAY_SM, INK, MUTED, SHADOW, SURFACE } from "@/components/design-system";

// The four card washes' hue pairs — the same values the digest cards carry, so
// a candidate judged here is judged in the product's own colour.
const SOURCE_PALETTES: [string, string][] = [0, 1, 2, 3].map(i => washSlots(i)) as [string, string][];

/** Spectrum hues at an alpha — the pastels are already light, so this is only
 *  used where a bar sits over text. */
function hex2rgba(hex: string, a: number) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/*
 * Headline animation candidates — pick one and it replaces SweepTitle in
 * today-page.tsx.
 *
 * Same rules the loader candidates followed:
 *  - No dependencies. CSS @keyframes only.
 *  - Palette is the spectrum, read by card position — the four card pairs.
 *  - Hard edges. Mechanical where it can be.
 *  - prefers-reduced-motion gets the resting state, not a frozen first frame.
 *
 * One thing worth knowing while judging: today's sweep is *transient* — both
 * bars wipe in and then wipe back out, so the headline's resting state is plain
 * ink with no underline at all. Some candidates below leave colour on the page
 * (Highlighter, Stack, Declassify); some don't (Sweep, Type-in, Rise). That's a
 * bigger decision than the motion itself, because the resting state is what
 * you look at for the next ten minutes.
 */



// The real headline type, copied from SweepTitle so judgements transfer.
const H1: React.CSSProperties = {
  fontFamily: DISPLAY,
  fontSize: "clamp(2.75rem, 5vw, 4rem)",
  lineHeight: 1.25,
  fontWeight: 700,
  letterSpacing: "-0.055em",
  color: INK,
  margin: 0,
};

// Palette colours are tuned for fills, not for text on white — #D4F04A as a
// word is unreadable. Mixing toward ink keeps the hue and buys the contrast.
function inkMix(hex: string, t: number): string {
  const n = parseInt(hex.slice(1), 16);
  const mix = (c: number) => Math.round(c * (1 - t) + 26 * t);
  return `rgb(${mix((n >> 16) & 255)}, ${mix((n >> 8) & 255)}, ${mix(n & 255)})`;
}

// Same phrase split SweepTitle uses: break at the first verb, else halfway.
const VERBS = new Set(["drive", "drives", "shape", "shapes", "affect", "affects", "are", "is",
  "make", "makes", "help", "helps", "change", "changes", "influence", "influences",
  "determine", "determines", "impact", "impacts", "reveal", "reveals", "show", "shows",
  "explain", "explains", "challenge", "challenges", "use", "uses", "enable", "enables",
  "transform", "transforms", "predict", "predicts", "blur", "blurs", "define", "defines",
  "know", "knows", "keep", "keeps", "beat", "beats", "does", "do"]);

function splitPhrases(text: string): [string, string] {
  const words = text.split(" ");
  let at = -1;
  for (let i = 1; i < words.length - 1; i++) {
    if (VERBS.has(words[i].replace(/[^a-z]/gi, "").toLowerCase())) { at = i; break; }
  }
  if (at <= 0) at = Math.ceil(words.length / 2);
  return [words.slice(0, at).join(" "), words.slice(at).join(" ")];
}

// Words as separate elements, with the space kept OUTSIDE the animated box so a
// scaling word doesn't drag its own trailing space around.
function Words({ text, render }: { text: string; render: (word: string, i: number) => React.ReactNode }) {
  const words = text.split(" ");
  return (
    <>
      {words.map((w, i) => (
        <React.Fragment key={i}>
          {render(w, i)}
          {i < words.length - 1 ? " " : ""}
        </React.Fragment>
      ))}
    </>
  );
}

/* ── 1. Sweep (today) ─────────────────────────────────────────────────────
   Baseline. Bar wipes in under phrase one, wipes out, phrase two follows.
   Uses display:inline + background-image so the bar tracks text wrapping. */
function Sweep({ text }: { text: string }) {
  const [p1, p2] = splitPhrases(text);
  const bar = (i: number, delay: string): React.CSSProperties => ({
    display: "inline",
    backgroundImage: `linear-gradient(90deg, ${SOURCE_PALETTES[i][0]} 0%, ${SOURCE_PALETTES[i][1]} 100%)`,
    backgroundRepeat: "no-repeat",
    backgroundPosition: "left bottom",
    backgroundSize: "0% 9px",
    paddingBottom: 10,
    animationDelay: delay,
  });
  return (
    <h1 style={H1}>
      <span className="sw-bar" style={bar(0, "0.2s")}>{p1}</span>{" "}
      <span className="sw-bar" style={bar(1, "1.06s")}>{p2}</span>
    </h1>
  );
}

/* ── 2. Type-in ───────────────────────────────────────────────────────────
   Your idea: words scale up one at a time, each in a palette colour. The twist
   is that the colour is temporary — once the line has landed, every word
   settles to ink together. Colourful while it reads, calm once it's read. */
function TypeIn({ text }: { text: string }) {
  return (
    <h1 style={H1}>
      <Words
        text={text}
        render={(w, i) => (
          <span
            className="ti-word"
            style={{
              display: "inline-block",
              color: inkMix(SOURCE_PALETTES[i % SOURCE_PALETTES.length][0], 0.42),
              animationDelay: `${0.1 + i * 0.085}s, 1.5s`,
            }}
          >
            {w}
          </span>
        )}
      />
    </h1>
  );
}

/* ── 3. Highlighter ───────────────────────────────────────────────────────
   Your idea again, but the colour lands behind the words instead of in them —
   a marker wiping through each word in turn, like someone going at a printout.
   The marks stay: this one changes the resting state of the page. */
function Highlighter({ text }: { text: string }) {
  return (
    <h1 style={H1}>
      <Words
        text={text}
        render={(w, i) => {
          const [c1, c2] = SOURCE_PALETTES[i % SOURCE_PALETTES.length];
          return (
            <span
              className="hl-word"
              style={{
                display: "inline",
                backgroundImage: `linear-gradient(90deg, ${hex2rgba(c1, 0.85)}, ${hex2rgba(c2, 0.85)})`,
                backgroundRepeat: "no-repeat",
                backgroundPosition: "left 88%",
                backgroundSize: "0% 46%",
                animationDelay: `${0.15 + i * 0.11}s`,
              }}
            >
              {w}
            </span>
          );
        }}
      />
    </h1>
  );
}

/* ── 4. Stack ─────────────────────────────────────────────────────────────
   Your third idea, aimed at the headline: three cards tumble in and settle
   into the underline, one by one. Same border + hard shadow as a paper card,
   so the rule under the question is literally made of the sources. */
function Stack({ text }: { text: string }) {
  const WIDTHS = [3, 2, 4];
  return (
    <div>
      <h1 style={H1}>
        <Words
          text={text}
          render={(w, i) => (
            <span className="st-word" style={{ display: "inline-block", animationDelay: `${i * 0.045}s` }}>{w}</span>
          )}
        />
      </h1>
      <div style={{ display: "flex", gap: 7, marginTop: 16 }}>
        {WIDTHS.map((flex, i) => {
          const [c1, c2] = SOURCE_PALETTES[i % SOURCE_PALETTES.length];
          return (
            <div
              key={i}
              className="st-tile"
              style={{
                flex, height: 18,
                background: `linear-gradient(90deg, ${c1}, ${c2})`,
                border: `2px solid ${INK}`,
                boxShadow: `3px 3px 0 0 ${INK}`,
                animationDelay: `${0.45 + i * 0.17}s`,
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

/* ── 5. Declassify ────────────────────────────────────────────────────────
   Mine. The question arrives redacted — solid ink bars — and un-redacts word
   by word, right edge retracting left. It's the most "research archive" of the
   six and the only one where the motion means something: today's question was
   sealed until now. Colour arrives last, as the rule underneath. */
function Declassify({ text }: { text: string }) {
  return (
    <div>
      <h1 style={H1}>
        <Words
          text={text}
          render={(w, i) => (
            <span style={{ position: "relative", display: "inline-block" }}>
              {w}
              <span
                className="dc-block"
                style={{
                  position: "absolute", left: "-0.04em", right: "-0.04em", top: "7%", bottom: "13%",
                  background: INK, transformOrigin: "right center",
                  animationDelay: `${0.25 + i * 0.13}s`,
                }}
              />
            </span>
          )}
        />
      </h1>
      <div
        className="dc-rule"
        style={{
          height: 9, marginTop: 16, transformOrigin: "left center",
          background: `linear-gradient(90deg, ${SOURCE_PALETTES[0][0]}, ${SOURCE_PALETTES[1][0]}, ${SOURCE_PALETTES[2][1]})`,
          animationDelay: `${0.25 + text.split(" ").length * 0.13 + 0.15}s`,
        }}
      />
    </div>
  );
}

/* ── 6. Rise ──────────────────────────────────────────────────────────────
   Mine, the quiet one. Words lift 12px into place in sequence, then a hairline
   draws underneath. Same entrance as briefRise, which is already the site's
   motion vocabulary — this is the option that adds no new idea at all. */
function Rise({ text }: { text: string }) {
  const n = text.split(" ").length;
  return (
    <div>
      <h1 style={H1}>
        <Words
          text={text}
          render={(w, i) => (
            <span className="rs-word" style={{ display: "inline-block", animationDelay: `${i * 0.06}s` }}>{w}</span>
          )}
        />
      </h1>
      <div
        className="rs-rule"
        style={{ height: 3, marginTop: 18, background: INK, transformOrigin: "left center", animationDelay: `${n * 0.06 + 0.12}s` }}
      />
    </div>
  );
}

/* ── 7. Ink-fill — SHIPPED ────────────────────────────────────────────────
   The question arrives as hollow outline type and fills with ink word by word.
   No colour at all: the palette rule this originally ended on was cut, so the
   only event is the fill. This is what `InkTitle` in today-page.tsx does. */
function InkFill({ text }: { text: string }) {
  return (
    <h1 style={{ ...H1, WebkitTextStrokeColor: INK }}>
      <Words
        text={text}
        render={(w, i) => (
          <span className="if-word" style={{ display: "inline-block", animationDelay: `${0.15 + i * 0.1}s` }}>{w}</span>
        )}
      />
    </h1>
  );
}

const CANDIDATES: { key: string; name: string; note: string; el: (t: string) => React.ReactNode }[] = [
  {
    key: "sweep", name: "1 · Sweep (today)",
    note: "The baseline. Two phrases, bar in and back out. Nothing remains — the resting headline is plain ink.",
    el: t => <Sweep text={t} />,
  },
  {
    key: "typein", name: "2 · Type-in",
    note: "Words scale up one by one in palette colours, then all settle to ink together. Colour is the reading experience, not the resting state. Palette mixed 42% toward ink or the yellows are illegible.",
    el: t => <TypeIn text={t} />,
  },
  {
    key: "highlighter", name: "3 · Highlighter",
    note: "The same one-by-one rhythm with the colour behind the words instead of in them. Marks stay put — loudest at rest, and the only one that still reads as 'marked up' an hour later.",
    el: t => <Highlighter text={t} />,
  },
  {
    key: "stack", name: "4 · Stack",
    note: "Three cards tumble in and settle into the underline — card border and hard shadow, so the rule is made of the sources. Reads as the loader's cousin.",
    el: t => <Stack text={t} />,
  },
  {
    key: "declassify", name: "5 · Declassify",
    note: "The question arrives redacted and un-redacts word by word. Most on-brand for a research archive, and the only one whose motion carries a meaning. Costs the most attention.",
    el: t => <Declassify text={t} />,
  },
  {
    key: "rise", name: "6 · Rise",
    note: "Words lift into place, hairline draws under. Same vocabulary as briefRise. Adds no new idea — the safe floor.",
    el: t => <Rise text={t} />,
  },
  {
    key: "inkfill", name: "7 · Ink-fill — SHIPPED",
    note: "Hollow outline type fills with ink word by word. No colour — the palette rule it used to end on was cut. This is what the digest headline does now.",
    el: t => <InkFill text={t} />,
  },
];

const THEMES = [
  "Why does a headband know you're bored?",
  "Do plants keep time without a clock?",
  "What makes a crowd smarter than its smartest member?",
];

export default function HeadlinePrototype() {
  const [theme, setTheme] = useState(THEMES[0]);
  const [slow, setSlow] = useState(false);
  const [run, setRun] = useState(0); // bump to remount and restart every animation

  const btn = (active: boolean): React.CSSProperties => ({
    ...DISPLAY_SM,
    background: active ? INK : SURFACE, color: active ? SURFACE : INK,
    border: `2px solid ${INK}`, padding: "8px 14px", cursor: "pointer",
  });

  return (
    <div style={{ minHeight: "100vh", background: SURFACE, color: INK, ["--spd" as string]: slow ? 2.4 : 1 }}>
      <style>{`
        /* 1 · Sweep — the anchor flip at 100% size is invisible, which is what
           lets one keyframe do both the wipe in and the wipe back out. */
        @keyframes swBar {
          0%   { background-size: 0% 9px;   background-position: left bottom }
          48%  { background-size: 100% 9px; background-position: left bottom }
          52%  { background-size: 100% 9px; background-position: right bottom }
          100% { background-size: 0% 9px;   background-position: right bottom }
        }
        .sw-bar { animation: swBar calc(1.08s * var(--spd)) ease-in-out both; }

        /* 2 · Type-in — two animations: the pop is staggered per word, the
           colour settle fires at one fixed moment for every word at once.
           tiSettle has no from-keyframe, so it starts from the inline colour. */
        @keyframes tiPop { from { opacity: 0; transform: scale(0.62) } to { opacity: 1; transform: scale(1) } }
        @keyframes tiSettle { to { color: ${INK} } }
        .ti-word {
          animation-name: tiPop, tiSettle;
          animation-duration: calc(0.4s * var(--spd)), calc(0.55s * var(--spd));
          animation-timing-function: cubic-bezier(.2,.9,.25,1.25), ease;
          animation-fill-mode: both, forwards;
        }

        /* 3 · Highlighter */
        @keyframes hlWipe { from { background-size: 0% 46% } to { background-size: 100% 46% } }
        .hl-word { animation: hlWipe calc(0.34s * var(--spd)) ease-out both; }

        /* 4 · Stack */
        @keyframes stWord { from { opacity: 0 } to { opacity: 1 } }
        .st-word { animation: stWord calc(0.3s * var(--spd)) ease both; }
        @keyframes stTumble {
          0%   { opacity: 0; transform: translateY(-110px) rotate(-155deg) scale(0.5) }
          55%  { opacity: 1 }
          100% { opacity: 1; transform: translateY(0) rotate(0deg) scale(1) }
        }
        .st-tile { animation: stTumble calc(0.62s * var(--spd)) cubic-bezier(.2,.8,.3,1.15) both; }

        /* 5 · Declassify */
        @keyframes dcLift { from { transform: scaleX(1) } to { transform: scaleX(0) } }
        .dc-block { animation: dcLift calc(0.34s * var(--spd)) cubic-bezier(.5,0,.2,1) both; }
        @keyframes dcRule { from { transform: scaleX(0) } to { transform: scaleX(1) } }
        .dc-rule { animation: dcRule calc(0.5s * var(--spd)) ease-out both; }

        /* 6 · Rise */
        @keyframes rsWord { from { opacity: 0; transform: translateY(12px) } to { opacity: 1; transform: translateY(0) } }
        .rs-word { animation: rsWord calc(0.42s * var(--spd)) ease both; }
        @keyframes rsRule { from { transform: scaleX(0) } to { transform: scaleX(1) } }
        .rs-rule { animation: rsRule calc(0.45s * var(--spd)) ease-out both; }

        /* 7 · Ink-fill — the stroke goes to 0 as the fill arrives, so the
           resting headline is exactly today's weight, not a stroked version. */
        @keyframes ifFill {
          from { color: transparent; -webkit-text-stroke-width: 1.5px }
          to   { color: ${INK};      -webkit-text-stroke-width: 0px }
        }
        .if-word { animation: ifFill calc(0.4s * var(--spd)) ease-out both; }

        /* Reduced motion gets each candidate's RESTING state — not its first
           frame, which for Declassify would be a fully redacted headline. */
        @media (prefers-reduced-motion: reduce) {
          .sw-bar, .ti-word, .hl-word, .st-word, .st-tile, .dc-block, .dc-rule,
          .rs-word, .rs-rule, .if-word {
            animation: none !important;
          }
          .ti-word, .if-word { color: ${INK} !important }
          .hl-word { background-size: 100% 46% !important }
          .dc-block { transform: scaleX(0) !important }
          .dc-rule, .rs-rule { transform: scaleX(1) !important }
        }
      `}</style>

      <div style={{ maxWidth: 880, margin: "0 auto", padding: "48px 24px 96px" }}>
        <h1 style={{ ...DISPLAY_LG, margin: "0 0 10px" }}>
          Headline animation candidates
        </h1>
        <p style={{ ...BODY_STYLE, color: MUTED, margin: "0 0 20px", maxWidth: 620 }}>
          Pick one and it replaces <code>SweepTitle</code> on the digest. All CSS, no library.
          Rendered at the real headline size in a 760px column, so what you see is what ships.
          Try the long theme — it wraps, which is where most of these break.
        </p>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
          {THEMES.map((t, i) => (
            <button key={t} onClick={() => { setTheme(t); setRun(r => r + 1); }} style={btn(theme === t)}>
              {["Short", "Medium", "Wraps"][i]}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 48 }}>
          <button onClick={() => setRun(r => r + 1)} style={btn(false)}>Replay all ↻</button>
          <button onClick={() => setSlow(s => !s)} style={btn(slow)}>{slow ? "Normal speed" : "Slow motion"}</button>
        </div>

        <div style={{ display: "grid", gap: 40 }}>
          {CANDIDATES.map(c => (
            <div key={c.key} style={{ border: `2px solid ${INK}`, background: SURFACE, boxShadow: SHADOW }}>
              <div
                onClick={() => setRun(r => r + 1)}
                title="Click to replay"
                style={{ padding: "40px 32px 44px", borderBottom: `2px solid ${INK}`, cursor: "pointer", maxWidth: 760, overflow: "hidden" }}
              >
                <div key={`${run}-${theme}`}>{c.el(theme)}</div>
              </div>
              <div style={{ padding: "16px 20px 18px" }}>
                <div style={{ ...DISPLAY_SM, marginBottom: 6 }}>{c.name}</div>
                <p style={{ ...BODY_STYLE, color: MUTED, margin: 0 }}>{c.note}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
