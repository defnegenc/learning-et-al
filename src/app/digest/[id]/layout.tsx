import type { Metadata } from "next";
import { db } from "@/lib/db";
import { digests } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const digest = await db.query.digests.findFirst({
    where: eq(digests.id, id),
    columns: { theme: true, gist: true },
  }).catch(() => null);
  const title = digest?.theme || "A shared research digest";
  const description = digest?.gist || "A research digest shared from Learning et al.";
  const url = `/digest/${id}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: "article" },
    twitter: { title, description, card: "summary_large_image" },
  };
}

export default function DigestLayout({ children }: { children: React.ReactNode }) {
  return children;
}
