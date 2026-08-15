"use client";

import React, { useState } from "react";
import type { PaperItem } from "@/lib/types";
import { PaperCard, paperByline } from "@/components/paper-card";
import {
  BODY_STYLE, BODY_SM, BORDER, DIM, DISPLAY, DISPLAY_SM, HAIRLINE, INK, MUTED,
  RULE, SHADOW, SURFACE, Segmented, washSlots, wash,
} from "@/components/design-system";

/*
 * Paper card candidates — /prototype/cards.
 *
 * Settled, and no longer switchable:
 *
 *  · The hero is 22, not Display/LG. At 32 the long sample ran to five lines
 *    and the TL;DR ate the card.
 *  · The takeaway's mark takes the card's own hue, not a fixed pink. It is
 *    wayfinding — the mark should match the card it belongs to.
 *  · Headings are Cabinet Grotesk at Display/SM in ink, findings mark with
 *    **bold**, everything reads at Body 15, order is title, byline, TL;DR.
 *
 * The news card is fixed: `findings` can be two items, and the broadsheet's
 * grid was hard-coded to three columns, so the third sat empty. The columns
 * now count the findings.
 *
 * Deleted this round: the stat card (a number with no sentence around it says
 * nothing), and everything else from rounds one and two.
 *
 * Open, and what the Bullets control is for: the findings are a list rendered
 * as paragraphs. A marker in a gutter makes each one a discrete unit and
 * hangs the text in a column — which is most of what "cleaner" means here.
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
  },
];

/* ── Shared ──────────────────────────────────────────────────────────────── */

type Bullet = "none" | "dot" | "square" | "number";

/** Findings mark with weight. */
function marks(text: string): React.ReactNode[] {
  return text.split(/\*\*(.+?)\*\*/g).map((part, i) =>
    !part ? null : i % 2 === 1
      ? <strong key={i} style={{ fontWeight: 600 }}>{part}</strong>
      : <span key={i}>{part}</span>
  );
}

/** The takeaway marks with the card's own hue. */
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

/** The first bold phrase — a finding's headline, when only one line fits. */
function headline(f: string): string {
  return startCap((f.match(/\*\*(.+?)\*\*/)?.[1] ?? f).trim());
}

const READ: React.CSSProperties = { ...BODY_STYLE, lineHeight: "26px" };
const READ_TIGHT: React.CSSProperties = { ...BODY_STYLE, lineHeight: "24px" };

const HERO: React.CSSProperties = {
  fontFamily: DISPLAY, fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em",
  lineHeight: "28px", color: INK, margin: "4px 0 0",
};

function content(p: PaperItem) {
  const body = (p.summary || p.abstract || "").trim();
  const hero = body.match(/[^.!?]+[.!?]+["')\]]?/)?.[0]?.trim() || body;
  return {
    hero,
    claim: (p.claim || "").trim(),
    line: (p.takeawayLine || "").trim(),
    findings: (p.keyFindings ?? []).slice(0, 3),
    findingsLabel: p.source === "rss" ? "Key points" : "Findings",
    byline: paperByline(p),
  };
}

interface CandidateProps {
  paper: PaperItem;
  index: number;
  hue: string;
  bullet: Bullet;
}

/** Section heading — Cabinet Grotesk in ink. */
function Heading({ children }: { children: React.ReactNode }) {
  return <h3 style={{ ...DISPLAY_SM, margin: "0 0 10px" }}>{children}</h3>;
}

function Head({ paper, c }: { paper: PaperItem; c: ReturnType<typeof content> }) {
  return (
    <div>
      <h3 style={{ ...DISPLAY_SM, margin: 0 }}>{paper.plainName || paper.title}</h3>
      {c.byline && <div style={{ ...BODY_SM, fontStyle: "italic", color: DIM, marginTop: 2 }}>{c.byline}</div>}
      {c.hero && <p style={HERO}>{c.hero}</p>}
    </div>
  );
}

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

/**
 * A marker in an 18px gutter with the text hanging in a column beside it.
 * Without one the findings are three paragraphs that happen to be near each
 * other; with one they read as a list.
 */
function Mark({ bullet, i, hue, lh }: { bullet: Bullet; i: number; hue: string; lh: number }) {
  if (bullet === "none") return null;
  if (bullet === "number")
    return (
      <span style={{ ...DISPLAY_SM, color: MUTED, width: 22, flexShrink: 0, lineHeight: `${lh}px` }}>
        {String(i + 1).padStart(2, "0")}
      </span>
    );
  const size = bullet === "dot" ? 5 : 8;
  return (
    <span aria-hidden style={{ width: 18, flexShrink: 0, display: "flex", justifyContent: "flex-start" }}>
      <span
        style={{
          width: size, height: size, marginTop: (lh - size) / 2 - 1,
          background: bullet === "dot" ? INK : hue,
          border: bullet === "square" ? `1px solid ${INK}` : undefined,
          borderRadius: bullet === "dot" ? "50%" : 0,
        }}
      />
    </span>
  );
}

function FindingList({ items, bullet, hue, tight = false, gap = 14 }: {
  items: string[];
  bullet: Bullet;
  hue: string;
  tight?: boolean;
  gap?: number;
}) {
  const style = tight ? READ_TIGHT : READ;
  const lh = tight ? 24 : 26;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap }}>
      {items.map((f, i) => (
        <div key={i} style={{ display: "flex" }}>
          <Mark bullet={bullet} i={i} hue={hue} lh={lh} />
          <p style={{ ...style, margin: 0 }}>{marks(startCap(f))}</p>
        </div>
      ))}
    </div>
  );
}

