"use client";

import React, { useState } from "react";
import type { PaperItem } from "@/lib/types";
import { PaperCard, paperByline } from "@/components/paper-card";
import {
  BODY_STYLE, BODY_SM, BORDER, DIM, DISPLAY, DISPLAY_SM, HAIRLINE, INK, MUTED,
  RULE, SHADOW, SPECTRUM, SURFACE, Segmented, Tag, washSlots, wash,
} from "@/components/design-system";

/*
 * Paper card candidates — /prototype/cards.
 *
 * Round 1 asked what container the findings and the takeaway deserve. The
 * answers to that round:
 *
 *  - Reading size wins. Everything here is Body 15 at a 26px line, never 13.
 *  - The mono grey eyebrow is out. Section headings are Cabinet Grotesk at
 *    Display/SM, in ink — the same face and weight as the card's title, so a
 *    heading reads as a heading and not as a caption for the machinery.
 *  - The highlight is in. A hue mark behind the takeaway's claim is the one
 *    place colour lands on type, and it is the takeaway's emphasis in every
 *    candidate. Findings keep **bold** — two different marks doing two
 *    different jobs, rather than one mark diluted across the whole card.
 *  - Title first, then byline, then the TL;DR. That's the prod order, and
 *    every candidate keeps it except E, which is the deliberate outlier.
 *
 * Round 2 stops asking about containers and scrambles the card instead. All
 * six use material the digest already generates and then throws away:
 * `methodType` ("Field study"), `methodFacts` ("They tracked 1,200 counties
 * for twenty years."), `takeawayStat` and `connectionReason` are written by
 * the metadata call on every paper and rendered by no surface in the product.
 *
 * Nothing here is wired to the API. Candidate A is the real component.
 */

/* ── Samples ─────────────────────────────────────────────────────────────── */

const SAMPLES: PaperItem[] = [
  {
    id: "s1",
    title: "Cost-sensitive machine learning for startup success prediction",
    plainName: "AI models that predict startup success",
    summary:
      "Researchers tested machine learning models on 10,000 Israeli startups to see if AI could predict which ones would succeed.",
    source: "semantic_scholar",
    sourceUrl: "https://example.com/startups",
    keywords: ["machine learning", "venture capital", "risk"],
    authors: ["Ronald Setty", "Yuval Elovici"],
    year: 2024,
    category: "recent",
    keyFindings: [
      "Cost-sensitive AI models **significantly reduced investment risk** compared to standard prediction models",
      "The tradeoff is real: **fewer successful startups were identified** when the model prioritized avoiding bad bets",
      "Combining results from **multiple models improved startup identification**, especially for investors with smaller deal flows",
    ],
    claim:
      "AI models that treat different prediction mistakes as having different costs can meaningfully reduce risk for startup investors.",
    takeawayLine:
      "Turns out you can basically dial in how risky you want your startup bets to be — tell the AI 'missing a winner hurts more than backing a loser' and it changes its whole strategy.",
    takeawayStat: "10,000 startups",
    methodType: "Field study",
    methodFacts: [
      "They analysed 10,000 Israeli startups.",
      "Five prediction models were compared.",
      "Outcomes were tracked through 2022.",
    ],
    connectionReason:
      "It shows what happens when a prediction system is told which mistake it should be afraid of.",
  },
  {
    id: "s2",
    title: "Urban tree canopy and heat-related emergency visits across 1,200 US counties",
    plainName: "How city trees change summer hospital visits",
    summary:
      "A twenty-year panel of 1,200 US counties finds that neighbourhoods which added tree canopy saw fewer heat-related emergency visits, and the effect was largest on the blocks that started with the least shade.",
    source: "arxiv",
    sourceUrl: "https://example.com/canopy",
    keywords: ["urban heat", "public health", "trees"],
    authors: ["Amara Osei", "Lin Zhao", "Peter Vance"],
    year: 2025,
    category: "recent",
    keyFindings: [
      "Each **10 percentage-point gain in canopy cover** tracked a **7% drop in heat-related emergency visits**, holding income and air-conditioning access constant",
      "The benefit **concentrated in the lowest-canopy blocks** — above roughly 40% cover the curve flattens, so the marginal tree buys much less than the first one did",
      "Cooling showed up **within three summers of planting**, well before the canopy matures, which the authors did not expect",
    ],
    claim: "Shade is triage, not decoration.",
    takeawayLine:
      "Planting is a health intervention with a dose-response curve, and the dose that matters is the first ten points of shade on the hottest, barest blocks. Spending the same budget spreading trees evenly across a city is, on this evidence, close to wasting most of it.",
    takeawayStat: "7% fewer visits",
    methodType: "Panel study",
    methodFacts: [
      "They tracked 1,200 counties for twenty years.",
      "Canopy was measured from satellite imagery.",
      "Visits came from emergency-department records.",
    ],
    connectionReason:
      "It turns a landscaping budget into a public-health lever with a measurable dose.",
  },
  {
    id: "s3",
    title: "EU regulators open a consultation on automated hiring tools",
    plainName: "Europe asks what hiring algorithms owe applicants",
    summary:
      "The Commission has opened a three-month consultation on how automated hiring tools should explain their decisions to the people they reject.",
    source: "rss",
    sourceUrl: "https://example.com/eu-hiring",
    keywords: ["regulation", "hiring"],
    authors: [],
    year: 2026,
    category: "news",
    keyFindings: [
      "The draft would require an **explanation on rejection**, not on request",
      "Vendors, not employers, would carry the **documentation burden**",
    ],
    claim: "The burden is moving from the person rejected to the company doing the rejecting.",
    takeawayLine: "",
    takeawayStat: null,
    methodType: "News feature",
    methodFacts: ["The consultation runs for three months.", "Comments close in November."],
    connectionReason:
      "It is the first draft that makes the vendor, not the employer, hold the paperwork.",
  },
];

