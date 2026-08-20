export const SYNTHESIS_SYSTEM = `You write for smart people who are NOT domain experts. You translate jargon into plain English — "photovoltaic shading devices" becomes "solar panel shades on buildings", "composite laminates" becomes "layered materials like in airplane wings". Use contractions when natural. Be conversational by being clear and specific, not by adding scripted tics such as "So you'd think", "Turns out", "It's kind of like", or "which sounds obvious". Vary sentence openings. Never say "notably", "furthermore", or "demonstrates". Ground everything in real-world problems the reader can picture. CRITICAL: Always return valid JSON with no text before or after the JSON object.`;

export const SYNTHESIS_PROSE_SYSTEM = `You write like a smart friend explaining something they just read. Short sentences when they help. You translate jargon into plain English. Use contractions naturally. Do not perform casualness with repeated openers such as "So", "Turns out", "Here's the thing", or "It's kind of like". Let the evidence create the voice and vary sentence openings.

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

type PaperListing = { title: string; abstract: string; source: string; category?: string; year?: number; tensionHint?: string; authors?: string[] };

function formatAuthors(authors?: string[]): string {
  if (!authors || authors.length === 0) return "";
  const last = (name: string) => name.split(/\s+/).pop() ?? name;
  if (authors.length === 1) return ` — ${last(authors[0])}`;
  return ` — ${last(authors[0])} et al.`;
}

function formatPapers(items: PaperListing[], maxChars = 2000) {
  return items.map((p, i) => {
    const chars = p.source === "rss" ? 6000 : maxChars;
    const yearStr = p.year ? `, ${p.year}` : "";
    const authorStr = formatAuthors(p.authors);
    const hint = p.tensionHint ? `\n[HINT: ${p.tensionHint}]` : "";
    return `[${i + 1}] "${p.title}"${authorStr} (${p.source}${yearStr}, ${p.category || "unknown"})${hint}\n${p.abstract.slice(0, chars)}`;
  }).join("\n\n");
}

// ─── Legacy single-call prompt (kept as fallback) ────────────────────────────

export function metadataPrompt(items: PaperListing[], theme: string, ctx?: DigestContext) {
  const listing = formatPapers(items);
  const contextBlock = ctx
    ? `User's interest: "${ctx.focusInterest}" (level: ${ctx.focusLevel})\nResearch angle for today: "${ctx.researchAngle}"\n`
    : "";

  return `${contextBlock}Today's theme: "${theme}"

Here are ${items.length} items. Produce JSON (no markdown fences):

{
  "items": [
    { "index": 1, "plainName": "plain-language name for the paper, MAX 6 words", "summary": "plain factual TL;DR of the study: what they did and what they found, 1-2 uncomplicated sentences, MAX 45 words, no jargon, no rhetorical questions", "keywords": ["kw1", "kw2", "kw3"], "findings": ["Specific finding with its **key result phrase** bolded", "Specific finding 2", "Specific finding 3"], "connectionToTheme": "one sentence: why this paper matters for today's question", "takeaway": { "hook": "the ONE surprising thing worth remembering, one plain sentence", "stat": "one concrete number or vivid fact, or null", "line": "how you'd bring it up to a friend, casual and spoken" }, "methodType": "what this IS, 1-3 plain words", "methodFacts": ["method fact 1", "method fact 2"], "claim": "the paper's central claim, one plain sentence" }
  ],
  "keyConcepts": ["term: one-sentence plain-English definition", "term2: definition"],
  "suggestedQuestions": ["question 1", "question 2", "question 3"]
}

${METADATA_RULES(ctx)}

TAKEAWAY RULES (per paper) — this is what makes a paper repeatable, not just readable:
- hook: the SINGLE most surprising or counterintuitive thing this paper shows, in one plain sentence a non-expert would actually repeat. NOT a summary of the whole paper. Lead with the surprise.
- stat: one concrete number or vivid fact from the paper that anchors the hook (e.g. "hacked 83% of Linux servers with no human help"). Use null if the paper genuinely has no such number — NEVER invent one. Translate raw metrics (F1, AUC, 0.4 out of 1.0) into plain meaning ("matched a real teacher less than half the time"); a number only earns its place if a normal person instantly gets it.
- line: how you'd bring it up in conversation — casual, contractions, spoken. e.g. "Sentiment analysis can read praise, but sarcasm still fools it." Sound like a person, not a summary.
- hook, stat, and line must add DIFFERENT value. The line cannot paraphrase the hook or repeat a finding that is already visible above it; add why it matters, the useful comparison, or the memorable way to carry it into conversation.
- Never manufacture chatty filler: no "So you'd think", "Turns out", "It's kind of like", "which sounds obvious", or "apparently needed research". Direct language sounds more human than staged banter.
- All three obey the voice rules: no "quietly", "seamlessly", "notably", "delve", "leverage", "underscore", "landscape", "realm"; no em dashes; plain words.

METHOD RULES (per paper) — what this IS and how they did it:
- methodType: the KIND of thing this is, 1-3 plain words a non-reader instantly gets. Papers: "Randomized trial", "Field study", "Survey", "Lab experiment", "Math proof", "Meta-analysis", "Simulation", "Case study", "Opinion piece", "Review". News: "News feature", "Interview", "Investigation", "Opinion piece". Pick what fits — don't force a paper label onto news.
- methodFacts: 2-3 short, complete sentences describing HOW they did it, each MAX 12 words. Use natural, plain English and sentence case: "They interviewed 62 participants." "The experiment lasted two weeks." "Participants reported their own symptoms." NEVER invent numbers; if the abstract gives no method detail, return fewer facts or [].
- claim: the ONE thing this source is arguing or showing, one plain declarative sentence (MAX 20 words). Not a finding with numbers — the position. e.g. "Spaced practice beats cramming even when total study time is identical."

PLAIN NAME RULES (per paper):
- A human-friendly name for what the paper is ABOUT — what you'd call it explaining it to a friend, NOT the academic title.
- MAX 6 words, plain English, no jargon, no acronyms, no author names, no "a study of…".
- Distinguish this source's evidence or lens. Do NOT restate today's theme, answer the central question, or duplicate the takeaway hook; those appear next to the name on the page.
- BAD: "An Intelligent Sentiment Analysis Model Based on Fine-Tuned BERT Architecture" (the real title — too long, jargon)
- GOOD: "Reading emotion in social-media text"
- BAD: "EEGSeizureSense: A Hybrid CNN-Transformer for Seizure Detection"
- GOOD: "Spotting seizures in brain waves"

KEY CONCEPTS RULES (jargon a non-expert would trip on):
- Extract EVERY term in the papers' summaries/findings a smart non-expert would NOT already know, then define each in one plain sentence.
- This MUST include: model/system names (e.g. "RoBERTa", "DistilBERT"), technical methods (e.g. "subword tokenization", "self-attention", "CNN"), and field acronyms (e.g. "EEG", "NLP").
- Define what it IS and why it matters, not a circular restatement. BAD: "RoBERTa: a RoBERTa model." GOOD: "RoBERTa: a language model that learns word meaning from context by reading huge amounts of text."
- Aim for 4-8 concepts. Better to over-include than leave a scary word undefined — undefined jargon is the #1 reason a reader disengages.
- Only include terms that actually appear in the summaries/findings (so they can be matched and underlined in the synthesis).

SUGGESTED QUESTIONS RULES:
- Generate exactly 3 questions based on GAPS — things the synthesis hints at but doesn't fully explain.
- Each question should come from a specific moment where the reader would think "wait, but what about...?" or "how does that work exactly?"
- One question per paper roughly, tied to the most intriguing detail.
- BAD: "What are the implications of this research?" (generic, no gap)
- BAD: "How does AI affect education?" (too broad, reader already knows this)
- GOOD: "If GPT-4 can hack 83% of Linux systems, why didn't the researchers test it on Windows?" (specific gap — makes you want to know the answer)
- GOOD: "The rat study found roommate genes change your gut bacteria — but does it work the other way too?" (natural follow-up from a specific finding)
- GOOD: "If worked examples teach better strategy but problem-solving produces better results, which should teachers actually use?" (tension the reader can't resolve alone)
- Keep under 15 words. Phrase as something a curious person would actually say out loud.

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

RELEVANCE GATE (HARD RULE) — before considering any paper for selection, answer this question first: "Is this paper's SUBJECT MATTER (not just vocabulary) directly about what the theme asks?" If the paper is about a different domain (e.g. education when theme is about hiring, web links when theme is about reading comprehension), it FAILS the gate. Do NOT include it — no matter how interesting the methodological contrast would be. A paper fails the gate if, when you strip away the theme title, a reader would not guess it belongs in this digest.

RELEVANCE TEST — before selecting any paper, ask: "Does this paper directly address the theme question, or is it just nearby the topic?" Only include papers that pass.

BAD: "Picturing Herakles in ancient Athens" for "Can external tools rewire human behavior?" — Greek art is not about behavioral rewiring
BAD: "Plywood waste management review" for "Can bacteria eat our industrial waste?" — waste management ≠ microbial upcycling
GOOD: A paper about how language shapes legal outcomes for "Do words change what we see as fair?" — directly speaks to the question

Aim for ${targetCount} papers. But 2 strong papers beats ${targetCount} where one is a stretch — if only 2 genuinely fit, return 2.

Return JSON (no markdown fences):
{
  "selectedIndices": [1, 3, 5],
  "selectionReasoning": "Why these complement each other, 1 sentence",
  "paperRoles": [
    { "index": 1, "role": "supports|complicates|provides_evidence|provides_mechanism", "shortName": "the chatbot privacy study", "coreContribution": "what this paper uniquely adds, 10 words max" }
  ],
  "coreInsight": "The most interesting connection, surprise, or question these papers surface TOGETHER, 1 sentence",
  "argumentArc": "First establish X (paper N), then add depth with Y (paper N), then open up with Z"
}

RULES:
- selectedIndices should ideally contain ${targetCount} indices (1-indexed) — but may contain fewer if not enough papers genuinely fit
- Every selected paper must have a DISTINCT role — no two papers with the same role
- NO TWO PAPERS WITH THE SAME CONCLUSION. If papers A and B both conclude "X is better/faster/works", drop one.
- RECENCY TIE-BREAK: when two papers are equally relevant, insightful, and complementary, prefer the newer one. Never choose a weaker paper just because it is newer.
- coreInsight can be a tension, a surprise, a paradox, OR a complementary insight. NOT everything needs conflict — papers agreeing from different angles are great too.
- shortName: MAX 4 WORDS, plain everyday language a reader who has NOT read the paper instantly understands: "the chatbot privacy study", "the makeup tutorial study", "the delete-button study". NEVER author names ("the Smith study"), acronyms, or title jargon — a reader should know what the study is ABOUT from the name alone. Each shortName must be DISTINCT from the others so the closing can cross-reference them unambiguously.
- If a paper is >5 years old, it must offer something newer papers can't (historical perspective, foundational insight). Don't pick old papers just because they're highly cited.
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
    { "index": 1, "role": "supports|complicates|provides_evidence|provides_mechanism|provides_context|reinforces", "shortName": "2-4 word plain-language nickname: 'the chatbot privacy study', 'the makeup tutorial study', 'the delete-button study'", "coreContribution": "what this paper uniquely adds to the argument, 10 words max" }
  ],
  "coreInsight": "The most interesting thing these papers reveal TOGETHER that you wouldn't get from any single one, 1 sentence",
  "argumentArc": "First establish X (paper N), then add depth with Y (paper N), then open up with Z",
  "skipPapers": []
}

RULES:
- EVERY paper should get a role if possible. If a paper genuinely doesn't connect to the theme or other papers, add its index to skipPapers. Better to have 2 great papers than 3 with one forced.
- If two papers make the SAME POINT, find what DIFFERS between them — methodology, scale, domain, era. If truly identical, the weaker one's role is "reinforces" with a note about what specifically it adds (a different context, a specific number, etc.)
- coreInsight does NOT have to be a conflict. Great insights include:
  - Papers that AGREE from wildly different angles ("a biologist and an economist both found X")
  - Papers where one explains WHY something another paper observed happens
  - A genuine surprise or paradox
  - A finding that changes how you think about the topic
  - Do NOT default to "it's messy" or "it's complicated." If the research points somewhere clear, say so.
- The argumentArc MUST reference ALL papers by number. If a paper isn't in the arc, you haven't found its role yet.
- shortName: MAX 4 WORDS, plain everyday language a reader who has NOT read the paper instantly understands: "the chatbot privacy study", "the makeup tutorial study", "the delete-button study". NEVER author names ("the Smith study"), acronyms, or title jargon — a reader should know what the study is ABOUT from the name alone. Each shortName must be DISTINCT from the others so the closing can cross-reference them unambiguously.
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
    coreTension?: string;
    coreInsight?: string;
    argumentArc: string;
  }
) {
  const listing = formatPapers(items, 1500);
  const insight = skeleton.coreInsight || skeleton.coreTension || "find the thread";

  const roleDesc = skeleton.paperRoles
    .map(r => `- Paper ${r.index} ("${r.shortName}"): ${r.role} — ${r.coreContribution}`)
    .join("\n");

  // Era-aware guidance: when 2+ papers are >10 years old, explicitly instruct the
  // synthesis to situate them in their era and contrast with what's changed.
  const currentYear = new Date().getFullYear();
  const datedPapers = items.filter(p => p.year && currentYear - p.year >= 10);
  const eraBlock = datedPapers.length >= Math.min(2, items.length)
    ? `
