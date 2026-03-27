export const SYNTHESIS_SYSTEM = `You write for smart people who are NOT domain experts. You translate jargon into plain English — "photovoltaic shading devices" becomes "solar panel shades on buildings", "composite laminates" becomes "layered materials like in airplane wings". You use contractions and start sentences with "So", "But", "Turns out". You never say "notably", "furthermore", "demonstrates". You ground everything in real-world problems the reader can picture. CRITICAL: Always return valid JSON with no text before or after the JSON object.`;

export const SYNTHESIS_PROSE_SYSTEM = `You write like a smart friend texting about something they just read. Short sentences. Casual. You translate jargon into plain English. Contractions always. Start sentences with "So", "But", "Turns out", "Here's the thing".

BANNED PATTERNS — never write these:
- "The question of whether X isn't just about Y — it's about Z" (this is the worst one. Kill it.)
- "X isn't merely Y — it's fundamentally Z"
- "This isn't just about X — it's about the very nature of Y"
- Any sentence with "fundamentally", "inherently", "arguably", "notably", "furthermore", "demonstrates"
- Any sentence with an em dash followed by "it's about"
- No em dashes at all. Use periods. Use "but". Use "and".

Write like you're explaining this to a friend over coffee. Not like you're writing a TED talk script.`;

interface DigestContext {
  focusInterest: string;
  focusLevel: "beginner" | "intermediate" | "expert";
  researchAngle: string;
}

type PaperListing = { title: string; abstract: string; source: string; category?: string; year?: number; tensionHint?: string };

function formatPapers(items: PaperListing[], maxChars = 2000) {
  return items.map((p, i) => {
    const chars = p.source === "rss" ? 6000 : maxChars;
    const yearStr = p.year ? `, ${p.year}` : "";
    const hint = p.tensionHint ? `\n[HINT: ${p.tensionHint}]` : "";
    return `[${i + 1}] "${p.title}" (${p.source}${yearStr}, ${p.category || "unknown"})${hint}\n${p.abstract.slice(0, chars)}`;
  }).join("\n\n");
}

// ─── Legacy single-call prompt (kept as fallback) ────────────────────────────

export function digestPrompt(
  items: PaperListing[],
  theme: string,
  ctx?: DigestContext
) {
  const listing = formatPapers(items);

  const contextBlock = ctx
    ? `User's interest: "${ctx.focusInterest}" (level: ${ctx.focusLevel})
Research angle for today: "${ctx.researchAngle}"
`
    : "";

  return `${contextBlock}Today's theme: "${theme}"

Here are ${items.length} items. Produce JSON (no markdown fences):

{
  "items": [
    { "index": 1, "summary": "1-2 sentence plain-English summary, MAX 40 words", "keywords": ["kw1", "kw2", "kw3"], "findings": ["Specific finding 1", "Specific finding 2", "Specific finding 3"], "connectionToTheme": "one sentence: why this paper matters for today's question" }
  ],
  "synthesis": "see format below",
  "keyConcepts": ["term: one-sentence plain-English definition", "term2: definition"]
}

${METADATA_RULES(ctx)}

${SYNTHESIS_RULES(theme, ctx)}

Papers:

${listing}`;
}

// ─── Multi-stage prompts ─────────────────────────────────────────────────────

