import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { digests, papers } from "@/lib/db/schema";

/*
 * One-time, idempotent content patches, run from the cron entry point.
 *
 * Each patch checks a defect marker before writing and only touches the named
 * rows, so once the fix lands the marker is gone and the patch degrades to a
 * no-op read. Entries can be deleted after they apply.
 */

const SEP14_DIGEST_ID = "14a4708f-400b-4971-8e40-7ec9b2561e42"; // 2026-09-14 edition
const SEP14_STAPLE_PAPER_ID = "a02bd65c-d2eb-4b2e-b8b0-77ab6d204871"; // [Source 4]

export async function runContentPatches(): Promise<string[]> {
  const applied: string[] = [];

  // 2026-09-14 edition, from the daily review:
  // - "twenty-five years" is bad arithmetic (2000 → 2026) with no established endpoint.
  // - [Source 4]'s stored payload is ACS page metadata, not an abstract, so the
  //   helicity/enzyme-resistance/chemical-baggage claims are unverifiable as written;
  //   every kept claim now traces to the paper's own title ("An All-Hydrocarbon
  //   Cross-Linking System for Enhancing the Helicity and Metabolic Stability of
  //   Peptides").
  // - "side effects" misreads design tradeoffs as clinical ones.
  const d = await db.query.digests.findFirst({
    where: eq(digests.id, SEP14_DIGEST_ID),
    columns: { synthesisContent: true, gist: true },
  });
  if (d?.synthesisContent?.includes("twenty-five years")) {
    const synthesisContent = d.synthesisContent
      .replace(
        "Yes, and it took twenty-five years to get here. Back in 2000",
        "Yes. Back in 2000",
      )
      .replace(
        "making it both **more helical** and more resistant to the enzymes that normally chew peptides apart in the body.",
        "making it both **more helical** and more metabolically stable.",
      )
      .replace(
        "comes with side effects that needed cataloging",
        "comes with design tradeoffs that needed cataloging",
      );
    const gist = (d.gist ?? "").replace(
      "25 years of peptide engineering",
      "decades of peptide engineering",
    );
    await db
      .update(digests)
      .set({ synthesisContent, gist })
      .where(eq(digests.id, SEP14_DIGEST_ID));
    applied.push("digest-2026-09-14");
  }

  const p = await db.query.papers.findFirst({
    where: eq(papers.id, SEP14_STAPLE_PAPER_ID),
    columns: { summary: true },
  });
  if (p?.summary?.includes("digestive enzymes")) {
    await db
      .update(papers)
      .set({
        summary:
          "Chemists attached a carbon-only chemical bridge, or 'staple,' between two points on a short peptide chain to lock it into a spring-like helix shape, making the peptide more helical and more metabolically stable.",
        claim:
          "Locking a peptide into a helix with an all-carbon staple makes the peptide more helical and more metabolically stable.",
        keyFindings: JSON.stringify([
          "An all-hydrocarbon staple **increased the helicity** of peptides",
          "The same staple **increased the peptides' metabolic stability**",
          "The crosslink used **only carbon and hydrogen** atoms",
        ]),
        methodFacts: JSON.stringify([
          "They chemically linked two points on a peptide chain.",
          "The cross-link used only carbon and hydrogen atoms.",
          "They measured the peptide's helicity and metabolic stability.",
        ]),
        takeawayHook:
          "Welding two points of a floppy peptide chain together with a simple carbon bridge can make it hold its shape and stay metabolically stable.",
      })
      .where(eq(papers.id, SEP14_STAPLE_PAPER_ID));
    applied.push("paper-2026-09-14-source4");
  }

  return applied;
}
