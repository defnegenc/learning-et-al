import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

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
  gist: text("gist"),                     // one-line answer to the central question (zero-click hook)
  framing: text("framing"),               // legacy "I pulled N sources" line — no longer generated or shown (kept for old rows)
  homeworkTopic: text("homework_topic"),  // null = standing digest; set when a homework item seeds it (homework UI ships later)
  notes: text("notes"),
  starred: integer("starred", { mode: "boolean" }).$default(() => false),
  hidden: integer("hidden", { mode: "boolean" }).$default(() => false),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
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
  year: integer("year"),
  sourceIndex: integer("source_index"),
  plainName: text("plain_name"), // plain-language name for the paper, shown on cards alongside the academic title (E)
  takeawayHook: text("takeaway_hook"), // the one surprising, repeatable sentence — the card's draw (Conversational Papers)
  takeawayStat: text("takeaway_stat"), // concrete anchor: a number or vivid fact; nullable
  takeawayLine: text("takeaway_line"), // "say it like this" — ready-to-repeat casual sentence
  dinnerLine: text("dinner_line"), // casual "mention it at a dinner party" one-liner, generated on demand
  relatesLine: text("relates_line"), // clean one-sentence "how this relates to today's question", generated on demand
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

// Cached thread-agent runs for brief mode — one row per (digest, question, trail)
// so preloading the seed threads costs agent runs only once per digest.
export const threadCache = sqliteTable("thread_cache", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  digestId: text("digest_id").notNull().references(() => digests.id),
  question: text("question").notNull(),
  trailKey: text("trail_key").notNull().default(""),
  answer: text("answer").notNull(),
  seeds: text("seeds"),     // JSON string[]
  sources: text("sources"), // JSON AgentSource[]
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

export const qaPairs = sqliteTable("qa_pairs", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  paperId: text("paper_id").notNull().references(() => papers.id),
  userId: text("user_id").notNull().references(() => users.id),
  question: text("question").notNull(),
  answer: text("answer").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

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

export const comparisons = sqliteTable("comparisons", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => users.id),
  paperIds: text("paper_ids").notNull(),
  content: text("content").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

export const events = sqliteTable("events", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => users.id),
  type: text("type").notNull(), // digest_generate, dig_deeper, paper_click, source_click, regenerate, star_digest
  digestId: text("digest_id"),
  paperId: text("paper_id"),
  metadata: text("metadata"), // JSON: { question, theme, url, etc }
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});