/** Stage A: Metadata only (items, keywords, findings, keyConcepts) */
export function metadataPrompt(items: PaperListing[], theme: string, ctx?: DigestContext) {
  const listing = formatPapers(items);
  const contextBlock = ctx
    ? `User's interest: "${ctx.focusInterest}" (level: ${ctx.focusLevel})\nResearch angle for today: "${ctx.researchAngle}"\n`
    : "";

  return `${contextBlock}Today's theme: "${theme}"

Here are ${items.length} items. Produce JSON (no markdown fences):

{
  "items": [
    { "index": 1, "summary": "1-2 sentence plain-English summary, MAX 40 words", "keywords": ["kw1", "kw2", "kw3"], "findings": ["Specific finding 1", "Specific finding 2", "Specific finding 3"], "connectionToTheme": "one sentence: why this paper matters for today's question" }
  ],
  "keyConcepts": ["term: one-sentence plain-English definition", "term2: definition"],
  "suggestedQuestions": ["question 1", "question 2", "question 3"]
}

${METADATA_RULES(ctx)}

SUGGESTED QUESTIONS RULES:
- Generate exactly 3 questions a curious reader would ask after reading the synthesis.
- Each question must be SPECIFIC to these papers, not generic. Reference actual findings or tensions.
- Questions should pull the reader deeper — "What would happen if...", "Why doesn't...", "How does X square with Y?"
- BAD: "What are the implications of this research?" (generic, boring)
- GOOD: "If AI tutors outperform human ones, why do students still prefer human teachers?" (specific, surprising)
- Keep each question under 15 words.
- At least one question should highlight a tension BETWEEN the papers.

Papers:

${listing}`;
}

/**
 * Stage B: Selection skeleton — pick best papers for complementarity + plan argument.
 * Given a WIDER pool of candidates (~6), selects the best 2-3 that complement each other
 * and plans the argument structure.
 * Research: Radev (2000) Cross-Document Structure Theory, Yao (2023) Tree of Thoughts.
 */
export function selectionSkeletonPrompt(candidates: PaperListing[], theme: string, targetCount: number) {
  const listing = formatPapers(candidates, 1200);

  return `Theme: "${theme}"

You have ${candidates.length} candidate papers. Your job is to pick the BEST ${targetCount} that COMPLEMENT each other for an interesting argument about the theme. Then plan the argument.

Candidates:
${listing}

SELECTION CRITERIA — pick papers that:
1. Each contribute something DIFFERENT to the theme (not 3 papers saying the same thing)
2. Create genuine TENSION (one supports, one complicates, one offers a different mechanism)
3. Together tell a story the reader couldn't get from any single paper
4. Are each individually relevant to the theme (no stretches)

CRITICAL: If two papers make the SAME POINT (both say "X is faster" or "X works well"), you MUST drop one. Two papers agreeing is the #1 failure mode. Replace the redundant paper with one that CONTRADICTS, COMPLICATES, or EXPLAINS WHY.

BAD selection: "Vision Mamba is efficient" + "Faster R-CNN is efficient" → SAME POINT. Both say "better architecture = faster." Drop one, find a paper showing WHERE efficiency breaks down or WHY adoption lags.
BAD selection: 3 papers all about "AI in education" that agree → boring, redundant
GOOD selection: 1 paper showing AI works in education + 1 showing it FAILS in a specific context + 1 from a different field that explains WHY → tension, insight, surprise
GOOD selection: 1 paper proving a new method works + 1 paper from industry showing nobody uses it yet + 1 paper from a different angle entirely

CRITICAL: Do NOT select a paper that is only tangentially related to the theme. For each paper, ask: "If I removed the theme title, would a reader understand why this paper is here?" If not, skip it.

BAD: A "COVID-19 NLP corpus" paper in a digest about "Can machines think for themselves?" — it's about annotating text, not autonomous reasoning
BAD: A "tech-business analytics" paper in a digest about "why we ignore logic" — both involve business but the connection stops there
GOOD: Every selected paper should make a reader say "oh, I see how this connects"

If fewer than ${targetCount} papers genuinely fit the theme, select only the ones that do. It's better to return 2 great papers than 3 where one is a stretch.

Return JSON (no markdown fences):
{
  "selectedIndices": [1, 3, 5],
  "selectionReasoning": "Why these 3 complement each other, 1 sentence",
  "paperRoles": [
    { "index": 1, "role": "supports|complicates|provides_evidence|provides_mechanism", "shortName": "the Turkish teacher study", "coreContribution": "what this paper uniquely adds, 10 words max" }
  ],
  "coreTension": "The central disagreement or unresolved question, 1 sentence",
  "argumentArc": "First establish X (paper N), then complicate with Y (paper N), resolve/leave open with Z"
}

RULES:
- selectedIndices MUST contain exactly ${targetCount} paper indices (1-indexed, matching the candidate list)
- Every selected paper must have a DISTINCT role — no two papers with the same role
- NO TWO PAPERS WITH THE SAME CONCLUSION. If papers A and B both conclude "X is better/faster/works", drop one.
- The coreTension must be GENUINE, not manufactured. "Some people haven't adopted it yet" is NOT a tension — it's just a fact. A tension is: "Paper A says X works, Paper B says X fails when Y."
- shortName: how you'd refer to it talking to a friend
- If a paper is >5 years old, it must offer something a newer paper can't (historical perspective, foundational insight). Don't pick old papers just because they're highly cited.
- If no ${targetCount} papers work well together, pick the best 2 and note it
- Prefer papers from DIFFERENT fields/methods when quality is comparable`;
}

