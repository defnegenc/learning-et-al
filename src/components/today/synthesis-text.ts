/*
 * Pure synthesis-text helpers — parsing, flattening, and paper-name resolution.
 *
 * These live outside synthesis-banner.tsx on purpose: brief mode (the default
 * reading experience) needs the parsing but not the banner UI, and importing
 * them from the banner dragged that whole component — plus react-markdown — into
 * the first-load bundle for every visitor.
 */

type BodySection =
  | { kind: "paragraph"; text: string }
  | { kind: "bullet"; text: string; sourceIdx: number | null; details: { label: string; text: string }[] }
  | { kind: "bridge"; text: string };

export function parseBodySections(text: string): BodySection[] {
  const sections: BodySection[] = [];
  let paraLines: string[] = [];
  let activeBullet: Extract<BodySection, { kind: "bullet" }> | null = null;
  const flushPara = () => {
    if (paraLines.length > 0) {
      sections.push({ kind: "paragraph", text: paraLines.join("\n") });
      paraLines = [];
    }
  };
  for (const line of text.split("\n")) {
    const nestedBulletMatch = line.match(/^\s{2,}[-*]\s+(.*)/);
    const bulletMatch = line.match(/^[-*]\s+(.*)/);
    const bridgeMatch = line.match(/^\s*>\s+(.*)/);
    if (nestedBulletMatch && activeBullet) {
      const t = nestedBulletMatch[1].trim();
      const labelMatch = t.match(/^([^:]{2,42}):\s*(.*)$/);
      activeBullet.details.push(labelMatch
        ? { label: labelMatch[1], text: labelMatch[2] }
        : { label: "Note", text: t });
    } else if (bulletMatch) {
      flushPara();
      const t = bulletMatch[1];
      const m = t.match(/\*\*\[(?:source\s*)?(\d+)\]/i);
      activeBullet = { kind: "bullet", text: t, sourceIdx: m ? parseInt(m[1], 10) - 1 : null, details: [] };
      sections.push(activeBullet);
    } else if (bridgeMatch) {
      flushPara();
      activeBullet = null;
      sections.push({ kind: "bridge", text: bridgeMatch[1] });
    } else if (line.trim()) {
      activeBullet = null;
      paraLines.push(line);
    } else {
      // Keep activeBullet across blank lines: bodyText joins every source line
      // with "\n\n", so a bullet and its indented details are always separated
      // by a blank. Any non-blank, non-nested line still resets it above.
      flushPara();
    }
  }
  flushPara();
  return sections;
}

// Split a raw synthesis into the display theme and the body text below it.
// Mirrors the long-standing first-line heuristics (old digests carry a
// "Today we're exploring:" prefix; new ones get the theme as a column).
export function splitSynthesisTheme(synthesis: string, theme?: string): { displayTheme: string; bodyText: string } {
  const lines = synthesis.split("\n").filter(l => l.trim());
  let displayTheme = theme || "";
  let bodyLines = lines;

  if (!displayTheme) {
    const firstLine = lines[0] || "";
    const prefixMatch = firstLine.match(/^today(?:'s\s+\w+| we're exploring):\s*/i);
    if (prefixMatch) {
      const after = firstLine.slice(prefixMatch[0].length).trim();
      const sentenceEnd = after.match(/^(.+?[?!.])/);
      displayTheme = sentenceEnd ? sentenceEnd[1] : after;
      bodyLines = lines.slice(1);
    } else {
      const sentenceEnd = firstLine.match(/^(.+?[?!.])/);
      if (sentenceEnd) {
        displayTheme = sentenceEnd[1];
        const remainder = firstLine.slice(sentenceEnd[0].length).trim();
        bodyLines = remainder ? [remainder, ...lines.slice(1)] : lines.slice(1);
      } else {
        displayTheme = firstLine;
        bodyLines = lines.slice(1);
      }
    }
  } else {
    const firstLine = lines[0] || "";
    if (/^today/i.test(firstLine)) {
      bodyLines = lines.slice(1);
    }
  }
  return { displayTheme, bodyText: bodyLines.join("\n\n") };
}

export function splitSourceHeading(text: string) {
  const match = text.match(/^(\*\*\[(?:source\s*)?\d+\][^*]+\*\*)(?:\s+[-–—]\s+(.+))?$/i);
  return match ? { source: match[1], role: match[2] || "" } : { source: text, role: "" };
}

