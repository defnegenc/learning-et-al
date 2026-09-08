import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { digests, interests } from "@/lib/db/schema";

/*
 * Homework: the reader assigns the librarian a topic ("children's mental
 * models of ai") and the next digests lean into it until the assignment is
 * retired.
 *
 * A homework item is stored as an interest row with source "homework". The
 * pipeline's seed sampler is weight-driven, so a high weight lands the
 * assignment in the candidate pool most days without the pipeline itself
 * knowing homework exists. The rotation penalty (recently featured interests
 * score lower) and the daily weight decay then fade it over the following
 * days — which is the shape the feature asks for: surface the topic, then
 * gradually let go.
 *
 * The flag ("this is coming from your homework") is exact, not inferred:
 * after a digest is generated, its seedInterests are matched against the
 * reader's active homework. A match stamps digests.homeworkTopic, which the
 * Today header renders.
 */

/** Well above the default interest weight of 1.0, so a fresh assignment wins the weighted seed draw. */
const HOMEWORK_WEIGHT = 3.0;

const norm = (s: string) => s.toLowerCase().trim();

export async function listHomework(userId: string) {
  return db.query.interests.findMany({
    where: and(eq(interests.userId, userId), eq(interests.source, "homework")),
    orderBy: desc(interests.createdAt),
  });
}

export async function addHomework(userId: string, topic: string) {
  const keyword = topic.trim().replace(/\s+/g, " ");
  if (keyword.length < 3) return { error: "Topic is too short." } as const;
  if (keyword.length > 120) return { error: "Keep the topic under 120 characters." } as const;
  const existing = await listHomework(userId);
  if (existing.some(i => norm(i.keyword) === norm(keyword))) {
    return { error: "That homework is already assigned." } as const;
  }
  const [row] = await db.insert(interests).values({
    userId,
    keyword,
    weight: HOMEWORK_WEIGHT,
    source: "homework",
    level: "intermediate",
  }).returning();
  console.log(`[Homework] Assigned for ${userId}: "${keyword}"`);
  return { homework: row } as const;
}

export async function retireHomework(userId: string, id: string) {
  await db.delete(interests).where(
    and(eq(interests.id, id), eq(interests.userId, userId), eq(interests.source, "homework")),
  );
}

/**
 * Stamp a freshly generated digest when one of the reader's homework items
 * seeded it. seedInterests records exactly which interests the theme step
 * selected, so this is a recorded fact, not a similarity guess. The substring
 * check both ways covers the LLM lightly rewording the keyword it echoes back.
 */
export async function flagHomeworkDigest(userId: string, digestId: string): Promise<string | null> {
  try {
    const digest = await db.query.digests.findFirst({ where: eq(digests.id, digestId) });
    if (!digest || digest.userId !== userId || digest.homeworkTopic) return null;
    const homework = await listHomework(userId);
    if (homework.length === 0) return null;
    let seeds: string[] = [];
    try {
      seeds = (JSON.parse(digest.seedInterests || "[]") as { keyword?: string }[])
        .map(s => norm(s.keyword || "")).filter(Boolean);
    } catch { /* no seeds recorded on this row */ }
    const match = homework.find(h => {
      const topic = norm(h.keyword);
      return seeds.some(s => s === topic || (s.length > 4 && topic.includes(s)) || (topic.length > 4 && s.includes(topic)));
    });
    if (!match) return null;
    await db.update(digests).set({ homeworkTopic: match.keyword }).where(eq(digests.id, digestId));
    console.log(`[Homework] Digest ${digestId} flagged: "${match.keyword}"`);
    return match.keyword;
  } catch (err) {
    // A flag is a nicety on top of a finished digest — never fail the run for it.
    console.error("[Homework] Failed to flag digest:", err);
    return null;
  }
}
