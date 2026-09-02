"use client";

import React, { useState } from "react";
import { Bookmark, Info } from "lucide-react";
import type { PaperItem } from "@/lib/types";
import { paperByline, READING_BODY } from "@/components/paper-card";
import {
  BODY_SM, BODY_STYLE, BORDER, DIM, DISPLAY, DISPLAY_SM, GOLD, INK, MUTED,
  SHADOW, SHADOW_GOLD, SURFACE, foundationalSlots, foundationalWash, InkTip,
} from "@/components/design-system";

/*
 * Foundational treatments, at /prototype/foundational.
 *
 * The complaint, precisely: the mono all-caps FOUNDATIONAL TEXT eyebrow at the
 * top left, and the tinted "Significance" box under the hero. Between them they
 * put a Label, a Display/SM heading and a paragraph on a card that already has
 * a title, a byline, a hero, findings and a takeaway. It is two extra headings
 * for one extra sentence.
 *
 * Everything below keeps what makes the card foundational (the gold frame, the
 * gold shadow, the slot 02+01 wash) and changes only where the word and the
 * sentence live. No candidate adds a mono label, per the standing rule that new
 * surfaces use bolded body-face sentence-case lead-ins instead.
 *
 * Each candidate is shown twice: the full digest card (today) and the compact
 * card (the vault shelf), because the vault currently says nothing at all about
 * a foundational paper beyond the gold frame.
 */

/* ── Sample ──────────────────────────────────────────────────────────────── */

const PAPER: PaperItem = {
  id: "f1",
  title: "The Strength of Weak Ties",
  plainName: "Why your distant acquaintances find you jobs",
  summary:
    "Granovetter showed that the people who bring you genuinely new information are rarely your close friends: they are the acquaintances who move in circles yours does not touch.",
  abstract: "",
  source: "semantic_scholar",
  sourceUrl: "https://doi.org/10.1086/225469",
  keywords: ["networks", "sociology", "information"],
  authors: ["Mark S. Granovetter"],
  year: 1973,
  category: "foundational",
  foundationalReason:
    "This is the paper that turned a hunch about gossip into a measurable property of networks, and almost every later argument about how information travels through a crowd is either building on it or arguing with it.",
  keyFindings: [
    "Most people heard about the job they took from someone they saw **rarely, not often**",
    "Close friends **share your information**, so they mostly tell you what you already know",
    "Weak ties are the **bridges between clusters**: cut them and a network falls into islands",
  ],
  claim: "The contacts who change your life are the ones you barely keep.",
  takeawayLine:
    "Strong ties are where your support lives; weak ties are where your options live, and the two are not interchangeable.",
} as PaperItem;

/* ── Shared pieces ───────────────────────────────────────────────────────── */

const MARK = foundationalSlots()[0];

/**
 * The tab's fill is a long way lighter than `GOLD` on purpose. Gold at full
 * strength needs near-white highlights to look like metal, and a band of near
 * white behind 13px type is the one thing on the card you cannot read. Pale
 * champagne keeps the ink text at full contrast across every band, and it lets
 * `GOLD` itself be the tab's edge rather than a second, darker gold.
 */

function emphasize(text: string): React.ReactNode[] {
  return text.split(/\*\*(.+?)\*\*/g).map((part, i) =>
    !part ? null : i % 2 === 1
      ? <strong key={i} style={{ fontWeight: 600 }}>{part}</strong>
      : <span key={i}>{part}</span>
  );
}

/** The gold eye: the explanation, wherever a candidate chooses to hang it. */
function Eye({ label = "What is a foundational text?" }: { label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span style={{ position: "relative", display: "inline-flex", verticalAlign: "-2px" }}>
      <button
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onClick={() => setOpen(v => !v)}
        aria-label={label}
        style={{ background: "none", border: "none", padding: 0, cursor: "help", display: "flex", lineHeight: 1, color: open ? INK : GOLD }}
      >
        <Info size={15} strokeWidth={2} />
      </button>
      {open && (
        <span style={{ position: "absolute", top: "calc(100% + 8px)", left: 0, zIndex: 40, pointerEvents: "none" }}>
          <InkTip>
            Earlier thinking that set the terms of the argument, giving today&rsquo;s newer work something to build on, revise, or push against.
          </InkTip>
        </span>
      )}
    </span>
  );
}