/* ── Shared ──────────────────────────────────────────────────────────────── */

type Emphasis = "bold" | "underline" | "hue";
type HeadingCase = "caps" | "sentence";

/** Findings emphasis — the pipeline's **bold**, three ways. Default is weight. */
function marks(text: string, mode: Emphasis, hue: string): React.ReactNode[] {
  return text.split(/\*\*(.+?)\*\*/g).map((part, i) => {
    if (!part) return null;
    if (i % 2 === 0) return <span key={i}>{part}</span>;
    if (mode === "bold") return <strong key={i} style={{ fontWeight: 600 }}>{part}</strong>;
    if (mode === "underline")
      return (
        <span key={i} style={{ textDecoration: "underline", textDecorationThickness: 2, textUnderlineOffset: 3 }}>
          {part}
        </span>
      );
    return <Marked key={i} hue={hue}>{part}</Marked>;
  });
}

/** The takeaway's emphasis: a hue mark behind the type. The one place colour lands on words. */
function Marked({ children, hue }: { children: React.ReactNode; hue: string }) {
  return (
    <span style={{ background: hue, boxDecorationBreak: "clone", WebkitBoxDecorationBreak: "clone", padding: "2px 4px" }}>
      {children}
    </span>
  );
}

function startCap(text: string): string {
  return text.replace(/[A-Za-z]/, (l) => l.toUpperCase());
}

/** Reading size. Every candidate shares it; the tiles in prod are 13. */
const READ: React.CSSProperties = { ...BODY_STYLE, lineHeight: "26px" };

const HERO: React.CSSProperties = {
  fontFamily: DISPLAY, fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em",
  lineHeight: "28px", color: INK, margin: 0,
};

function content(p: PaperItem) {
  const body = (p.summary || p.abstract || "").trim();
  const hero = body.match(/[^.!?]+[.!?]+["')\]]?/)?.[0]?.trim() || body;
  const claim = (p.claim || "").trim();
  const line = (p.takeawayLine || "").trim();
  return {
    hero,
    claim,
    line,
    findings: (p.keyFindings ?? []).slice(0, 3),
    findingsLabel: p.source === "rss" ? "Key points" : "Findings",
    facts: (p.methodFacts ?? []).slice(0, 3),
    method: (p.methodType || "").trim(),
    stat: (p.takeawayStat || "").trim(),
    why: (p.connectionReason || "").trim(),
    byline: paperByline(p),
  };
}

interface CandidateProps {
  paper: PaperItem;
  index: number;
  /** How **bold** renders inside findings. */
  mode: Emphasis;
  hcase: HeadingCase;
  /** The resolved highlight colour for the takeaway. */
  hue: string;
  open: boolean;
  setOpen: (v: boolean) => void;
}

/** Section heading — Cabinet Grotesk in ink, not a mono grey eyebrow. */
function Heading({ children, hcase, style }: { children: React.ReactNode; hcase: HeadingCase; style?: React.CSSProperties }) {
  return (
    <h3 style={{ ...DISPLAY_SM, textTransform: hcase === "caps" ? "uppercase" : "none", margin: "0 0 10px", ...style }}>
      {children}
    </h3>
  );
}

/** Title, byline, TL;DR — the prod order, kept by every candidate but E. */
function Head({ paper, c }: { paper: PaperItem; c: ReturnType<typeof content> }) {
  return (
    <>
      <h3 style={{ ...DISPLAY_SM, margin: 0 }}>{paper.plainName || paper.title}</h3>
      {c.byline && <div style={{ ...BODY_SM, fontStyle: "italic", color: DIM, marginTop: -6 }}>{c.byline}</div>}
      {c.hero && <p style={{ ...HERO, marginTop: 4 }}>{c.hero}</p>}
    </>
  );
}

/** Claim marked, the spoken line plain behind it. */
function Takeaway({ c, hue }: { c: ReturnType<typeof content>; hue: string }) {
  const lead = startCap(c.claim || c.line);
  const rest = c.claim && c.line ? c.line : "";
  if (!lead) return null;
  return (
    <p style={{ ...READ, margin: 0 }}>
      <Marked hue={hue}>{lead}</Marked>
      {rest ? ` ${rest}` : ""}
    </p>
  );
}

function Shell({ index, children, style }: { index: number; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ ...wash(index), border: BORDER, boxShadow: SHADOW, padding: "22px 24px", display: "flex", flexDirection: "column", gap: 12, overflow: "hidden", ...style }}>
      {children}
    </div>
  );
}

