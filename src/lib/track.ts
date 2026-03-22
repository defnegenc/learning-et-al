import { db } from "@/lib/db";
import { events } from "@/lib/db/schema";

/**
 * Log an analytics event. Non-blocking — failures are swallowed.
 */
export async function trackEvent(
  userId: string,
  type: string,
  opts?: { digestId?: string; paperId?: string; metadata?: Record<string, unknown> }
) {
  try {
    await db.insert(events).values({
      userId,
      type,
      digestId: opts?.digestId ?? null,
      paperId: opts?.paperId ?? null,
      metadata: opts?.metadata ? JSON.stringify(opts.metadata) : null,
    });
  } catch {
    // Non-critical — never fail the request over analytics
  }
}