/** Simpler skeleton for when papers are already selected (e.g., after selection skeleton). */
export function skeletonPrompt(items: PaperListing[], theme: string) {
  const listing = formatPapers(items, 1500);

  return `Theme: "${theme}"

Papers:
${listing}

You are planning the argument structure for a research synthesis paragraph. ANALYZE the relationships between these papers.

Return JSON (no markdown fences):
{
  "paperRelations": [
    { "paper1": 1, "paper2": 2, "relation": "contradicts|agrees|extends|alternative_mechanism|unrelated", "explanation": "5-10 words" }
  ],
  "paperRoles": [
    { "index": 1, "role": "supports|complicates|provides_evidence|provides_mechanism|provides_context|reinforces", "shortName": "2-4 word nickname: 'the polyphenols study', 'the Turkish teacher research', 'the epilepsy review'", "coreContribution": "what this paper uniquely adds to the argument, 10 words max" }
  ],
  "coreTension": "The central disagreement or unresolved question these papers surface, 1 sentence",
  "argumentArc": "First establish X (paper N), then complicate with Y (paper N), resolve/leave open with Z",
  "skipPapers": []
}

RULES:
- EVERY paper should get a role if possible. If a paper genuinely doesn't connect to the theme or other papers, add its index to skipPapers. Better to have 2 great papers than 3 with one forced.
- If two papers make the SAME POINT, find what DIFFERS between them — methodology, scale, domain, era. If truly identical, the weaker one's role is "reinforces" with a note about what specifically it adds (a different context, a specific number, etc.)
- The coreTension should be a GENUINE intellectual tension, not a fake one. "People haven't adopted it" or "there are still challenges" is NOT a tension. A tension is a real DISAGREEMENT or PARADOX between the papers.
- The argumentArc MUST reference ALL papers by number. If a paper isn't in the arc, you haven't found its role yet.
- If you can't find genuine tension, say so honestly in coreTension. "These papers agree; the interesting question is WHY it took so long" is better than manufacturing fake conflict.
- shortName: MAX 4 WORDS. How you'd refer to it at a bar: "the polyphenols study", "the McKinsey report", "the epilepsy paper". NOT "The Brain-Gut-Microbiome Axis Across the Life Continuum review" — that's the title, not a nickname. Use the topic keyword: "the gut-brain review", "the seizure inflammation study".
- paperRelations: include one entry per pair of papers (for 3 papers: 3 pairs)`;
}

/**
 * Stage C: Write synthesis from the argument skeleton.
 * The skeleton ensures the model argues rather than summarizes.
 */