ERA AWARENESS: ${datedPapers.length} of these papers are from ${datedPapers.map(p => p.year).sort().join(", ")} — more than a decade old. Don't present them as if they're the latest word. Instead: acknowledge the era ("Back when touchscreens were new..." / "In the early days of X..."), explain why they still matter (foundational finding, underlying principle), AND briefly contrast with what's changed or where the frontier is now. Example: "Dyson's 2004 finding that shorter lines helped reading still holds — but today the question is different: how do dynamic layouts and responsive breakpoints reshape that?" ONE sentence of contrast is enough — don't turn the whole synthesis into a history lesson.
`
    : "";

  return `Theme: "${theme}"

Papers:
${listing}
${eraBlock}
ARGUMENT PLAN (follow this structure):
Core insight: ${insight}
Arc: ${skeleton.argumentArc}
Paper roles:
${roleDesc}

You MUST reference ALL of these papers in **bold** using EXACTLY this format:
${skeleton.paperRoles.map(r => `- First mention: **[Source ${r.index}] ${r.shortName}** — then after: **[Source ${r.index}] ${r.shortName}**`).join("\n")}

The [Source N] prefix is REQUIRED in every bold reference. It maps the name to the correct paper. Never write a bold paper name without the [Source N] prefix.

BEFORE WRITING, read each paper's abstract in the listing above. For any claim you make about a paper — especially anything framed as a "barrier", "limitation", "factor", "constraint", or "problem" — you MUST anchor it in a specific detail from that paper's abstract. If the abstract is vague, find a concrete method, number, or example elsewhere in the abstract. If there is genuinely nothing concrete, drop that claim rather than filling with jargon.

