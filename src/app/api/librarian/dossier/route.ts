import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/get-user";
import { getTasteContext, refreshDossier } from "@/lib/librarian/dossier";

// What the librarian thinks you like.
//   GET  → the current note, when it was written, and how many signals from
//   POST → rewrite it now (the "refresh" button in settings)
//
// The centroid vectors never leave the server: they are hundreds of floats per
// cluster, they mean nothing to a reader, and the labels carry everything the
// UI needs to say.
export const maxDuration = 120;

export async function GET(req: NextRequest) {
  const userId = await getAuthUser(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const taste = await getTasteContext(userId);
  return NextResponse.json({
    dossier: taste.dossier,
    updatedAt: taste.updatedAt,
    signalCount: taste.signalCount,
    clusters: taste.centroids.map(c => ({ label: c.label, count: c.count })),
  });
}

export async function POST(req: NextRequest) {
  const userId = await getAuthUser(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = await refreshDossier(userId, { force: true });
  const taste = await getTasteContext(userId);
  return NextResponse.json({
    ...result,
    dossier: taste.dossier,
    updatedAt: taste.updatedAt,
    signalCount: taste.signalCount,
    clusters: taste.centroids.map(c => ({ label: c.label, count: c.count })),
  });
}
