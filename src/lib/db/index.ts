import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import * as schema from "./schema";

const client = createClient({
  url: process.env.TURSO_DATABASE_URL || "file:paper-processor.db",
  authToken: process.env.TURSO_AUTH_TOKEN,
});

// Idempotent micro-migrations. Turso prod can't be reached from dev machines
// (secrets are Vercel-sensitive), so additive columns are applied here on cold
// start: the ALTER fails silently once the column exists. Remove entries once
// they're known to have run in prod.
const MICRO_MIGRATIONS = [
  `CREATE TABLE IF NOT EXISTS saved_digests (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL,
    digest_id TEXT NOT NULL,
    created_at INTEGER,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (digest_id) REFERENCES digests(id) ON DELETE CASCADE
  )`,
  "CREATE UNIQUE INDEX IF NOT EXISTS saved_digests_user_digest_unique ON saved_digests(user_id, digest_id)",
  `CREATE TABLE IF NOT EXISTS digest_jobs (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL,
    date TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    attempts INTEGER NOT NULL DEFAULT 0,
    digest_id TEXT,
    error TEXT,
    email_status TEXT,
    email_error TEXT,
    created_at INTEGER,
    updated_at INTEGER,
    started_at INTEGER,
    finished_at INTEGER
  )`,
  "ALTER TABLE digests ADD COLUMN seed_topic TEXT",
  "ALTER TABLE users ADD COLUMN digest_paused INTEGER DEFAULT 0",
  "ALTER TABLE papers ADD COLUMN companion TEXT",
  "ALTER TABLE papers ADD COLUMN homework TEXT",
  "ALTER TABLE papers ADD COLUMN follow_ups TEXT",
  "ALTER TABLE digests ADD COLUMN working_theme TEXT",
  "ALTER TABLE digests ADD COLUMN theme_candidates TEXT",
  // Phase 2 engagement-ledger columns. Keep these before Phase 3 tables: the
  // reading view can render without them, but Ask/dig reads cannot.
  "ALTER TABLE qa_pairs ADD COLUMN thread_id TEXT",
  "ALTER TABLE qa_pairs ADD COLUMN selection TEXT",
  "ALTER TABLE qa_pairs ADD COLUMN section_key TEXT",
  `CREATE TABLE IF NOT EXISTS familiarity (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL,
    topic_id TEXT NOT NULL,
    topic_name TEXT NOT NULL,
    level INTEGER NOT NULL,
    source TEXT NOT NULL DEFAULT 'interleave',
    created_at INTEGER,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`,
  "CREATE UNIQUE INDEX IF NOT EXISTS familiarity_user_topic_unique ON familiarity(user_id, topic_id)",
  `CREATE TABLE IF NOT EXISTS familiarity_prompts (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL,
    topic_id TEXT NOT NULL,
    topic_name TEXT NOT NULL,
    day TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'offered',
    created_at INTEGER,
    updated_at INTEGER,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`,
  "CREATE UNIQUE INDEX IF NOT EXISTS familiarity_prompts_user_topic_unique ON familiarity_prompts(user_id, topic_id)",
  "CREATE UNIQUE INDEX IF NOT EXISTS familiarity_prompts_user_day_unique ON familiarity_prompts(user_id, day)",
  // Phase 4: the librarian's own memory. Independent of the phase 2/3 tables
  // above — a reader with no dossier yet just gets the pipeline as it was.
  `CREATE TABLE IF NOT EXISTS taste_dossiers (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL,
    dossier TEXT,
    centroids TEXT,
    signal_count INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER,
    updated_at INTEGER,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`,
  "CREATE UNIQUE INDEX IF NOT EXISTS taste_dossiers_user_unique ON taste_dossiers(user_id)",
  // One visible edition per reader per day. Duplicated dates already exist in
  // prod (cron double-fires + force regens each inserted a fresh row), so hide
  // every visible duplicate but the earliest first, or the partial unique
  // index below can never be created. The update is idempotent and the index
  // only covers visible rows, so hidden history keeps its duplicates.
  `UPDATE digests SET hidden = 1
   WHERE COALESCE(hidden, 0) = 0 AND id NOT IN (
     SELECT id FROM (
       SELECT id, ROW_NUMBER() OVER (PARTITION BY user_id, date ORDER BY created_at ASC, id ASC) AS rn
       FROM digests WHERE COALESCE(hidden, 0) = 0
     ) WHERE rn = 1
   )`,
  "CREATE UNIQUE INDEX IF NOT EXISTS digests_user_date_visible_unique ON digests(user_id, date) WHERE COALESCE(hidden, 0) = 0",
];
let migrated: Promise<void> | null = null;
export function ensureSchema(): Promise<void> {
  migrated ??= (async () => {
    for (const sql of MICRO_MIGRATIONS) {
      try { await client.execute(sql); } catch { /* column already exists */ }
    }
  })();
  return migrated;
}
ensureSchema();

export const db = drizzle(client, { schema });