function ExpandLine({ open, onClick, label }: { open: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      style={{ ...BODY_SM, fontWeight: 600, background: "none", border: "none", padding: 0, cursor: "pointer", color: INK, textAlign: "left", alignSelf: "flex-start", textDecoration: "underline", textUnderlineOffset: 4 }}
    >
      {open ? "Hide ↑" : `${label} ↓`}
    </button>
  );
}

function ReadPaper({ href, small = false }: { href: string | null; small?: boolean }) {
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="ds-lift"
      style={{ ...DISPLAY_SM, display: "inline-flex", alignItems: "center", gap: 8, background: INK, color: SURFACE, border: BORDER, boxShadow: SHADOW, padding: small ? "9px 16px" : "12px 22px", textDecoration: "none", alignSelf: "flex-start" }}
    >
      Read paper ↗
    </a>
  );
}

/* ── Findings, six ways ──────────────────────────────────────────────────── */

/** Rows divided by hairlines. */
function LedgerRows({ items, mode, hue }: { items: string[]; mode: Emphasis; hue: string }) {
  return (
    <div>
      {items.map((f, i) => (
        <p key={i} style={{ ...READ, margin: 0, padding: i === 0 ? "0 0 12px" : "12px 0", borderTop: i === 0 ? undefined : HAIRLINE }}>
          {marks(startCap(f), mode, hue)}
        </p>
      ))}
    </div>
  );
}

/** A hue square instead of a bullet, aligned to the first line. */
function SquareRows({ items, mode, hue }: { items: string[]; mode: Emphasis; hue: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {items.map((f, i) => (
        <div key={i} style={{ display: "flex", gap: 12 }}>
          <span aria-hidden style={{ width: 10, height: 10, background: hue, border: `1px solid ${INK}`, flexShrink: 0, marginTop: 8 }} />
          <p style={{ ...READ, margin: 0 }}>{marks(startCap(f), mode, hue)}</p>
        </div>
      ))}
    </div>
  );
}

/** No bullets, no rules — just air between the rows. */
function PlainRows({ items, mode, hue, gap = 12 }: { items: string[]; mode: Emphasis; hue: string; gap?: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap }}>
      {items.map((f, i) => (
        <p key={i} style={{ ...READ, margin: 0 }}>{marks(startCap(f), mode, hue)}</p>
      ))}
    </div>
  );
}

/**
 * The bold phrase promoted to its own line in the display face; the rest of the
 * sentence becomes its deck. Scannable at a glance without reading a word of body.
 */
function HeadlineDeck({ items, hcase }: { items: string[]; hcase: HeadingCase }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {items.map((f, i) => {
        const m = f.match(/\*\*(.+?)\*\*/);
        if (!m) return <p key={i} style={{ ...READ, margin: 0 }}>{startCap(f)}</p>;
        // The deck is the sentence with its headline phrase lifted out — an
        // ellipsis where the phrase was, so nothing is read twice.
        const before = f.slice(0, m.index).trim();
        const after = f.slice((m.index ?? 0) + m[0].length).replace(/^[\s,;:.]+/, "").trim();
        const deck = [before, after].filter(Boolean).join(" … ");
        return (
          <div key={i}>
            <div style={{ ...DISPLAY_SM, textTransform: hcase === "caps" ? "uppercase" : "none", marginBottom: 2 }}>
              {startCap(m[1])}
            </div>
            {deck && <p style={{ ...READ, margin: 0, color: DIM }}>{startCap(deck)}</p>}
          </div>
        );
      })}
    </div>
  );
}

/** Three columns divided by 2px rules — the poster treatment. */
function Triptych({ items, mode, hue }: { items: string[]; mode: Emphasis; hue: string }) {
  return (
    <div className="proto-triptych">
      {items.map((f, i) => (
        <p key={i} style={{ ...READ, margin: 0 }}>{marks(startCap(f), mode, hue)}</p>
      ))}
    </div>
  );
}

/* ── Round 1, refit ──────────────────────────────────────────────────────── */

