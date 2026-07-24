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
  "ALTER TABLE users ADD COLUMN digest_paused INTEGER DEFAULT 0",
  "ALTER TABLE papers ADD COLUMN companion TEXT",
  "ALTER TABLE papers ADD COLUMN homework TEXT",
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
