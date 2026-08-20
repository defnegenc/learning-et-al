"use client";

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { readPendingSharedSaves, writePendingSharedSaves } from "@/lib/shared-saves";

/**
 * Replays device-backed saves once an account is available. The normal paper
 * feedback endpoint also links a foreign digest into this user's Vault history.
 */
export function PendingSharedSaves() {
  const { status } = useSession();
  const syncing = useRef(false);

  useEffect(() => {
    if (status !== "authenticated" || syncing.current) return;
    const pending = readPendingSharedSaves();
    if (pending.length === 0) return;

    syncing.current = true;
    void (async () => {
      const remaining: typeof pending = [];
      for (const digest of pending) {
        const failedPaperIds: string[] = [];
        for (const paperId of digest.paperIds) {
          try {
            const response = await fetch(`/api/papers/${paperId}/feedback`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ type: "star" }),
            });
            if (!response.ok) {
              failedPaperIds.push(paperId);
              continue;
            }
            // Match the ordinary bookmark flow: start the cached reading prep
            // after the bookmark itself has safely landed.
            fetch(`/api/papers/${paperId}/companion`, { method: "POST" }).catch(() => {});
            fetch(`/api/papers/${paperId}/homework`, { method: "POST" }).catch(() => {});
          } catch {
            failedPaperIds.push(paperId);
          }
        }
        if (failedPaperIds.length > 0) {
          remaining.push({ ...digest, paperIds: failedPaperIds });
        }
      }
      writePendingSharedSaves(remaining);
      window.dispatchEvent(new CustomEvent("shared-saves-synced"));
      syncing.current = false;
    })();
  }, [status]);

  return null;
}
