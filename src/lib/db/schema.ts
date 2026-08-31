import { sqliteTable, text, integer, real, uniqueIndex } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  timezone: text("timezone").default("America/New_York"),
  contentMix: integer("content_mix").default(50),
  cadence: text("cadence", { enum: ["daily", "biweekly", "weekly"] }).default("daily"),
  emailOptOut: integer("email_opt_out", { mode: "boolean" }).default(false),
  digestPaused: integer("digest_paused", { mode: "boolean" }).default(false), // admin kill-switch: cron skips this user
  email: text("email"),
  name: text("name"),
  image: text("image"),
  emailVerified: integer("email_verified", { mode: "timestamp" }),
});

export const accounts = sqliteTable("accounts", {
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  provider: text("provider").notNull(),
  providerAccountId: text("provider_account_id").notNull(),
  refresh_token: text("refresh_token"),
  access_token: text("access_token"),
  expires_at: integer("expires_at"),
  token_type: text("token_type"),
  scope: text("scope"),
  id_token: text("id_token"),
  session_state: text("session_state"),
});

export const sessions = sqliteTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expires: integer("expires", { mode: "timestamp" }).notNull(),
});

export const verificationTokens = sqliteTable("verification_tokens", {
  identifier: text("identifier").notNull(),
  token: text("token").notNull(),
  expires: integer("expires", { mode: "timestamp" }).notNull(),
});

export const interests = sqliteTable("interests", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => users.id),
  keyword: text("keyword").notNull(),
  field: text("field").default("Computer Science"),
  weight: real("weight").default(1.0),
  source: text("source", { enum: ["seed", "star", "engagement", "dislike"] }).notNull(),
  level: text("level", { enum: ["beginner", "intermediate", "expert"] }).default("intermediate"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

export const digests = sqliteTable("digests", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => users.id),
  date: text("date").notNull(),
  theme: text("theme"),
  synthesisContent: text("synthesis_content"),
  keyConcepts: text("key_concepts"),
  suggestedQuestions: text("suggested_questions"),
  suggestedAnswers: text("suggested_answers"),
  seedInterests: text("seed_interests"), // JSON [{keyword, field}] — interests that seeded this digest (drives header chips)
  seedTopic: text("seed_topic"),          // JSON {id, name, interest, subfield, subfieldId} — OpenAlex topic seed + rotation memory
  gist: text("gist"),                     // one-line answer to the central question (zero-click hook)
  workingTheme: text("working_theme"),    // debug: the pre-search retrieval question Step 5 edited away from
  themeCandidates: text("theme_candidates"), // debug: JSON [{theme, problems, coldRead, guessSim, chosen}] — why this headline won
  framing: text("framing"),               // legacy "I pulled N sources" line — no longer generated or shown (kept for old rows)
  homeworkTopic: text("homework_topic"),  // null = standing digest; set when a homework item seeds it (homework UI ships later)
  notes: text("notes"),
  searchQueries: text("search_queries"), // JSON string[] — queries used to find this digest's papers (query-memory for future runs)
  starred: integer("starred", { mode: "boolean" }).$default(() => false),
  hidden: integer("hidden", { mode: "boolean" }).$default(() => false),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

/**
 * A digest can appear in more than its author's history after it is shared.
 * Keep that relationship separate from `digests.userId`: the original row and
 * its papers remain the canonical public copy, while each reader can add it to
 * their own Vault without cloning content.
 */
export const savedDigests = sqliteTable("saved_digests", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  digestId: text("digest_id").notNull().references(() => digests.id, { onDelete: "cascade" }),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
}, (table) => [
  uniqueIndex("saved_digests_user_digest_unique").on(table.userId, table.digestId),
]);

export const digestJobs = sqliteTable("digest_jobs", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  date: text("date").notNull(),
  status: text("status", {
    enum: ["pending", "running", "generated", "failed", "skipped_paused", "skipped_no_interests"],
  }).notNull().default("pending"),
  attempts: integer("attempts").notNull().default(0),
  digestId: text("digest_id").references(() => digests.id),
  error: text("error"),
  emailStatus: text("email_status"),
  emailError: text("email_error"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  startedAt: integer("started_at", { mode: "timestamp" }),
  finishedAt: integer("finished_at", { mode: "timestamp" }),
});

