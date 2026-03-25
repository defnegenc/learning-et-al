# Research-Backed Synthesis Improvements

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single-shot synthesis call with a multi-stage pipeline (skeleton → draft → self-refine) and add hybrid BM25+embedding scoring with RRF fusion.

**Architecture:** The current Step 6 (single `aiComplete` call producing items + synthesis + keyConcepts) gets split into: (A) metadata call (items/keywords/findings/keyConcepts), (B) skeleton call (cross-document relations + argument outline), (C) synthesis draft from skeleton, (D) self-critique + revision. Paper scoring adds BM25 as a second signal fused with embeddings via Reciprocal Rank Fusion.

**Tech Stack:** Same stack (Next.js, Drizzle, aiComplete abstraction). No new deps — BM25 implemented from scratch (~30 lines).

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `src/lib/bm25.ts` | **Create** | BM25 scorer + RRF fusion function |
| `src/lib/ai/prompts.ts` | **Modify** | Split `digestPrompt` into metadata + skeleton + synthesis + critique prompts |
| `src/lib/pipeline/digest.ts` | **Modify** | Multi-stage synthesis pipeline, hybrid scoring in Step 3 |
| `docs/algorithm.md` | **Modify** | Document new pipeline stages |

---

### Task 1: BM25 Scorer + RRF Fusion

**Files:**
- Create: `src/lib/bm25.ts`

- [ ] **Step 1: Create BM25 + RRF module**

```typescript
// src/lib/bm25.ts

/**
 * Lightweight BM25 scorer + Reciprocal Rank Fusion.
 * Cormack et al. (2009) — RRF outperforms individual rank methods.
 */

const K1 = 1.2;
const B = 0.75;

function tokenize(text: string): string[] {
  return text.toLowerCase().replace(/[^\w\s]/g, " ").split(/\s+/).filter(w => w.length > 2);
}

/** Compute BM25 scores for a query against a corpus of documents. */
export function bm25Score(query: string, docs: string[]): number[] {
  const queryTokens = tokenize(query);
  const tokenizedDocs = docs.map(tokenize);
  const N = docs.length;
  const avgDl = tokenizedDocs.reduce((s, d) => s + d.length, 0) / Math.max(N, 1);

  // IDF: log((N - df + 0.5) / (df + 0.5) + 1) per query term
  const df = new Map<string, number>();
  for (const doc of tokenizedDocs) {
    const unique = new Set(doc);
    for (const t of unique) df.set(t, (df.get(t) || 0) + 1);
  }

  return tokenizedDocs.map(doc => {
    const dl = doc.length;
    const tf = new Map<string, number>();
    for (const t of doc) tf.set(t, (tf.get(t) || 0) + 1);

    let score = 0;
    for (const qt of queryTokens) {
      const termDf = df.get(qt) || 0;
      const termTf = tf.get(qt) || 0;
      const idf = Math.log((N - termDf + 0.5) / (termDf + 0.5) + 1);
      score += idf * (termTf * (K1 + 1)) / (termTf + K1 * (1 - B + B * dl / avgDl));
    }
    return score;
  });
}

/**
 * Reciprocal Rank Fusion — combine multiple ranked lists.
 * Cormack et al. (2009), SIGIR. k=60 is standard.
 */
export function rrfFuse(rankedLists: number[][], k = 60): number[] {
  const n = rankedLists[0].length;
  // Each rankedList is an array of scores — convert to ranks
  const rankArrays = rankedLists.map(scores => {
    const indexed = scores.map((s, i) => ({ i, s }));
    indexed.sort((a, b) => b.s - a.s);
    const ranks = new Array(n).fill(0);
    indexed.forEach((item, rank) => { ranks[item.i] = rank + 1; });
    return ranks;
  });

  // RRF(d) = sum(1 / (k + rank_i(d)))
  const fused = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    for (const ranks of rankArrays) {
      fused[i] += 1 / (k + ranks[i]);
    }
  }
  return fused;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/bm25.ts
git commit -m "feat: add BM25 scorer and RRF fusion (Cormack 2009)"
```

---

### Task 2: Hybrid Scoring in Digest Pipeline

**Files:**
- Modify: `src/lib/pipeline/digest.ts` — Step 3 scoring section (~lines 343-375)

