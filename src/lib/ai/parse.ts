/** Extract and parse JSON from LLM responses that may contain markdown fences or preamble. */
export function extractJson<T>(raw: string): T | null {
  const fenceStripped = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```\s*$/, "");
  const match = fenceStripped.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try { return JSON.parse(match[0]) as T; }
  catch { return null; }
}

/** Strip markdown code fences from LLM prose output. */
export function stripFences(raw: string): string {
  return raw.replace(/^```[\s\S]*?\n/, "").replace(/\n```\s*$/, "").trim();
}
