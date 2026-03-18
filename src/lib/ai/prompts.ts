export const SYNTHESIS_SYSTEM = `You are a curious, well-read friend who keeps up with research and tech news. You write like a smart person texting. Casual, direct, sometimes funny. Never use em dashes. Never write like a press release. No corporate language. No "demonstrates" or "reveals" or "suggests that". Just talk normally.`;

export const THEME_SYSTEM = `You are a research curator. You help find real, specific academic papers. Always return valid JSON.`;

export function themePrompt(
  interests: { keyword: string; field: string; level: string }[],
  contentMix: number,
  pastContext?: { recentThemes: string[]; starredKeywords: string[]; dislikedKeywords: string[] }
) {
  const mixLabel = contentMix < 40 ? "all research (no news)" : contentMix > 60 ? "all news (no research)" : "mixed research and news";

  let contextBlock = "";
  if (pastContext) {
    if (pastContext.recentThemes.length > 0) {
      contextBlock += `\nRecent themes (don't repeat): ${pastContext.recentThemes.join(", ")}`;
    }
    if (pastContext.starredKeywords.length > 0) {
      contextBlock += `\nTopics the user liked (lean into): ${pastContext.starredKeywords.join(", ")}`;
    }
    if (pastContext.dislikedKeywords.length > 0) {
      contextBlock += `\nTopics to avoid: ${pastContext.dislikedKeywords.join(", ")}`;
    }
  }

  // Pick ONE interest to focus on today
  return `A user has these interests:
${interests.map(i => `- "${i.keyword}" (${i.field}, ${i.level})`).join('\n')}

Their preference is: ${mixLabel}
${contextBlock}

Pick ONE of their interests to focus on today. Not a combination. Just ONE topic, explored in depth.

Return JSON (no markdown fences):
{
  "theme": "a specific question about this ONE interest, e.g. 'do AI agents need emotions to be effective?'",
  "focusInterest": "which interest this is about",
  "searches": {
    "foundational": "a SPECIFIC, well-known paper title or very precise search query",
    "recent": "a precise search query for recent work (include year like 2024 or 2025)",
    "news": "2-3 specific keywords for news search"
  }
}

${contentMix < 40 ? `User wants ALL RESEARCH. Replace "news" with a third paper search that contrasts with the first two.` : ""}
${contentMix > 60 ? `User wants ALL NEWS. Replace "foundational" and "recent" with news searches.` : ""}

CRITICAL RULES for search queries:
- The "foundational" query should be a REAL paper you know exists, or very close to one. For example: "Attention is All You Need" or "generative agents simulacra" not "computational models of aesthetic preference".
- Search queries should be 3-6 words, concrete, not abstract. "reinforcement learning from human feedback" is good. "computational approaches to learning systems" is bad.
- For ${interests[0]?.level || "intermediate"} level users in ${interests[0]?.field || "CS"}: pick papers they'd actually want to read.
- Rotate through the user's interests across days. Today pick ONE.`;
}

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

SYNTHESIS — write it as a short story, not a list:

Line 1: "Today's thread: ${theme}"

Then 3-5 sentences weaving ALL THREE items into a narrative. Mention each by name in **bold**. Tell me why these matter together. What's the arc? The classic paper set the stage, the new work pushes it, and the news shows where it's landing.

If any paper seems off-topic or irrelevant, just say so honestly. "This one's a stretch but here's what's interesting about it."

RULES:
- NO em dashes. Use periods, commas, "and", "but".
- NO: demonstrates, reveals, highlights, suggests, indicates, showcases, underscores, bridges, navigates
- NO: "the gap between", "early stages of", "democratization of", "landscape of"
- Write like you're telling a friend. "So basically," "the interesting part is," "what I didn't expect was"
- 3-5 sentences after the theme line. That's it.

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
