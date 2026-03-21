export const SYNTHESIS_SYSTEM = `You write like a person texting a group chat, not writing an essay. You use contractions (it's, don't, can't, they're). You start sentences with "So", "But", "And", "Turns out". You say "pretty wild", "kind of", "basically", "honestly". You never say "notably", "furthermore", "it is worth noting", "this highlights", "demonstrates". You sound like someone who just read something cool and wants to share it. CRITICAL: Always return valid JSON with no text before or after the JSON object.`;

interface DigestContext {
  focusInterest: string;
  focusLevel: "beginner" | "intermediate" | "expert";
  researchAngle: string;
}

export function digestPrompt(
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
    ? `User's interest: "${ctx.focusInterest}" (level: ${ctx.focusLevel})
Research angle for today: "${ctx.researchAngle}"
`
    : "";

  return `${contextBlock}Today's theme: "${theme}"

Here are ${items.length} items. Produce JSON (no markdown fences):

{
  "items": [
    { "index": 1, "summary": "2-3 sentence plain-English summary", "keywords": ["kw1", "kw2", "kw3"], "findings": ["Specific finding 1", "Specific finding 2", "Specific finding 3"] }
  ],
  "synthesis": "see format below",
  "keyConcepts": ["term: one-sentence plain-English definition", "term2: definition"]
}

SUMMARY RULES:
- Write for a smart person who is NOT a domain expert. No jargon without explanation.
- When you must use a technical term, define it immediately: "formal verification (a method for mathematically proving code is correct)"
- Focus on what the paper actually FOUND and why it matters — not what it set out to do.
- For NEWS articles: the summary should be a TL;DR that tells the reader the CORE CONTENT of the article. Name specific companies, products, numbers, trends. The reader should walk away knowing what the article actually said.
- BAD: "This paper investigates the efficacy of parameter-efficient fine-tuning approaches for sentiment classification tasks"
- BAD: "This industry report outlines key trends in AI agent development" — WHICH trends? NAME THEM.
- GOOD: "Researchers tested whether you could fine-tune a large AI model cheaply by only updating a tiny fraction of its parameters. On social media text, this cut training costs 10x with only a 3% accuracy drop."
- GOOD: "FintechNews reports that multi-agent collaboration, agentic RAG, and vertical AI agents (specialized for healthcare, legal, finance) are the three biggest AI agent trends heading into 2026."

FINDINGS RULES:
- 3 findings per paper. Each one answers: "what did they FIND OUT?" not "what did they DO?"
- A finding is a RESULT, OUTCOME, or CONCLUSION. Not a method, not a description of the study.
- Think of it as: if someone asks "so what?" — your finding should answer that.

BAD findings (these describe the STUDY, not the RESULTS):
- "Five gamified versions were created and tested with 13 experts" — that's the METHOD, not what they found
- "The paper examines how AI affects creativity" — tells me nothing
- "Researchers surveyed 381 students about emoji use" — that's what they DID, not what they LEARNED
- "Expert interviews revealed design principles" — WHICH principles? Say them.

GOOD findings (these tell me WHAT WORKED, WHAT HAPPENED, WHAT'S TRUE):
- "Leaderboards boosted student attention by 40% but badges had no measurable effect"
- "The podcast group's motivation jumped massively (1.33 effect size) while the control group showed zero change"
- "Salesforce's Agentforce processed 1 billion agent actions in December 2024"
- "Multi-agent collaboration is the #1 AI agent trend for 2026 according to the report"

For NEWS: name the specific companies, products, numbers, trends. The reader should learn the actual content from your 3 findings.

KEYWORD RULES:
- Keywords should describe what the PAPER is actually about, not the user's interest. If the paper is about nutrition, say "precision nutrition" not "fashion tech"
- Keywords should be terms a curious person could Google and learn something from
- For ${ctx?.focusLevel === "beginner" ? "beginners" : "this level"}: avoid pure jargon acronyms (HMC, ELBO). Use plain-ish terms: "Bayesian inference" not "MCMC sampling"
- 3 DISTINCT terms per paper — not variations of the same thing

KEYCONCEPTS RULES:
- 5 concepts that span all papers
- MUST include at least 1 concept that explains the user's core interest: "${ctx?.focusInterest ?? "the main topic"}"
- Format MUST be "term: definition" — e.g. "AI agents: AI systems that take sequences of actions to complete a goal autonomously"
- Definitions must be one plain sentence, as if explaining to a curious 20-year-old with no domain background

SYNTHESIS — three lenses on the central question "${theme}".

The central question is EVERYTHING. Each paragraph is about a FACET OF THE QUESTION, not about a paper. Papers are evidence you pull in to illuminate that facet. Multiple papers can appear in the same paragraph. A single paper can appear in multiple paragraphs.

Write 3 paragraphs + a closing. Structure:

PARAGRAPH 1 — THE MECHANISM: What's actually happening under the hood? Start with what makes this question interesting, then pull in whichever paper(s) explain the "how" or "why." Reference paper titles in **bold** (short version, before the colon). 2-3 sentences.

PARAGRAPH 2 — THE EVIDENCE: What proof do we have that this works (or doesn't)? Pull in paper(s) with concrete results, numbers, experiments. Show where papers AGREE or DISAGREE with each other. If one paper says X works and another found X breaks under certain conditions, that's gold. 2-3 sentences.

PARAGRAPH 3 — THE IMPLICATION: So what? What does this mean for the real world, for the reader, for what comes next? Pull in any remaining papers plus connect back to earlier ones. What's the genuinely hard question this raises? 2-3 sentences.

CLOSING — 2 sentences:
Name the core tension across the papers (where do they push in different directions? what's unresolved?). End with "If you want to go deeper, look into [specific thing], because [specific reason]."

CRITICAL RULES FOR SYNTHESIS:
- Every paper MUST appear at least once, referenced by **bold title** (short version before the colon).
- Do NOT go paper-by-paper. Go question-facet-by-facet.
- Each paragraph should reference 2+ papers when possible. Weave them together.
- Find the TENSION. Paper A says X. Paper B found the opposite. Paper C explains why both could be right. That's the good stuff.
- If there's no real tension, find the COMPLEMENT: how do the papers fill different gaps in the same puzzle?

TONE: You're a curious friend walking someone through what you read today. Human words. Short sentences. No academic language.

Paper titles in **bold**. Use the short version (before the colon if there is one). The theme "${theme}" is the big headline above — don't restate it.

RULES:
- NO em dashes. Use periods, commas, "and", "but".
- NO: demonstrates, reveals, highlights, suggests, indicates, showcases, underscores, elicits, employs, utilizes, nuanced, multifaceted
- NO: "the gap between", "the question of whether", "it is increasingly", "a complex but"
- Be SPECIFIC. Say what was found, not that it "explored" something.
- Use paragraph breaks between paragraphs.

Papers:

${listing}`;
}

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
