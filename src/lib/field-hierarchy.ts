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
  color: string;
  s2Field: S2Field;
  topics: string[];
}

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
    color: "#fef08a",
    s2Field: "Medicine",
    topics: [
      "clinical AI", "mental health", "public health", "precision medicine",
      "drug discovery", "epidemiology", "medical imaging",
    ],
  },
  "Social Sciences": {
    label: "SOCIAL",
    color: "#e9d5ff",
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
    color: "#bbf7d0",
    s2Field: "Environmental Science",
    topics: [
      "climate change", "circular economy", "renewable energy",
      "biodiversity", "sustainable materials", "carbon markets",
    ],
  },
  "Philosophy & Ethics": {
    label: "PHIL",
    color: "#ede9fe",
    s2Field: "Philosophy",
    topics: [
      "AI ethics", "consciousness", "philosophy of mind",
      "bioethics", "political philosophy", "existential risk",
    ],
  },
  "Education": {
    label: "EDU",
    color: "#fef9c3",
    s2Field: "Computer Science",
    topics: [
      "educational AI", "online learning", "gamification",
      "learning science", "adaptive learning",
    ],
  },
};
