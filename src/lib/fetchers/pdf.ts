import { extractText } from "unpdf";

export async function downloadAndParsePdf(pdfUrl: string): Promise<string> {
  try {
    const response = await fetch(pdfUrl);
    const buffer = new Uint8Array(await response.arrayBuffer());
    const { text } = await extractText(buffer);
    return Array.isArray(text) ? text.join("\n") : text;
  } catch (e) {
    console.error(`Failed to parse PDF from ${pdfUrl}:`, e);
    return "";
  }
}

/**
 * The ceiling on how much of a paper reaches a prompt.
 *
 * This is a safety rail against a pathological extract, NOT a budget. With back
 * matter dropped, a long empirical paper runs 60–90k characters and a review
 * around 120k, so 400k passes every real paper whole. What it stops is a
 * mis-parsed PDF that came back as a megabyte of ligature soup, or a scraped
 * page that swallowed a journal's entire archive.
 *
 * The old cap was 30,000, which was a budget dressed as a rail, and it truncated
 * from the FRONT — so what got dropped was the discussion and the limitations,
 * which is exactly where a paper says what it can't claim. "Where it's shaky"
 * was being written without access to the authors' own account of where it was
 * shaky.
 */
export const FULL_TEXT_CAP = 400_000;

/**
 * The ceiling on what goes to a model, which is a budget, unlike FULL_TEXT_CAP.
 *
 * 120k characters is about 30k tokens: every empirical paper and most reviews
 * pass whole. Anything longer (a thesis, a book chapter, a long review) used to
 * go in at up to 100k tokens per call, and the Ask thread sent it again on
 * every question. Over the cap, the cut comes out of the middle. The opening
 * and the closing quarter survive, because the closing quarter holds the
 * discussion and limitations, which are the parts the 30k front-truncation
 * used to lose.
 */
export const PROMPT_TEXT_CAP = 120_000;

/**
 * Where the paper stops and the bibliography starts.
 *
 * Only a heading on its own line counts — "see the references below" in running
 * prose must not amputate the paper.
 */
const BACK_MATTER = /\n[^\S\n]*(references|bibliography|works cited|literature cited)[^\S\n]*\n/gi;

/**
 * A paper's text, ready for a prompt: back matter dropped, then capped at
 * PROMPT_TEXT_CAP by cutting from the middle.
 *
 * The bibliography is a quarter of a typical extract ("Attention Is All You
 * Need" is 39,642 characters, of which 9,458 are references) and it is pure
 * noise to a model asked what the paper found — a list of other papers' titles
 * is the single most misleading thing you can put in front of a summariser.
 * Dropping it buys back more room than any cap increase does.
 *
 * Only a heading in the back half is trusted, because front matter routinely
 * lists section names, and an appendix after the references goes with it. That
 * is the intended trade: appendices are mostly tables, while the discussion and
 * the limitations sit BEFORE the references and are what the caveats beat needs.
 */
export function textForPrompt(text: string, cap = PROMPT_TEXT_CAP): string {
  const heading = [...text.matchAll(BACK_MATTER)]
    .filter((m) => (m.index ?? 0) > text.length * 0.5)
    .pop();
  const body = heading?.index ? text.slice(0, heading.index) : text;
  if (body.length <= cap) return body;
  const tail = Math.floor(cap / 4);
  return `${body.slice(0, cap - tail)}\n\n[... part of the middle of the paper is omitted for length ...]\n\n${body.slice(-tail)}`;
}
