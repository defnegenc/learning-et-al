export type S2Field =
  | "Computer Science" | "Medicine" | "Biology" | "Physics"
  | "Psychology" | "Economics" | "Engineering" | "Mathematics"
  | "Art" | "Sociology" | "Business" | "Environmental Science"
  | "Law" | "Philosophy" | "Linguistics" | "Political Science";

export type ExpertiseLevel = "beginner" | "intermediate" | "expert";

export interface InterestEntry {
  keyword: string;
  field: S2Field;
  fieldLabel: string;
  level: ExpertiseLevel;
}

export interface FieldDef {
  label: string;
  /** The field's FIXED spectrum slot — see SPECTRUM in design-system.tsx. */
  color: string;
  s2Field: S2Field;
  topics: string[];
}

/**
 * Ten fields on ten hue-ordered spectrum slots — one each, semantic, never
 * moving. The old set gave ten fields five distinguishable colours: Biology and
 * Sustainability were the identical hex, and Medicine, Business and Education
 * were three versions of the same yellow.
 */
export const FIELD_HIERARCHY: Record<string, FieldDef> = {
  "Computer Science": {
    label: "CS",
    color: "#bfdbfe",
    s2Field: "Computer Science",
    topics: [
      "AI agents", "large language models", "computer vision", "reinforcement learning",
      "HCI", "NLP", "generative AI", "robotics", "cybersecurity", "databases",
    ],
  },
  "Design & Art": {
    label: "DESIGN",
    color: "#fbcfe8",
    s2Field: "Art",
    topics: [
      "interaction design", "fashion design", "architecture", "typography",
      "generative art", "interior design", "graphic design", "industrial design",
    ],
  },
  "Biology": {
    label: "BIO",
    color: "#bbf7d0",
    s2Field: "Biology",
    topics: [
      "genetics", "neuroscience", "microbiome", "synthetic biology",
      "protein folding", "ecology", "evolution", "immunology",
    ],
  },
  "Medicine": {
    label: "MED",
    color: "#fecaca",
    s2Field: "Medicine",
    topics: [
      "clinical AI", "mental health", "public health", "precision medicine",
      "drug discovery", "epidemiology", "medical imaging",
    ],
  },
  "Social Sciences": {
    label: "SOCIAL",
    color: "#ddd6fe",
    s2Field: "Sociology",
    topics: [
      "cognitive psychology", "behavioral economics", "social networks",
      "decision making", "misinformation", "labor and automation",
    ],
  },
  "Physics & Engineering": {
    label: "PHYS",
    color: "#fed7aa",
    s2Field: "Physics",
    topics: [
      "quantum computing", "materials science", "renewable energy",
      "semiconductors", "nanotechnology", "photonics",
    ],
  },
  "Business & Finance": {
    label: "BIZ",
    color: "#fde68a",
    s2Field: "Business",
    topics: [
      "venture capital", "fintech", "digital marketing", "platform economics",
      "supply chain", "business strategy", "consumer behavior",
    ],
  },
  "Sustainability": {
    label: "ENV",
    color: "#99f6e4",
    s2Field: "Environmental Science",
    topics: [
      "climate change", "circular economy", "renewable energy",
      "biodiversity", "sustainable materials", "carbon markets",
    ],
  },
  "Philosophy & Ethics": {
    label: "PHIL",
    color: "#f5d0fe",
    s2Field: "Philosophy",
    topics: [
      "AI ethics", "consciousness", "philosophy of mind",
      "bioethics", "political philosophy", "existential risk",
    ],
  },
  "Education": {
    label: "EDU",
    color: "#d9f99d",
    s2Field: "Computer Science",
    topics: [
      "educational AI", "online learning", "gamification",
      "learning science", "adaptive learning",
    ],
  },
};

// One color per field, same mapping the preferences interest picker uses.
// Accepts either a hierarchy key ("Design & Art") or a stored S2Field ("Art").
export function fieldColor(field?: string | null): string {
  if (!field) return "#e8e8e8"; // the field neutral — no slot means no identity
  for (const def of Object.values(FIELD_HIERARCHY)) {
    if (def.s2Field === field) return def.color;
  }
  return FIELD_HIERARCHY[field]?.color || "#e8e8e8";
}

