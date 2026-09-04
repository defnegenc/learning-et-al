import { and, asc, desc, eq, gte, inArray, isNull, lt, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { digestJobs, digests, interests, papers, users } from "@/lib/db/schema";
import { sendDigestEmail, type DigestEmailData } from "@/lib/email";
import { AIConfig, aiConfigFor } from "@/lib/ai/provider";
import { generateDigest } from "@/lib/pipeline/digest";
import { postDigestToX } from "@/lib/twitter";

type UserRow = typeof users.$inferSelect;
type DigestJobStatus = typeof digestJobs.$inferSelect.status;

// One attempt per hourly slot (04:00-16:00 UTC), so 13 lets a job keep
// retrying through the whole day. At 3, a bad model/API window in the early
// morning exhausted every attempt by 06:00 UTC and the date stayed empty.
const MAX_ATTEMPTS = 13;
const DEFAULT_BATCH_SIZE = 2;

export function utcDateString(date = new Date()): string {
  return date.toISOString().split("T")[0];
}

export function digestJobId(date: string, userId: string): string {
  return `${date}:${userId}`;
}

/** @deprecated Kept as the pipeline's name for `aiConfigFor("digest")`. */
export function getCronAiConfig(): AIConfig {
  return aiConfigFor("digest");
}

async function hasInterests(userId: string): Promise<boolean> {
  const rows = await db.select({ id: interests.id }).from(interests).where(eq(interests.userId, userId)).limit(1);
  return rows.length > 0;
}

async function upsertJobStatus(user: UserRow, date: string, status: DigestJobStatus): Promise<"created" | "existing"> {
  const id = digestJobId(date, user.id);
  const now = new Date();
  try {
    await db.insert(digestJobs).values({
      id,
      userId: user.id,
      date,
      status,
      createdAt: now,
      updatedAt: now,
      finishedAt: status === "pending" ? null : now,
    });
    return "created";
  } catch (error) {
    const existing = await db.query.digestJobs.findFirst({ where: eq(digestJobs.id, id) });
    if (!existing) throw error;
    if (existing && existing.status === "pending" && status !== "pending") {
      await db.update(digestJobs).set({ status, updatedAt: now, finishedAt: now }).where(eq(digestJobs.id, id));
    }
    return "existing";
  }
}

export async function seedDailyDigestJobs(date = utcDateString()) {
  const allUsers = await db.select().from(users);
  const results: { userId: string; status: DigestJobStatus; action: "created" | "existing" }[] = [];

  for (const user of allUsers) {
    let status: DigestJobStatus = "pending";
    if (user.digestPaused) {
      status = "skipped_paused";
    } else if (!(await hasInterests(user.id))) {
      status = "skipped_no_interests";
    }

    const action = await upsertJobStatus(user, date, status);
    results.push({ userId: user.id, status, action });
  }

  return {
    date,
    totalUsers: allUsers.length,
    pending: results.filter((r) => r.status === "pending").length,
    skipped: results.filter((r) => r.status.startsWith("skipped")).length,
    created: results.filter((r) => r.action === "created").length,
    existing: results.filter((r) => r.action === "existing").length,
    results,
  };
}

async function sendCadenceEmail(user: UserRow, digestDate: string): Promise<{ status?: string; error?: string }> {
  if (user.id !== process.env.ADMIN_USER_ID) {
    return { status: "email_skipped_non_admin" };
  }
  if (!user.email) return { status: "email_skipped_no_email" };
  if (user.emailOptOut) return { status: "email_skipped_opt_out" };

  const cadence = (user.cadence as "daily" | "biweekly" | "weekly") || "daily";
  const today = new Date(`${digestDate}T00:00:00.000Z`);
  const dayOfWeek = today.getUTCDay();
  const shouldEmail =
    cadence === "daily" ||
    (cadence === "biweekly" && (dayOfWeek === 2 || dayOfWeek === 5)) ||
    (cadence === "weekly" && dayOfWeek === 0);

  if (!shouldEmail) return { status: `email_deferred_${cadence}` };

  const periodDays = cadence === "weekly" ? 7 : cadence === "biweekly" ? 3 : 1;
  const periodStart = new Date(today);
  periodStart.setUTCDate(periodStart.getUTCDate() - periodDays);
  const periodStartStr = utcDateString(periodStart);

  const periodDigests = await db.select().from(digests)
    .where(and(eq(digests.userId, user.id), gte(digests.date, periodStartStr)))
    .orderBy(desc(digests.createdAt));

  if (periodDigests.length === 0) return { status: "email_skipped_no_digest" };

  const best = periodDigests[0];
  const digestPapers = await db.select().from(papers).where(eq(papers.digestId, best.id));
  const bestData: DigestEmailData = {
    theme: best.theme || "Untitled Digest",
    synthesis: best.synthesisContent || "",
    digestId: best.id,
    date: new Date(`${best.date}T00:00:00.000Z`).toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    }),
    papers: digestPapers.map((p) => ({
      title: p.title,
      source: p.source,
      year: p.year ?? undefined,
      summary: p.summary ?? undefined,
      sourceUrl: p.sourceUrl ?? undefined,
      keywords: p.keywords ? JSON.parse(p.keywords) : [],
    })),
  };

  const allDigestSummaries = periodDigests.map((d) => ({
    theme: d.theme || "Untitled",
    date: d.date,
    digestId: d.id,
  }));

  const emailResult = await sendDigestEmail(user.email, cadence, bestData, allDigestSummaries);
  return {
    status: emailResult.sent ? "emailed" : "email_failed",
    error: emailResult.error,
  };
}

