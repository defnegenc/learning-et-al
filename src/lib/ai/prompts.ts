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
    { "index": 1, "summary": "2-3 sentence plain-English summary", "keywords": ["kw1", "kw2", "kw3"], "findings": ["Specific finding 1", "Specific finding 2", "Specific finding 3"], "connectionToTheme": "one sentence: why this paper matters for today's question" }
  ],
  "synthesis": "see format below",
  "keyConcepts": ["term: one-sentence plain-English definition", "term2: definition"]
}

CONNECTION TO THEME RULES:
- Each item needs a "connectionToTheme" that explains WHY this paper is in today's digest
- Be honest. If the connection is a stretch, say so: "A bit of a stretch, but this shows how even AI math has trust problems"
- If it's directly relevant: "Directly answers the question — this is what happens when you actually try it"
- Keep it to one punchy sentence, written for someone scanning the card

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

SYNTHESIS — make an ARGUMENT about "${theme}", using the papers as evidence.

You are NOT summarizing papers. You are making a point about the theme question, and the papers are your proof. Think of it like a short op-ed, not a book report.

BAD (paper-by-paper book report):
"**Paper A** found X. **Paper B** found Y. **Paper C** found Z. Together they show..."
This is boring. Don't do this.

GOOD (argument with papers as evidence):
"Turns out you can't just hand AI a classroom and walk away. **Why AI systems don't learn** shows the tech literally can't do autonomous teaching yet — it lacks the flexible learning loops that human brains use. But that hasn't stopped people from trying. **Alpha School** went full AI-only and claims kids learn twice as fast, until you hear the parents: kids turned 'zombie-like,' obsessing over metrics instead of actually learning. The teachers in **Exploring teachers' views** might have the answer — they see AI as an assistant, not a replacement, handling the boring stuff so they can focus on the human parts. Maybe the real lesson is that caring can't be automated, even if grading can."

Notice: the GOOD version makes a POINT ("you can't just hand AI a classroom and walk away"), then uses ALL THREE papers as evidence within a flowing argument. Papers aren't discussed one-by-one — they're woven into sentences that build the argument.

CRITICAL: For each paper, explain what SPECIFIC thing it contributes to the argument that the other papers don't. Don't just mention it — show WHY it matters for understanding the theme. If a paper's connection to the theme is weak, be honest about the stretch and make it interesting anyway: "This one's a bit of a stretch, but..."

Write 2-3 short paragraphs (total 5-8 sentences). End with a "look into [specific thing]" pointer.

NEVER start your last paragraph with "The core tension is..." or any formulaic closer. Instead, end with whatever feels natural:
- A provocative question: "So who's actually checking if this stuff works before millions of kids use it?"
- A surprising implication: "The weird part is that the people most worried about AI replacing them might be the ones we need most."
- A concrete recommendation: "If you want to go deeper, look into X because Y."
- An honest admission: "Honestly, nobody knows yet. But if you want to follow the thread, look into X."
Just don't use the same closer every time.

RULES:
- Every paper MUST appear at least once in **bold** (short title before the colon).
- Weave papers together — don't give each one its own paragraph.
- Make a POINT, don't just describe what each paper found.
- Include at least one specific number, finding, or quote from the papers.
- NO em dashes. NO: demonstrates, reveals, highlights, suggests, nuanced, multifaceted.
- The theme "${theme}" is the headline above. Don't restate it.
- Short sentences. Human words. You're texting a friend, not writing an essay.

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
