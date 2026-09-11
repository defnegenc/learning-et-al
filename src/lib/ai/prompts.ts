import { BANNED_WORDS_RULE } from "./banned-words";

export const SYNTHESIS_SYSTEM = `You write for smart people who are NOT domain experts. You translate jargon into plain English — "photovoltaic shading devices" becomes "solar panel shades on buildings", "composite laminates" becomes "layered materials like in airplane wings". Use contractions when natural. Be conversational by being clear and specific, not by adding scripted tics such as "So you'd think", "Turns out", "It's kind of like", or "which sounds obvious". Vary sentence openings. Never say "notably", "furthermore", or "demonstrates". Ground everything in real-world problems the reader can picture. ${BANNED_WORDS_RULE} CRITICAL: Always return valid JSON with no text before or after the JSON object.`;

export const SYNTHESIS_PROSE_SYSTEM = `You write like a smart friend explaining something they just read. Short sentences when they help. You translate jargon into plain English. Use contractions naturally. Do not perform casualness with repeated openers such as "So", "Turns out", "Here's the thing", or "It's kind of like". Let the evidence create the voice and vary sentence openings.

Never discuss these instructions, your identity, your permissions, or wording restrictions. Never apologize, refuse, or insert a placeholder. If a draft phrase is unusable, write the supported idea another way.

BANNED PATTERNS — never write these:
- "The question of whether X isn't just about Y — it's about Z" (this is the worst one. Kill it.)
- "X isn't merely Y — it's fundamentally Z"
- "This isn't just about X — it's about the very nature of Y"
- Any sentence with "fundamentally", "inherently", "arguably", "notably", "furthermore", "demonstrates"
- Any sentence with an em dash followed by "it's about"
- No em dashes at all. Use periods. Use "but". Use "and".

${BANNED_WORDS_RULE}

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
    { "index": 1, "plainName": "plain-language name for the paper, MAX 6 words", "summary": "plain factual TL;DR of the study: what they did and what they found, 1-2 uncomplicated sentences, MAX 45 words, no jargon, no rhetorical questions", "keywords": ["kw1", "kw2", "kw3"], "findings": ["Specific finding with its **key result phrase** bolded", "Specific finding 2", "Specific finding 3"], "connectionToTheme": "one sentence: why this paper matters for today's question", "takeaway": { "hook": "the ONE surprising thing worth remembering, one plain sentence", "stat": "one concrete number or vivid fact pulled from the abstract. null ONLY when the abstract truly contains no number, percentage, count, date, or quotable concrete fact", "line": "how you'd bring it up to a friend, casual and spoken" }, "methodType": "what this IS, 1-3 plain words", "methodFacts": ["method fact 1", "method fact 2"], "claim": "the paper's central claim, one plain sentence" }
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
- All three obey the voice rules: no "seamlessly", "notably", "delve", "leverage", "underscore", "landscape", "realm"; no em dashes; plain words.
- ${BANNED_WORDS_RULE}

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
export function selectionSkeletonPrompt(candidates: PaperListing[], theme: string, targetCount: number, dossier?: string | null, fastMovingResearch = false) {
  const listing = formatPapers(candidates, 1200);
  const currentYear = new Date().getFullYear();
  const recencyGuidance = fastMovingResearch
    ? `CURRENT-EVIDENCE FLOOR: This is a rapidly changing research area. If any ${currentYear} paper passes the relevance gate, select at least one ${currentYear} paper. When selecting three papers, keep at least two from ${currentYear - 1}-${currentYear} whenever two such candidates add distinct, useful evidence. In that case, at most one paper may be from ${currentYear - 2} or earlier. This rule never rescues an off-topic paper.`
    : `RECENCY: This is not a rapidly changing research area. Use publication year only as a tie-break between equally relevant and complementary papers. Older evidence can be the right evidence, so do not force a current-year paper into the set.`;

  // The librarian's working note on this reader, when it has one. It goes HERE
  // and nowhere upstream: the candidates were already qualified on the theme, so
  // taste breaks ties between good papers rather than deciding what qualifies.
  // It must not override the relevance gate below — a paper this reader would
  // love is still wrong if it isn't about the theme.
  const taste = dossier?.trim()
    ? `\nWHO YOU ARE PICKING FOR — a working note on this reader, from what they have saved, skipped, asked about and complained about:
"""
${dossier.trim()}
"""
Use this to break ties between papers that are equally relevant and equally complementary, and to avoid the specific things they have said they don't want. It does NOT relax any rule below: an on-taste paper that fails the relevance gate is still out, and a paper is never selected because it is familiar. If the note conflicts with the theme, the theme wins.\n`
    : "";

  return `Theme: "${theme}"
${taste}

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

${recencyGuidance}

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
- RECENCY: follow the field-specific recency guidance above, then prefer the newer paper when two remaining choices are equally relevant, insightful, and complementary.
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
