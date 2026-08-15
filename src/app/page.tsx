"use client";

import { useState, useEffect } from "react";
import { useSession } from "@/lib/hooks/use-session";
import { useSession as useAuthSession, signIn } from "next-auth/react";
import { Onboarding } from "@/components/onboarding";
import { AppShell } from "@/components/app-shell";
import { TodayPage } from "@/components/today/today-page";
import { NoiseOverlay } from "@/components/noise-overlay";
import { ActionButton, PageLoader, SiteHeader, SURFACE } from "@/components/design-system";

export default function Home() {
  const { session, updateSession, loaded } = useSession();
  const { data: authSession, status: authStatus } = useAuthSession();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  // Re-validate invite code on load to pick up server-side config changes
  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem("pp_session") || "{}");
    // no-op: invite code no longer returns credentials
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync Auth.js session → local session + check if returning user
  useEffect(() => {
    if (authStatus === "authenticated" && authSession?.user?.id) {
      if (!session.userId) {
        updateSession({ userId: authSession.user.id });
      }
      // Check admin status once — admin uses server-side env credentials, skips API key prompt
      if (isAdmin === null) {
        fetch("/api/admin/check")
          .then(r => setIsAdmin(r.ok))
          .catch(() => setIsAdmin(false));
      }
      // Check if user already has interests (returning user — skip onboarding)
      if (!session.isSetUp && authSession.user.id) {
        fetch("/api/interests")
          .then(r => r.json())
          .then(data => {
            if (data.interests && data.interests.length >= 3) {
              updateSession({ userId: authSession.user!.id, isSetUp: true });
            }
          })
          .catch(() => {});
      }
    }
  }, [authStatus, authSession, session.userId, session.isSetUp, updateSession, isAdmin]);

  // Auth resolving. The chrome renders immediately and the loader sits exactly
  // where TodayPage's own first-load loader sits, so auth → digest reads as ONE
  // wait with one indicator rather than two spinners in a row.
  if (!loaded || authStatus === "loading") {
    return (
      <div className="relative min-h-screen flex flex-col" style={{ background: SURFACE }}>
        <NoiseOverlay />
        <SiteHeader />
        <main className="relative z-10 flex-1"><PageLoader /></main>
      </div>
    );
  }

  // Fully set up — show the app
  if (session.isSetUp) {
    return <AppShell session={session} updateSession={updateSession} />;
  }

  // Signed in but no interests yet — onboard
  // All users skip the API key step: server falls back to CRON_AI_* env credentials.
  // Users who want to bring their own key can add it later in Settings.
  if (session.userId) {
    return (
      <Onboarding
        skipApiKey
        onComplete={async ({ userId, contentMix }) => {
          fetch("/api/digest/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ force: true }),
          }).catch(() => {});
          updateSession({ userId, isSetUp: true, contentMix });
        }}
      />
    );
  }

  // Not signed in — show same today page layout as logged-in users
  return (
    <div className="relative min-h-screen flex flex-col" style={{ background: SURFACE }}>
      <NoiseOverlay />

      <SiteHeader
        right={
          <ActionButton variant="primary" shadow={false} style={{ padding: "7px 14px" }} onClick={() => signIn("google")}>
            Sign in
          </ActionButton>
        }
      />

      <main className="relative z-10 flex-1">
        <TodayPage onSignIn={() => signIn("google")} />
      </main>
    </div>
  );
}
