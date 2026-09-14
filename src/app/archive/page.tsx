import { NoiseOverlay } from "@/components/noise-overlay";
import { BODY_STYLE, DIM, Label, SiteHeader, SURFACE } from "@/components/design-system";
import { db } from "@/lib/db";
import { digests } from "@/lib/db/schema";
import { and, desc, eq, isNull, or } from "drizzle-orm";
import Link from "next/link";

export const metadata = {
  title: "Archive",
  description: "Every daily edition of Learning et al. - one provocative question a day.",
};

export const revalidate = 300;

/**
 * Every edition, newest first. The questions are the product's calling card -
 * this is the page a first-time visitor binges, and the crawlable index that
 * gets each edition's permalink indexed.
 */
export default async function ArchivePage() {
  const adminId = process.env.ADMIN_USER_ID;
  const editions = adminId
    ? await db.query.digests.findMany({
        where: and(
          eq(digests.userId, adminId),
          or(isNull(digests.hidden), eq(digests.hidden, false)),
        ),
        orderBy: desc(digests.date),
        columns: { id: true, date: true, theme: true, gist: true },
      })
    : [];

  return (
    <div className="relative min-h-screen" style={{ background: SURFACE }}>
      <NoiseOverlay />
      <SiteHeader />
      <main className="relative z-10 px-4 md:px-8 pt-8 md:pt-12 pb-20" style={{ maxWidth: 760, margin: "0 auto" }}>
        <Label>Archive</Label>
        <p style={{ ...BODY_STYLE, color: DIM, margin: "10px 0 28px" }}>
          One question a day. Every edition stays up.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          {editions.map((d) => {
            const date = new Date(`${d.date}T12:00:00`).toLocaleDateString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
              year: "numeric",
            });
            return (
              <Link
                key={d.id}
                href={`/digest/${d.id}`}
                style={{ textDecoration: "none", color: "inherit", display: "block" }}
              >
                <div style={{ ...BODY_STYLE, color: DIM, fontSize: 13 }}>{date}</div>
                <div style={{ ...BODY_STYLE, fontWeight: 600, fontSize: 20, lineHeight: 1.25, marginTop: 2 }}>
                  {d.theme || "Untitled edition"}
                </div>
              </Link>
            );
          })}
          {editions.length === 0 && (
            <p style={{ ...BODY_STYLE, color: DIM }}>No editions yet.</p>
          )}
        </div>
      </main>
    </div>
  );
}
