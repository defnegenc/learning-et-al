/** Shared contracts for the familiarity interleave and its visible-use line. */

export interface FamiliarityTopic {
  id: string;
  name: string;
  subfield?: string;
  source: "openalex" | "interest";
}

export interface FamiliarityValue {
  topicId: string;
  topicName: string;
  level: number;
  source?: "interleave" | "correction";
  createdAt?: Date | string | number | null;
}

export interface PitchedForYou {
  topicId: string;
  topicName: string;
  level: number;
  consequence: string;
}

export const PITCH_PREFIX = "PITCHED FOR YOU |";

export function isFamiliarityLevel(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 1 && Number(value) <= 5;
}

export function pitchConsequence(level: number): string {
  if (level <= 2) return "I'm defining terms and using analogies as I go.";
  if (level === 3) return "I'm skipping the basics but keeping working terms visible.";
  return "I'm skipping the basics and going straight to the method.";
}

export function pitchedForYou(topic: FamiliarityTopic, level: number, consequence?: string): PitchedForYou {
  return {
    topicId: topic.id,
    topicName: topic.name,
    level,
    consequence: consequence?.trim() || pitchConsequence(level),
  };
}

/** Persist a parseable disclosure even if a provider ignored the first-line contract. */
export function ensurePitchedForYou(raw: string, topic: FamiliarityTopic, level: number): string {
  if (stripPitchedForYou(raw, { topic, level }).pitch) return raw;
  return `${PITCH_PREFIX} ${topic.name} | ${level}/5 | ${pitchConsequence(level)}\n\n${raw.trim()}`;
}

export function familiarityPrompt(topic: FamiliarityTopic, level: number): string {
  const depth = level <= 2
    ? "Define field-specific terms, use a concrete analogy where it helps, and make the mechanism intuitive before adding detail."
    : level === 3
      ? "Skip general background, define working and specialist terms, and explain the mechanism with concrete detail."
      : "Skip basic and working-level definitions. Go directly to method, mechanism, limitations, and specialist detail.";

  return `\n\nThe reader self-reports ${level}/5 familiarity with ${topic.name}. ${depth}
Because this stored rating shapes the response, the response MUST begin with exactly one plain-text line in this parseable format:
${PITCH_PREFIX} ${topic.name} | ${level}/5 | <one short first-person sentence saying what you changed>
Then add one blank line and the response body. Do not repeat the disclosure anywhere else.`;
}

/** Strip the model-enforced line so callers can render it as structured UI. */
export function stripPitchedForYou(
  raw: string,
  expected?: { topic: FamiliarityTopic; level: number },
): { body: string; pitch: PitchedForYou | null } {
  const match = raw.match(/^\s*PITCHED FOR YOU\s*\|\s*([^|\n]+)\s*\|\s*([1-5])\s*\/\s*5\s*\|\s*([^\n]+)\n*/i);
  if (!match) return { body: raw.trim(), pitch: null };

  const parsedLevel = Number(match[2]);
  const topicName = expected?.topic.name ?? match[1].trim();
  const level = expected?.level ?? parsedLevel;
  return {
    body: raw.slice(match[0].length).trim(),
    pitch: {
      topicId: expected?.topic.id ?? `legacy:${topicName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      topicName,
      level,
      consequence: match[3].trim() || pitchConsequence(level),
    },
  };
}

export function topicFromCompanion(value: unknown): FamiliarityTopic | null {
  if (!value || typeof value !== "object") return null;
  const topic = (value as { topic?: unknown }).topic;
  if (!topic || typeof topic !== "object") return null;
  const candidate = topic as Partial<FamiliarityTopic>;
  if (typeof candidate.id !== "string" || !candidate.id.trim()) return null;
  if (typeof candidate.name !== "string" || !candidate.name.trim()) return null;
  return {
    id: candidate.id.trim(),
    name: candidate.name.trim(),
    subfield: typeof candidate.subfield === "string" ? candidate.subfield.trim() : undefined,
    source: candidate.source === "interest" ? "interest" : "openalex",
  };
}