/** B · Ledger — the tiles deleted, the takeaway's hue moved onto the words. */
function CandidateB({ paper, index, mode, hcase, hue, open, setOpen }: CandidateProps) {
  const c = content(paper);
  return (
    <Shell index={index}>
      <Head paper={paper} c={c} />
      <ExpandLine open={open} onClick={() => setOpen(!open)} label={`${c.findingsLabel} and takeaway`} />
      {open && (
        <div style={{ display: "flex", flexDirection: "column", gap: 22, marginTop: 6 }}>
          {c.findings.length > 0 && (
            <section>
              <Heading hcase={hcase}>{c.findingsLabel}</Heading>
              <LedgerRows items={c.findings} mode={mode} hue={hue} />
            </section>
          )}
          <section>
            <Heading hcase={hcase}>Takeaway</Heading>
            <Takeaway c={c} hue={hue} />
          </section>
          <ReadPaper href={paper.sourceUrl} />
        </div>
      )}
    </Shell>
  );
}

/** C · Strata — sections as strata of the card, divided by its own 2px rule. */
function CandidateC({ paper, index, mode, hcase, hue, open, setOpen }: CandidateProps) {
  const c = content(paper);
  return (
    <div style={{ ...wash(index), border: BORDER, boxShadow: SHADOW, overflow: "hidden" }}>
      <div style={{ padding: "22px 24px", display: "flex", flexDirection: "column", gap: 12 }}>
        <Head paper={paper} c={c} />
      </div>
      <button
        onClick={() => setOpen(!open)}
        style={{ ...DISPLAY_SM, textTransform: hcase === "caps" ? "uppercase" : "none", width: "100%", textAlign: "left", background: "transparent", border: "none", borderTop: BORDER, padding: "12px 24px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}
      >
        <span>{open ? "Close" : `${c.findingsLabel} · Takeaway`}</span>
        <span aria-hidden>{open ? "↑" : "↓"}</span>
      </button>
      {open && (
        <>
          {c.findings.length > 0 && (
            <section style={{ borderTop: BORDER, padding: "18px 24px", background: SURFACE }}>
              <Heading hcase={hcase}>{c.findingsLabel}</Heading>
              <LedgerRows items={c.findings} mode={mode} hue={hue} />
            </section>
          )}
          <section style={{ borderTop: BORDER, padding: "18px 24px 22px", background: hue }}>
            <Heading hcase={hcase}>Takeaway</Heading>
            <p style={{ ...READ, margin: "0 0 18px" }}>{startCap([c.claim, c.line].filter(Boolean).join(" "))}</p>
            <ReadPaper href={paper.sourceUrl} />
          </section>
        </>
      )}
    </div>
  );
}

/** D · Conclusion first — the takeaway is the hero, marked, and only evidence hides. */
function CandidateD({ paper, index, mode, hcase, hue, open, setOpen }: CandidateProps) {
  const c = content(paper);
  return (
    <Shell index={index}>
      <h3 style={{ ...DISPLAY_SM, margin: 0 }}>{paper.plainName || paper.title}</h3>
      {c.byline && <div style={{ ...BODY_SM, fontStyle: "italic", color: DIM, marginTop: -6 }}>{c.byline}</div>}
      <p style={{ ...HERO, marginTop: 6 }}>
        <Marked hue={hue}>{startCap(c.claim || c.hero)}</Marked>
      </p>
      {c.claim && c.line && <p style={{ ...READ, margin: 0 }}>{c.line}</p>}

      {c.findings.length > 0 && <ExpandLine open={open} onClick={() => setOpen(!open)} label={`See the ${c.findingsLabel.toLowerCase()}`} />}
      {open && (
        <div style={{ display: "flex", flexDirection: "column", gap: 22, marginTop: 6 }}>
          <section>
            <Heading hcase={hcase}>{paper.source === "rss" ? "The story" : "What they did"}</Heading>
            <p style={{ ...READ, margin: 0, color: DIM }}>{c.hero}</p>
          </section>
          <section>
            <Heading hcase={hcase}>{c.findingsLabel}</Heading>
            <LedgerRows items={c.findings} mode={mode} hue={hue} />
          </section>
          <ReadPaper href={paper.sourceUrl} />
        </div>
      )}
    </Shell>
  );
}

/** E · Colophon — no expand control, citation at the foot. The one that moves the name. */
function CandidateE({ paper, index, mode, hue }: CandidateProps) {
  const c = content(paper);
  return (
    <Shell index={index} style={{ gap: 18 }}>
      <p style={HERO}>{c.hero}</p>
      {c.findings.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {c.findings.map((f, i) => (
            <div key={i} style={{ display: "flex", gap: 14 }}>
              <span style={{ ...DISPLAY_SM, color: MUTED, width: 24, flexShrink: 0, lineHeight: "26px" }}>
                {String(i + 1).padStart(2, "0")}
              </span>
              <p style={{ ...READ, margin: 0 }}>{marks(startCap(f), mode, hue)}</p>
            </div>
          ))}
        </div>
      )}
      <Takeaway c={c} hue={hue} />
      <div style={{ borderTop: HAIRLINE, paddingTop: 14, display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <div style={{ ...DISPLAY_SM }}>{paper.plainName || paper.title}</div>
          {c.byline && <div style={{ ...BODY_SM, fontStyle: "italic", color: DIM, marginTop: 2 }}>{c.byline}</div>}
        </div>
        <ReadPaper href={paper.sourceUrl} small />
      </div>
    </Shell>
  );
}

/* ── Round 2 — scrambles ─────────────────────────────────────────────────── */

/**
 * F · Argument. The card as a claim with its evidence: headings become the
 * moves in an argument rather than the names of database fields, and the
 * takeaway closes it. Nothing hides.
 */
function CandidateF({ paper, index, mode, hcase, hue }: CandidateProps) {
  const c = content(paper);
  return (
    <Shell index={index} style={{ gap: 20 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Head paper={paper} c={c} />
      </div>
      {c.findings.length > 0 && (
        <section>
          <Heading hcase={hcase}>The evidence</Heading>
          <SquareRows items={c.findings} mode={mode} hue={hue} />
        </section>
      )}
      <section>
        <Heading hcase={hcase}>So what</Heading>
        <Takeaway c={c} hue={hue} />
      </section>
      <ReadPaper href={paper.sourceUrl} />
    </Shell>
  );
}

/**
 * G · Receipts. Everything the pipeline writes and the card currently drops:
 * the stat as a number you can see from across the room, the method type and
 * method facts behind one line, the keywords as tags.
 */
function CandidateG({ paper, index, mode, hcase, hue, open, setOpen }: CandidateProps) {
  const c = content(paper);
  return (
    <Shell index={index} style={{ gap: 18 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Head paper={paper} c={c} />
      </div>

      {c.stat && (
        <div style={{ display: "flex", alignItems: "baseline", gap: 14, flexWrap: "wrap" }}>
          <span style={{ fontFamily: DISPLAY, fontSize: 32, fontWeight: 700, letterSpacing: "-0.02em", lineHeight: "40px" }}>
            <Marked hue={hue}>{c.stat}</Marked>
          </span>
          {c.method && <span style={{ ...BODY_SM, color: DIM }}>{c.method}</span>}
        </div>
      )}

      {c.findings.length > 0 && (
        <section>
          <Heading hcase={hcase}>{c.findingsLabel}</Heading>
          <PlainRows items={c.findings} mode={mode} hue={hue} />
        </section>
      )}

      <section>
        <Heading hcase={hcase}>Takeaway</Heading>
        <Takeaway c={c} hue={hue} />
      </section>

      {c.facts.length > 0 && (
        <div>
          <ExpandLine open={open} onClick={() => setOpen(!open)} label="How they did it" />
          {open && (
            <p style={{ ...READ, margin: "10px 0 0", color: DIM }}>{c.facts.join(" ")}</p>
          )}
        </div>
      )}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {paper.keywords.slice(0, 3).map((k) => <Tag key={k} label={k} variant="glass" />)}
      </div>

      <ReadPaper href={paper.sourceUrl} />
    </Shell>
  );
}

/**
 * H · Split. The takeaway takes the wide column and the findings sit beside it
 * behind a 2px rule, so the point and its evidence are read together instead of
 * one under the other. Stacks below 720px.
 */
function CandidateH({ paper, index, mode, hcase, hue }: CandidateProps) {
  const c = content(paper);
  return (
    <Shell index={index} style={{ gap: 18 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Head paper={paper} c={c} />
      </div>
      <div className="proto-split">
        <section>
          <Heading hcase={hcase}>Takeaway</Heading>
          <Takeaway c={c} hue={hue} />
          <div style={{ marginTop: 18 }}><ReadPaper href={paper.sourceUrl} small /></div>
        </section>
        <section>
          <Heading hcase={hcase}>{c.findingsLabel}</Heading>
          <PlainRows items={c.findings} mode={mode} hue={hue} gap={14} />
        </section>
      </div>
    </Shell>
  );
}

/**
 * I · Headline & deck. Each finding's bold phrase is promoted to its own line
 * in the display face and the rest of the sentence becomes its deck — the
 * findings can be read in three seconds or in thirty.
 */
function CandidateI({ paper, index, hcase, hue }: CandidateProps) {
  const c = content(paper);
  return (
    <Shell index={index} style={{ gap: 20 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Head paper={paper} c={c} />
      </div>
      {/* No section heading: the three headlines are the findings, and one more
          Display/SM line above them would be the same style twice. */}
      {c.findings.length > 0 && <HeadlineDeck items={c.findings} hcase={hcase} />}
      <section>
        <Heading hcase={hcase}>Takeaway</Heading>
        <Takeaway c={c} hue={hue} />
      </section>
      <ReadPaper href={paper.sourceUrl} />
    </Shell>
  );
}

/**
 * J · Three questions. Headings stop naming fields and start asking what the
 * reader wants to know, which lets `connectionReason` — written on every paper,
 * rendered nowhere — carry the last section.
 */
function CandidateJ({ paper, index, mode, hcase, hue }: CandidateProps) {
  const c = content(paper);
  const news = paper.source === "rss";
  return (
    <Shell index={index} style={{ gap: 20 }}>
      <div>
        <h3 style={{ ...DISPLAY_SM, margin: 0 }}>{paper.plainName || paper.title}</h3>
        {c.byline && <div style={{ ...BODY_SM, fontStyle: "italic", color: DIM, marginTop: 4 }}>{c.byline}</div>}
      </div>
      <section>
        <Heading hcase={hcase}>{news ? "What happened" : "What they did"}</Heading>
        <p style={{ ...READ, margin: 0 }}>{c.hero}</p>
      </section>
      {c.findings.length > 0 && (
        <section>
          <Heading hcase={hcase}>{news ? "What it says" : "What they found"}</Heading>
          <PlainRows items={c.findings} mode={mode} hue={hue} />
        </section>
      )}
      <section>
        <Heading hcase={hcase}>Why it matters</Heading>
        {c.why && <p style={{ ...READ, margin: "0 0 10px", color: DIM }}>{c.why}</p>}
        <Takeaway c={c} hue={hue} />
      </section>
      <ReadPaper href={paper.sourceUrl} />
    </Shell>
  );
}

/**
 * K · Broadsheet. Findings run as three columns under a rule, the way a
 * research poster sets them, and the takeaway is a full-bleed band at the foot
 * with the heading inside it. The most structural of the six.
 */
function CandidateK({ paper, index, mode, hcase, hue }: CandidateProps) {
  const c = content(paper);
  return (
    <div style={{ ...wash(index), border: BORDER, boxShadow: SHADOW, overflow: "hidden" }}>
      <div style={{ padding: "22px 24px", display: "flex", flexDirection: "column", gap: 12 }}>
        <Head paper={paper} c={c} />
        {c.method && <div style={{ ...BODY_SM, color: DIM }}>{c.method}{c.facts[0] ? ` · ${c.facts[0]}` : ""}</div>}
      </div>
      {c.findings.length > 0 && (
        <section style={{ borderTop: BORDER, padding: "18px 24px", background: SURFACE }}>
          <Heading hcase={hcase}>{c.findingsLabel}</Heading>
          <Triptych items={c.findings} mode={mode} hue={hue} />
        </section>
      )}
      <section style={{ borderTop: BORDER, padding: "18px 24px 22px", background: hue, display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 20, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 320px" }}>
          <Heading hcase={hcase}>Takeaway</Heading>
          <p style={{ ...READ, margin: 0 }}>{startCap([c.claim, c.line].filter(Boolean).join(" "))}</p>
        </div>
        <ReadPaper href={paper.sourceUrl} small />
      </section>
    </div>
  );
}

/* ── The page ────────────────────────────────────────────────────────────── */

const ROUND_ONE: Candidate[] = [
  {
    key: "B",
    name: "Ledger",
    note: "The tiles are gone. Findings are rows divided by hairlines at reading size, the takeaway's claim carries the mark, and the card's own frame is the only box on screen.",
    axes: "Findings: hairline rows · Takeaway: marked claim · Expand: names what's inside",
    render: (p) => <CandidateB {...p} />,
  },
  {
    key: "C",
    name: "Strata",
    note: "Keeps the coloured takeaway but full-bleed, divided by the card's own 2px rule — nothing is a box inside a box. The seam between head and body is the expand control. No mark on the words here: the band is already the highlight.",
    axes: "Findings: white band · Takeaway: hue band · Expand: the seam itself",
    render: (p) => <CandidateC {...p} />,
  },
  {
    key: "D",
    name: "Conclusion first",
    note: "The takeaway is the best line on the card, so it becomes the TL;DR and wears the mark at display size. Title still leads. Only the evidence hides.",
    axes: "Findings: behind one toggle · Takeaway: marked, at display size · Expand: findings only",
    render: (p) => <CandidateD {...p} />,
  },
  {
    key: "E",
    name: "Colophon",
    note: "No expand control at all, and the one candidate that moves the name: numbered findings always visible, then the citation at the foot beside Read paper. Kept as the outlier — everything else leads with the title.",
    axes: "Findings: numbered, always open · Takeaway: marked claim · Expand: deleted · Name: at the foot",
    render: (p) => <CandidateE {...p} />,
  },
];

const ROUND_TWO: Candidate[] = [
  {
    key: "F",
    name: "Argument",
    note: "Headings stop naming database fields and start naming the moves in an argument: the evidence, then so what. Findings get a hue square instead of a bullet, which is the smallest possible dose of the card's colour.",
    axes: "Findings: hue squares · Headings: The evidence / So what · Nothing hides",
    render: (p) => <CandidateF {...p} />,
  },
  {
    key: "G",
    name: "Receipts",
    note: "Everything the pipeline writes and the card throws away. takeawayStat becomes a number you can read from across the room, methodType sits beside it, methodFacts go behind one line, and the keywords come back as tags.",
    axes: "New material: stat, method, method facts, keywords · Findings: plain rows · Expand: method only",
    render: (p) => <CandidateG {...p} />,
  },
  {
    key: "H",
    name: "Split",
    note: "The takeaway takes the wide column and the findings sit beside it behind a 2px rule, so the point and its evidence are read together rather than one under the other. Stacks below 720px.",
    axes: "Two columns · Takeaway: left, marked · Findings: right, plain rows",
    render: (p) => <CandidateH {...p} />,
  },
  {
    key: "I",
    name: "Headline & deck",
    note: "Each finding's bold phrase is promoted onto its own line in the display face, and the rest of the sentence becomes its deck with an ellipsis where the phrase was lifted out — nothing is read twice. Three seconds or thirty, which is what the bold was always trying to buy. No Findings heading: the headlines are the findings.",
    axes: "Findings: display headline + body deck · Takeaway: marked claim · Nothing hides",
    render: (p) => <CandidateI {...p} />,
  },
  {
    key: "J",
    name: "Three questions",
    note: "The headings ask what the reader wants to know — what they did, what they found, why it matters — which gives connectionReason (written on every paper, rendered nowhere) a job. No TL;DR line: the first answer is the TL;DR.",
    axes: "New material: connectionReason · Headings: questions · Hero: folded into the first answer",
    render: (p) => <CandidateJ {...p} />,
  },
  {
    key: "K",
    name: "Broadsheet",
    note: "Findings run as three columns under a rule, the way a research poster sets them, and the takeaway is a full-bleed band at the foot with its heading inside it. The method line rides under the byline.",
    axes: "Findings: three columns · Takeaway: hue band · New material: method + first method fact",
    render: (p) => <CandidateK {...p} />,
  },
];

export default function CardPrototypes() {
  const [sample, setSample] = useState(0);
  const [mode, setMode] = useState<Emphasis>("bold");
  const [hcase, setHcase] = useState<HeadingCase>("caps");
  const [pink, setPink] = useState(false);
  const [openMap, setOpenMap] = useState<Record<string, boolean>>({ B: true, C: true, D: true, G: true });

  const paper = SAMPLES[sample];
  const hue = pink ? SPECTRUM[0] : washSlots(sample)[0];
  const set = (k: string) => (v: boolean) => setOpenMap((m) => ({ ...m, [k]: v }));
  const props = (k: string): CandidateProps => ({
    paper, index: sample, mode, hcase, hue, open: openMap[k] ?? true, setOpen: set(k),
  });

  return (
    <div style={{ minHeight: "100vh", background: SURFACE, color: INK }}>
      <style>{`
        .proto-split { display: grid; grid-template-columns: 1.15fr 1fr; gap: 24px; }
        .proto-split > section + section { border-left: ${BORDER}; padding-left: 24px; }
        .proto-triptych { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
        .proto-triptych > p + p { border-left: ${HAIRLINE}; padding-left: 20px; }
        @media (max-width: 720px) {
          .proto-split, .proto-triptych { grid-template-columns: 1fr; }
          .proto-split > section + section { border-left: none; border-top: ${BORDER}; padding-left: 0; padding-top: 20px; }
          .proto-triptych > p + p { border-left: none; border-top: ${HAIRLINE}; padding-left: 0; padding-top: 16px; }
        }
      `}</style>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "48px 24px 120px" }}>
        <h1 style={{ fontFamily: DISPLAY, fontSize: 32, fontWeight: 700, letterSpacing: "-0.02em", lineHeight: "40px", margin: "0 0 10px" }}>
          Paper card candidates
        </h1>
        <p style={{ ...BODY_STYLE, color: DIM, margin: "0 0 8px", maxWidth: 640 }}>
          Ten cards against the real one. Everything reads at Body 15, section headings are
          Cabinet Grotesk in ink rather than a mono grey eyebrow, findings keep <strong style={{ fontWeight: 600 }}>bold</strong>{" "}
          and the takeaway carries the highlight. Round one argues about containers; round
          two scrambles the card and puts the fields the pipeline already writes —
          the stat, the method, why it matters — back on screen.
        </p>
        <p style={{ ...BODY_SM, color: MUTED, margin: "0 0 24px", maxWidth: 640 }}>
          Nothing here saves. The bookmark is live only on the current card.
        </p>

        <nav style={{ ...BODY_SM, display: "flex", flexWrap: "wrap", gap: "6px 14px", marginBottom: 32 }}>
          {[{ key: "A", name: "Tiles (prod)" }, ...ROUND_ONE, ...ROUND_TWO].map((c) => (
            <a key={c.key} href={`#c-${c.key}`} style={{ color: INK, textDecorationThickness: 1, textUnderlineOffset: 3 }}>
              {c.key} · {c.name}
            </a>
          ))}
        </nav>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 18, marginBottom: 44 }}>
          <Control label="Sample">
            <Segmented
              value={String(sample)}
              onChange={(v) => setSample(Number(v))}
              options={[{ key: "0", label: "Short" }, { key: "1", label: "Long" }, { key: "2", label: "News" }]}
              style={{ width: 290 }}
            />
          </Control>
          <Control label="Headings">
            <Segmented
              value={hcase}
              onChange={setHcase}
              options={[{ key: "caps" as const, label: "Caps" }, { key: "sentence" as const, label: "Sentence" }]}
              style={{ width: 220 }}
            />
          </Control>
          <Control label="Highlight">
            <Segmented
              value={pink ? "pink" : "hue"}
              onChange={(v) => setPink(v === "pink")}
              options={[{ key: "hue", label: "Card hue" }, { key: "pink", label: "Always pink" }]}
              style={{ width: 260 }}
            />
          </Control>
          <Control label="Emphasis in findings">
            <Segmented
              value={mode}
              onChange={setMode}
              options={[
                { key: "bold" as const, label: "Bold" },
                { key: "underline" as const, label: "Underline" },
                { key: "hue" as const, label: "Highlight" },
              ]}
              style={{ width: 320 }}
            />
          </Control>
        </div>

        <RoundTitle>Round one — what container the copy deserves</RoundTitle>

        <Frame
          id="c-A"
          eyebrow="Candidate A — in prod today"
          name="Tiles"
          note="The real component, unmodified — open it with its own See more. Findings and takeaway are Body/SM 13 in bordered tiles inside the bordered card, under mono grey eyebrows, and the takeaway sits on a full-strength fill."
          axes="Findings: bordered tile, 13 · Takeaway: solid fill tile · Expand: See more / See less"
        >
          <PaperCard paper={paper} index={sample} size="digest" />
        </Frame>

        {ROUND_ONE.map((c) => (
          <Frame key={c.key} id={`c-${c.key}`} eyebrow={`Candidate ${c.key}`} name={c.name} note={c.note} axes={c.axes}>
            {c.render(props(c.key))}
          </Frame>
        ))}

        <RoundTitle>Round two — scrambles</RoundTitle>

        {ROUND_TWO.map((c) => (
          <Frame key={c.key} id={`c-${c.key}`} eyebrow={`Candidate ${c.key}`} name={c.name} note={c.note} axes={c.axes}>
            {c.render(props(c.key))}
          </Frame>
        ))}

        <p style={{ ...BODY_SM, color: MUTED, marginTop: 48, maxWidth: 640 }}>
          The axes are separable. I&rsquo;s headline-and-deck findings drop into any of them,
          G&rsquo;s stat works above F&rsquo;s evidence list, J&rsquo;s question headings can sit over K&rsquo;s
          columns. Pick per axis and I&rsquo;ll compose the winner into the real card.
        </p>
      </div>
    </div>
  );
}

interface Candidate {
  key: string;
  name: string;
  note: string;
  axes: string;
  render: (p: CandidateProps) => React.ReactNode;
}

function RoundTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{ fontFamily: DISPLAY, fontSize: 32, fontWeight: 700, letterSpacing: "-0.02em", lineHeight: "40px", margin: "0 0 28px", paddingTop: 12, borderTop: BORDER }}>
      {children}
    </h2>
  );
}

function Control({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ ...DISPLAY_SM, marginBottom: 8 }}>{label}</div>
      {children}
    </div>
  );
}

function Frame({ id, eyebrow, name, note, axes, children }: {
  id: string;
  eyebrow: string;
  name: string;
  note: string;
  axes: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} style={{ marginBottom: 56, scrollMarginTop: 24 }}>
      <div style={{ ...BODY_SM, color: MUTED, marginBottom: 4 }}>{eyebrow}</div>
      <h3 style={{ ...DISPLAY_SM, margin: "0 0 8px" }}>{name}</h3>
      <p style={{ ...BODY_SM, color: DIM, margin: "0 0 6px", maxWidth: 640 }}>{note}</p>
      <p style={{ ...BODY_SM, color: MUTED, margin: "0 0 20px", maxWidth: 640 }}>{axes}</p>
      <div style={{ maxWidth: 760, borderTop: `1px solid ${RULE}`, paddingTop: 20 }}>{children}</div>
    </section>
  );
}
