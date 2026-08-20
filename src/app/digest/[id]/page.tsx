"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { signIn, useSession } from "next-auth/react";
import { SynthesisBanner } from "@/components/today/synthesis-banner";
import { ShareDigestButton } from "@/components/today/share-digest-button";
import type { PaperItem } from "@/lib/types";
import { NoiseOverlay } from "@/components/noise-overlay";
import { PaperCard } from "@/components/paper-card";
import { pendingPaperIds, setPendingSharedPaper } from "@/lib/shared-saves";
import { ACID_GREEN, ActionButton, BODY_SM, BODY_STYLE, BORDER, INK, Label, PageLoader, SiteHeader, SURFACE } from "@/components/design-system";

interface Digest {
  id: string;
  theme: string | null;
  synthesisContent: string | null;
  keyConcepts: string[];
  starred: boolean | null;
  date: string;
}

export default function DigestPermalink() {
  const params = useParams();
  const id = params.id as string;
  const { status: authStatus } = useSession();
  const [digest, setDigest] = useState<Digest | null>(null);
  const [papers, setPapers] = useState<PaperItem[]>([]);
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());
  const [deviceSavedIds, setDeviceSavedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loggedIn = authStatus === "authenticated";

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/digest/${id}`);
        if (!res.ok) {
          setError(res.status === 404 ? "Digest not found" : "Failed to load digest");
          return;
        }
        const data = await res.json();
        setDigest(data.digest);
        setPapers(data.papers);
      } catch {
        setError("Failed to load digest");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  useEffect(() => {
    setDeviceSavedIds(pendingPaperIds(id));
  }, [id]);

  useEffect(() => {
    if (!loggedIn) return;
    const loadBookmarks = () => {
      fetch("/api/papers/bookmarks", { cache: "no-store" })
        .then((response) => response.ok ? response.json() : { ids: [] })
        .then((data) => setBookmarkedIds(new Set(data.ids ?? [])))
        .catch(() => {});
    };
    loadBookmarks();
    window.addEventListener("shared-saves-synced", loadBookmarks);
    return () => window.removeEventListener("shared-saves-synced", loadBookmarks);
  }, [loggedIn]);

  const handleDeviceSave = (paper: PaperItem, saved: boolean) => {
    setDeviceSavedIds(setPendingSharedPaper(id, paper.id, saved));
  };

  if (loading) return <PageLoader />;

  if (error || !digest) {
    return (
      <div className="flex min-h-screen items-center justify-center flex-col gap-4" style={{ background: SURFACE }}>
        <Label>{error || "Digest not found"}</Label>
        <Link href="/" style={{ ...BODY_STYLE, color: INK, textDecoration: "underline", textUnderlineOffset: 4 }}>
          Go to today&apos;s digest
        </Link>
      </div>
    );
  }

  const openSource = (p: PaperItem) => p.sourceUrl && window.open(p.sourceUrl, "_blank", "noopener,noreferrer");

  return (
    <div className="relative min-h-screen" style={{ background: SURFACE }}>
      <NoiseOverlay />

      {/* The shared page stays useful on either side of authentication. */}
      <SiteHeader
        right={
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <ShareDigestButton digestId={digest.id} theme={digest.theme} compact />
            {loggedIn ? (
              <ActionButton variant="outline" shadow={false} style={{ padding: "7px 12px" }} onClick={() => { window.location.href = "/"; }}>
                Open app
              </ActionButton>
            ) : (
              <ActionButton
                variant="primary"
                shadow={false}
                style={{ padding: "7px 12px" }}
                onClick={() => signIn("google", { redirectTo: window.location.href })}
              >
                Sign in
              </ActionButton>
            )}
          </div>
        }
      />

      {/* Content */}
      <div className="grid grid-cols-1 md:grid-cols-[5fr_minmax(340px,2fr)] w-full" style={{ position: "relative", zIndex: 10 }}>
        {/* Left: synthesis */}
        <div className="px-4 md:px-10 pt-6 md:pt-8 pb-6 md:pb-8">
          <Label style={{ marginBottom: 16 }}>{digest.date}</Label>

          {!loggedIn && deviceSavedIds.size > 0 && (
            <div style={{ border: BORDER, padding: "12px 14px", marginBottom: 22, background: SURFACE }}>
              <p style={{ ...BODY_SM, color: ACID_GREEN, fontWeight: 600, margin: 0 }}>
                Saved on this device.
              </p>
              <p style={{ ...BODY_SM, margin: "2px 0 0" }}>
                Sign in to keep this digest in your history and {deviceSavedIds.size === 1 ? "this paper" : `these ${deviceSavedIds.size} papers`} in Saved papers.
              </p>
            </div>
          )}

          {digest.synthesisContent && (
            <SynthesisBanner
              synthesis={digest.synthesisContent}
              theme={digest.theme ?? undefined}
              keyConcepts={digest.keyConcepts}
              activeConcept={null}
              onConceptClick={() => {}}
              papers={papers}
              onSelectPaper={openSource}
            />
          )}
        </div>

        {/* Right: sources (desktop) */}
        <div className="hidden md:block pt-8 pb-8 px-4">
          <Label style={{ marginBottom: 20 }}>Referenced sources</Label>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {papers.map((paper, idx) => (
              <PaperCard
                key={paper.id}
                paper={paper}
                index={idx}
                size="compact"
                loggedIn={loggedIn}
                initialBookmarked={bookmarkedIds.has(paper.id) || deviceSavedIds.has(paper.id)}
                onSignedOutSaveChange={authStatus === "unauthenticated" ? handleDeviceSave : undefined}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Mobile: sources below */}
      <div className="block md:hidden px-4 pb-20" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Label>Referenced sources</Label>
        {papers.map((paper, idx) => (
          <PaperCard
            key={paper.id}
            paper={paper}
            index={idx}
            size="compact"
            loggedIn={loggedIn}
            initialBookmarked={bookmarkedIds.has(paper.id) || deviceSavedIds.has(paper.id)}
            onSignedOutSaveChange={authStatus === "unauthenticated" ? handleDeviceSave : undefined}
          />
        ))}
      </div>
    </div>
  );
}
