export const SYNTHESIS_SYSTEM = `You write like a sharp analyst, not a summarizer. You find the non-obvious connection. You identify what each paper gets RIGHT and what it MISSES. Your reader should finish and think "huh, I hadn't considered that." No em dashes. No corporate filler. No hand-waving.`;

export function digestPrompt(items: { title: string; abstract: string; source: string; category?: string }[], theme: string) {
  const listing = items.map((p, i) =>
    `[${i + 1}] "${p.title}" (${p.source}, ${p.category || "unknown"})\n${p.abstract.slice(0, 2000)}`
  ).join("\n\n");

  return `Today's theme is: "${theme}"

Here are 3 items. Produce JSON (no markdown fences):

{
  "items": [
    { "index": 1, "summary": "2-3 sentence summary", "keywords": ["kw1", "kw2", "kw3"] }
  ],
  "synthesis": "see format below",
  "keyConcepts": ["concept1", "concept2", "concept3", "concept4", "concept5"]
}

KEYWORD RULES:
- Each paper's keywords should be 3 DISTINCT terms, not variations of the same concept
- BAD: ["co-creative systems", "co-creation", "creative collaboration"] — these are the same thing
- GOOD: ["co-creative AI", "design agency", "human-AI handoff"] — each is a different angle
- keyConcepts should be 5 themes that SPAN all papers, not repeat per-paper keywords

SYNTHESIS — write it as an engaging narrative that makes the reader THINK:

Line 1: "Today's thread: ${theme}"

Then write 4-6 sentences that tell a STORY with genuine tension. DO NOT just summarize each paper in sequence. Instead:
- Identify the REAL contradiction or tension between the items. Paper A says X works. But Paper B found that X breaks when Y happens.
- Go one level deeper than description. WHY does the disagreement exist? What assumption does each paper make that the other rejects?
- If there's a news item, use it to show what happens when theory meets reality. Did the real world prove one paper right and the other wrong?
- END with a question that is genuinely hard to answer. Not rhetorical, not a softball. Something where smart people would disagree. "But if X, then what happens to Y?" or "The real question is whether Z."
- Each sentence should earn its place. If a sentence just describes what a paper did without connecting it to the tension, cut it.

The tone should be like a sharp analyst briefing (think Stratechery or Benedict Evans). Clear, opinionated, draws non-obvious connections.

Mention each item by name in **bold**.

RULES:
- NO em dashes (—). Use periods, commas, "and", "but".
- NO: demonstrates, reveals, highlights, suggests, indicates, showcases, underscores, bridges, navigates
- NO: "the gap between", "early stages of", "democratization of", "landscape of"
- NO: "so basically", "what's wild is", "the interesting part is" — these are filler. Just make the point.
- Be SPECIFIC. Say what the paper found, not that it "explored" something.
- 4-6 sentences after the theme line. End on a question that smart people would disagree about.

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