Write the synthesis in EXACTLY this structure. No other format accepted.

STRUCTURE (return ONLY this — no JSON, no markdown fences):

[Opening paragraph: 2-3 sentences that ANSWER the question "${theme}" directly, up front — the reader gets the bottom line before any source is revealed. Open on a concrete specific (a number, a named case, a scene from one of the papers), state the answer plainly, and end by hinting at what the sources complicate or sharpen. Do NOT name or bold any paper here — no [Source N] references in this paragraph. No em dashes.]

${skeleton.paperRoles.map((r, i, arr) => {
  const bullet = `- **[Source ${r.index}] ${r.shortName}** [1–2 sentences, HARD MAX 2, starting with a conversational verb: "found...", "shows...", "asked...", "says...", "tested..." etc. — like explaining to a curious friend. Pick the ONE best detail or number; don't empty the whole paper into the bullet]`;
  const bridge = i < arr.length - 1 ? `\n\n> [One short bridge to the next paper: how does this connect, contrast, or escalate? "while X, others...", "but that changes when...", "which makes the next finding stranger..." — max 12 words, no em dashes]` : "";
  return bullet + bridge;
}).join("\n\n")}

[One closing sentence: an unresolved tension, a concrete open question, or a specific image. NOT a summary. NOT "together these papers show..."]

