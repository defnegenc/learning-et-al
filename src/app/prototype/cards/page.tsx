"use client";

import React, { useState } from "react";
import type { PaperItem } from "@/lib/types";
import { PaperCard, paperByline } from "@/components/paper-card";
import {
  BODY, BODY_STYLE, BODY_SM, BORDER, DIM, DISPLAY, HAIRLINE, INK, LABEL_STYLE,
  MONO, MUTED, RULE, SHADOW, SURFACE, FIELD, Segmented, washSlots, wash,
} from "@/components/design-system";

/*
 * Paper card candidates — /prototype/cards.
 *
 * Three questions, five answers. The card in prod (candidate A) is the real
 * component, so what's below is measured against the thing itself, not a
 * redraw of it.
 *
 *  1. The findings and the takeaway are hard to read. They are Body/SM 13 set
 *     inside a bordered tile inside a bordered card, half the words bold, and
 *     the takeaway sits on a full-strength spectrum fill. Every candidate here
 *     moves that copy up to Body 15/26 — reading size — and then differs in
 *     what container, if any, it keeps.
 *  2. See more / see less. B keeps it but names what's behind it; C moves it
 *     onto the card's seam; D toggles findings only; E deletes it.
 *  3. Where the paper's name goes. B and C leave it under the hero; D folds it
 *     into one provenance line; E moves it to the foot, next to Read paper, so
 *     the card opens with the idea and closes with the citation.
 *
 * Nothing here is wired to the API — no bookmark, no expandTick, no feedback.
 * The emphasis control is a fourth axis: the pipeline hands us **bold** inside
 * every finding, and at 15px the question of how to render that mark is worth
 * asking separately from the layout.
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
    keywords: ["machine learning", "venture capital"],
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
    keywords: ["urban heat", "public health"],
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

/* ── Shared bits ─────────────────────────────────────────────────────────── */

type Emphasis = "bold" | "underline" | "hue";

/** The pipeline's **bold**, rendered three ways so the mark can be argued about. */
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
    return (
      <span key={i} style={{ background: hue, boxDecorationBreak: "clone", WebkitBoxDecorationBreak: "clone", padding: "1px 2px" }}>
        {part}
      </span>
    );
  });
}

function startCap(text: string): string {
  return text.replace(/[A-Za-z]/, (l) => l.toUpperCase());
}

/** Reading size — Body 15 with the column's line height. The one change every candidate shares. */
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
    takeaway: [claim, line && line !== claim ? line : ""].filter(Boolean).join(" "),
    byline: paperByline(p),
  };
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

function ReadPaper({ href }: { href: string | null }) {
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="ds-lift"
      style={{ fontFamily: DISPLAY, fontSize: 16, fontWeight: 700, letterSpacing: "-0.01em", lineHeight: "20px", textTransform: "uppercase", display: "inline-flex", alignItems: "center", gap: 8, background: INK, color: SURFACE, border: BORDER, boxShadow: SHADOW, padding: "12px 22px", textDecoration: "none", alignSelf: "flex-start" }}
    >
      Read paper ↗
    </a>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <div style={{ ...LABEL_STYLE, marginBottom: 8 }}>{children}</div>;
}

/** Findings as a divided ledger: no bullets, a hairline between rows, reading size. */
function Ledger({ items, mode, hue }: { items: string[]; mode: Emphasis; hue: string }) {
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

/* ── B · Ledger ──────────────────────────────────────────────────────────── */

function CandidateB({ paper, index, mode, open, setOpen }: CandidateProps) {
  const c = content(paper);
  const hue = washSlots(index)[0];
  return (
    <Shell index={index}>
      <p style={HERO}>{c.hero}</p>
      <div style={{ fontFamily: BODY, fontSize: 13, fontWeight: 600, lineHeight: "18px", color: INK }}>{paper.plainName || paper.title}</div>
      {c.byline && <div style={{ ...BODY_SM, fontStyle: "italic", color: DIM, marginTop: -6 }}>{c.byline}</div>}

      <ExpandLine open={open} onClick={() => setOpen(!open)} label={[c.findings.length ? c.findingsLabel.toLowerCase() : "", c.takeaway ? "takeaway" : ""].filter(Boolean).join(" and ").replace(/^./, (l) => l.toUpperCase())} />

      {open && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20, marginTop: 6 }}>
          {c.findings.length > 0 && (
            <section>
              <Eyebrow>{c.findingsLabel}</Eyebrow>
              <Ledger items={c.findings} mode={mode} hue={hue} />
            </section>
          )}
          {c.takeaway && (
            <section style={{ display: "flex", gap: 14 }}>
              <span aria-hidden style={{ width: 4, flexShrink: 0, background: hue }} />
              <div>
                <Eyebrow>Takeaway</Eyebrow>
                <p style={{ ...READ, margin: 0 }}>{marks(startCap(c.takeaway), mode, hue)}</p>
              </div>
            </section>
          )}
          <ReadPaper href={paper.sourceUrl} />
        </div>
      )}
    </Shell>
  );
}

