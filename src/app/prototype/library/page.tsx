"use client";

import { useMemo, useState } from "react";
import type { PaperItem } from "@/lib/types";
import { PaperCard } from "@/components/paper-card";
import { fieldColor } from "@/lib/field-hierarchy";
import {
  ActionButton, BODY_SM, BODY_STYLE, BORDER_HAIR, DIM, DISPLAY_LG, DISPLAY_SM,
  HAIRLINE, INK, RULE, Segmented, SURFACE, Tag,
} from "@/components/design-system";

/*
 * The saved-papers shelf, reworked: /prototype/library.
 *
 * Three proposals in one grid, each answering a complaint about the vault:
 *
 *  1. A saved paper wears its ORIGINAL digest wash, `wash(sourceIndex)`, not a
 *     colour drawn from its position in the save-ordered grid. The DB already
 *     stores `sourceIndex` and /api/vault already returns it; nothing new needs
 *     persisting. The Segmented control compares the two so the difference is
 *     visible on the same papers.
 *  2. The shelf segments by field. A row of field chips above the grid, each
 *     filled with the field's fixed spectrum slot. (Production would need a
 *     field per paper: derived from the digest's seed interest at save time,
 *     or from the paper's OpenAlex primary domain. Fixture papers carry it
 *     directly.)
 *  3. A card says what clicking it does: the footnote gains "Read →" opposite
 *     the origin line, and clicking anywhere on the card opens the reading
 *     view. Here the click lands on a stub standing in for /library/[id].
 *
 * The cards are the production `PaperCard` compact. Only the fixtures and the
 * chrome around the grid are prototype code.
 */

type SavedPaper = PaperItem & { field: string };

const PAPERS: SavedPaper[] = [
  {
    id: "s1",
    title: "Emergent deception in reward-optimised dialogue agents",
    summary: null, source: "arxiv", sourceUrl: "https://example.com/deception",
    keywords: ["language models", "alignment"], authors: ["Nadia Osei", "Piotr Waleski"],
    year: 2026, category: "recent", sourceIndex: 0, field: "Computer Science",
    digestTheme: "Can a model want something it hides?",
    companionRemember: "Optimise a chatbot hard enough for approval and it learns to say what raters want to hear, which is not the same thing as what it computed.",
  },
  {
    id: "s2",
    title: "Gut microbial succession after a course of broad-spectrum antibiotics",
    summary: null, source: "semantic_scholar", sourceUrl: "https://example.com/microbiome",
    keywords: ["microbiome", "antibiotics"], authors: ["Lena Fischer", "Tomás Aguilar", "Rei Nakamura"],
    year: 2025, category: "recent", sourceIndex: 2, field: "Biology",
    digestTheme: "Does your gut ever fully come back?",
    companionRemember: "The community that returns is not the one that left: most species come back within weeks, but the rare ones that anchor the network can be gone for good.",
  },
  {
    id: "s3",
    title: "Prospective evaluation of an LLM triage assistant in a paediatric emergency department",
    summary: null, source: "semantic_scholar", sourceUrl: "https://example.com/triage",
    keywords: ["clinical AI", "triage"], authors: ["Amara Diallo", "Sofia Petrov"],
    year: 2026, category: "recent", sourceIndex: 1, field: "Medicine",
    digestTheme: "Should a model see your child first?",
    companionRemember: "The assistant matched senior nurses on urgency but failed differently: its misses clustered on the rare presentations, exactly where a tired human also misses.",
  },
  {
    id: "s4",
    title: "The strength of weak ties",
    summary: null, source: "semantic_scholar", sourceUrl: "https://example.com/weak-ties",
    keywords: ["social networks"], authors: ["Mark S. Granovetter"],
    year: 1973, category: "foundational", sourceIndex: 3, field: "Social Sciences",
    foundationalReason: "Fifty years of network science, job-search research and feed algorithms are replies to this one observation about acquaintances.",
    digestTheme: "Who actually gets you the job?",
    companionRemember: "Close friends know what you know. The acquaintance you rarely see lives in a different information pool, and that is why leads come from the edge of your network.",
  },
  {
    id: "s5",
    title: "Scaling laws for sparse mixture-of-experts language models revisited",
    summary: null, source: "arxiv", sourceUrl: "https://example.com/moe",
    keywords: ["language models", "scaling"], authors: ["Wei Zhang", "Priya Raghunathan"],
    year: 2026, category: "recent", sourceIndex: 2, field: "Computer Science",
    digestTheme: "Is bigger still the whole trick?",
    companionRemember: "Past a threshold the routing network, not the expert count, sets the ceiling: doubling experts buys almost nothing once routing entropy saturates.",
  },
  {
    id: "s6",
    title: "Continuous glucose monitoring in non-diabetic adults: signal or theatre?",
    summary: null, source: "semantic_scholar", sourceUrl: "https://example.com/cgm",
    keywords: ["metabolism", "wearables"], authors: ["Johan Berg", "Aisha Karim"],
    year: 2025, category: "recent", sourceIndex: 0, field: "Medicine",
    digestTheme: "Is your glucose monitor telling you anything?",
    companionRemember: "Healthy adults wearing CGMs mostly rediscover that rice raises glucose. The spikes that look alarming sit inside the range clinicians consider unremarkable.",
  },
  {
    id: "s7",
    title: "Horizontal gene transfer in urban wildlife populations",
    summary: null, source: "semantic_scholar", sourceUrl: "https://example.com/hgt",
    keywords: ["evolution", "urban ecology"], authors: ["Carmen Ruiz", "Dele Adeyemi"],
    year: 2026, category: "recent", sourceIndex: 1, field: "Biology",
    digestTheme: "Are cities breeding new biology?",
    companionRemember: "Resistance genes move between species faster in cities than in forests, and the vector is not medicine: it is shared dumpsters.",
  },
  {
    id: "s8",
    title: "Do multimodal models read charts or memorise them?",
    summary: null, source: "arxiv", sourceUrl: "https://example.com/charts",
    keywords: ["computer vision", "evaluation"], authors: ["Hana Sato", "Louis Mbeki"],
    year: 2026, category: "recent", sourceIndex: 3, field: "Computer Science",
    digestTheme: "Can a model read a graph it has never seen?",
    companionRemember: "Redraw the same data with unfamiliar axes and accuracy halves: much of chart 'reading' is recognition of chart conventions, not extraction of values.",
  },
];

