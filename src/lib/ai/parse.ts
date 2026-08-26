/** Extract and parse JSON from LLM responses that may contain markdown fences or preamble. */
export function extractJson<T>(raw: string): T | null {
  const fenceStripped = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```\s*$/, "");
  const match = fenceStripped.match(/\{[\s\S]*\}/);
  if (match) {
    try { return JSON.parse(match[0]) as T; }
    catch { /* fall through to the salvage pass */ }
  }
  const salvaged = closeTruncatedJson(fenceStripped);
  if (!salvaged) return null;
  try { return JSON.parse(salvaged) as T; }
  catch { return null; }
}

/**
 * Salvage the complete prefix of a response that was cut off mid-JSON.
 *
 * A response that hits the model's output ceiling ends in the middle of a value,
 * and the greedy `{...}` match above then runs to the last `}` in the fragment,
 * so `JSON.parse` throws and the caller sees a total failure. That is how a
 * digest shipped with no metadata at all: Stage A returns one large object whose
 * `items` array carries every paper's plain name, summary, findings and
 * takeaway, and one truncated item threw all of them away.
 *
 * Only a `}` or `]` counts as a cut point, so a half-written object is dropped
 * whole rather than closed around a dangling key. Everything that finished
 * before the cut survives; keys the response never reached come back undefined,
 * which every caller here already treats as absent.
 */
function closeTruncatedJson(text: string): string | null {
  const start = text.indexOf("{");
  if (start < 0) return null;

  const stack: string[] = [];
  let inString = false;
  let escaped = false;
  let cut = -1;
  let cutDepth: string[] = [];

  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') { inString = true; continue; }
    if (ch === "{" || ch === "[") { stack.push(ch === "{" ? "}" : "]"); continue; }
    if (ch === "}" || ch === "]") {
      stack.pop();
      if (stack.length === 0) return text.slice(start, i + 1); // not truncated after all
      cut = i + 1;
      cutDepth = [...stack];
      continue;
    }
  }

  if (cut < 0) return null;
  return text.slice(start, cut) + cutDepth.reverse().join("");
}

/** Strip markdown code fences from LLM prose output. */
export function stripFences(raw: string): string {
  return raw.replace(/^```[\s\S]*?\n/, "").replace(/\n```\s*$/, "").trim();
}
