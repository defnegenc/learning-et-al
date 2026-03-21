import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  timezone: text("timezone").default("America/New_York"),
  contentMix: integer("content_mix").default(50),
  email: text("email"),
  name: text("name"),
  image: text("image"),
  emailVerified: integer("email_verified", { mode: "timestamp" }),
});

export const accounts = sqliteTable("accounts", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
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
  starred: integer("starred", { mode: "boolean" }).$default(() => false),
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

export const comparisons = sqliteTable("comparisons", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => users.id),
  paperIds: text("paper_ids").notNull(),
  content: text("content").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});