function Shell({ index, children, style }: { index: number; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ ...wash(index), border: BORDER, boxShadow: SHADOW, padding: "22px 24px", display: "flex", flexDirection: "column", gap: 18, overflow: "hidden", ...style }}>
      {children}
    </div>
  );
}

function ReadPaper({ href }: { href: string | null }) {
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="ds-lift"
      style={{ ...DISPLAY_SM, display: "inline-flex", alignItems: "center", gap: 8, background: INK, color: SURFACE, border: BORDER, boxShadow: SHADOW, padding: "9px 16px", textDecoration: "none", alignSelf: "flex-start" }}
    >
      Read paper ↗
    </a>
  );
}

/* ── K · Broadsheet ──────────────────────────────────────────────────────── */

/**
 * The winner. Strata divided by the card's own 2px rule, findings as poster
 * columns, the takeaway marked in the card's hue.
 *
 * The columns count the findings — hard-coding three left the news card, which
 * carries two key points, with an empty third of a band.
 */
function Broadsheet({ paper, index, hue, bullet }: CandidateProps) {
  const c = content(paper);
  return (
    <div style={{ ...wash(index), border: BORDER, boxShadow: SHADOW, overflow: "hidden" }}>
      <div style={{ padding: "22px 24px" }}>
        <Head paper={paper} c={c} />
      </div>
      {c.findings.length > 0 && (
        <section style={{ borderTop: BORDER, padding: "18px 24px", background: SURFACE }}>
          <Heading>{c.findingsLabel}</Heading>
          <div
            className="proto-cols"
            style={{ gridTemplateColumns: `repeat(${c.findings.length}, 1fr)` }}
          >
            {c.findings.map((f, i) => (
              <div key={i} style={{ display: "flex" }}>
                <Mark bullet={bullet} i={i} hue={hue} lh={26} />
                <p style={{ ...READ, margin: 0 }}>{marks(startCap(f))}</p>
              </div>
            ))}
          </div>
        </section>
      )}
      <section style={{ borderTop: BORDER, padding: "18px 24px 22px", display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 20, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 340px" }}>
          <Heading>Takeaway</Heading>
          <Takeaway c={c} hue={hue} />
        </div>
        <div><ReadPaper href={paper.sourceUrl} /></div>
      </section>
    </div>
  );
}

/* ── The split family ────────────────────────────────────────────────────── */

/** H · Split — point left, evidence right. */
function Split({ paper, index, hue, bullet }: CandidateProps) {
  const c = content(paper);
  return (
    <Shell index={index}>
      <Head paper={paper} c={c} />
      <div className="proto-split">
        <section>
          <Heading>Takeaway</Heading>
          <Takeaway c={c} hue={hue} />
          <div style={{ marginTop: 18 }}><ReadPaper href={paper.sourceUrl} /></div>
        </section>
        <section>
          <Heading>{c.findingsLabel}</Heading>
          <FindingList items={c.findings} bullet={bullet} hue={hue} />
        </section>
      </div>
    </Shell>
  );
}

/** H2 · Evidence first — the same rule, columns swapped. */
function SplitFlipped({ paper, index, hue, bullet }: CandidateProps) {
  const c = content(paper);
  return (
    <Shell index={index}>
      <Head paper={paper} c={c} />
      <div className="proto-split">
        <section>
          <Heading>{c.findingsLabel}</Heading>
          <FindingList items={c.findings} bullet={bullet} hue={hue} />
        </section>
        <section>
          <Heading>Takeaway</Heading>
          <Takeaway c={c} hue={hue} />
          <div style={{ marginTop: 18 }}><ReadPaper href={paper.sourceUrl} /></div>
        </section>
      </div>
    </Shell>
  );
}

/**
 * H3 · Rail, even. The height problem was the rail's width: at 290px each
 * finding wrapped to four or five lines, so the evidence column drove the
 * card. Equal columns cut most findings to two or three lines and hand the
 * height back to the left column, which is the one with something to say.
 */
function RailEven({ paper, index, hue, bullet }: CandidateProps) {
  const c = content(paper);
  return (
    <Shell index={index} style={{ padding: 0, gap: 0 }}>
      <div className="proto-rail proto-rail--even">
        <section style={{ padding: "22px 24px", display: "flex", flexDirection: "column", gap: 18 }}>
          <Head paper={paper} c={c} />
          <div>
            <Heading>Takeaway</Heading>
            <Takeaway c={c} hue={hue} />
          </div>
          <ReadPaper href={paper.sourceUrl} />
        </section>
        <section style={{ padding: "22px 24px" }}>
          <Heading>{c.findingsLabel}</Heading>
          <FindingList items={c.findings} bullet={bullet} hue={hue} tight gap={12} />
        </section>
      </div>
    </Shell>
  );
}

/**
 * H3b · Rail, headlines. The narrow rail kept, but each finding shows only its
 * bold phrase — one line each, so the column can never drive the card's height.
 * The cost is real: "Within three summers of planting" is not a sentence, and a
 * reader who wants the qualification has to open the paper.
 */
function RailHeadlines({ paper, index, hue, bullet }: CandidateProps) {
  const c = content(paper);
  return (
    <Shell index={index} style={{ padding: 0, gap: 0 }}>
      <div className="proto-rail">
        <section style={{ padding: "22px 24px", display: "flex", flexDirection: "column", gap: 18 }}>
          <Head paper={paper} c={c} />
          <div>
            <Heading>Takeaway</Heading>
            <Takeaway c={c} hue={hue} />
          </div>
          <ReadPaper href={paper.sourceUrl} />
        </section>
        <section style={{ padding: "22px 24px" }}>
          <Heading>{c.findingsLabel}</Heading>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {c.findings.map((f, i) => (
              <div key={i} style={{ display: "flex" }}>
                <Mark bullet={bullet} i={i} hue={hue} lh={24} />
                <p style={{ ...READ_TIGHT, margin: 0, fontWeight: 600 }}>{headline(f)}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </Shell>
  );
}

/* ── The page ────────────────────────────────────────────────────────────── */

interface Candidate {
  key: string;
  name: string;
  note: string;
  render: (p: CandidateProps) => React.ReactNode;
}

const CANDIDATES: Candidate[] = [
  {
    key: "K",
    name: "Broadsheet",
    note: "The winner. Hero back to 22, the mark takes the card's own hue, and the findings band counts its columns — the news card has two key points, and three hard-coded columns left the last one empty. That was the broken one.",
    render: (p) => <Broadsheet {...p} />,
  },
  {
    key: "H",
    name: "Split",
    note: "Point left, evidence right, one rule. Same bullet treatment as the rest — set it with the control above.",
    render: (p) => <Split {...p} />,
  },
  {
    key: "H2",
    name: "Evidence first",
    note: "The columns swapped, so the card argues toward its conclusion instead of stating it and then showing work. With a marker in the gutter the findings finally read as a list rather than three adjacent paragraphs.",
    render: (p) => <SplitFlipped {...p} />,
  },
  {
    key: "H3",
    name: "Rail, even",
    note: "The height problem was the rail's width: at 290px every finding wrapped to four or five lines, so the evidence column drove the card. Equal columns cut most to two or three and hand the height back to the left column, which is the one with something to say.",
    render: (p) => <RailEven {...p} />,
  },
  {
    key: "H3b",
    name: "Rail, headlines",
    note: "The narrow rail kept, but each finding shows only its bold phrase — one line each, so the column can never drive the height. The cost is real: “Within three summers of planting” is not a sentence, and anyone who wants the qualification has to open the paper.",
    render: (p) => <RailHeadlines {...p} />,
  },
];

export default function CardPrototypes() {
  const [sample, setSample] = useState(0);
  const [bullet, setBullet] = useState<Bullet>("dot");

  const paper = SAMPLES[sample];
  const hue = washSlots(sample)[0];
  const props: CandidateProps = { paper, index: sample, hue, bullet };

  return (
    <div style={{ minHeight: "100vh", background: SURFACE, color: INK }}>
      <style>{`
        .proto-split { display: grid; grid-template-columns: 1.15fr 1fr; gap: 24px; }
        .proto-split > section + section { border-left: ${BORDER}; padding-left: 24px; }
        .proto-rail { display: grid; grid-template-columns: 1fr 290px; }
        .proto-rail--even { grid-template-columns: 1fr 1fr; }
        .proto-rail > section + section { border-left: ${BORDER}; }
        .proto-cols { display: grid; gap: 20px; }
        .proto-cols > div + div { border-left: ${HAIRLINE}; padding-left: 20px; }
        @media (max-width: 720px) {
          .proto-split, .proto-rail, .proto-cols { grid-template-columns: 1fr !important; }
          .proto-split > section + section { border-left: none; border-top: ${BORDER}; padding-left: 0; padding-top: 20px; }
          .proto-rail > section + section { border-left: none; border-top: ${BORDER}; }
          .proto-cols > div + div { border-left: none; border-top: ${HAIRLINE}; padding-left: 0; padding-top: 16px; }
        }
      `}</style>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "48px 24px 120px" }}>
        <h1 style={{ fontFamily: DISPLAY, fontSize: 32, fontWeight: 700, letterSpacing: "-0.02em", lineHeight: "40px", margin: "0 0 10px" }}>
          Paper card candidates
        </h1>
        <p style={{ ...BODY_STYLE, color: DIM, margin: "0 0 8px", maxWidth: 640 }}>
          The broadsheet, fixed, and three ways to make the split cleaner. Hero is 22, the
          takeaway&rsquo;s mark follows the card&rsquo;s hue, and the stat card is gone — a number
          with no sentence around it says nothing.
        </p>
        <p style={{ ...BODY_SM, color: MUTED, margin: "0 0 32px", maxWidth: 640 }}>
          The Bullets control runs across every candidate at once. A marker in an 18px
          gutter is most of what makes a findings list read as a list.
        </p>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 18, marginBottom: 44 }}>
          <Control label="Sample">
            <Segmented
              value={String(sample)}
              onChange={(v) => setSample(Number(v))}
              options={[{ key: "0", label: "Short" }, { key: "1", label: "Long" }, { key: "2", label: "News" }]}
              style={{ width: 290 }}
            />
          </Control>
          <Control label="Bullets">
            <Segmented
              value={bullet}
              onChange={setBullet}
              options={[
                { key: "dot" as const, label: "Dot" },
                { key: "square" as const, label: "Square" },
                { key: "number" as const, label: "Number" },
                { key: "none" as const, label: "None" },
              ]}
              style={{ width: 380 }}
            />
          </Control>
        </div>

        {CANDIDATES.map((c) => (
          <Frame key={c.key} eyebrow={`Candidate ${c.key}`} name={c.name} note={c.note}>
            {c.render(props)}
          </Frame>
        ))}

        <Frame
          eyebrow="For reference"
          name="What's in prod today"
          note="The real component, unmodified — open it with its own See more."
        >
          <PaperCard paper={paper} index={sample} size="digest" />
        </Frame>
      </div>
    </div>
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

function Frame({ eyebrow, name, note, children }: {
  eyebrow: string;
  name: string;
  note: string;
  children: React.ReactNode;
}) {
  return (
    <section style={{ marginBottom: 56 }}>
      <div style={{ ...BODY_SM, color: MUTED, marginBottom: 4 }}>{eyebrow}</div>
      <h2 style={{ ...DISPLAY_SM, margin: "0 0 8px" }}>{name}</h2>
      <p style={{ ...BODY_SM, color: DIM, margin: "0 0 20px", maxWidth: 640 }}>{note}</p>
      <div style={{ maxWidth: 760, borderTop: `1px solid ${RULE}`, paddingTop: 20 }}>{children}</div>
    </section>
  );
}
