export const SYNTHESIS_SYSTEM = `You are a curious, well-read friend who keeps up with research and tech news. You write like a smart person texting. Casual, direct, sometimes funny. Never use em dashes. Never write like a press release. No corporate language. No "demonstrates" or "reveals" or "suggests that". Just talk normally.`;

export const THEME_SYSTEM = `You are a research curator. You pick interesting daily themes that combine a user's interests in unexpected ways. Always return valid JSON.`;

export function themePrompt(
  interests: { keyword: string; field: string; level: string }[],
  contentMix: number,
  pastContext?: { recentThemes: string[]; starredKeywords: string[]; dislikedKeywords: string[] }
) {
  const mixLabel = contentMix < 40 ? "all research (no news)" : contentMix > 60 ? "all news (no research)" : "mixed research and news";

  let contextBlock = "";
  if (pastContext) {
    if (pastContext.recentThemes.length > 0) {
      contextBlock += `\nRecent themes you've already covered (don't repeat): ${pastContext.recentThemes.join(", ")}`;
    }
    if (pastContext.starredKeywords.length > 0) {
      contextBlock += `\nTopics the user starred/engaged with (lean into these): ${pastContext.starredKeywords.join(", ")}`;
    }
    if (pastContext.dislikedKeywords.length > 0) {
      contextBlock += `\nTopics the user disliked (avoid): ${pastContext.dislikedKeywords.join(", ")}`;
    }
  }

  return `A user has these interests:
${interests.map(i => `- "${i.keyword}" (${i.field}, ${i.level})`).join('\n')}

Their preference is: ${mixLabel}
${contextBlock}

Pick ONE theme for today that combines 2-3 of their interests in a specific, interesting way. Then provide search queries to find exactly 3 items.

Return JSON (no markdown fences):
{
  "theme": "a specific angle, like 'how agents learn taste' or 'the neuroscience of design decisions'",
  "searches": {
    "foundational": "search query for a classic/influential paper on this theme",
    "recent": "search query for a recent paper (last 2 years) pushing this theme forward",
    "news": "search keywords for a relevant news article about this theme in practice"
  }
}

${contentMix < 40 ? `Since the user wants ALL RESEARCH, replace the "news" search with a third paper query: one that contrasts with or builds on the first two.` : ""}
${contentMix > 60 ? `Since the user wants ALL NEWS, replace "foundational" and "recent" with two more news search queries on different angles of the theme.` : ""}

Rules:
- The theme should be SPECIFIC, not broad. "AI agents" is too broad. "Can AI agents develop genuine preferences?" is specific.
- For beginner users, pick accessible foundational papers (surveys, landmark studies).
- For expert users, pick niche, cutting-edge work.
- The three items should tell a STORY together: a foundation, a new development, and a real-world connection.`;
}

export function digestPrompt(items: { title: string; abstract: string; source: string; category?: string }[], theme: string) {
  const listing = items.map((p, i) =>
    `[${i + 1}] "${p.title}" (${p.source}, ${p.category || "unknown"})\n${p.abstract.slice(0, 2000)}`
  ).join("\n\n");

  return `Today's theme is: "${theme}"

Here are the 3 items found for this theme. Produce a JSON response (no markdown fences, just raw JSON):

{
  "items": [
    {
      "index": 1,
      "summary": "2-3 sentence summary",
      "keywords": ["keyword1", "keyword2", "keyword3"]
    }
  ],
  "synthesis": "see format below",
  "keyConcepts": ["concept1", "concept2", "concept3", "concept4", "concept5"]
}

SYNTHESIS FORMAT — this is a short story, not a list:

Start with: "Today's thread: ${theme}"

Then write 3-5 sentences that WEAVE the three items into a narrative. Mention each by name in bold (**Title**). Tell me WHY these three things matter together. What's the story arc? The foundational paper set the stage, the recent work is pushing it forward, and the news shows where it's landing in the real world.

Write it like you're telling me about your reading over coffee. Use "so basically," and "the interesting part is" and "what I didn't expect was" — that kind of energy.

HARD RULES:
- NO em dashes (—). Use periods, commas, "and", or "but".
- NO: demonstrates, reveals, highlights, suggests, indicates, showcases, underscores, bridges, navigates
- NO: "the gap between", "early stages of", "democratization of", "landscape of"
- Use normal title case for paper names, not ALL CAPS
- Keep it to 3-5 sentences after the theme line. That's it.

Papers:

${listing}`;
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

  return `Compare and contrast these ${papers.length} items. Write conversationally, like you're explaining to a smart friend. No em dashes. Be specific about what each paper actually found.

${texts}`;
}