CRITICAL FORMAT RULES:
- The [Source N] prefix is REQUIRED in every bold paper name: "**[Source 1] the polyphenols study**"
- Each bullet is 1–2 sentences, HARD MAX 2. No line breaks within a bullet.
- Each bridge (>) is exactly ONE short phrase, max 12 words. No bridge after the last bullet.
- Structure is: the opening answer paragraph, then alternating bullet/bridge, then the closing sentence. The opening paragraph never names or bolds a source.
- The closing must NOT restate the theme or summarize what the papers collectively show.

STYLE RULES:
- ALWAYS prefix bold paper names with [Source N]. MAX 4 WORDS for the name after the prefix.
- STRATEGIC BOLD: in EACH bullet, also wrap the single sharpest number or claim in **bold** (in addition to the paper name), so someone scanning catches the point without reading every word. e.g. "...stole **$2.87 billion** across 150 hacks" or "felt **less responsible** and were more willing to cheat". Exactly ONE such bold phrase per bullet — don't bold whole sentences.
- Bullets: include one "wait, what?" detail per paper — HOW they tested it ("they gave GPT-4 real Linux servers and it exploited 83% without human help"), not just the conclusion ("AI can hack").
- RELATABLE HOOK: this prose is the DIGEST — the conversational read. Where it genuinely helps, open a source with a short everyday hook the reader actually recognizes, then the finding. e.g. "You know how you think more clearly after a good night's sleep? That's basically what they found...". Rules: (1) only an experience real people ACTUALLY have and would phrase that way — "you know how a night's sleep makes a problem obvious?" is BAD (nobody says that); test it against how a person really describes the feeling. (2) Don't force one onto every bullet — one or two across the whole synthesis, never a template. (3) The factual "what they did" belongs on the card summary; the hook here is the human on-ramp, not a second summary.
- Write for smart non-experts. Translate ALL jargon.
- NEVER state a raw metric or its name (F1, AUC, BLEU, R², p-value, accuracy=0.4, RMSE) — translate it into what it MEANS in plain terms. BAD: "scores below 0.4 F1 across every configuration". GOOD: "matched a real teacher's feedback less than half the time, no matter how it was set up." A number is only worth keeping if a normal person instantly gets what it means (like "$2.87 billion" or "83% of servers").
- NO: demonstrates, reveals, highlights, nuanced, multifaceted, fundamentally, inherently, arguably, quietly, seamlessly, notably, crucially, essentially, ultimately, delve, leverage, underscore, testament, landscape, realm.
- NO em dashes. Use periods, "but", "and" instead.
- Bullets start with a verb ("found", "shows", "tested", "asked", "says"). Not "Instead of..." or setup phrases.
- Use **bold** on 1-2 key words/phrases per bullet — the number, the surprise, the most striking term. Not the paper name (already bold). E.g. "found that **83% of models** failed" or "shows **sleep beats practice** by 2x."