/* ── C · Strata ──────────────────────────────────────────────────────────── */

function CandidateC({ paper, index, mode, open, setOpen }: CandidateProps) {
  const c = content(paper);
  const hue = washSlots(index)[0];
  return (
    <div style={{ ...wash(index), border: BORDER, boxShadow: SHADOW, overflow: "hidden" }}>
      <div style={{ padding: "22px 24px", display: "flex", flexDirection: "column", gap: 12 }}>
        <p style={HERO}>{c.hero}</p>
        <div style={{ fontFamily: BODY, fontSize: 13, fontWeight: 600, lineHeight: "18px", color: INK }}>{paper.plainName || paper.title}</div>
        {c.byline && <div style={{ ...BODY_SM, fontStyle: "italic", color: DIM, marginTop: -6 }}>{c.byline}</div>}
      </div>

      {/* The seam is the control: the card's own rule doubles as the toggle. */}
      <button
        onClick={() => setOpen(!open)}
        style={{ ...LABEL_STYLE, color: INK, width: "100%", textAlign: "left", background: "transparent", border: "none", borderTop: BORDER, padding: "10px 24px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}
      >
        <span>{open ? "Close" : `${c.findingsLabel} · Takeaway`}</span>
        <span aria-hidden>{open ? "↑" : "↓"}</span>
      </button>

      {open && (
        <>
          {c.findings.length > 0 && (
            <section style={{ borderTop: BORDER, padding: "18px 24px", background: SURFACE }}>
              <Eyebrow>{c.findingsLabel}</Eyebrow>
              <Ledger items={c.findings} mode={mode} hue={hue} />
            </section>
          )}
          {c.takeaway && (
            <section style={{ borderTop: BORDER, padding: "18px 24px 22px", background: hue }}>
              <Eyebrow>Takeaway</Eyebrow>
              <p style={{ ...READ, margin: "0 0 18px" }}>{marks(startCap(c.takeaway), mode === "hue" ? "bold" : mode, hue)}</p>
              <ReadPaper href={paper.sourceUrl} />
            </section>
          )}
        </>
      )}
    </div>
  );
}

/* ── D · Conclusion first ────────────────────────────────────────────────── */

function CandidateD({ paper, index, mode, open, setOpen }: CandidateProps) {
  const c = content(paper);
  const hue = washSlots(index)[0];
  const lead = c.claim || c.hero;
  const rest = c.claim ? c.line : "";
  return (
    <Shell index={index}>
      <p style={HERO}>{lead}</p>
      {rest && <p style={{ ...READ, margin: 0 }}>{rest}</p>}

      <p style={{ ...BODY_SM, color: DIM, margin: 0 }}>
        <span style={{ fontWeight: 600, color: INK }}>{paper.plainName || paper.title}</span>
        {c.byline ? <span style={{ fontStyle: "italic" }}> · {c.byline}</span> : null}
      </p>

      {c.findings.length > 0 && <ExpandLine open={open} onClick={() => setOpen(!open)} label={`See the ${c.findingsLabel.toLowerCase()}`} />}

      {open && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20, marginTop: 6 }}>
          <section>
            <Eyebrow>{paper.source === "rss" ? "The story" : "What they did"}</Eyebrow>
            <p style={{ ...READ, margin: 0, color: DIM }}>{c.hero}</p>
          </section>
          <section>
            <Eyebrow>{c.findingsLabel}</Eyebrow>
            <Ledger items={c.findings} mode={mode} hue={hue} />
          </section>
          <ReadPaper href={paper.sourceUrl} />
        </div>
      )}
    </Shell>
  );
}

