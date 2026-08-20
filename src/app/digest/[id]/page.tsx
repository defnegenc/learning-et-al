"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { signIn, useSession } from "next-auth/react";
import { BriefDigest } from "@/components/today/brief-digest";
import { DigestHeader } from "@/components/today/digest-header";
import { splitSynthesisTheme } from "@/components/today/synthesis-text";
import { ShareDigestButton } from "@/components/today/share-digest-button";
import type { PaperItem } from "@/lib/types";
import { NoiseOverlay } from "@/components/noise-overlay";
import { pendingPaperIds, setPendingSharedPaper } from "@/lib/shared-saves";
import { ACID_GREEN, ActionButton, BODY_SM, BODY_STYLE, BORDER, DISPLAY, INK, Label, PageLoader, SiteHeader, SURFACE } from "@/components/design-system";

interface Digest {
  id: string;
  theme: string | null;
  synthesisContent: string | null;
  keyConcepts: string[];
  seedInterests?: { keyword: string; field: string }[];
  gist?: string | null;
  starred: boolean | null;
  date: string;
}

export default function DigestPermalink() {
  const params = useParams();
  const id = params.id as string;
  const { data: authSession, status: authStatus } = useSession();
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

  const displayDate = new Date(`${digest.date}T12:00:00`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const accountName = authSession?.user?.name || authSession?.user?.email || "Signed in";
  const displayTheme = splitSynthesisTheme(digest.synthesisContent || "", digest.theme ?? undefined).displayTheme;

  return (
    <div className="relative min-h-screen" style={{ background: SURFACE }}>
      <NoiseOverlay />

      {/* The shared page stays useful on either side of authentication. */}
      <SiteHeader
        right={
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <ShareDigestButton digestId={digest.id} theme={displayTheme} compact />
            {loggedIn ? (
              <>
                <span
                  title={`Signed in as ${accountName}`}
                  style={{ ...BODY_SM, color: ACID_GREEN, fontWeight: 600, whiteSpace: "nowrap" }}
                >
                  Signed in
                </span>
                <ActionButton variant="outline" shadow={false} style={{ padding: "7px 12px" }} onClick={() => { window.location.href = "/"; }}>
                  Open app
                </ActionButton>
              </>
            ) : authStatus === "unauthenticated" ? (
              <ActionButton
                variant="primary"
                shadow={false}
                style={{ padding: "7px 12px" }}
                onClick={() => signIn("google", { redirectTo: window.location.href })}
              >
                Sign in
              </ActionButton>
            ) : null}
          </div>
        }
      />

      {/* A shared digest is a reading surface, not a second app layout. Render
          the same fully revealed brief used when its author revisits it. */}
      <main
        className="px-4 md:px-8 pt-8 md:pt-12 pb-20"
        style={{ position: "relative", zIndex: 10, maxWidth: 760, margin: "0 auto" }}
      >
        <div style={{ marginBottom: 28 }}>
          <Label style={{ marginBottom: 16 }}>{displayDate}</Label>

          {displayTheme && (
            <h1
              style={{
                fontFamily: DISPLAY,
                fontSize: "clamp(2.75rem, 7vw, 4rem)",
                lineHeight: 1.12,
                fontWeight: 700,
                letterSpacing: "-0.055em",
                color: INK,
                margin: "0 0 28px",
              }}
            >
              {displayTheme}
            </h1>
          )}

          <DigestHeader
            seedInterests={digest.seedInterests}
            gist={digest.gist}
            keyConcepts={digest.keyConcepts}
            isLoggedIn={loggedIn}
            onSignIn={() => signIn("google", { redirectTo: window.location.href })}
          />
        </div>

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
          <BriefDigest
            revealAll
            synthesis={digest.synthesisContent}
            theme={displayTheme}
            keyConcepts={digest.keyConcepts}
            papers={papers}
            digestId={digest.id}
            loggedIn={loggedIn}
            savedIds={new Set([...bookmarkedIds, ...deviceSavedIds])}
            onSignedOutSaveChange={authStatus === "unauthenticated" ? handleDeviceSave : undefined}
          />
        )}
      </main>
    </div>
  );
}