async function postAdminDigestToX(user: UserRow, digestId: string) {
  if (user.id !== process.env.ADMIN_USER_ID) return { status: "x_skipped_non_admin" };

  const digest = await db.query.digests.findFirst({ where: eq(digests.id, digestId) });
  if (!digest) return { status: "x_skipped_no_digest" };

  const digestPapersForX = await db.select().from(papers).where(eq(papers.digestId, digestId));
  const synthesis = digest.synthesisContent || "";
  const lines = synthesis.split("\n");
  const firstBulletLine = lines.findIndex((line) => /^\s*-\s+\*\*\[source/i.test(line));
  const lede = firstBulletLine > 0
    ? lines.slice(0, firstBulletLine).filter((line) => line.trim()).join(" ").trim()
    : null;

  const result = await postDigestToX({
    theme: digest.theme || "Today's Research Digest",
    lede,
    papers: digestPapersForX.map((paper) => ({ title: paper.title, sourceUrl: paper.sourceUrl })),
    digestId,
  });

  return { status: result.ok ? "x_posted" : "x_failed", error: result.error };
}

export async function processDigestJobBatch(aiConfig: AIConfig, batchSize = DEFAULT_BATCH_SIZE, date?: string) {
  if (!aiConfig.apiKey) {
    throw new Error("No CRON_AI_KEY configured");
  }

  const now = new Date();
  const retryBefore = new Date(now.getTime() - 30 * 60 * 1000);
  const runnableJobFilter = and(
    inArray(digestJobs.status, ["pending", "failed", "running"]),
    lt(digestJobs.attempts, MAX_ATTEMPTS),
  );
  const jobFilter = date ? and(eq(digestJobs.date, date), runnableJobFilter) : runnableJobFilter;
  const jobs = await db.select().from(digestJobs)
    .where(jobFilter)
    .orderBy(asc(digestJobs.date), asc(digestJobs.updatedAt))
    .limit(batchSize);

  const runnable = jobs.filter((job) => job.status !== "running" || !job.startedAt || job.startedAt < retryBefore);
  const results: {
    jobId: string;
    userId: string;
    status: string;
    digestId?: string | null;
    error?: string;
    emailStatus?: string;
    xStatus?: string;
  }[] = [];

  for (const job of runnable) {
    // Atomic claim. The 04:00 seeder and the hourly slot workers overlap, and
    // an unguarded flip let two invocations run the same job, which generated
    // duplicate editions for the same date. Only update while the job is still
    // claimable, then verify this worker is the one holding it.
    const startedAt = new Date();
    await db.update(digestJobs).set({
      status: "running",
      attempts: job.attempts + 1,
      error: null,
      updatedAt: startedAt,
      startedAt,
      finishedAt: null,
    }).where(and(
      eq(digestJobs.id, job.id),
      or(
        inArray(digestJobs.status, ["pending", "failed"]),
        and(eq(digestJobs.status, "running"), or(isNull(digestJobs.startedAt), lt(digestJobs.startedAt, retryBefore))),
      ),
    ));
    const claimed = await db.query.digestJobs.findFirst({ where: eq(digestJobs.id, job.id) });
    if (!claimed || claimed.status !== "running" || claimed.attempts !== job.attempts + 1 || claimed.startedAt?.getTime() !== startedAt.getTime()) {
      results.push({ jobId: job.id, userId: job.userId, status: "skipped_claimed_elsewhere" });
      continue;
    }

    const user = await db.query.users.findFirst({ where: eq(users.id, job.userId) });
    if (!user) {
      await db.update(digestJobs).set({
        status: "failed",
        error: "User not found",
        updatedAt: new Date(),
        finishedAt: new Date(),
      }).where(eq(digestJobs.id, job.id));
      results.push({ jobId: job.id, userId: job.userId, status: "failed", error: "User not found" });
      continue;
    }

    if (user.digestPaused) {
      await db.update(digestJobs).set({
        status: "skipped_paused",
        updatedAt: new Date(),
        finishedAt: new Date(),
      }).where(eq(digestJobs.id, job.id));
      results.push({ jobId: job.id, userId: user.id, status: "skipped_paused" });
      continue;
    }

    if (!(await hasInterests(user.id))) {
      await db.update(digestJobs).set({
        status: "skipped_no_interests",
        updatedAt: new Date(),
        finishedAt: new Date(),
      }).where(eq(digestJobs.id, job.id));
      results.push({ jobId: job.id, userId: user.id, status: "skipped_no_interests" });
      continue;
    }

    try {
      const digest = await generateDigest(user.id, aiConfig);
      const xResult = digest?.id ? await postAdminDigestToX(user, digest.id) : { status: "x_skipped_no_digest" };
      const emailResult = await sendCadenceEmail(user, job.date);
      const finishedAt = new Date();
      await db.update(digestJobs).set({
        status: "generated",
        digestId: digest?.id ?? null,
        emailStatus: emailResult.status,
        emailError: emailResult.error ?? null,
        updatedAt: finishedAt,
        finishedAt,
      }).where(eq(digestJobs.id, job.id));
      results.push({
        jobId: job.id,
        userId: user.id,
        status: "generated",
        digestId: digest?.id,
        emailStatus: emailResult.status,
        xStatus: xResult.status,
        error: emailResult.error || xResult.error,
      });
    } catch (error) {
      const message = String(error).slice(0, 500);
      const failedAt = new Date();
      await db.update(digestJobs).set({
        status: "failed",
        error: message,
        updatedAt: failedAt,
        finishedAt: failedAt,
      }).where(eq(digestJobs.id, job.id));
      results.push({ jobId: job.id, userId: user.id, status: "failed", error: message });
    }
  }

  const remaining = await db.select({ id: digestJobs.id }).from(digestJobs)
    .where(jobFilter);

  return {
    date: date ?? "all",
    requested: batchSize,
    claimed: runnable.length,
    remaining: remaining.length,
    results,
  };
}