/* ── E · Colophon ────────────────────────────────────────────────────────── */

function CandidateE({ paper, index, mode }: CandidateProps) {
  const c = content(paper);
  const hue = washSlots(index)[0];
  return (
    <Shell index={index} style={{ gap: 18 }}>
      <p style={HERO}>{c.hero}</p>

      {c.findings.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {c.findings.map((f, i) => (
            <div key={i} style={{ display: "flex", gap: 14 }}>
              <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 700, letterSpacing: "0.12em", lineHeight: "26px", color: MUTED, width: 22, flexShrink: 0 }}>
                {String(i + 1).padStart(2, "0")}
              </span>
              <p style={{ ...READ, margin: 0 }}>{marks(startCap(f), mode, hue)}</p>
            </div>
          ))}
        </div>
      )}

      {c.takeaway && (
        <p style={{ ...READ, margin: 0 }}>
          <span style={{ background: hue, boxDecorationBreak: "clone", WebkitBoxDecorationBreak: "clone", padding: "2px 4px", marginLeft: -4 }}>
            {startCap(c.claim || c.takeaway)}
          </span>
          {c.claim && c.line ? ` ${c.line}` : ""}
        </p>
      )}

      <div style={{ borderTop: HAIRLINE, paddingTop: 14, display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <div style={{ ...BODY_STYLE, fontWeight: 600 }}>{paper.plainName || paper.title}</div>
          {c.byline && <div style={{ ...BODY_SM, fontStyle: "italic", color: DIM }}>{c.byline}</div>}
        </div>
        <ReadPaper href={paper.sourceUrl} />
      </div>
    </Shell>
  );
}

/* ── The page ────────────────────────────────────────────────────────────── */

interface CandidateProps {
  paper: PaperItem;
  index: number;
  mode: Emphasis;
  open: boolean;
  setOpen: (v: boolean) => void;
}

const CANDIDATES: {
  key: string;
  name: string;
  note: string;
  axes: string;
  render: (p: CandidateProps) => React.ReactNode;
}[] = [
  {
    key: "B",
    name: "Ledger",
    note: "The tiles are gone. Findings become rows divided by hairlines at reading size; the takeaway keeps its hue as a 4px bar instead of a fill, so the card's frame is the only box on screen.",
    axes: "Findings: hairline rows, Body 15 · Takeaway: hue bar, no fill · Expand: names what's inside · Name: unchanged",
    render: (p) => <CandidateB {...p} />,
  },
  {
    key: "C",
    name: "Strata",
    note: "Keeps the coloured takeaway but takes it full-bleed. The sections are strata of the card divided by its own 2px rule — nothing is a box inside a box — and the seam between head and body is the expand control.",
    axes: "Findings: white band · Takeaway: hue band, edge to edge · Expand: the seam itself · Name: unchanged",
    render: (p) => <CandidateC {...p} />,
  },
  {
    key: "D",
    name: "Conclusion first",
    note: "The takeaway is the best line on the card, so it becomes the hero and the descriptive sentence steps back behind the toggle. Name and byline fold into one provenance line. Only the evidence is hidden.",
    axes: "Findings: hairline rows behind one toggle · Takeaway: promoted to the hero · Expand: findings only · Name: one line with the byline",
    render: (p) => <CandidateD {...p} />,
  },
  {
    key: "E",
    name: "Colophon",
    note: "No expand control at all. Findings are numbered in mono and always visible, the takeaway is one marked sentence rather than a tile, and the citation moves to the foot beside Read paper — the card opens with the idea and closes with the source.",
    axes: "Findings: numbered, always open · Takeaway: inline hue mark · Expand: deleted · Name: at the foot",
    render: (p) => <CandidateE {...p} />,
  },
];