/** Save, exactly as the card wears it. Inert here. */
function Save() {
  return (
    <span style={{ ...BODY_SM, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 7, color: DIM, flexShrink: 0, lineHeight: 1, whiteSpace: "nowrap", cursor: "pointer" }}>
      <Bookmark size={16} />
      Save
    </span>
  );
}

/** The card frame every candidate shares: gold border, gold shadow, gold wash. */
function Shell({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        ...foundationalWash(),
        border: `2px solid ${GOLD}`,
        boxShadow: SHADOW_GOLD,
        padding: "22px 24px",
        display: "flex",
        flexDirection: "column",
        gap: 18,
        overflow: "hidden",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

const HERO: React.CSSProperties = {
  fontFamily: DISPLAY, fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em",
  lineHeight: "28px", color: INK, margin: 0,
};

function Byline({ tail }: { tail?: React.ReactNode }) {
  return (
    <div style={{ ...BODY_SM, fontStyle: "italic", color: DIM, marginTop: 2 }}>
      {paperByline(PAPER)}
      {tail}
    </div>
  );
}

function Title({ withSave = true }: { withSave?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14 }}>
      <h3 style={{ ...DISPLAY_SM, margin: 0, flex: 1 }}>{PAPER.plainName}</h3>
      {withSave && <Save />}
    </div>
  );
}

/** Findings and takeaway, identical in every candidate, so nothing else moves. */
function Body() {
  const findings = (PAPER.keyFindings ?? []).slice(0, 3);
  return (
    <div className="proto-split">
      <section>
        <h3 style={{ ...DISPLAY_SM, margin: "0 0 10px" }}>Findings</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {findings.map((f, i) => (
            <div key={i} style={{ display: "flex" }}>
              <span aria-hidden style={{ width: 18, flexShrink: 0, display: "flex" }}>
                <span style={{ width: 5, height: 5, marginTop: 10, background: INK, borderRadius: "50%" }} />
              </span>
              <p style={{ ...READING_BODY, margin: 0 }}>{emphasize(f)}</p>
            </div>
          ))}
        </div>
      </section>
      <section>
        <h3 style={{ ...DISPLAY_SM, margin: "0 0 10px" }}>Takeaway</h3>
        <p style={{ ...READING_BODY, margin: 0 }}>
          <span style={{ background: MARK, boxDecorationBreak: "clone", WebkitBoxDecorationBreak: "clone", padding: "2px 4px", fontWeight: 600 }}>
            {PAPER.claim}
          </span>{" "}
          {PAPER.takeawayLine}
        </p>
      </section>
    </div>
  );
}

function ReadPaper() {
  return (
    <div style={{ display: "flex", justifyContent: "flex-end" }}>
      <a
        href={PAPER.sourceUrl!}
        target="_blank"
        rel="noopener noreferrer"
        className="ds-lift"
        style={{ ...DISPLAY_SM, display: "inline-flex", alignItems: "center", gap: 8, background: INK, color: SURFACE, border: BORDER, boxShadow: SHADOW, padding: "9px 16px", textDecoration: "none" }}
      >
        Read paper ↗
      </a>
    </div>
  );
}

