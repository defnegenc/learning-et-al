/**
 * Signed-out bookmark intent. The browser keeps the digest relationship with
 * the selected papers, then `PendingSharedSaves` replays it after sign-in.
 */
export const PENDING_SHARED_SAVES_KEY = "learningetal_pending_shared_saves";

export interface PendingSharedDigest {
  digestId: string;
  paperIds: string[];
  savedAt: string;
}

export function readPendingSharedSaves(): PendingSharedDigest[] {
  if (typeof window === "undefined") return [];
  try {
    const value: unknown = JSON.parse(localStorage.getItem(PENDING_SHARED_SAVES_KEY) || "[]");
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is PendingSharedDigest => (
      typeof item === "object" && item !== null
      && typeof (item as PendingSharedDigest).digestId === "string"
      && Array.isArray((item as PendingSharedDigest).paperIds)
      && (item as PendingSharedDigest).paperIds.every((id) => typeof id === "string")
    ));
  } catch {
    return [];
  }
}

export function writePendingSharedSaves(items: PendingSharedDigest[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(PENDING_SHARED_SAVES_KEY, JSON.stringify(items));
}

export function pendingPaperIds(digestId: string): Set<string> {
  const entry = readPendingSharedSaves().find((item) => item.digestId === digestId);
  return new Set(entry?.paperIds ?? []);
}

export function setPendingSharedPaper(digestId: string, paperId: string, saved: boolean): Set<string> {
  const items = readPendingSharedSaves();
  const existing = items.find((item) => item.digestId === digestId);
  const ids = new Set(existing?.paperIds ?? []);
  if (saved) ids.add(paperId);
  else ids.delete(paperId);

  const withoutDigest = items.filter((item) => item.digestId !== digestId);
  if (ids.size > 0) {
    withoutDigest.push({
      digestId,
      paperIds: [...ids],
      savedAt: existing?.savedAt ?? new Date().toISOString(),
    });
  }
  writePendingSharedSaves(withoutDigest);
  return ids;
}