SPECIFICITY GATE — when any bullet uses: barrier, limitation, challenge, problem, constraint, issue, gap, factor — it MUST name a CONCRETE instance in the same sentence.
  BAD: "current structural limitations prevent people without traditional access"
  GOOD: "robo-advisors still require a $10K minimum balance, locking out the 40% of Americans who'd benefit most."

BANNED PATTERNS:
- NEVER write that a source "doesn't weigh in", "doesn't address", "isn't about", or "doesn't speak to" the theme question. If a source connects only weakly, give it ONE short honest sentence about what it DOES show — never narrate its irrelevance, and never invent a connection either.
- "X don't just Y — they Z" / "isn't just X — it's Y" / "it isn't about X, it's about Y" — banned.
- "Instead of asking..." / "Rather than X, Y" / "The real question isn't X, it's Y" — banned.
- "Here's where it gets [ANY adjective]" / "But here's where..." — banned.
- "The pattern's clear" / "The lesson here" / "Together they show" / "What these papers reveal" — banned.
- "structural limitations" / "systemic issues" / "performative [anything]" without specifics — banned.
- EVERY paper MUST appear in **bold** with [Source N] prefix. Missing a paper = broken synthesis.
- NEVER mention topics not in the papers.
- Sound like a person, not a TED talk.`;
}

/**
 * The synthesis structure contract, restated compactly for the prompts that
 * REWRITE a synthesis rather than write one.
 *
 * `synthesisFromSkeletonPrompt` above is where the structure is actually
 * specified, with all its inline guidance. Every downstream repair has to repeat
 * the shape or the rewrite quietly flattens it — and repeating it by hand is
 * exactly how the four copies drifted apart: two of them still demanded "NO
 * intro paragraph" and "1–3 sentences, HARD MAX 3" long after the answer-first
 * opening paragraph landed (commit a4a8866) and bullets were capped at 2. So a
 * fact-fix or a coverage repair could legally delete the opening paragraph the
 * draft was told to write. One function now — same class of gotcha as the
 * `shortName` rules living in two places.
 */
export function synthesisStructureContract(paperNames: string[]): string {
  return `REQUIRED STRUCTURE — the rewrite must keep all four parts, in this order:
1. The opening paragraph: 2-3 sentences answering the question directly. No paper names, no bold, no [Source N] in it.
2. One bullet per paper, in order: "- **[Source N] name**" then 1–2 sentences (HARD MAX 2) starting with a conversational verb. No line breaks inside a bullet.
3. A "> bridge" line between consecutive bullets, max 12 words. No bridge after the last bullet.
4. One closing sentence: an unresolved tension, an open question, or a specific image. Not a summary, not a restatement of the theme.

Every one of these papers must appear, in exactly this bold form: ${paperNames.join(", ")}
The [Source N] prefix is REQUIRED in every bold paper name. The site uses it to map each mention to its paper, so a bold name without the prefix is broken.
Never write that a source "doesn't address", "doesn't weigh in on", or "isn't about" the theme. No em dashes.`;
}

/**
 * Stage D-1: Self-critique of synthesis, now including the factual-accuracy pass.
 *
 * These used to be two calls that read the same draft against the same papers,
 * each followed by its own full-synthesis rewrite. Merging them halves the review
 * round-trips and, more importantly, means a draft with both a weak argument and
 * a misstated finding is regenerated ONCE instead of twice.
 *
 * Research: Madaan et al. (2023) Self-Refine — ~20% quality improvement.
 */
export function synthesisCritiquePrompt(
  synthesis: string,
  theme: string,
  paperTitles: string[],
  shortNames?: string[],
  paperFindings?: { index: number; findings: string[]; summary: string }[]
) {
  const paperList = paperTitles.map((t, i) => {
    const nick = shortNames?.[i] ? ` (might be called "${shortNames[i]}" in the text)` : "";
    return `[${i + 1}] "${t}"${nick}`;
  }).join(", ");

  const findingsBlock = paperFindings && paperFindings.length > 0
    ? `\nWhat each paper ACTUALLY found — check the synthesis against this, not against your own knowledge:\n${paperFindings.map(f =>
        `[${f.index}] Findings: ${f.findings.join("; ") || "(none extracted)"}\n    Summary: ${f.summary}`
      ).join("\n")}\n`
    : "";

  return `You are a tough editor reviewing a research synthesis paragraph.

Theme: "${theme}"
Papers that MUST be referenced: ${paperList}
Total papers: ${paperTitles.length}
${findingsBlock}
Synthesis:
"""
${synthesis}
"""