- [ ] **Step 1: Import bm25 and add hybrid scoring**

Add import at top of digest.ts:
```typescript
import { bm25Score, rrfFuse } from "@/lib/bm25";
```

Replace the scoring section (Step 3) — keep all existing signals but add BM25 as a second axis and fuse with RRF:

```typescript
  // ─── Step 3: Score candidates — hybrid multi-signal scoring ──────────────────
  // Research: Cormack et al. (2009) — RRF fusion of heterogeneous rankings
  // Signal 1: Embedding similarity (semantic meaning)
  // Signal 2: BM25 (keyword/term matching — catches specific technique names embeddings miss)
  const resultEmbs = await embedBatch(allResults.map(paperText));
  const currentYear = new Date().getFullYear();

  // Compute raw embedding similarities
  const embeddingSims = allResults.map((_, i) => cosineSimilarity(themeEmb, resultEmbs[i]));

  // Compute BM25 scores against the theme text
  const bm25Scores = bm25Score(theme, allResults.map(paperText));

  // RRF fusion of embedding + BM25 rankings
  const rrfScores = rrfFuse([embeddingSims, bm25Scores]);

  const SIM_MIN_THEME = 0.12;
  const scored = allResults
    .map((p, i) => {
      const themeSim = embeddingSims[i];
      const rrfScore = rrfScores[i];
      // Quality boosts (applied on top of RRF)
      const age = p.year ? currentYear - p.year : 2;
      const recencyBonus = age <= 0 ? 0.03 : age === 1 ? 0.015 : 0; // scaled down for RRF range
      const venueBoost = venueQualityBoost(p.venueName, p.primaryDomain) * 0.3; // scale to RRF range
      const instBoost = institutionBoost(p.institutions || []) * 0.3;
      const score = rrfScore + recencyBonus + venueBoost + instBoost;
      if (venueBoost > 0 || instBoost > 0) {
        console.log(`[Digest] Quality boost: "${p.title.slice(0, 50)}" venue=${venueBoost.toFixed(3)} inst=${instBoost.toFixed(3)} (${p.venueName || "unknown"})`);
      }
      return { p, themeSim, score };
    })
    .filter(({ p }) => !seenPaperTitles.has(p.title.toLowerCase()))
    .filter(({ themeSim }) => themeSim >= SIM_MIN_THEME)
    .sort((a, b) => b.score - a.score);
```

- [ ] **Step 2: Update threshold constants for RRF range**

RRF scores are much smaller than raw cosine similarities. Update the threshold constants:

```typescript
// RRF-adapted thresholds (RRF scores are typically 0.01-0.03 range)
const SIM_ONTOPIC  = 0.025; // was 0.25 for raw cosine
const SIM_FALLBACK = 0.015; // was 0.15 for raw cosine
```

Note: The `SIM_ONTOPIC` and `SIM_FALLBACK` constants are used for the `score` field which is now RRF-based. The raw `themeSim` floor (`SIM_MIN_THEME = 0.12`) stays as-is since it operates on raw cosine similarity.

- [ ] **Step 3: Verify build**

```bash
npx next build
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/pipeline/digest.ts
git commit -m "feat: hybrid BM25+embedding scoring with RRF fusion"
```

---

### Task 3: Split Prompts for Multi-Stage Synthesis

**Files:**
- Modify: `src/lib/ai/prompts.ts`

- [ ] **Step 1: Add metadata-only prompt (items, keywords, findings, keyConcepts)**

This is the existing `digestPrompt` but with synthesis removed. Add a new function:

```typescript
export function metadataPrompt(
  items: { title: string; abstract: string; source: string; category?: string; year?: number }[],
  theme: string,
  ctx?: DigestContext
) {
  const listing = items.map((p, i) => {
    const maxChars = p.source === "rss" ? 6000 : 2000;
    const yearStr = p.year ? `, ${p.year}` : "";
    return `[${i + 1}] "${p.title}" (${p.source}${yearStr}, ${p.category || "unknown"})\n${p.abstract.slice(0, maxChars)}`;
  }).join("\n\n");

  const contextBlock = ctx
    ? `User's interest: "${ctx.focusInterest}" (level: ${ctx.focusLevel})\nResearch angle for today: "${ctx.researchAngle}"\n`
    : "";

  return `${contextBlock}Today's theme: "${theme}"

Here are ${items.length} items. Produce JSON (no markdown fences):

{
  "items": [
    { "index": 1, "summary": "1-2 sentence plain-English summary, MAX 40 words", "keywords": ["kw1", "kw2", "kw3"], "findings": ["Specific finding 1", "Specific finding 2", "Specific finding 3"], "connectionToTheme": "one sentence: why this paper matters for today's question" }
  ],
  "keyConcepts": ["term: one-sentence plain-English definition", "term2: definition"]
}

${/* Keep all the existing SUMMARY RULES, FINDINGS RULES, KEYWORD RULES, KEYCONCEPTS RULES from digestPrompt — copy them verbatim */""}
CONNECTION TO THEME RULES:
- Each item needs a "connectionToTheme" — a SHORT phrase (5-10 words) explaining why it's here
- NO prefixes like "Directly answers..." or "A bit of a stretch..."
- Just the reason: "shows what happens when you remove human teachers" or "the tech behind the trust problem"

SUMMARY RULES:
- MAX 40 WORDS. 1-2 sentences. The reader scans this on a card — it must fit without truncation.
- Write for a smart person who is NOT a domain expert.
- Focus on what the paper FOUND, not what it set out to do.
- BAD: "This paper investigates the efficacy of parameter-efficient fine-tuning approaches..."
- GOOD: "Fine-tuning just 1% of an AI model's parameters cut training costs 10x with only a 3% accuracy drop."

FINDINGS RULES:
- 3 findings per paper. Each one answers: "what did they FIND OUT?" not "what did they DO?"
- A finding is a RESULT, OUTCOME, or CONCLUSION.

KEYWORD RULES:
- Keywords should describe what the PAPER is actually about
- 3 DISTINCT terms per paper

KEYCONCEPTS RULES:
- 5 concepts that span all papers
- Format MUST be "term: definition"
- Definitions must be one plain sentence, as if explaining to a curious 20-year-old

Papers:

${listing}`;
}
```

- [ ] **Step 2: Add skeleton prompt (cross-document relations + argument outline)**

Research basis: Radev (2000) Cross-Document Structure Theory, CAST (2020), Yao (2023) Tree of Thoughts.

```typescript
export function skeletonPrompt(
  items: { title: string; abstract: string; source: string; year?: number }[],
  theme: string,
) {
  const listing = items.map((p, i) => {
    const yearStr = p.year ? `, ${p.year}` : "";
    return `[${i + 1}] "${p.title}" (${p.source}${yearStr})\n${p.abstract.slice(0, 1500)}`;
  }).join("\n\n");

  return `Theme: "${theme}"

Papers:
${listing}

You are planning the argument structure for a research synthesis paragraph. Before writing anything, ANALYZE the relationships between these papers.

Return JSON (no markdown fences):
{
  "paperRelations": [
    { "paper1": 1, "paper2": 2, "relation": "contradicts|agrees|extends|alternative_mechanism|unrelated", "explanation": "5-10 words" }
  ],
  "paperRoles": [
    { "index": 1, "role": "supports|complicates|provides_evidence|provides_mechanism|is_weak_fit", "shortName": "the Turkish teacher study", "coreContribution": "what this paper uniquely adds to the argument, 10 words max" }
  ],
  "coreTension": "The central disagreement or unresolved question these papers surface, 1 sentence",
  "argumentArc": "First establish X (paper N), then complicate with Y (paper N), resolve/leave open with Z",
  "skipPapers": [1] // indices of papers that don't meaningfully connect — better to skip than force
}

RULES:
- Be HONEST about paper fit. If a paper barely connects to the theme, mark it "is_weak_fit" and add to skipPapers.
- The coreTension should be a GENUINE intellectual tension, not a fake one.
- The argumentArc must show how papers BUILD on each other, not just appear sequentially.
- shortName should be how you'd refer to it talking to a friend: "the McKinsey report", "the Nigerian banking study"
- If all papers agree, the tension is: "if everyone agrees, why hasn't this been solved?"`;
}
```

- [ ] **Step 3: Add synthesis-from-skeleton prompt**

```typescript
export function synthesisFromSkeletonPrompt(
  items: { title: string; abstract: string; source: string; year?: number }[],
  theme: string,
  skeleton: {
    paperRoles: { index: number; role: string; shortName: string; coreContribution: string }[];
    coreTension: string;
    argumentArc: string;
    skipPapers?: number[];
  }
) {
  const listing = items.map((p, i) => {
    const yearStr = p.year ? `, ${p.year}` : "";
    return `[${i + 1}] "${p.title}" (${p.source}${yearStr})\n${p.abstract.slice(0, 1500)}`;
  }).join("\n\n");

  const roleDesc = skeleton.paperRoles
    .filter(r => !skeleton.skipPapers?.includes(r.index))
    .map(r => `- Paper ${r.index} ("${r.shortName}"): ${r.role} — ${r.coreContribution}`)
    .join("\n");

  const skippedDesc = skeleton.skipPapers?.length
    ? `\nPapers to skip or mention only briefly: ${skeleton.skipPapers.map(i => `[${i}]`).join(", ")}`
    : "";

  return `Theme: "${theme}"

Papers:
${listing}

ARGUMENT PLAN (follow this structure):
Core tension: ${skeleton.coreTension}
Arc: ${skeleton.argumentArc}
Paper roles:
${roleDesc}${skippedDesc}

Now write the synthesis paragraph. Follow the argument arc above. Return ONLY the paragraph text (no JSON, no markdown fences).

STYLE RULES:
- Name papers in **bold** conversationally: "**${skeleton.paperRoles[0]?.shortName || "the study"}** (Author, Year)"
- After first mention, just use the short bold name
- ONE paragraph, 5-8 sentences
- Start with the insight, not the build-up
- Include one specific number or finding
- End naturally — no formulaic closing
- Write for smart non-experts. Translate jargon.
- NO: demonstrates, reveals, highlights, nuanced, multifaceted
- NO em dashes. NO restating the theme.
- Contractions OK. "So", "But", "Turns out" OK.
- If a paper is in skipPapers, you may mention it in one sentence or leave it out entirely. Do NOT build your argument around it.`;
}
```

- [ ] **Step 4: Add self-critique prompt**

Research basis: Madaan et al. (2023) Self-Refine, ~20% quality improvement.

```typescript
export function synthesisCritiquePrompt(
  synthesis: string,
  theme: string,
  paperTitles: string[]
) {
  return `You are a tough editor reviewing a research synthesis paragraph.

Theme: "${theme}"
Papers referenced: ${paperTitles.map((t, i) => `[${i + 1}] "${t}"`).join(", ")}

Synthesis:
"""
${synthesis}
"""

Score each dimension 1-5 and give specific, actionable feedback:

Return JSON (no markdown fences):
{
  "scores": {
    "argument": 0, // Does it make an ARGUMENT (not just summarize)? Is there a genuine tension?
    "connection": 0, // Are ALL mentioned papers necessary to the argument? Or is one just... there?
    "accessibility": 0, // Would a smart non-expert find this clear and interesting?
    "specificity": 0 // Does it include specific findings/numbers, or just vague claims?
  },
  "weakestPoint": "Which sentence is weakest and why, in 15 words",
  "revision": "Specific rewrite instruction in 1-2 sentences. Be concrete: 'Move the finding about X to the opening' not 'make it better'"
}

Be harsh. A 3 is average. Most syntheses are 2-3. A 5 means publishable.`;
}
```

- [ ] **Step 5: Add revision prompt**

```typescript
export function synthesisRevisionPrompt(
  originalSynthesis: string,
  critique: { weakestPoint: string; revision: string },
  theme: string
) {
  return `Revise this synthesis based on the editor's feedback.

Theme: "${theme}"

Original:
"""
${originalSynthesis}
"""

Editor's feedback:
- Weakest point: ${critique.weakestPoint}
- Revision instruction: ${critique.revision}

Write the improved version. Return ONLY the revised paragraph (no JSON, no markdown fences). Keep the same **bold paper names**. Same length (5-8 sentences). Fix ONLY what the editor flagged — don't rewrite parts that work.`;
}
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/ai/prompts.ts
git commit -m "feat: add skeleton, critique, and revision prompts for multi-stage synthesis"
```

---

### Task 4: Multi-Stage Synthesis Pipeline

**Files:**
- Modify: `src/lib/pipeline/digest.ts` — Replace Step 6 (~lines 617-646)
- Modify: `src/lib/pipeline/digest.ts` — Update imports

- [ ] **Step 1: Update imports**

```typescript
import { digestPrompt, metadataPrompt, skeletonPrompt, synthesisFromSkeletonPrompt, synthesisCritiquePrompt, synthesisRevisionPrompt, SYNTHESIS_SYSTEM } from "@/lib/ai/prompts";
```

Note: Keep `digestPrompt` imported as fallback.

- [ ] **Step 2: Replace Step 6 with multi-stage pipeline**

Replace everything from `// ─── Step 6: Synthesize` through the JSON parsing (lines ~617-646) with:

```typescript
  // ─── Step 6: Multi-stage synthesis (Skeleton → Draft → Self-Refine) ─────────
  // Research: Yao 2023 (Tree of Thoughts), Radev 2000 (CST), Madaan 2023 (Self-Refine)
  const paperListing = items.map(p => ({
    title: p.title, abstract: p.abstract, source: p.source, category: p.category, year: p.year,
  }));
  const ctx = { focusInterest, focusLevel, researchAngle: finalTheme };

  // Stage A: Metadata (items, keywords, findings, keyConcepts)
  console.log(`[Digest] Stage A: generating metadata...`);
  const metadataResp = await aiComplete(aiConfig, SYNTHESIS_SYSTEM, metadataPrompt(paperListing, finalTheme, ctx));
  let metadata: { items: DigestAIResponse["items"]; keyConcepts: string[] };
  try {
    const jsonMatch = metadataResp.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON");
    metadata = JSON.parse(jsonMatch[0]);
  } catch {
    console.log(`[Digest] Metadata parse failed, using empty defaults`);
    metadata = { items: items.map((_, i) => ({ index: i + 1, summary: "", keywords: [], findings: [] })), keyConcepts: [] };
  }

  // Stage B: Skeleton (cross-document relations + argument outline)
  console.log(`[Digest] Stage B: building argument skeleton...`);
  const skeletonResp = await aiComplete(
    aiConfig,
    "You analyze relationships between research papers and plan argument structures. Return only JSON.",
    skeletonPrompt(paperListing, finalTheme)
  );
  let skeleton: {
    paperRelations?: { paper1: number; paper2: number; relation: string; explanation: string }[];
    paperRoles: { index: number; role: string; shortName: string; coreContribution: string }[];
    coreTension: string;
    argumentArc: string;
    skipPapers?: number[];
  };
  try {
    const jsonMatch = skeletonResp.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON");
    skeleton = JSON.parse(jsonMatch[0]);
    console.log(`[Digest] Skeleton: tension="${skeleton.coreTension}", skip=${skeleton.skipPapers?.length || 0} papers`);
  } catch {
    console.log(`[Digest] Skeleton parse failed, using simple fallback`);
    skeleton = {
      paperRoles: items.map((p, i) => ({ index: i + 1, role: "supports", shortName: p.title.split(/\s+/).slice(0, 4).join(" "), coreContribution: "evidence" })),
      coreTension: `What "${finalTheme}" really means according to these papers`,
      argumentArc: "Present each paper's perspective, then find the thread",
    };
  }

  // Stage C: Draft synthesis from skeleton
  console.log(`[Digest] Stage C: drafting synthesis from skeleton...`);
  let synthesis = await aiComplete(
    aiConfig,
    SYNTHESIS_SYSTEM,
    synthesisFromSkeletonPrompt(paperListing, finalTheme, skeleton)
  );
  // Strip any accidental markdown fences
  synthesis = synthesis.replace(/^```[\s\S]*?\n/, "").replace(/\n```\s*$/, "").trim();

  // Stage D: Self-Refine (critique → revision)
  console.log(`[Digest] Stage D: self-critique...`);
  try {
    const critiqueResp = await aiComplete(
      aiConfig,
      "You are a tough editor who evaluates research synthesis quality. Return only JSON.",
      synthesisCritiquePrompt(synthesis, finalTheme, items.map(p => p.title))
    );
    const critiqueMatch = critiqueResp.match(/\{[\s\S]*\}/);
    if (critiqueMatch) {
      const critique = JSON.parse(critiqueMatch[0]);
      const minScore = Math.min(critique.scores?.argument || 5, critique.scores?.connection || 5, critique.scores?.accessibility || 5, critique.scores?.specificity || 5);
      console.log(`[Digest] Critique scores: arg=${critique.scores?.argument} conn=${critique.scores?.connection} acc=${critique.scores?.accessibility} spec=${critique.scores?.specificity}`);

      // Only revise if any dimension scores below 4
      if (minScore < 4 && critique.weakestPoint && critique.revision) {
        console.log(`[Digest] Revising (weakest: ${critique.weakestPoint})...`);
        const revised = await aiComplete(
          aiConfig,
          SYNTHESIS_SYSTEM,
          synthesisRevisionPrompt(synthesis, critique, finalTheme)
        );
        const cleanRevised = revised.replace(/^```[\s\S]*?\n/, "").replace(/\n```\s*$/, "").trim();
        if (cleanRevised.length > 50) {
          synthesis = cleanRevised;
          console.log(`[Digest] Revision applied (${cleanRevised.length} chars)`);
        }
      } else {
        console.log(`[Digest] Synthesis passed critique (min score ${minScore}), no revision needed`);
      }
    }
  } catch (err) {
    console.log(`[Digest] Self-refine failed (${err}), keeping draft synthesis`);
  }

  const parsedAI: DigestAIResponse = {
    items: metadata.items,
    synthesis,
    keyConcepts: metadata.keyConcepts || [],
  };
```

- [ ] **Step 3: Verify build**

```bash
npx next build
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/pipeline/digest.ts
git commit -m "feat: multi-stage synthesis pipeline (skeleton → draft → self-refine)"
```

---

### Task 5: Update Algorithm Documentation

**Files:**
- Modify: `docs/algorithm.md`

- [ ] **Step 1: Add new pipeline stages to algorithm.md**

Add a section documenting the multi-stage synthesis:

```markdown
## Synthesis Pipeline (Step 6)

Previously a single LLM call. Now four stages based on research:

### Stage A: Metadata Generation
Produces per-paper summaries, keywords, findings, and key concepts.

### Stage B: Argument Skeleton
**Research basis:** Cross-Document Structure Theory (Radev 2000), Tree of Thoughts (Yao 2023)

Before writing prose, the LLM:
1. Identifies cross-document relations (agrees, contradicts, extends, alternative mechanism)
2. Assigns each paper a role (supports, complicates, provides evidence, is weak fit)
3. Identifies the core tension between papers
4. Plans the argument arc
5. Flags papers that should be skipped rather than forced

### Stage C: Synthesis Draft
Writes the paragraph following the skeleton's argument arc. Papers marked as weak fit are mentioned briefly or skipped.

### Stage D: Self-Refine
**Research basis:** Self-Refine (Madaan et al. 2023, NeurIPS) — ~20% quality improvement

The LLM critiques its own synthesis on four dimensions:
- Argument (is it making a point, not just summarizing?)
- Connection (are all papers necessary?)
- Accessibility (would a non-expert understand?)
- Specificity (does it include real findings/numbers?)

If any score < 4, the LLM revises based on the critique.

## Scoring (Step 3)

### Hybrid BM25 + Embedding Scoring
**Research basis:** Reciprocal Rank Fusion (Cormack et al. 2009, SIGIR)

Papers are scored by two independent systems:
1. **Embedding similarity** (all-MiniLM-L6-v2) — captures semantic meaning
2. **BM25** — captures keyword/term matches that embeddings miss

Rankings are fused using Reciprocal Rank Fusion: `RRF(d) = sum(1/(k + rank_i(d)))` with k=60.
Quality boosts (venue prestige, institution, recency) are applied on top.
A hard floor of 0.12 raw embedding similarity prevents irrelevant papers from sneaking in via boosts.
```

- [ ] **Step 2: Commit**

```bash
git add docs/algorithm.md
git commit -m "docs: document multi-stage synthesis pipeline and hybrid scoring"
```

---

### Task 6: Final Integration Test + Deploy

- [ ] **Step 1: Full build verification**

```bash
npx next build
```

- [ ] **Step 2: Squash into single deploy commit and push**

```bash
git push
```