export function synthesisFromSkeletonPrompt(
  items: PaperListing[],
  theme: string,
  skeleton: {
    paperRoles: { index: number; role: string; shortName: string; coreContribution: string }[];
    coreTension: string;
    argumentArc: string;
  }
) {
  const listing = formatPapers(items, 1500);

  const roleDesc = skeleton.paperRoles
    .map(r => `- Paper ${r.index} ("${r.shortName}"): ${r.role} — ${r.coreContribution}`)
    .join("\n");

  return `Theme: "${theme}"

Papers:
${listing}

ARGUMENT PLAN (follow this structure):
Core tension: ${skeleton.coreTension}
Arc: ${skeleton.argumentArc}
Paper roles:
${roleDesc}

You MUST reference ALL of these papers in **bold** using EXACTLY this format:
${skeleton.paperRoles.map(r => `- First mention: **[Source ${r.index}] ${r.shortName}** — then after: **[Source ${r.index}] ${r.shortName}**`).join("\n")}

The [Source N] prefix is REQUIRED in every bold reference. It maps the name to the correct paper. Never write a bold paper name without the [Source N] prefix.

Now write the synthesis paragraph. Follow the argument arc above. Return ONLY the paragraph text (no JSON, no markdown fences).

STYLE RULES:
- ALWAYS prefix bold paper names with [Source N]: "**[Source 1] the polyphenols study**". MAX 4 WORDS for the name after the prefix.
- ONE paragraph, 5-8 sentences. Short sentences. Vary the length.
- Start with the insight, not the build-up.
- Include one specific number or finding.
- End naturally. No formulaic closing.
- Write for smart non-experts. Translate ALL jargon.
- NO: demonstrates, reveals, highlights, nuanced, multifaceted, fundamentally, inherently, arguably.
- NO em dashes. Use periods, "but", "and" instead.

BANNED PATTERNS (these make every digest sound the same):
- "X don't just Y — they Z" or "isn't just X — it's Y" → This is the #1 AI crutch. Never use it.
- "Here's where it gets [interesting/scary/tricky]" → Overused. Just state the finding.
- "The real question is..." or "The bigger picture is..." → Formulaic. Drop it.
- "It turns out that..." at the start of every other sentence → Once per digest max.

GOOD TRANSITIONS (vary these — never repeat the same pattern twice):
- "You'd think X, but Y says otherwise."
- "Despite decades of research on X, Y found..."
- "Unexpectedly, Y showed that..."
- "What Y actually found was the opposite:"
- "Y complicates this — their data shows..."
- Just start with the finding. "87% of students who..."
- Ask a rhetorical question mid-paragraph. "So why doesn't it work?"
- NEVER write "isn't merely X — it's fundamentally Y" or any variation.
- Contractions always. "So", "But", "Turns out", "Here's the thing" are good openers.
- EVERY paper MUST appear in **bold** at least once. There are only 2-3 papers — if you can't mention one, your argument arc is wrong. Restructure.
- When moving between papers, ADD A BRIDGE SENTENCE. Don't just place them next to each other.
- NEVER mention topics that aren't in the papers.
- Sound like a person, not a TED talk. Read your output aloud. If it sounds like a speech, rewrite it.`;
}

/**
 * Stage D-1: Self-critique of synthesis.
 * Research: Madaan et al. (2023) Self-Refine — ~20% quality improvement.
 */