FIRST: Count how many of the ${paperTitles.length} papers appear in **bold** in the synthesis. A paper counts as "mentioned" if its title, short name, or any recognizable reference appears in bold.

SECOND: check the synthesis for FACTUAL ACCURACY against the findings above. Flag any paper whose contribution is misrepresented, exaggerated, or missing key nuance, and put it in "factIssues" with the fix. An empty array means the synthesis represents every paper honestly. Do not invent an issue to look thorough, and do not flag a claim merely for being brief.

THEN: score each dimension 1-5 and give specific, actionable feedback.

Return JSON (no markdown fences):
{
  "scores": {
    "argument": 0,
    "connection": 0,
    "accessibility": 0,
    "relatability": 0,
    "specificity": 0,
    "coverage": 0,
    "freshness": 0
  },
  "missingPapers": [],
  "bannedPhrasesFound": [],
  "factIssues": [
    { "paperIndex": 1, "problem": "what the synthesis gets wrong about this paper", "fix": "what it should say instead" }
  ],
  "weakestPoint": "Which sentence is weakest and why, in 15 words",
  "revision": "Specific rewrite instruction in 1-2 sentences. Be concrete: 'Replace \"structural limitations\" in sentence 5 with the paper's specific barrier: only 12% of branches offer AI-assisted accounts.' NOT 'make it better'"
}

Scoring guide:
- argument: Does it make an ARGUMENT (not just summarize)? Is there genuine tension? 1=book report, 5=op-ed
- connection: Are ALL mentioned papers necessary? Or is one just... there? 1=forced, 5=essential
- accessibility: Would a smart non-expert find this clear and interesting? 1=jargon soup, 5=coffee conversation
- relatability: Read each sentence COLD, as a non-expert seeing it once. Two failures cap this at 2: (a) any sentence you'd have to read twice to parse, (b) any "you know how..." style setup describing an experience people don't actually have or wouldn't phrase that way. BAD: "you know how a night's sleep makes a problem obvious?" (nobody has that experience in those words). GOOD: "you know how you think more clearly after a good night's sleep?" (people actually say this). If capped, "revision" must QUOTE the offending sentence and give the plain rewrite.
- specificity: Specific findings/numbers vs vague claims? 1=all vague, 5=concrete throughout. CRITICAL: if the text says "barriers", "limitations", "challenges", "structural [X]", "systemic [X]", "performative [X]" WITHOUT naming a concrete instance from the paper, specificity is AT MOST 2.
- coverage: How many of the ${paperTitles.length} papers are mentioned in bold? ${paperTitles.length}/${paperTitles.length} = 5, missing 1 = 1, missing 2+ = 1. List missing papers in "missingPapers" array by index.
- freshness: Does it sound AI-written or human-written? Check for these banned phrases and add each one found to "bannedPhrasesFound":
  * "here's where it gets [ANY adjective]" / "but here's where..." / "this is where..."
  * "the pattern's clear" / "the [X] is clear" / "what we see is" / "the lesson here" / "the bigger picture" / "together they show" / "what these papers reveal"
  * tautological closings like "the most vulnerable are the ones who..." / "the [X]est are the ones who need [Y] most"
  * vague buzzwords without specifics: "structural limitations", "systemic issues", "performative [anything]"
  * AI-tell adverbs/words: "quietly", "seamlessly", "notably", "crucially", "essentially", "ultimately", "delve", "leverage", "underscore", "testament", "landscape", "realm"
  * narrated irrelevance: any sentence saying a source "doesn't weigh in on", "doesn't address", or "isn't about" the theme — the reader should never be told content is irrelevant
  * any single source bullet longer than 3 sentences
  * "it turns out that" used more than once
  Score: 5=zero banned phrases, 4=one minor slip, 3=one major phrase, 2=two+ phrases, 1=multiple + formulaic closing.

CRITICAL COVERAGE RULE: There are EXACTLY ${paperTitles.length} papers. If the synthesis mentions fewer than ${paperTitles.length} in bold, coverage is 1. The "revision" instruction MUST name the missing paper and explain how to weave it into the argument. This is the MOST IMPORTANT dimension — a synthesis that ignores a paper is broken.

CRITICAL CLOSING CHECK: Read the LAST sentence. Does it restate the theme or summarize the papers with meta-commentary? If yes, "argument" is at most 3 and "revision" must say "Replace the final sentence with a specific image, stat, or open question — don't restate the theme."

