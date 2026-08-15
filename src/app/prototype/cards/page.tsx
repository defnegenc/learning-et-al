"use client";

import React, { useState } from "react";
import type { PaperItem } from "@/lib/types";
import { PaperCard, paperByline } from "@/components/paper-card";
import {
  BODY_STYLE, BODY_SM, BORDER, DIM, DISPLAY, DISPLAY_LG, DISPLAY_SM, HAIRLINE,
  INK, MUTED, RULE, SHADOW, SPECTRUM, SURFACE, Segmented, washSlots, wash,
} from "@/components/design-system";

/*
 * Paper card candidates — /prototype/cards.
 *
 * Two shapes survived the first two rounds, and everything else is deleted.
 *
 *  · The SPLIT (H). One rule down the middle: the point on one side, the
 *    evidence on the other, read together instead of one under the other.
 *    Four of the five below are this shape rearranged.
 *  · The BROADSHEET (K), with two fixes. The method line is gone, and the
 *    takeaway is no longer a filled band — the pink is a mark on the claim,
 *    which is all the colour that sentence needed.
 *
 * The hierarchy note from the review: in K the hero sat between the title and
 * the section headings, all three in Cabinet Grotesk, so nothing led. The fix
 * is the Hero control — Display/LG 32 makes the TL;DR twice the size of any
 * heading on the card, which is the only way the display face can carry
 * hierarchy when it is also the heading face. 22 is what prod runs today.
 *
 * Settled and no longer switchable: section headings are Cabinet Grotesk at
 * Display/SM in ink (never a mono grey eyebrow), findings mark with **bold**,
 * the takeaway marks with the highlight, and the order is title, byline,
 * TL;DR.
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

/** Findings mark with weight — settled. */
function marks(text: string): React.ReactNode[] {
  return text.split(/\*\*(.+?)\*\*/g).map((part, i) =>
    !part ? null : i % 2 === 1
      ? <strong key={i} style={{ fontWeight: 600 }}>{part}</strong>
      : <span key={i}>{part}</span>
  );
}

/** The takeaway marks with the highlight — the one place colour lands on type. */
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

/** Reading size. Prod runs the tiles at 13. */
const READ: React.CSSProperties = { ...BODY_STYLE, lineHeight: "26px" };