export function synthesisCritiquePrompt(
  synthesis: string,
  theme: string,
  paperTitles: string[],
  shortNames?: string[]
) {
  const paperList = paperTitles.map((t, i) => {
    const nick = shortNames?.[i] ? ` (might be called "${shortNames[i]}" in the text)` : "";
    return `[${i + 1}] "${t}"${nick}`;
  }).join(", ");

  return `You are a tough editor reviewing a research synthesis paragraph.

Theme: "${theme}"
Papers that MUST be referenced: ${paperList}
Total papers: ${paperTitles.length}

Synthesis:
"""
${synthesis}
"""

FIRST: Count how many of the ${paperTitles.length} papers appear in **bold** in the synthesis. A paper counts as "mentioned" if its title, short name, or any recognizable reference appears in bold.

Score each dimension 1-5 and give specific, actionable feedback.

Return JSON (no markdown fences):
{
  "scores": {
    "argument": 0,
    "connection": 0,
    "accessibility": 0,
    "specificity": 0,
    "coverage": 0
  },
  "missingPapers": [],
  "weakestPoint": "Which sentence is weakest and why, in 15 words",
  "revision": "Specific rewrite instruction in 1-2 sentences. Be concrete: 'Add the polyphenols paper by noting how plant compounds provide a third pathway' not 'make it better'"
}

Scoring guide:
- argument: Does it make an ARGUMENT (not just summarize)? Is there genuine tension? 1=book report, 5=op-ed
- connection: Are ALL mentioned papers necessary? Or is one just... there? 1=forced, 5=essential
- accessibility: Would a smart non-expert find this clear and interesting? 1=jargon soup, 5=coffee conversation
- specificity: Specific findings/numbers vs vague claims? 1=all vague, 5=concrete throughout
- coverage: How many of the ${paperTitles.length} papers are mentioned in bold? ${paperTitles.length}/${paperTitles.length} = 5, missing 1 = 1, missing 2+ = 1. List missing papers in "missingPapers" array by index.

CRITICAL COVERAGE RULE: There are EXACTLY ${paperTitles.length} papers. If the synthesis mentions fewer than ${paperTitles.length} in bold, coverage is 1. The "revision" instruction MUST name the missing paper and explain how to weave it into the argument. This is the MOST IMPORTANT dimension — a synthesis that ignores a paper is broken.

Be harsh. A 3 is average. Most syntheses are 2-3. A 5 means publishable.`;
}

/** Stage D-2: Revision based on critique feedback. */
export function synthesisRevisionPrompt(
  originalSynthesis: string,
  critique: { weakestPoint: string; revision: string },
  theme: string,
  paperNames?: string[]
) {
  const coverageRule = paperNames && paperNames.length > 0
    ? `\n\nCRITICAL: ALL these papers MUST remain referenced in **bold**: ${paperNames.join(", ")}. Do NOT drop any paper from the synthesis.`
    : "";

  return `Revise this synthesis based on the editor's feedback.

Theme: "${theme}"

Original:
"""
${originalSynthesis}
"""

Editor's feedback:
- Weakest point: ${critique.weakestPoint}
- Revision instruction: ${critique.revision}

Write the improved version. Return ONLY the revised paragraph (no JSON, no markdown fences). Keep the same **bold paper names**. Same length (5-8 sentences). Fix ONLY what the editor flagged — don't rewrite parts that already work.${coverageRule}`;
}

// ─── Shared rule blocks ──────────────────────────────────────────────────────

function METADATA_RULES(ctx?: DigestContext) {
  return `CONNECTION TO THEME RULES:
- Each item needs a "connectionToTheme" — a SHORT phrase (5-10 words) explaining why it's here
- NO prefixes like "Directly answers..." or "A bit of a stretch..."
- Just the reason: "shows what happens when you remove human teachers" or "the tech behind the trust problem"
- Think of it like a subtitle on a card — brief and scannable

SUMMARY RULES:
- MAX 40 WORDS. 1-2 sentences. The reader scans this on a card — it must fit without truncation.
- Write for a smart person who is NOT a domain expert.
- Focus on what the paper FOUND, not what it set out to do.
- BAD (too long): "This paper investigates the efficacy of parameter-efficient fine-tuning approaches..."
- GOOD (scannable): "Fine-tuning just 1% of an AI model's parameters cut training costs 10x with only a 3% accuracy drop."
- BAD: "This industry report outlines key trends in AI agent development" — WHICH trends? NAME THEM.
- GOOD: "FintechNews reports that multi-agent collaboration, agentic RAG, and vertical AI agents are the three biggest AI agent trends heading into 2026."

FINDINGS RULES:
- 3 findings per paper. Each one answers: "what did they FIND OUT?" not "what did they DO?"
- A finding is a RESULT, OUTCOME, or CONCLUSION. Not a method, not a description of the study.
- Think of it as: if someone asks "so what?" — your finding should answer that.

BAD findings (these describe the STUDY, not the RESULTS):
- "Five gamified versions were created and tested with 13 experts" — that's the METHOD, not what they found
- "The paper examines how AI affects creativity" — tells me nothing
- "Researchers surveyed 381 students about emoji use" — that's what they DID, not what they LEARNED

GOOD findings (these tell me WHAT WORKED, WHAT HAPPENED, WHAT'S TRUE):
- "Leaderboards boosted student attention by 40% but badges had no measurable effect"
- "The podcast group's motivation jumped massively (1.33 effect size) while the control group showed zero change"
- "Multi-agent collaboration is the #1 AI agent trend for 2026 according to the report"

For NEWS: name the specific companies, products, numbers, trends.

KEYWORD RULES:
- Keywords should describe what the PAPER is actually about, not the user's interest
- Keywords should be terms a curious person could Google and learn something from
- For ${ctx?.focusLevel === "beginner" ? "beginners" : "this level"}: avoid pure jargon acronyms. Use plain-ish terms.
- 3 DISTINCT terms per paper — not variations of the same thing

KEYCONCEPTS RULES:
- 5 concepts that span all papers
- MUST include at least 1 concept that explains the user's core interest: "${ctx?.focusInterest ?? "the main topic"}"
- Format MUST be "term: definition"
- Definitions must be one plain sentence, as if explaining to a curious 20-year-old`;
}

