import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { refreshDossier } from "@/lib/librarian/dossier";

/*
 * The dossier keeper's weekly round.
 *
 * Saves also trigger a refresh, but only when five new signals have piled up —
 * a reader who saves one paper a fortnight would otherwise never get a rewrite.
 * This is the floor: once a week, every active reader's note is at most seven
 * days stale.
 *
 * Runs on Sunday at 03:00 UTC, an hour before the digest cron, so Sunday's
 * digests are chosen with a fresh note rather than last week's.
 */
export const maxDuration = 300;

/** Left inside the execution window even with slow model calls. */
const MAX_USERS_PER_RUN = 60;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const rows = await db.query.users.findMany({
      where: eq(users.digestPaused, false),
      columns: { id: true },
      limit: MAX_USERS_PER_RUN,
    });

    let written = 0;
    let skipped = 0;
    for (const user of rows) {
      const result = await refreshDossier(user.id);
      if (result.written) written++;
      else skipped++;
    }

    if (rows.length === MAX_USERS_PER_RUN) {
      console.log(`[Librarian] Hit the ${MAX_USERS_PER_RUN}-user cap this run — readers beyond it wait for next week or a save-triggered rewrite.`);
    }
    return NextResponse.json({ ok: true, considered: rows.length, written, skipped });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
