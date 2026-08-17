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
  "ALTER TABLE digests ADD COLUMN working_theme TEXT",
  "ALTER TABLE digests ADD COLUMN theme_candidates TEXT",
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
