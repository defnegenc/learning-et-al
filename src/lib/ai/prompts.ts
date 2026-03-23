export const SYNTHESIS_SYSTEM = `You write for smart people who are NOT domain experts. You translate jargon into plain English — "photovoltaic shading devices" becomes "solar panel shades on buildings", "composite laminates" becomes "layered materials like in airplane wings". You use contractions and start sentences with "So", "But", "Turns out". You never say "notably", "furthermore", "demonstrates". You ground everything in real-world problems the reader can picture. CRITICAL: Always return valid JSON with no text before or after the JSON object.`;

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
    { "index": 1, "summary": "1-2 sentence plain-English summary, MAX 40 words", "keywords": ["kw1", "kw2", "kw3"], "findings": ["Specific finding 1", "Specific finding 2", "Specific finding 3"], "connectionToTheme": "one sentence: why this paper matters for today's question" }
  ],
  "synthesis": "see format below",
  "keyConcepts": ["term: one-sentence plain-English definition", "term2: definition"]
}

CONNECTION TO THEME RULES:
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

SYNTHESIS — make an ARGUMENT about "${theme}", using the papers as evidence.

You are NOT summarizing papers. You are making a point about the theme question, and the papers are your proof. Think of it like a short op-ed, not a book report.

BAD (paper-by-paper book report):
"**Paper A** found X. **Paper B** found Y. **Paper C** found Z. Together they show..."
This is boring. Don't do this.

GOOD (argument with papers as evidence, SHORT paper names, GROUNDED in real life):
"Making airplane wings is basically expensive guesswork right now. **the composites review** found that AI can turn that guesswork into predictable science by standardizing how manufacturers pick their materials. But here's the thing: smarter tech doesn't always win. **the solar shading study** found that fancy movable panels don't beat simple fixed ones. What matters is matching the design to your specific climate. And **Duolingo** proves the ultimate version of this: 50 million people practice vocabulary daily because a cartoon owl made repetition addictive. The lesson across all three? The smartest design isn't the most complex one. It's the one that actually fits the problem."

Notice what the GOOD version does:
1. STARTS with a real-world problem the reader can picture ("making airplane wings is guesswork")
2. Explains technical papers in PLAIN terms the reader already understands
3. Each paper adds something NEW to the argument, not just "another example"
4. Never assumes the reader knows jargon — "composite materials" becomes "airplane wings and race car parts"
5. Paper names are SHORT (2-5 words)

CRITICAL RULES:
- The reader should never have to Google a term to understand your point. Translate jargon into things a smart non-expert already knows.
- When moving between papers, ADD A BRIDGE SENTENCE that explicitly connects them.
- Don't just place papers next to each other and hope the reader connects them. SPELL OUT the connection.
- NEVER mention topics that aren't in the papers. If no paper mentions interior design, don't bring up interior design. Only discuss what the papers actually cover.
- If two papers seem barely related, be honest: "These two don't obviously connect, but..." is better than forcing a fake connection.

LENGTH: 5-8 sentences. ONE or TWO paragraphs. Tell the reader enough about each paper that they don't need to read it — what was studied, what was found, and why it matters for the theme.

START with the point, not the build-up. Lead with the insight, then back it up with the papers.

RULES:
- Every paper appears in **bold** with authors and year on first mention: "**Antarctic tourism governance** (Zhu et al., 2026) found..."
- This citation format makes it clear these are real published research, not AI-generated content.
- After first mention, just use the short bold name.
- ONE paragraph. No multi-paragraph essays.
- Start with the insight, not "Turns out" or "The big question."
- Include one specific number or finding.
- End naturally. No formulaic "The core tension is..." or forced "look into."
- NO: demonstrates, reveals, highlights, suggests, nuanced, multifaceted.
- NO: "it's deeply about", "This kind of", "This shows how", "The real lesson."
- NO em dashes. NO restating the theme.
- Only mention topics actually in the papers. Never hallucinate connections.

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