export const papers = sqliteTable("papers", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  digestId: text("digest_id").notNull().references(() => digests.id),
  title: text("title").notNull(),
  authors: text("authors"),
  abstract: text("abstract"),
  fullText: text("full_text"),
  summary: text("summary"),
  source: text("source", { enum: ["arxiv", "rss", "semantic_scholar"] }).notNull(),
  sourceUrl: text("source_url"),
  pdfUrl: text("pdf_url"),
  keywords: text("keywords"),
  keyFindings: text("key_findings"),
  connectionReason: text("connection_reason"),
  category: text("category", { enum: ["foundational", "recent", "news"] }),
  foundationalReason: text("foundational_reason"), // foundational lane only: one sentence on why this text set the stage for the field
  year: integer("year"),
  sourceIndex: integer("source_index"),
  openAlexId: text("open_alex_id"), // stable work ID for cross-digest dedup (title matching misses preprint/published variants)
  plainName: text("plain_name"), // plain-language name for the paper, shown on cards alongside the academic title (E)
  takeawayHook: text("takeaway_hook"), // the one surprising, repeatable sentence — the card's draw (Conversational Papers)
  takeawayStat: text("takeaway_stat"), // concrete anchor: a number or vivid fact; nullable
  takeawayLine: text("takeaway_line"), // "say it like this" — ready-to-repeat casual sentence
  methodType: text("method_type"), // what this IS: "Field study", "Opinion piece", "Randomized trial"…
  methodFacts: text("method_facts"), // JSON string[] — method micro-facts ("62 participants", "two-week experiment")
  claim: text("claim"), // the paper's central claim in one-two plain sentences
  dinnerLine: text("dinner_line"), // casual "mention it at a dinner party" one-liner, generated on demand
  relatesLine: text("relates_line"), // clean one-sentence "how this relates to today's question", generated on demand
  abstractJargon: text("abstract_jargon"), // JSON [{term, def}] — hover defs for the abstract, generated on first detail open
  eli5: text("eli5"), // legacy plain-language gist (superseded by companion.gist; kept for old rows)
  companion: text("companion"), // JSON reading companion generated on bookmark: {gist, did, found, caveats, remember, glossary, questions}
  followUps: text("follow_ups"), // JSON {generatedAt, items} for "what's happened since"
  homework: text("homework"), // Reserved for the separate homework feature; legacy rows may contain old follow-up caches
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

/**
 * Every turn a reader has with a paper — typed questions and highlighted
 * passages both. One table rather than a separate `digs` one: a dig and an Ask
 * question are the same object once a dig can be followed up, and the reading
 * view rehydrates a paper's panels and its thread from the same read.
 *
 * `threadId` groups turns. Rows written before threading exist have it null and
 * are treated as single-turn threads of their own.
 */
export const qaPairs = sqliteTable("qa_pairs", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  paperId: text("paper_id").notNull().references(() => papers.id),
  userId: text("user_id").notNull().references(() => users.id),
  question: text("question").notNull(),
  answer: text("answer").notNull(),
  threadId: text("thread_id"),        // groups a dig and its follow-ups; null on legacy rows
  selection: text("selection"),       // the quoted passage a dig started from; null for typed questions
  sectionKey: text("section_key"),    // gist | did | found | caveats | remember — where the highlight was
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

/**
 * A reader's self-reported familiarity with one OpenAlex topic. This is a
 * presentation-time signal only: companion/answer depth and glossary density
 * may read it, while digest selection and scoring must not.
 */
export const familiarity = sqliteTable("familiarity", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  topicId: text("topic_id").notNull(),
  topicName: text("topic_name").notNull(),
  level: integer("level").notNull(), // application-enforced Likert value, 1–5
  source: text("source", { enum: ["interleave", "correction"] }).notNull().default("interleave"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
}, (table) => [
  uniqueIndex("familiarity_user_topic_unique").on(table.userId, table.topicId),
]);

/**
 * The interleaver's server-side annoyance budget. A unique user/day reserves
 * the one daily ask before it is painted, and a unique user/topic means a
 * skipped topic is never quietly asked again.
 */
export const familiarityPrompts = sqliteTable("familiarity_prompts", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  topicId: text("topic_id").notNull(),
  topicName: text("topic_name").notNull(),
  day: text("day").notNull(),
  status: text("status", { enum: ["offered", "answered", "skipped"] }).notNull().default("offered"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
}, (table) => [
  uniqueIndex("familiarity_prompts_user_topic_unique").on(table.userId, table.topicId),
  uniqueIndex("familiarity_prompts_user_day_unique").on(table.userId, table.day),
]);

export const feedback = sqliteTable("feedback", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  paperId: text("paper_id").notNull().references(() => papers.id),
  userId: text("user_id").notNull().references(() => users.id),
  type: text("type", { enum: ["star", "dislike"] }).notNull(),
  reason: text("reason"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

export const digestFeedback = sqliteTable("digest_feedback", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  digestId: text("digest_id").notNull().references(() => digests.id),
  userId: text("user_id").notNull().references(() => users.id),
  reason: text("reason").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

/**
 * What the librarian thinks you like — one row per reader.
 *
 * `dossier` is a ~300-word natural-language document rewritten from the signal
 * ledger (saves, skips, questions, digs, complaints). It is deliberately prose
 * rather than a feature vector: it is inspectable, it can be shown to the reader
 * in settings, and it is the form the LLM selection step can actually use.
 *
 * `centroids` are embedding centroids of saved papers — one per cluster, never
 * one global average, because somebody who saves both HCI and metabolism papers
 * is not the midpoint of the two. They are a SOFT prior on ranking inside the
 * already-qualified pool, never a filter and never a threshold.
 *
 * `signalCount` is what the last rewrite was written from, so the keeper can
 * tell "five new signals since" without re-reading the whole ledger's content.
 */
export const tasteDossiers = sqliteTable("taste_dossiers", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  dossier: text("dossier"),
  centroids: text("centroids"),   // JSON [{label, vector: number[], count}]
  signalCount: integer("signal_count").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
}, (table) => [
  uniqueIndex("taste_dossiers_user_unique").on(table.userId),
]);

export const events = sqliteTable("events", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => users.id),
  type: text("type").notNull(), // digest_generate, dig_deeper, paper_click, source_click, regenerate, star_digest
  digestId: text("digest_id"),
  paperId: text("paper_id"),
  metadata: text("metadata"), // JSON: { question, theme, url, etc }
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});