function content(p: PaperItem) {
  const body = (p.summary || p.abstract || "").trim();
  const hero = body.match(/[^.!?]+[.!?]+["')\]]?/)?.[0]?.trim() || body;
  return {
    hero,
    claim: (p.claim || "").trim(),
    line: (p.takeawayLine || "").trim(),
    findings: (p.keyFindings ?? []).slice(0, 3),
    findingsLabel: p.source === "rss" ? "Key points" : "Findings",
    stat: (p.takeawayStat || "").trim(),
    byline: paperByline(p),
  };
}

interface CandidateProps {
  paper: PaperItem;
  index: number;
  /** The resolved highlight colour. */
  hue: string;
  /** 22 = today's hero. 32 = Display/LG, twice any heading on the card. */
  heroSize: 22 | 32;
}

/** Section heading — Cabinet Grotesk in ink. Never a mono grey eyebrow. */
function Heading({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <h3 style={{ ...DISPLAY_SM, margin: "0 0 10px", ...style }}>{children}</h3>;
}

/** Title, byline, TL;DR — the prod order. The hero is what carries hierarchy. */
function Head({ paper, c, heroSize }: { paper: PaperItem; c: ReturnType<typeof content>; heroSize: 22 | 32 }) {
  const hero: React.CSSProperties = heroSize === 32
    ? { ...DISPLAY_LG, margin: "6px 0 0" }
    : { fontFamily: DISPLAY, fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em", lineHeight: "28px", color: INK, margin: "4px 0 0" };
  return (
    <div>
      <h3 style={{ ...DISPLAY_SM, margin: 0 }}>{paper.plainName || paper.title}</h3>
      {c.byline && <div style={{ ...BODY_SM, fontStyle: "italic", color: DIM, marginTop: 2 }}>{c.byline}</div>}
      {c.hero && <p style={hero}>{c.hero}</p>}
    </div>
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

function Findings({ items, gap = 14 }: { items: string[]; gap?: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap }}>
      {items.map((f, i) => <p key={i} style={{ ...READ, margin: 0 }}>{marks(startCap(f))}</p>)}
    </div>
  );
}

function NumberedFindings({ items }: { items: string[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {items.map((f, i) => (
        <div key={i} style={{ display: "flex", gap: 12 }}>
          <span style={{ ...DISPLAY_SM, color: MUTED, width: 22, flexShrink: 0, lineHeight: "26px" }}>
            {String(i + 1).padStart(2, "0")}
          </span>
          <p style={{ ...READ, margin: 0 }}>{marks(startCap(f))}</p>
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

/* ── K · Broadsheet ──────────────────────────────────────────────────────── */

/**
 * The one you liked, with both fixes: the method line is gone, and the
 * takeaway's band is no longer filled — the pink is a mark on the claim, so
 * colour lands on the sentence that earns it rather than on 200px of card.
 * The strata are still divided by the card's own 2px rule.
 */
function Broadsheet({ paper, index, hue, heroSize }: CandidateProps) {
  const c = content(paper);
  return (
    <div style={{ ...wash(index), border: BORDER, boxShadow: SHADOW, overflow: "hidden" }}>
      <div style={{ padding: "22px 24px" }}>
        <Head paper={paper} c={c} heroSize={heroSize} />
      </div>
      {c.findings.length > 0 && (
        <section style={{ borderTop: BORDER, padding: "18px 24px", background: SURFACE }}>
          <Heading>{c.findingsLabel}</Heading>
          <div className="proto-triptych">
            {c.findings.map((f, i) => <p key={i} style={{ ...READ, margin: 0 }}>{marks(startCap(f))}</p>)}
          </div>
        </section>
      )}
      <section style={{ borderTop: BORDER, padding: "18px 24px 22px", display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 20, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 340px" }}>
          <Heading>Takeaway</Heading>
          <Takeaway c={c} hue={hue} />
        </div>
        {/* Wrapped: ReadPaper sets its own alignSelf, which would otherwise
            override the row's flex-end and float the button to the top. */}
        <div><ReadPaper href={paper.sourceUrl} small /></div>
      </section>
    </div>
  );
}

/* ── The split family ────────────────────────────────────────────────────── */

/** H · Split — the one you liked. Point left, evidence right, one 2px rule. */
function Split({ paper, index, hue, heroSize }: CandidateProps) {
  const c = content(paper);
  return (
    <Shell index={index}>
      <Head paper={paper} c={c} heroSize={heroSize} />
      <div className="proto-split">
        <section>
          <Heading>Takeaway</Heading>
          <Takeaway c={c} hue={hue} />
          <div style={{ marginTop: 18 }}><ReadPaper href={paper.sourceUrl} small /></div>
        </section>
        <section>
          <Heading>{c.findingsLabel}</Heading>
          <Findings items={c.findings} />
        </section>
      </div>
    </Shell>
  );
}

/**
 * H2 · Evidence first. The same rule, the columns swapped: findings take the
 * wide left column and the takeaway closes on the right. Left-to-right means
 * this version argues *toward* the conclusion; H states it and then shows work.
 */
function SplitFlipped({ paper, index, hue, heroSize }: CandidateProps) {
  const c = content(paper);
  return (
    <Shell index={index}>
      <Head paper={paper} c={c} heroSize={heroSize} />
      <div className="proto-split">
        <section>
          <Heading>{c.findingsLabel}</Heading>
          <Findings items={c.findings} />
        </section>
        <section>
          <Heading>Takeaway</Heading>
          <Takeaway c={c} hue={hue} />
          <div style={{ marginTop: 18 }}><ReadPaper href={paper.sourceUrl} small /></div>
        </section>
      </div>
    </Shell>
  );
}

/**
 * H3 · Rail. The rule runs the full height of the card instead of starting
 * below the header, so the findings become a marginal column and the wide
 * column is one uninterrupted read: title, TL;DR, takeaway. The most hierarchy
 * of the family — nothing sits beside the hero to compete with it.
 */
function Rail({ paper, index, hue, heroSize }: CandidateProps) {
  const c = content(paper);
  return (
    <Shell index={index} style={{ padding: 0, gap: 0 }}>
      <div className="proto-rail">
        <section style={{ padding: "22px 24px", display: "flex", flexDirection: "column", gap: 18 }}>
          <Head paper={paper} c={c} heroSize={heroSize} />
          <div>
            <Heading>Takeaway</Heading>
            <Takeaway c={c} hue={hue} />
          </div>
          <ReadPaper href={paper.sourceUrl} small />
        </section>
        <section style={{ padding: "22px 24px" }}>
          <Heading>{c.findingsLabel}</Heading>
          <NumberedFindings items={c.findings} />
        </section>
      </div>
    </Shell>
  );
}

/**
 * H4 · Split with the number. `takeawayStat` is written for every paper and
 * rendered nowhere; here it opens the left column at display size, marked, and
 * the takeaway reads as its caption. The only new material on the card.
 */
function SplitStat({ paper, index, hue, heroSize }: CandidateProps) {
  const c = content(paper);
  return (
    <Shell index={index}>
      <Head paper={paper} c={c} heroSize={heroSize} />
      <div className="proto-split">
        <section>
          {c.stat && (
            <p style={{ ...DISPLAY_LG, margin: "0 0 12px" }}>
              <Marked hue={hue}>{c.stat}</Marked>
            </p>
          )}
          <Heading>Takeaway</Heading>
          <p style={{ ...READ, margin: 0 }}>{startCap([c.claim, c.line].filter(Boolean).join(" "))}</p>
          <div style={{ marginTop: 18 }}><ReadPaper href={paper.sourceUrl} small /></div>
        </section>
        <section>
          <Heading>{c.findingsLabel}</Heading>
          <Findings items={c.findings} />
        </section>
      </div>
    </Shell>
  );
}

/**
 * H5 · Split, closed. The two columns carry only the evidence — findings left,
 * why-it-matters right — and the takeaway comes back full width under a
 * hairline as the card's last line, which is where a conclusion belongs.
 * Broadsheet's ending on Split's body.
 */
function SplitClosed({ paper, index, hue, heroSize }: CandidateProps) {
  const c = content(paper);
  const half = Math.ceil(c.findings.length / 2);
  return (
    <Shell index={index}>
      <Head paper={paper} c={c} heroSize={heroSize} />
      <div className="proto-split proto-split--even">
        <section>
          <Heading>{c.findingsLabel}</Heading>
          <Findings items={c.findings.slice(0, half)} />
        </section>
        <section>
          <Findings items={c.findings.slice(half)} />
        </section>
      </div>
      <div style={{ borderTop: HAIRLINE, paddingTop: 18, display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 20, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 340px" }}>
          <Heading>Takeaway</Heading>
          <Takeaway c={c} hue={hue} />
        </div>
        <div><ReadPaper href={paper.sourceUrl} small /></div>
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
    note: "Yours, fixed. The method line is gone and the takeaway's band is no longer filled — the pink is a mark on the claim, so colour lands on the one sentence that earns it. Findings still run as three poster columns between the card's own 2px rules.",
    render: (p) => <Broadsheet {...p} />,
  },
  {
    key: "H",
    name: "Split",
    note: "The one you liked, unchanged except for the hero. Point on the left, evidence on the right, one rule between them.",
    render: (p) => <Split {...p} />,
  },
  {
    key: "H2",
    name: "Evidence first",
    note: "The same rule with the columns swapped. Reading left to right, this version argues toward the conclusion; H states the conclusion and then shows its work. Same weight of ink, opposite rhetoric.",
    render: (p) => <SplitFlipped {...p} />,
  },
  {
    key: "H3",
    name: "Rail",
    note: "The rule runs the full height instead of starting under the header, so the findings become a margin column and the wide column is one uninterrupted read — title, TL;DR, takeaway. Nothing sits beside the hero to compete with it, which is the most hierarchy of the family.",
    render: (p) => <Rail {...p} />,
  },
  {
    key: "H4",
    name: "Split with the number",
    note: "takeawayStat is written for every paper and rendered nowhere in the product. Here it opens the left column at display size, marked, and the takeaway reads as its caption. One new field, no extra furniture.",
    render: (p) => <SplitStat {...p} />,
  },
  {
    key: "H5",
    name: "Split, closed",
    note: "The columns carry only the evidence, split between them, and the takeaway returns full width under a hairline as the card's last line — which is where a conclusion belongs. Broadsheet's ending on Split's body.",
    render: (p) => <SplitClosed {...p} />,
  },
];

export default function CardPrototypes() {
  const [sample, setSample] = useState(0);
  const [heroSize, setHeroSize] = useState<22 | 32>(32);
  const [pink, setPink] = useState(true);

  const paper = SAMPLES[sample];
  const hue = pink ? SPECTRUM[0] : washSlots(sample)[0];
  const props: CandidateProps = { paper, index: sample, hue, heroSize };

  return (
    <div style={{ minHeight: "100vh", background: SURFACE, color: INK }}>
      <style>{`
        .proto-split { display: grid; grid-template-columns: 1.15fr 1fr; gap: 24px; }
        .proto-split--even { grid-template-columns: 1fr 1fr; }
        .proto-split > section + section { border-left: ${BORDER}; padding-left: 24px; }
        .proto-rail { display: grid; grid-template-columns: 1fr 290px; }
        .proto-rail > section + section { border-left: ${BORDER}; }
        .proto-triptych { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
        .proto-triptych > p + p { border-left: ${HAIRLINE}; padding-left: 20px; }
        @media (max-width: 720px) {
          .proto-split, .proto-rail, .proto-triptych { grid-template-columns: 1fr; }
          .proto-split > section + section { border-left: none; border-top: ${BORDER}; padding-left: 0; padding-top: 20px; }
          .proto-rail > section + section { border-left: none; border-top: ${BORDER}; }
          .proto-triptych > p + p { border-left: none; border-top: ${HAIRLINE}; padding-left: 0; padding-top: 16px; }
        }
      `}</style>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "48px 24px 120px" }}>
        <h1 style={{ ...DISPLAY_LG, margin: "0 0 10px" }}>Paper card candidates</h1>
        <p style={{ ...BODY_STYLE, color: DIM, margin: "0 0 8px", maxWidth: 640 }}>
          Two shapes survived: the split, and the broadsheet with its band unfilled. Four
          of the six below are the split rearranged. Settled and no longer switchable —
          headings are Cabinet Grotesk in ink, findings mark with bold, the takeaway marks
          with the highlight, and everything reads at Body 15.
        </p>
        <p style={{ ...BODY_SM, color: MUTED, margin: "0 0 32px", maxWidth: 640 }}>
          The hero control is the hierarchy fix: when the display face is also the heading
          face, only size can make the TL;DR lead. 32 is Display/LG — twice any heading on
          the card. 22 is what prod runs today.
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
          <Control label="Hero">
            <Segmented
              value={String(heroSize)}
              onChange={(v) => setHeroSize(v === "32" ? 32 : 22)}
              options={[{ key: "32", label: "32 · Display/LG" }, { key: "22", label: "22 · today" }]}
              style={{ width: 300 }}
            />
          </Control>
          <Control label="Highlight">
            <Segmented
              value={pink ? "pink" : "hue"}
              onChange={(v) => setPink(v === "pink")}
              options={[{ key: "pink", label: "Pink" }, { key: "hue", label: "Card hue" }]}
              style={{ width: 240 }}
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
          note="The real component, unmodified — open it with its own See more. Kept only as the baseline to measure against."
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
