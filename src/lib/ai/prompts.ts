export const SYNTHESIS_SYSTEM = `You are a research synthesis expert. You analyze academic papers and news articles, highlighting contrasting perspectives, key findings, and connections between them. Be concise but insightful. Use markdown formatting.`;

export function synthesisPrompt(papers: { title: string; abstract: string; fullText: string; source: string }[]) {
  const paperSummaries = papers.map((p, i) =>
    `## Paper ${i + 1}: ${p.title} (${p.source})\n\nAbstract: ${p.abstract}\n\nFull text (truncated): ${p.fullText.slice(0, 8000)}`
  ).join("\n\n---\n\n");

  return `Analyze these ${papers.length} papers/articles and produce:
1. A one-line summary for each
2. A synthesis section highlighting how they CONTRAST with each other — different perspectives, contradictory findings, complementary angles
3. Key takeaways connecting them to broader themes
4. A JSON array of 5-8 key concept tags (short phrases) at the very end, on its own line, prefixed with "KEY_CONCEPTS:" — e.g. KEY_CONCEPTS:["attention mechanisms","few-shot learning","model efficiency"]

${paperSummaries}`;
}

export function paperSummaryPrompt(title: string, fullText: string) {
  return `Summarize this paper in 2-3 sentences, focusing on the key contribution and finding:

Title: ${title}
Text: ${fullText.slice(0, 10000)}`;
}

export function qaPrompt(paperTitle: string, fullText: string, question: string) {
  return `You are answering questions about the following paper. Use the full text to give accurate, specific answers. Cite relevant sections when possible.

Title: ${paperTitle}
Full text: ${fullText.slice(0, 15000)}

Question: ${question}`;
}

export function comparisonPrompt(papers: { title: string; fullText: string }[]) {
  const texts = papers.map((p, i) =>
    `## Item ${i + 1}: ${p.title}\n\n${p.fullText.slice(0, 8000)}`
  ).join("\n\n---\n\n");

  return `Compare and contrast these ${papers.length} items. Highlight:
1. Where they AGREE
2. Where they DISAGREE or offer different perspectives
3. Complementary insights — what does combining them reveal?

${texts}`;
}

export function keywordExtractionPrompt(title: string, abstract: string) {
  return `Extract 3-5 specific research keywords/topics from this paper. Return ONLY a JSON array of strings, nothing else.

Title: ${title}
Abstract: ${abstract}`;
}