const FIELDS = ["Computer Science", "Biology", "Medicine", "Social Sciences"];

export default function LibraryPrototype() {
  const [colorMode, setColorMode] = useState<"original" | "shelf">("original");
  const [field, setField] = useState<string | null>(null);
  const [opened, setOpened] = useState<SavedPaper | null>(null);

  const shown = useMemo(
    () => (field ? PAPERS.filter(p => p.field === field) : PAPERS),
    [field],
  );

  if (opened) {
    return (
      <div style={{ minHeight: "100vh", background: SURFACE, color: INK }}>
        <div style={{ maxWidth: 720, margin: "0 auto", padding: "64px 24px" }}>
          <h1 style={{ ...DISPLAY_LG, margin: "0 0 12px" }}>{opened.plainName ?? opened.title}</h1>
          <p style={{ ...BODY_STYLE, color: DIM, margin: "0 0 8px" }}>
            In the product this click goes to <code>/library/{opened.id}</code>: the reading
            view, with the walkthrough, the glossary and Ask. The shelf card is the door;
            this stub just proves the door opens.
          </p>
          <p style={{ ...BODY_STYLE, margin: "0 0 24px" }}>{opened.companionRemember}</p>
          <ActionButton onClick={() => setOpened(null)}>Back to the shelf</ActionButton>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: SURFACE, color: INK }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "48px 24px 80px" }}>
        <h1 style={{ ...DISPLAY_LG, margin: "0 0 10px" }}>The library shelf</h1>
        <p style={{ ...BODY_STYLE, color: DIM, margin: "0 0 24px", maxWidth: 640 }}>
          Three proposals on the production compact card: a saved paper keeps the colour it
          wore in its digest, the shelf segments by field, and the card says that clicking
          it opens the reading view. Toggle the colour mode to compare against what ships
          today.
        </p>

        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 16, marginBottom: 12 }}>
          <Segmented
            value={colorMode}
            onChange={setColorMode}
            options={[
              { key: "original" as const, label: "Original digest colour" },
              { key: "shelf" as const, label: "Grid position (today)" },
            ]}
            style={{ minWidth: 380 }}
          />
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, padding: "14px 0 20px", borderBottom: HAIRLINE, marginBottom: 24 }}>
          <Tag
            label="Everything"
            tint={field === null ? INK : SURFACE}
            onClick={() => setField(null)}
            style={field === null ? { color: SURFACE } : { border: `1px solid ${RULE}` }}
          />
          {FIELDS.map(f => {
            const active = field === f;
            return (
              <Tag
                key={f}
                label={f}
                tint={active ? fieldColor(f) : SURFACE}
                onClick={() => setField(active ? null : f)}
                style={active ? { border: BORDER_HAIR } : { border: `1px solid ${RULE}` }}
              />
            );
          })}
          <span style={{ ...BODY_SM, color: DIM, alignSelf: "center", marginLeft: 4 }}>
            {shown.length} of {PAPERS.length} saved
          </span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 24 }}>
          {shown.map((p, gridIdx) => (
            <PaperCard
              key={p.id}
              paper={p}
              index={colorMode === "original" ? (p.sourceIndex ?? gridIdx) : gridIdx}
              size="compact"
              loggedIn
              initialBookmarked
              preview={p.companionRemember}
              onOpen={() => setOpened(p)}
              footnote={
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
                  <span style={{ ...BODY_SM, fontStyle: "italic", color: DIM, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    Saved from &ldquo;{p.digestTheme}&rdquo;
                  </span>
                  <span style={{ ...DISPLAY_SM, padding: "6px 14px", border: `2px solid ${INK}`, background: SURFACE, whiteSpace: "nowrap" }}>Learn more &rarr;</span>
                </div>
              }
            />
          ))}
        </div>
      </div>
    </div>
  );
}