/** The compact shell: what the vault shelf renders. */
function CompactShell({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div
      className="ds-lift"
      style={{
        ...foundationalWash(),
        border: `2px solid ${GOLD}`,
        boxShadow: SHADOW_GOLD,
        padding: "16px 18px",
        display: "flex",
        flexDirection: "column",
        gap: 10,
        height: "100%",
        cursor: "pointer",
        overflow: "hidden",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function CompactHead() {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
      <h3 style={{ ...DISPLAY_SM, margin: 0, flex: 1 }}>{PAPER.title}</h3>
      <Save />
    </div>
  );
}

const CLAMP: React.CSSProperties = {
  display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden",
};

/* ── A · Lead-in ─────────────────────────────────────────────────────────── */

/**
 * The box goes; the sentence stays where it was. It opens with a bolded
 * body-face lead-in in the same voice as "Tip:" and "Pitched for you:", so the
 * word "foundational" is said once, in a sentence, rather than twice: once as
 * a Label and once as a heading over a tinted panel.
 */
function LeadIn() {
  return (
    <Shell>
      <div>
        <Title />
        <Byline />
        <p style={{ ...HERO, marginTop: 14 }}>{PAPER.summary}</p>
      </div>
      <p style={{ ...BODY_STYLE, color: DIM, margin: 0 }}>
        <strong style={{ fontWeight: 600, color: INK }}>Foundational text.</strong>{" "}
        {PAPER.foundationalReason} <Eye />
      </p>
      <Body />
      <ReadPaper />
    </Shell>
  );
}

function LeadInCompact() {
  return (
    <CompactShell>
      <CompactHead />
      <Byline />
      <p style={{ ...BODY_STYLE, margin: "2px 0 0", color: DIM, ...CLAMP }}>
        <strong style={{ fontWeight: 600, color: INK }}>Foundational text.</strong>{" "}
        {PAPER.foundationalReason}
      </p>
    </CompactShell>
  );
}

/* ── B · Standfirst ──────────────────────────────────────────────────────── */

/**
 * No marker word anywhere. The gold frame already says which card this is, and
 * the sentence moves to the top as a standfirst behind a 3px gold rule, the
 * one place on the card a reader looks before the title. The eye sits at the end
 * of it for anyone who still wants the definition.
 *
 * The bet: the label is redundant with the frame, and what a reader actually
 * needs at the top is the reason, not the category.
 */
function Standfirst() {
  return (
    <Shell>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
        <p style={{ ...BODY_SM, fontStyle: "italic", color: DIM, margin: 0, borderLeft: `3px solid ${GOLD}`, paddingLeft: 12, flex: 1 }}>
          {PAPER.foundationalReason} <Eye />
        </p>
        <Save />
      </div>
      <div>
        <Title withSave={false} />
        <Byline />
        <p style={{ ...HERO, marginTop: 14 }}>{PAPER.summary}</p>
      </div>
      <Body />
      <ReadPaper />
    </Shell>
  );
}

function StandfirstCompact() {
  return (
    <CompactShell>
      <p style={{ ...BODY_SM, fontStyle: "italic", color: DIM, margin: 0, borderLeft: `3px solid ${GOLD}`, paddingLeft: 10, ...CLAMP }}>
        {PAPER.foundationalReason}
      </p>
      <CompactHead />
      <Byline />
    </CompactShell>
  );
}

/* ── C · Hero swap ───────────────────────────────────────────────────────── */

/**
 * The most text this cuts. On a foundational card the interesting sentence is
 * not what the paper says, it is why the paper still matters, so that sentence
 * becomes the hero, and the summary drops to Body 15 under the byline where a
 * summary belongs. The marker rides the byline as a bolded body-face word, the
 * way the venue does.
 *
 * One block fewer than every other candidate, and no heading is repeated.
 */
function HeroSwap() {
  return (
    <Shell>
      <div>
        <Title />
        <Byline
          tail={
            <>
              {" · "}
              <span style={{ fontStyle: "normal", fontWeight: 600, color: INK }}>Foundational text</span>{" "}
              <Eye />
            </>
          }
        />
        <p style={{ ...HERO, marginTop: 12 }}>{PAPER.foundationalReason}</p>
        <p style={{ ...BODY_STYLE, color: DIM, margin: "10px 0 0" }}>{PAPER.summary}</p>
      </div>
      <Body />
      <ReadPaper />
    </Shell>
  );
}

function HeroSwapCompact() {
  return (
    <CompactShell>
      <CompactHead />
      <Byline
        tail={
          <>
            {" · "}
            <span style={{ fontStyle: "normal", fontWeight: 600, color: INK }}>Foundational text</span>
          </>
        }
      />
      <p style={{ ...BODY_STYLE, margin: "2px 0 0", ...CLAMP }}>{PAPER.foundationalReason}</p>
    </CompactShell>
  );
}

/* ── D · Footnote ────────────────────────────────────────────────────────── */

/**
 * The top of the card becomes an ordinary card: title, byline, hero, nothing
 * else. The provenance moves to the foot behind a gold rule and shares the row
 * with Read paper, in Body/SM: a colophon rather than a callout.
 *
 * The bet: why a paper is foundational is context you want after the argument,
 * not a gate in front of it.
 */
function Footnote() {
  return (
    <Shell>
      <div>
        <Title />
        <Byline />
        <p style={{ ...HERO, marginTop: 14 }}>{PAPER.summary}</p>
      </div>
      <Body />
      <div style={{ borderTop: `2px solid ${GOLD}`, paddingTop: 14, display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 24 }}>
        <p style={{ ...BODY_SM, color: DIM, margin: 0, maxWidth: 460 }}>
          <strong style={{ fontWeight: 600, color: INK }}>Foundational text.</strong>{" "}
          {PAPER.foundationalReason} <Eye />
        </p>
        <a
          href={PAPER.sourceUrl!}
          target="_blank"
          rel="noopener noreferrer"
          className="ds-lift"
          style={{ ...DISPLAY_SM, display: "inline-flex", alignItems: "center", gap: 8, background: INK, color: SURFACE, border: BORDER, boxShadow: SHADOW, padding: "9px 16px", textDecoration: "none", flexShrink: 0 }}
        >
          Read paper ↗
        </a>
      </div>
    </Shell>
  );
}

function FootnoteCompact() {
  return (
    <CompactShell>
      <CompactHead />
      <Byline />
      <p style={{ ...BODY_STYLE, margin: "2px 0 0", ...CLAMP }}>
        Granovetter&rsquo;s acquaintances, not his friends, are the ones who bring him news.
      </p>
      <div style={{ marginTop: "auto", paddingTop: 10, borderTop: `2px solid ${GOLD}` }}>
        <p style={{ ...BODY_SM, color: DIM, margin: 0 }}>
          <strong style={{ fontWeight: 600, color: INK }}>Foundational text.</strong>{" "}
          Later work on how information travels is building on this or arguing with it.
        </p>
      </div>
    </CompactShell>
  );
}

/* ── E · Tab ─────────────────────────────────────────────────────────────── */

/**
 * The marker as a gold tab straddling the card's top border: a folder tab on a
 * box in an archive, which is the aesthetic the product is already in. Body-face
 * sentence case, not a mono Label. The sentence sits under the hero as one dim
 * italic line with no heading and no fill.
 *
 * The cost is the only shell here that cannot clip: the tab needs overflow
 * visible and 12px of room above the card.
 */
function Tab() {
  return (
    <div style={{ position: "relative", marginTop: 12 }}>
      <span
        style={{
          ...BODY_SM,
          fontWeight: 600,
          position: "absolute",
          top: -13,
          left: 20,
          zIndex: 2,
          background: SURFACE,
          border: `2px solid ${GOLD}`,
          padding: "1px 10px",
          display: "inline-flex",
          alignItems: "center",
          gap: 7,
          lineHeight: "22px",
        }}
      >
        Foundational text <Eye />
      </span>
      <Shell style={{ overflow: "visible", paddingTop: 26 }}>
        <div>
          <Title />
          <Byline />
          <p style={{ ...HERO, marginTop: 14 }}>{PAPER.summary}</p>
          <p style={{ ...BODY_STYLE, fontStyle: "italic", color: DIM, margin: "12px 0 0" }}>
            {PAPER.foundationalReason}
          </p>
        </div>
        <Body />
        <ReadPaper />
      </Shell>
    </div>
  );
}

function TabCompact() {
  return (
    <div style={{ position: "relative", marginTop: 12, height: "100%" }}>
      <span
        style={{
          ...BODY_SM,
          fontWeight: 600,
          position: "absolute",
          top: -13,
          left: 16,
          zIndex: 2,
          background: SURFACE,
          border: `2px solid ${GOLD}`,
          padding: "1px 10px",
          lineHeight: "22px",
        }}
      >
        Foundational text
      </span>
      <CompactShell style={{ overflow: "visible", paddingTop: 20 }}>
        <CompactHead />
        <Byline />
        <p style={{ ...BODY_STYLE, fontStyle: "italic", color: DIM, margin: "2px 0 0", ...CLAMP }}>
          {PAPER.foundationalReason}
        </p>
      </CompactShell>
    </div>
  );
}

/* ── E1 · Gold tab, E2 · Shining tab ─────────────────────────────────────── */

/**
 * E with the tab filled rather than outlined.
 *
 * Gold has been a line colour everywhere else in the product, and it still is on
 * this card: the frame and the shadow. The tab is the one exception, and it can
 * be, because it is a physical object in the metaphor. A folder tab is a piece
 * of card stock, not a rule.
 *
 * Two levels of it. `flat` is stamped metal: a hard vertical gradient with a
 * bright top half and a dark bottom half, the way a brutalist surface would
 * render a bevel if it were allowed one. `shine` is the same bar with a light
 * travelling across it, done by moving a wide gradient's background-position
 * rather than by sweeping an overlay, so nothing has to clip and the eye's
 * tooltip still escapes the tab.
 *
 * Ink stays the text colour in both: white on gold is unreadable at 13px, and
 * the product has one text colour on light ground.
 */
function GoldTab({ shine, compact = false }: { shine: boolean; compact?: boolean }) {
  return (
    <span
      className={shine ? "proto-tab-shine" : "proto-tab-flat"}
      style={{
        ...BODY_SM,
        fontWeight: 600,
        color: INK,
        position: "absolute",
        top: -13,
        left: compact ? 16 : 20,
        zIndex: 2,
        border: `2px solid ${GOLD}`,
        padding: "1px 10px",
        display: "inline-flex",
        alignItems: "center",
        gap: 7,
        lineHeight: "22px",
      }}
    >
      Foundational text {!compact && <Eye />}
    </span>
  );
}

function TabGold({ shine }: { shine: boolean }) {
  return (
    <div style={{ position: "relative", marginTop: 12 }}>
      <GoldTab shine={shine} />
      <Shell style={{ overflow: "visible", paddingTop: 26 }}>
        <div>
          <Title />
          <Byline />
          <p style={{ ...HERO, marginTop: 14 }}>{PAPER.summary}</p>
          <p style={{ ...BODY_STYLE, fontStyle: "italic", color: DIM, margin: "12px 0 0" }}>
            {PAPER.foundationalReason}
          </p>
        </div>
        <Body />
        <ReadPaper />
      </Shell>
    </div>
  );
}

function TabGoldCompact({ shine }: { shine: boolean }) {
  return (
    <div style={{ position: "relative", marginTop: 12, height: "100%" }}>
      <GoldTab shine={shine} compact />
      <CompactShell style={{ overflow: "visible", paddingTop: 20 }}>
        <CompactHead />
        <Byline />
        <p style={{ ...BODY_STYLE, fontStyle: "italic", color: DIM, margin: "2px 0 0", ...CLAMP }}>
          {PAPER.foundationalReason}
        </p>
      </CompactShell>
    </div>
  );
}

/* ── F · In the lead ─────────────────────────────────────────────────────── */

/**
 * The words "Foundational Text" inside the sentence that does the explaining.
 * There is no tab, no eyebrow, no heading and no second block: the card says what
 * it is in the course of saying why it matters, which is one sentence instead of
 * a label plus a sentence.
 *
 * The phrase takes the size, face and weight of whatever line it lands in. All it
 * adds is the capitals, which make it read as the name of a kind of thing rather
 * than as two ordinary words, and a gold underline, which is what carries the
 * hover definition. Nothing else is needed: the phrase holds the ink tooltip the
 * way a hard word in the synthesis does, so the info icon goes too.
 *
 * This one needs the pipeline to write a different sentence. See
 * `foundationalLead` below and the note on the page.
 */
function BigFT() {
  const [open, setOpen] = useState(false);
  return (
    <span
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      style={{
        position: "relative", cursor: "help",
        borderBottom: `2px solid ${GOLD}`, whiteSpace: "nowrap",
      }}
    >
      Foundational Text
      {open && (
        <span style={{ position: "absolute", top: "calc(100% + 8px)", left: 0, zIndex: 40, pointerEvents: "none" }}>
          <InkTip>
            Earlier thinking that set the terms of the argument, giving today&rsquo;s newer work something to build on, revise, or push against.
          </InkTip>
        </span>
      )}
    </span>
  );
}

/**
 * What the pipeline would return under F: the predicate only, no subject and no
 * date. The card owns "This <phrase>, written in <year>," because the year is
 * already on the paper and the capitalised phrase is a typographic decision, not
 * something a model should be asked to remember to produce.
 */
const LEAD_PREDICATE =
  "turned a hunch about gossip into a measurable property of networks, and nearly every later argument about how information moves through a crowd is answering it.";

function Lead() {
  return (
    <>
      This <BigFT />, written in {PAPER.year}, {LEAD_PREDICATE}
    </>
  );
}

function InTheLead() {
  return (
    <Shell>
      <div>
        <Title />
        <Byline />
        <p style={{ ...HERO, marginTop: 14 }}><Lead /></p>
        <p style={{ ...BODY_STYLE, color: DIM, margin: "12px 0 0" }}>{PAPER.summary}</p>
      </div>
      <Body />
      <ReadPaper />
    </Shell>
  );
}

function InTheLeadCompact() {
  return (
    <CompactShell>
      <CompactHead />
      <Byline />
      <p style={{ ...BODY_STYLE, margin: "4px 0 0", ...CLAMP }}><Lead /></p>
    </CompactShell>
  );
}

/* ── Today, as it ships ──────────────────────────────────────────────────── */

/** The current card, rebuilt here so the comparison is on one page. */
function Shipped() {
  return (
    <Shell>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700, letterSpacing: "0.12em", lineHeight: "16px", textTransform: "uppercase", color: INK }}>
            Foundational text
          </span>
          <Eye />
        </span>
        <Save />
      </div>
      <div>
        <Title withSave={false} />
        <Byline />
        <p style={{ ...HERO, marginTop: 4 }}>{PAPER.summary}</p>
      </div>
      <section style={{ background: `color-mix(in oklab, ${MARK} 55%, ${SURFACE})`, padding: "14px 16px" }}>
        <h3 style={{ ...DISPLAY_SM, margin: "0 0 8px" }}>Significance</h3>
        <p style={{ ...BODY_STYLE, color: DIM, margin: 0 }}>{PAPER.foundationalReason}</p>
      </section>
      <Body />
      <ReadPaper />
    </Shell>
  );
}

function ShippedCompact() {
  return (
    <CompactShell>
      <CompactHead />
      <Byline />
    </CompactShell>
  );
}

/* ── The page ────────────────────────────────────────────────────────────── */

interface Candidate {
  key: string;
  name: string;
  note: string;
  digest: () => React.ReactNode;
  compact: () => React.ReactNode;
  /** What the pipeline would have to write differently for this one to work. */
  prompt?: React.ReactNode;
}

const CANDIDATES: Candidate[] = [
  {
    key: "E1",
    name: "E1 · Gold tab",
    note: "E with the tab filled instead of outlined: stamped metal, a hard bright-to-dark gradient with a darker gold edge, because a 2px gold border around a gold fill is not a border. Ink text stays ink; white on gold is unreadable at 13px.",
    digest: () => <TabGold shine={false} />,
    compact: () => <TabGoldCompact shine={false} />,
  },
  {
    key: "E2",
    name: "E2 · Shining tab",
    note: "The same bar with a light travelling across it. The sheen moves a wide gradient's background-position rather than sweeping an overlay, so the tab never has to clip and the eye's tooltip still escapes it. Holds still for anyone who has asked for reduced motion.",
    digest: () => <TabGold shine />,
    compact: () => <TabGoldCompact shine />,
  },
  {
    key: "F",
    name: "F · In the lead",
    note: "The phrase says it, nothing else does. No tab, no eyebrow, no heading, no second block: \u201cThis Foundational Text, written in 1973, \u2026\u201d, with the F and the T set large in the display face so the phrase reads as the name of a kind of thing. The hover definition hangs on the phrase, the way a hard word in the synthesis does, so the info icon goes too. Needs a prompt change: see the note under this card.",
    digest: InTheLead,
    compact: InTheLeadCompact,
    prompt: (
      <>
        <strong style={{ fontWeight: 600, color: INK }}>Prompt change.</strong>{" "}
        The gate in <code>pickFoundational</code> currently asks for a whole sentence
        (&ldquo;one plain-English sentence on why this text changed the field&rdquo;), which
        arrives with its own subject: &ldquo;This paper showed that&hellip;&rdquo;. F needs the
        predicate only, so the card can own the subject, the phrase and the year, all
        three of which it already has. The ask becomes: finish the sentence &ldquo;This
        Foundational Text, written in 1973, __&rdquo; in at most 25 words, no citation
        counts, no restating the title. Composing the opening in the card rather than
        asking a model to produce the capitals is the difference between a rule and a
        hope. Not applied yet: it would leave every other candidate on this page
        rendering half a sentence.
      </>
    ),
  },
  {
    key: "0",
    name: "As it ships today",
    note: "The mono all-caps eyebrow, then a Display/SM heading over a tinted panel. Two headings and a filled box for one sentence, on a card that already carries five other blocks. Here for comparison only.",
    digest: Shipped,
    compact: ShippedCompact,
  },
  {
    key: "A",
    name: "A · Lead-in",
    note: "Smallest change that fixes both complaints. The eyebrow and the box both go; the sentence stays where it was and introduces itself in body face, sentence case, the way “Tip:” does. The word is said once instead of twice.",
    digest: LeadIn,
    compact: LeadInCompact,
  },
  {
    key: "B",
    name: "B · Standfirst",
    note: "No marker word at all. The gold frame is already the label, so the sentence takes the top of the card behind a 3px gold rule and the eye carries the definition. The card opens with why it matters rather than with a category.",
    digest: Standfirst,
    compact: StandfirstCompact,
  },
  {
    key: "C",
    name: "C · Hero swap",
    note: "The biggest cut: one block fewer than anything else here. On a foundational card the reason IS the interesting sentence, so it becomes the hero and the summary drops to body under the byline. The marker rides the byline like the venue does.",
    digest: HeroSwap,
    compact: HeroSwapCompact,
  },
  {
    key: "D",
    name: "D · Footnote",
    note: "The top of the card reads as an ordinary card. Provenance moves to the foot behind a gold rule and shares the row with Read paper, in Body/SM: a colophon, not a callout. Context after the argument rather than a gate in front of it.",
    digest: Footnote,
    compact: FootnoteCompact,
  },
  {
    key: "E",
    name: "E · Tab",
    note: "The marker as a gold folder tab straddling the top border, body face and sentence case. The sentence follows the hero as one dim italic line with no heading and no fill. Costs 12px of room above the card and a shell that cannot clip.",
    digest: Tab,
    compact: TabCompact,
  },
];

export default function FoundationalPrototypes() {
  const [only, setOnly] = useState<string | null>(null);
  const shown = only ? CANDIDATES.filter(c => c.key === only) : CANDIDATES;

  return (
    <div style={{ minHeight: "100vh", background: SURFACE, color: INK }}>
      <style>{`
        .proto-split { display: grid; grid-template-columns: 1.15fr 1fr; gap: 24px; }
        .proto-split > section + section { border-left: ${BORDER}; padding-left: 24px; }
        .proto-shelf { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; align-items: stretch; }
        .proto-tab-flat {
          background: linear-gradient(180deg, #fdf6dd 0%, #f2e2ae 46%, #e6d094 54%, #f7ecc6 100%);
        }
        .proto-tab-shine {
          background: linear-gradient(100deg,
            #eddfae 0%, #f7edc9 11%, #fdf8e4 21%, #f5e9c0 31%,
            #e9dba6 44%, #fcf6df 57%, #f3e6bb 69%,
            #e7d79f 82%, #f1e4b6 100%);
          background-size: 320% 100%;
          animation: proto-sheen 16s linear infinite;
        }
        @keyframes proto-sheen {
          from { background-position: 0% 0; }
          to   { background-position: 320% 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .proto-tab-shine { animation: none; background-position: 22% 0; }
        }
        @media (max-width: 720px) {
          .proto-split, .proto-shelf { grid-template-columns: 1fr; gap: 20px; }
          .proto-split > section + section { border-left: none; border-top: ${BORDER}; padding-left: 0; padding-top: 20px; }
        }
      `}</style>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "48px 24px 140px" }}>
        <h1 style={{ fontFamily: DISPLAY, fontSize: 32, fontWeight: 700, letterSpacing: "-0.02em", lineHeight: "40px", margin: "0 0 10px" }}>
          Foundational treatments
        </h1>
        <p style={{ ...BODY_STYLE, color: DIM, margin: "0 0 8px", maxWidth: 640 }}>
          Round two is the first three: E with the tab filled in gold, the same tab with a
          light moving across it, and one with no marker anywhere at all, where the phrase in
          the opening sentence is the label. Round one follows below. Gold frame, gold shadow
          and the 02+01 wash are fixed in every one; only the word and the sentence move.
        </p>
        <p style={{ ...BODY_SM, color: MUTED, margin: "0 0 28px", maxWidth: 640 }}>
          Each candidate is shown twice: the full card as Today renders it, then the compact card
          as the vault shelf renders it. The shelf currently says nothing about a foundational
          paper at all beyond the frame, which is the other half of the problem.
        </p>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 40 }}>
          {[{ key: "", name: "All" }, ...CANDIDATES.map(c => ({ key: c.key, name: c.key === "0" ? "Today" : c.key }))].map(o => {
            const active = (only ?? "") === o.key;
            return (
              <button
                key={o.key || "all"}
                onClick={() => setOnly(o.key || null)}
                style={{ ...DISPLAY_SM, padding: "8px 14px", border: BORDER, background: active ? INK : SURFACE, color: active ? SURFACE : INK, cursor: "pointer" }}
              >
                {o.name}
              </button>
            );
          })}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 64 }}>
          {shown.map(c => (
            <section key={c.key}>
              <h2 style={{ ...DISPLAY_SM, fontSize: 20, margin: "0 0 8px" }}>{c.name}</h2>
              <p style={{ ...BODY_SM, color: DIM, margin: "0 0 22px", maxWidth: 640 }}>{c.note}</p>
              {c.digest()}
              {c.prompt && (
                <p style={{ ...BODY_SM, color: DIM, margin: "18px 0 0", padding: "14px 16px", border: `2px solid ${GOLD}`, maxWidth: 640 }}>
                  {c.prompt}
                </p>
              )}
              <p style={{ ...BODY_SM, color: MUTED, margin: "26px 0 12px" }}>On the vault shelf:</p>
              <div className="proto-shelf">
                {c.compact()}
                <div style={{ border: `2px dashed ${MUTED}`, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, minHeight: 120 }}>
                  <span style={{ ...BODY_SM, color: MUTED, textAlign: "center" }}>
                    an ordinary saved paper sits here
                  </span>
                </div>
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
