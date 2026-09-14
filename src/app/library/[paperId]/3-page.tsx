"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { signIn, useSession } from "next-auth/react";
import type { PaperItem } from "@/lib/types";
import { NoiseOverlay } from "@/components/noise-overlay";
import { ReadingPaperDetail } from "@/components/vault/reading-paper-detail";
import {
  ActionButton, BODY_STYLE, BORDER, DIM, DISPLAY_LG, Label, PageLoader, SiteHeader, SURFACE,
} from "@/components/design-system";

/*
 * /library/[paperId] — the reading view, with an address.
 *
 * This page is the whole point of giving the view a URL: a digest email can say
 * "your walkthrough is ready →", the first-save confirmation can link straight
 * at it, and a refresh or a back-button press does the obvious thing. Before
 * this it was a portal overlay the vault handed a paper object to, reachable
 * only by two clicks from inside the app and linkable by nothing.
 *
 * There is no intercepted route: the reading view was already full-bleed, so
 * the overlay was never buying a layered presentation — only losing the URL.
 * The vault navigates here.
 */
export default function LibraryPaperPage() {
  const params = useParams();
  const router = useRouter();
  const paperId = params.paperId as string;
  const { status } = useSession();

  const [paper, setPaper] = useState<PaperItem | null>(null);
  const [index, setIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "loading") return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/papers/${paperId}`);
        if (!res.ok) throw new Error(res.status === 404 ? "That paper isn't here." : "Couldn't load that paper.");
        const data = await res.json();
        if (cancelled) return;
        setPaper(data.paper);
        // The hue follows the paper's position in the digest it came from, so
        // the page wears the same wash as the card it was surfaced on.
        setIndex(data.paper?.sourceIndex ?? 0);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Couldn't load that paper.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [paperId, status]);

  const shell = (children: React.ReactNode) => (
    <div className="relative min-h-screen flex flex-col" style={{ background: SURFACE }}>
      <NoiseOverlay />
      <SiteHeader />
      <main className="relative z-10 flex-1">{children}</main>
    </div>
  );

  if (status === "loading" || (status === "authenticated" && loading)) {
    return shell(<PageLoader />);
  }

  if (status === "unauthenticated") {
    // A stranger landing from a shared link has no library - say what the
    // paper IS (the same card facts the public digest shows) before asking
    // for the account. The walkthrough itself stays behind sign-in.
    return shell(
      <div className="flex flex-col py-24 gap-5 px-4" style={{ maxWidth: 760, margin: "0 auto" }}>
        {paper ? (
          <>
            <div style={{ border: BORDER, padding: "20px 22px", background: SURFACE }}>
              <Label>{paper.digestTheme ? "From the digest" : "Paper"}</Label>
              <h1 style={{ ...DISPLAY_LG, margin: "10px 0 6px" }}>{paper.title}</h1>
              <p style={{ ...BODY_STYLE, color: DIM, margin: 0 }}>
                {[paper.authors?.join(", "), paper.source, paper.year].filter(Boolean).join(" · ")}
              </p>
              {paper.summary && (
                <p style={{ ...BODY_STYLE, margin: "14px 0 0" }}>{paper.summary}</p>
              )}
            </div>
            <div className="flex flex-col items-start gap-4">
              <p style={{ ...BODY_STYLE, color: DIM, margin: 0, maxWidth: 420 }}>
                Sign in to read the full walkthrough - the findings, the method, and the companion that answers questions about it.
              </p>
              <ActionButton variant="primary" onClick={() => signIn("google")}>Sign in</ActionButton>
            </div>
          </>
        ) : (
          <PageLoader />
        )}
      </div>
    );
  }

  if (error || !paper) {
    return shell(
      <div className="flex flex-col items-center justify-center py-24 gap-5 px-4">
        <h1 style={{ ...DISPLAY_LG, textAlign: "center", margin: 0 }}>{error ?? "That paper isn't here."}</h1>
        <ActionButton onClick={() => router.push("/")}>Back to the digest</ActionButton>
      </div>
    );
  }

  return shell(
    <ReadingPaperDetail
      paper={paper}
      index={index}
      onBack={() => router.back()}
    />
  );
}