function SYNTHESIS_RULES(theme: string, _ctx?: DigestContext) {
  return `SYNTHESIS — make an ARGUMENT about "${theme}", using the papers as evidence.

You are NOT summarizing papers. You are making a point about the theme question, and the papers are your proof. Think of it like a short op-ed, not a book report.

BAD (paper-by-paper book report):
"**Paper A** found X. **Paper B** found Y. **Paper C** found Z. Together they show..."
This is boring. Don't do this.

GOOD (argument with papers as evidence, SHORT paper names, GROUNDED in real life):
"Making airplane wings is basically expensive guesswork right now. **the composites review** found that AI can turn that guesswork into predictable science by standardizing how manufacturers pick their materials. But here's the thing: smarter tech doesn't always win. **the solar shading study** found that fancy movable panels don't beat simple fixed ones. What matters is matching the design to your specific climate. And **Duolingo** proves the ultimate version of this: 50 million people practice vocabulary daily because a cartoon owl made repetition addictive. The lesson across all three? The smartest design isn't the most complex one. It's the one that actually fits the problem."

CRITICAL RULES:
- Translate jargon into things a smart non-expert already knows.
- When moving between papers, ADD A BRIDGE SENTENCE.
- NEVER mention topics that aren't in the papers.
- If a paper doesn't meaningfully connect to the theme, SKIP IT. Better 2 papers well than 3 with one forced.
- If two papers seem barely related, be honest about it.

LENGTH: 5-8 sentences. ONE paragraph.
START with the point, not the build-up.

RULES:
- Name papers CONVERSATIONALLY in **bold** with parenthetical source/year: "**the McKinsey fashion report** (Iwedi, 2026)"
- After first mention, just use the short bold name.
- Include one specific number or finding.
- End naturally. No formulaic closing.
- NO: demonstrates, reveals, highlights, suggests, nuanced, multifaceted, fundamentally, inherently, arguably.
- NO em dashes. Use periods, "but", "and" instead.
- NEVER write "The question of whether X isn't just about Y — it's about Z" or any variation of this pattern.
- NO restating the theme. Sound like a person, not a speech.`;
}

// ─── Other prompts ───────────────────────────────────────────────────────────

export function qaPrompt(paperTitle: string, fullText: string, question: string) {
  return `Answer this question about the paper. Be specific, cite sections when you can. Write casually.

Title: ${paperTitle}
Full text: ${fullText.slice(0, 15000)}

Question: ${question}`;
}

export function comparisonPrompt(papers: { title: string; fullText: string }[]) {
  const texts = papers.map((p, i) =>
    `## ${i + 1}. ${p.title}\n\n${p.fullText.slice(0, 8000)}`
  ).join("\n\n---\n\n");

  return `Compare these ${papers.length} papers. What do they agree on? Where do they differ? Write it like you're explaining to a smart friend. No em dashes. Be specific.

${texts}`;
}