// Resolve a bold synthesis run to the paper it names. Handles the explicit
// "[Source N] name" prefix first, then falls back to fuzzy title/author/keyword
// overlap (older digests name papers inline without a source marker).
// Returns the matched paper index (or -1) plus the display text with any prefix stripped.
const MATCH_STOP_WORDS = new Set(["the", "this", "that", "with", "from", "about", "what", "when", "where", "which", "their", "these", "those", "been", "have", "will", "would", "could", "should", "into", "over", "under", "between", "through", "after", "before", "more", "most", "some", "also", "than", "them", "were", "here", "there", "then", "each", "every", "both", "such", "very", "just", "only", "other", "found", "shows", "study", "paper", "research", "report", "review"]);

export function resolvePaperFromBold(
  text: string,
  papers: { title: string; keywords: string[]; authors: string[] }[]
): { paperIdx: number; displayText: string } {
  const indexMatch = text.match(/^\[(?:source\s*)?(\d+)\]\s*/i);
  if (indexMatch) {
    const idx = parseInt(indexMatch[1], 10) - 1;
    if (idx >= 0 && idx < papers.length) return { paperIdx: idx, displayText: text.slice(indexMatch[0].length) };
  }

  const cleanText = text.toLowerCase().replace(/\s*\(.*?\)\s*/g, " ").trim();
  const stem = (w: string) => w.replace(/(ing|tion|ment|ness|ity|ies|es|ed|ly|s)$/i, "");
  const boldWords = cleanText.split(/\s+/).filter(w => (w.length > 2 || w === "ai") && !MATCH_STOP_WORDS.has(w));
  const boldStems = boldWords.map(stem);
  const acronyms = cleanText.split(/\s+/).filter(w => /^[A-Z]{2,6}$/.test(w));
  const matchesAcronym = (acronym: string, title: string) => {
    const words = title.split(/[\s\-]+/).filter(w => w.length > 0);
    for (let start = 0; start <= words.length - acronym.length; start++) {
      const initials = words.slice(start, start + acronym.length).map(w => w[0].toUpperCase()).join("");
      if (initials === acronym) return true;
    }
    return false;
  };
  let bestIdx = -1;
  let bestScore = 0;
  let secondBestScore = 0;
  papers.forEach((p, i) => {
    let score = 0;
    const title = p.title.toLowerCase();
    const kwStr = p.keywords.join(" ").toLowerCase();
    const authorStr = p.authors.join(" ").toLowerCase();
    if (title.includes(cleanText) || cleanText.includes(title.slice(0, 30))) score += 10;
    for (const acronym of acronyms) { if (matchesAcronym(acronym, p.title)) score += 8; }
    for (const bs of boldStems) {
      const titleStems = title.split(/\s+/).filter(w => w.length > 2).map(stem);
      if (titleStems.some(ts => ts === bs || ts.includes(bs) || bs.includes(ts))) score += 3;
      if (authorStr.includes(bs)) score += 4;
      if (kwStr.includes(bs)) score += 1;
    }
    if (score > bestScore) { secondBestScore = bestScore; bestScore = score; bestIdx = i; }
    else if (score > secondBestScore) { secondBestScore = score; }
  });
  const matched = bestScore >= 4 && bestScore - secondBestScore >= 2;
  return { paperIdx: matched ? bestIdx : -1, displayText: text };
}

// Flatten a structured synthesis (per-paper bullets with labelled details,
// bridges) into one prose paragraph per source. Paper-name markers survive.
export function flattenSynthesis(bodyText: string): string[] {
  const sections = parseBodySections(bodyText);
  // Drop intro paragraphs that precede the first source bullet — the gist already
  // serves as the hook, so standalone intro text is redundant.
  const firstBullet = sections.findIndex(s => s.kind === "bullet");
  const trimmed = firstBullet > 0
    ? sections.filter((s, i) => !(i < firstBullet && s.kind === "paragraph"))
    : sections;
  const paragraphs: string[] = [];
  let pendingBridge = "";
  for (const section of trimmed) {
    if (section.kind === "bridge") { pendingBridge = section.text.trim(); continue; }
    let text: string;
    if (section.kind === "bullet") {
      const { source } = splitSourceHeading(section.text);
      const detailText = section.details
        .filter(d => !/understand/i.test(d.label)) // drop the "if you want to understand" navigation phrase
        .map(d => {
          let t = d.text.trim();
          if (!t) return "";
          t = t.charAt(0).toUpperCase() + t.slice(1);       // sentence-case each detail
          if (!/[.!?]$/.test(t)) t += ".";                  // terminate so they don't run together
          return t;
        })
        .filter(Boolean)
        .join(" ");
      text = detailText ? `${source}: ${detailText}` : source;
    } else {
      text = section.text;
    }
    if (pendingBridge) { text = `${pendingBridge} ${text}`; pendingBridge = ""; }
    paragraphs.push(text);
  }
  if (pendingBridge) paragraphs.push(pendingBridge);
  return paragraphs;
}