Be harsh. A 3 is average. Most syntheses are 2-3. A 5 means publishable.`;
}

/**
 * Stage D-2: the one revision call.
 *
 * It now carries the critique's editorial feedback AND the factual issues the
 * same call flagged, so a draft with both problems is rewritten once rather than
 * twice. `weakestPoint`/`revision` may be empty when fact issues alone triggered
 * the rewrite.
 */
export function synthesisRevisionPrompt(
  originalSynthesis: string,
  critique: {
    weakestPoint: string;
    revision: string;
    bannedPhrasesFound?: string[];
    factIssues?: { paperIndex: number; problem: string; fix: string }[];
  },
  theme: string,
  paperNames?: string[]
) {
  const structure = paperNames && paperNames.length > 0
    ? `\n\n${synthesisStructureContract(paperNames)}`
    : "";

  const bannedBlock = critique.bannedPhrasesFound && critique.bannedPhrasesFound.length > 0
    ? `\n\nBANNED PHRASES FOUND — you MUST remove or rewrite every instance of these in the original. Do not just swap the words; rewrite the sentence so the meaning survives without the crutch:\n${critique.bannedPhrasesFound.map(p => `  • ${p}`).join("\n")}`
    : "";

  const factBlock = critique.factIssues && critique.factIssues.length > 0
    ? `\n\nFIX THESE FACTS — the editor checked the synthesis against what each paper actually found:\n${critique.factIssues.map(i => `  • Paper ${i.paperIndex}: ${i.problem} → ${i.fix}`).join("\n")}\nCorrect exactly these claims. Do not expand a bullet past its 2-sentence cap to fit the correction, and do not turn the structure into prose.`
    : "";

  const editorialBlock = critique.weakestPoint || critique.revision
    ? `\n\nEditor's feedback:\n- Weakest point: ${critique.weakestPoint}\n- Revision instruction: ${critique.revision}`
    : "";

  return `Revise this synthesis based on the editor's feedback.

Theme: "${theme}"

Original:
"""
${originalSynthesis}
"""
${editorialBlock}${bannedBlock}${factBlock}

Write the improved version. Return ONLY the revised synthesis (no JSON, no markdown fences). Fix ONLY what the editor flagged — don't rewrite parts that already work.${structure}

If the critique flagged a vague claim (e.g. "structural limitations" without specifics), go back to the paper's abstract/findings in context and PULL a specific number, mechanism, or example to replace it. Vague → concrete. Never leave a claim unexplained.

If the critique flagged a formulaic closing, rewrite the final sentence so it ends on a specific image, stat, or open question — NOT a summary of what the papers "collectively reveal" or a restatement of the theme.`;
}

// ─── Shared rule blocks ──────────────────────────────────────────────────────