export default function CardPrototypes() {
  const [sample, setSample] = useState(0);
  const [mode, setMode] = useState<Emphasis>("bold");
  const [bg, setBg] = useState<"surface" | "field">("surface");
  const [openMap, setOpenMap] = useState<Record<string, boolean>>({ B: true, C: true, D: true });

  const paper = SAMPLES[sample];
  const set = (k: string) => (v: boolean) => setOpenMap((m) => ({ ...m, [k]: v }));

  return (
    <div style={{ minHeight: "100vh", background: SURFACE, color: INK }}>
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "48px 24px 120px" }}>
        <h1 style={{ fontFamily: DISPLAY, fontSize: 32, fontWeight: 700, letterSpacing: "-0.02em", lineHeight: "40px", margin: "0 0 10px" }}>
          Paper card candidates
        </h1>
        <p style={{ ...BODY_STYLE, color: DIM, margin: "0 0 8px", maxWidth: 620 }}>
          Four alternatives to the card in today&rsquo;s digest, against the real one. Every
          candidate moves the findings and the takeaway from Body/SM 13 up to Body 15 at a
          26px line — that single change is doing most of the work, and the rest is an
          argument about what container the copy deserves.
        </p>
        <p style={{ ...BODY_SM, color: MUTED, margin: "0 0 32px", maxWidth: 620 }}>
          Nothing here saves. The bookmark is only live on the current card.
        </p>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 18, marginBottom: 40 }}>
          <Control label="Sample">
            <Segmented
              value={String(sample)}
              onChange={(v) => setSample(Number(v))}
              options={[
                { key: "0", label: "Short" },
                { key: "1", label: "Long" },
                { key: "2", label: "News" },
              ]}
              style={{ width: 300 }}
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
          <Control label="Behind the card">
            <Segmented
              value={bg}
              onChange={setBg}
              options={[
                { key: "surface" as const, label: "White" },
                { key: "field" as const, label: "Field" },
              ]}
              style={{ width: 200 }}
            />
          </Control>
        </div>

        <Frame
          eyebrow="Candidate A — in prod today"
          name="Tiles"
          note="The real component, unmodified — open it with its own See more. Findings and takeaway are Body/SM 13 in bordered tiles inside the bordered card, and the takeaway sits on a full-strength spectrum fill."
          axes="Findings: bordered tile, Body/SM 13 · Takeaway: solid fill tile · Expand: See more / See less · Name: under the hero"
          bg={bg}
        >
          <PaperCard paper={paper} index={sample} size="digest" />
        </Frame>

        {CANDIDATES.map((c) => (
          <Frame
            key={c.key}
            eyebrow={`Candidate ${c.key}`}
            name={c.name}
            note={c.note}
            axes={c.axes}
            bg={bg}
          >
            {c.render({ paper, index: sample, mode, open: openMap[c.key] ?? true, setOpen: set(c.key) })}
          </Frame>
        ))}

        <p style={{ ...BODY_SM, color: MUTED, marginTop: 48, maxWidth: 620 }}>
          The four axes are separable: the ledger from B can go inside the bands of C, D&rsquo;s
          promoted takeaway works under any of them, and E&rsquo;s foot citation is independent
          of everything else. Pick per axis, not per card.
        </p>
      </div>
    </div>
  );
}

function Control({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ ...LABEL_STYLE, marginBottom: 8 }}>{label}</div>
      {children}
    </div>
  );
}

function Frame({ eyebrow, name, note, axes, bg, children }: {
  eyebrow: string;
  name: string;
  note: string;
  axes: string;
  bg: "surface" | "field";
  children: React.ReactNode;
}) {
  return (
    <section style={{ marginBottom: 56 }}>
      <div style={{ ...LABEL_STYLE, marginBottom: 6 }}>{eyebrow}</div>
      <h2 style={{ fontFamily: DISPLAY, fontSize: 16, fontWeight: 700, letterSpacing: "-0.01em", lineHeight: "20px", textTransform: "uppercase", margin: "0 0 8px" }}>
        {name}
      </h2>
      <p style={{ ...BODY_SM, color: DIM, margin: "0 0 6px", maxWidth: 620 }}>{note}</p>
      <p style={{ ...BODY_SM, color: MUTED, margin: "0 0 20px", maxWidth: 620 }}>{axes}</p>
      <div style={{ background: bg === "field" ? FIELD : SURFACE, padding: bg === "field" ? "28px 24px" : 0, border: bg === "field" ? `1px solid ${RULE}` : undefined }}>
        <div style={{ maxWidth: 760 }}>{children}</div>
      </div>
    </section>
  );
}