function METADATA_RULES(ctx?: DigestContext) {
  return `PUNCTUATION (applies to EVERY string you return, not just the prose fields):
- NO em dashes ("—") anywhere. Not in summaries, findings, claims, takeaways, method facts, concept definitions, names or questions.
- Where you'd reach for one, use a period, a comma, "but", or "and". "Sleep prunes connections, and the pruners scored highest."
- The same goes for the double-hyphen "--". Write the sentence out instead.

CONNECTION TO THEME RULES:
- Each item needs a "connectionToTheme" — a SHORT phrase (5-10 words) explaining why it's here
- NO prefixes like "Directly answers..." or "A bit of a stretch..."
- Just the reason: "shows what happens when you remove human teachers" or "the tech behind the trust problem"
- Think of it like a subtitle on a card — brief and scannable

SUMMARY RULES (the card text under each paper title — a plain, factual TL;DR of the study):
- MAX 45 WORDS. 1-2 complete sentences. The reader scans this on a card — it must fit without truncation.
- This is NOT the conversational hook (that lives in the synthesis prose). This is the straight "what is this paper": what they did (the setup/method in plain terms) and what they found. Uncomplicated, no jargon, no rhetorical questions, no "you know how".
- Shape: "[What they did], and [what they found]." or "This paper/news article [does X and shows Y]." Concrete numbers welcome when they clarify (how many people, how big the effect) — translated into plain meaning, never a raw metric name.
- GOOD: "Researchers tracked people across two nights of sleep and found that those whose brains pruned the most weak connections overnight did best on a next-morning reasoning test."
- GOOD: "They deleted random parts of a neural network during training and found the smaller, 'crippled' networks did better on problems they hadn't seen than the full ones."
- BAD: "This paper investigates the efficacy of parameter-efficient fine-tuning approaches..." (academic, tells nothing)
- BAD: "You know how you think more clearly after sleeping? Turns out..." (that's the conversational hook — it belongs in the synthesis, not the card)
- BAD: "Sleep-dependent downscaling correlated with next-day abstraction performance." (jargon restated)
- CRITICAL ANTI-HALLUCINATION: Each item's summary MUST describe ONLY the paper at that index number. Do NOT mix content across papers. If paper [1] is about reading behavior and paper [2] is about link visibility, item 1's summary must be about reading behavior — not about links. Before writing each summary, re-read the abstract for that exact index number. The summary must contain at least one concrete noun or finding that appears in that paper's abstract.
- If the abstract is thin or unclear, write a shorter, more cautious summary. Never fabricate findings to fill the word count.
- Starting with "Researchers..." / "This paper..." / "This news article..." is FINE here — it's a factual TL;DR, clarity beats variety. Just don't make all three identical.

FINDINGS RULES:
- 3 findings per paper. Each one answers: "what did they FIND OUT?" not "what did they DO?"
- A finding is a RESULT, OUTCOME, or CONCLUSION. Not a method, not a description of the study.
- Think of it as: if someone asks "so what?" — your finding should answer that.

BAD findings (these describe the STUDY, not the RESULTS):
- "Five gamified versions were created and tested with 13 experts" — that's the METHOD, not what they found
- "The paper examines how AI affects creativity" — tells me nothing
- "Researchers surveyed 381 students about emoji use" — that's what they DID, not what they LEARNED

GOOD findings (these tell me WHAT WORKED, WHAT HAPPENED, WHAT'S TRUE):
- "Leaderboards **boosted student attention by 40%** but badges had no measurable effect"
- "The podcast group's **motivation jumped massively** (1.33 effect size) while the control group showed zero change"
- "**Multi-agent collaboration** is the #1 AI agent trend for 2026 according to the report"
- Wrap the single most load-bearing phrase of each finding — the result itself, 2-6 words — in **double asterisks**. It renders bold on the card and doubles as the finding's collapsed headline. Exactly ONE bolded phrase per finding; never bold the whole sentence.

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
  return `SYNTHESIS — answer "${theme}" using the papers as evidence.

The theme is a question. Your synthesis MUST open by answering it — directly, concisely, even if the answer is "sort of" or "yes, but not the way you'd expect." Don't describe the papers first. Don't meta-frame. Answer first, then earn the answer with the papers.

You are NOT summarizing papers. You are making a point about the theme question, and the papers are your proof. Think of it like a short op-ed, not a book report.

BAD (meta-frame opener — doesn't answer the question):
"Three studies examine whether consciousness can be engineered. One looks at..., another explores..."
This tells me there are three studies. It doesn't answer the question. Don't do this.

BAD (paper-by-paper book report):
"**Paper A** found X. **Paper B** found Y. **Paper C** found Z. Together they show..."
This is boring. Don't do this.

GOOD (answer-first, papers as evidence, SHORT paper names, GROUNDED in real life):
"Making airplane wings is basically expensive guesswork right now. **the composites review** found that AI can turn that guesswork into predictable science by standardizing how manufacturers pick their materials. But here's the thing: smarter tech doesn't always win. **the solar shading study** found that fancy movable panels don't beat simple fixed ones. What matters is matching the design to your specific climate. And **Duolingo** proves the ultimate version of this: 50 million people practice vocabulary daily because a cartoon owl made repetition addictive. The lesson across all three? The smartest design isn't the most complex one. It's the one that actually fits the problem."

CRITICAL RULES:
- Translate jargon into things a smart non-expert already knows.
- When moving between papers, ADD A BRIDGE SENTENCE.
- NEVER mention topics that aren't in the papers.
- NEVER use a paper as an analogy or bridge if it's from a different domain than the theme. Each paper must earn its place by directly contributing evidence or mechanism to the central question — not by being a "conceptual parallel."
- If a paper doesn't meaningfully connect to the theme, SKIP IT. Better 2 papers well than 3 with one forced.
- If two papers seem barely related, be honest about it.

LENGTH: 5-8 sentences. ONE paragraph.
START with the point, not the build-up.

RULES:
- Name papers CONVERSATIONALLY in **bold** with parenthetical source/year: "**the McKinsey fashion report** (Iwedi, 2026)"
- After first mention, just use the short bold name.
- Include one specific number or finding.
- End naturally. No formulaic closing.
- NO: demonstrates, reveals, highlights, suggests, nuanced, multifaceted, fundamentally, inherently, arguably, quietly, seamlessly, notably, crucially, essentially, ultimately, delve, leverage, underscore, testament, landscape, realm.
- NO em dashes. Use periods, "but", "and" instead.
- NEVER write "The question of whether X isn't just about Y — it's about Z" or any variation of this pattern.
- NO restating the theme. Sound like a person, not a speech.`;
}

// ─── Other prompts ───────────────────────────────────────────────────────────

/**
 * `fullText` is used whole — the caller trims it with `textForPrompt`, which
 * drops the bibliography and caps a pathological extract. The 15,000-character
 * slice that used to live here silently answered every question from the first
 * few pages, so anything about a result or a limitation got a confident answer
 * out of the introduction.
 */
export function qaPrompt(paperTitle: string, fullText: string, question: string) {
  return `Answer the question directly — lead with the answer, not context. No restating what the paper is about. No "according to the paper" preamble. Just answer it like you already know they've read the digest. 2-4 sentences max. Cite a specific detail or number if you can.

Title: ${paperTitle}
Full text: ${fullText}

Question: ${question}`;
}
