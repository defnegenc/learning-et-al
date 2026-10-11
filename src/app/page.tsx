"use client";

import { useState, useEffect } from "react";
import { useSession } from "@/lib/hooks/use-session";
import { useSession as useAuthSession, signIn, getSession } from "next-auth/react";
import { Onboarding } from "@/components/onboarding";
import { AppShell } from "@/components/app-shell";
import { TodayPage } from "@/components/today/today-page";
import { NoiseOverlay } from "@/components/noise-overlay";
import { ActionButton, PageLoader, SiteHeader, SURFACE } from "@/components/design-system";

export default function Home() {
  const { session, updateSession, loaded } = useSession();
  const { data: authSession, status: authStatus } = useAuthSession();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  // Set when a signed-in request 401s and the server confirms the session is
  // gone. Auth.js's client status stays "authenticated" until its next refetch,
  // so this is what drops the reader to the signed-out page mid-visit.
  const [expired, setExpired] = useState(false);

  // The app used to render from localStorage alone: `pp_session.isSetUp` showed
  // the signed-in shell even when the server had no session, so every digest,
  // save and admin call 401'd behind a page that looked signed in. The server
  // session is the authority; localStorage only remembers onboarding.
  const signedOut = authStatus === "unauthenticated" || expired;
  const authUserId = authSession?.user?.id;
  const otherAccount = authStatus === "authenticated" && !!authUserId && !!session.userId && session.userId !== authUserId;

  useEffect(() => {
    if (!loaded) return;
    if (signedOut && (session.userId || session.isSetUp)) {
      updateSession({ userId: null, isSetUp: false, justOnboarded: false });
    } else if (otherAccount) {
      // A different Google account on this browser: its setup state is its
      // own, so re-run the interests check below rather than inherit it.
      updateSession({ userId: authUserId, isSetUp: false, justOnboarded: false });
    }
  }, [loaded, signedOut, otherAccount, authUserId, session.userId, session.isSetUp, updateSession]);

  // Mid-visit expiry. Watch same-origin API responses while signed in; on a
  // 401, ask the server whether the session still exists (a 401 alone could
  // be one route's bug) and only then sign the reader out of the page.
  const watching = loaded && authStatus === "authenticated" && !expired;
  useEffect(() => {
    if (!watching) return;
    const original = window.fetch;
    let checking = false;
    window.fetch = async (...args: Parameters<typeof fetch>) => {
      const res = await original(...args);
      if (res.status === 401 && !checking) {
        const raw = args[0] instanceof Request ? args[0].url : String(args[0]);
        const path = new URL(raw, window.location.href);
        if (path.origin === window.location.origin
            && path.pathname.startsWith("/api/")
            && !path.pathname.startsWith("/api/auth/")
            && !path.pathname.startsWith("/api/public/")) {
          checking = true;
          getSession()
            .then(s => { if (!s?.user) setExpired(true); })
            .catch(() => {})
            .finally(() => { checking = false; });
        }
      }
      return res;
    };
    return () => { window.fetch = original; };
  }, [watching]);

  // Sync Auth.js session → local session + check if returning user.
  // Guard on `loaded`: the auth effect overwrites localStorage via updateSession, which
  // spreads the current session object. If it fires before the localStorage hydration
  // effect has run, `session` still holds DEFAULT_SESSION (isSetUp: false) and the
  // spread clobbers the stored isSetUp: true — causing onboarding to flash every refresh.
  useEffect(() => {
    if (!loaded || expired || otherAccount) return;
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
  }, [loaded, expired, otherAccount, authStatus, authSession, session.userId, session.isSetUp, updateSession, isAdmin]);

  // Auth resolving. The chrome renders immediately and the loader sits exactly
  // where TodayPage's own first-load loader sits, so auth → digest reads as ONE
  // wait with one indicator rather than two spinners in a row.
  if (!loaded || authStatus === "loading" || otherAccount) {
    return (
      <div className="relative min-h-screen flex flex-col" style={{ background: SURFACE }}>
        <NoiseOverlay />
        <SiteHeader />
        <main className="relative z-10 flex-1"><PageLoader /></main>
      </div>
    );
  }

  // Fully set up — show the app
  if (!signedOut && session.isSetUp) {
    return <AppShell session={session} updateSession={updateSession} />;
  }

  // Signed in but no interests yet — onboard
  // All users skip the API key step: server falls back to CRON_AI_* env credentials.
  // Users who want to bring their own key can add it later in Settings.
  if (!signedOut && session.userId) {
    return (
      <Onboarding
        skipApiKey
        onComplete={async ({ userId, contentMix }) => {
          fetch("/api/digest/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ force: true }),
          }).catch(() => {});
          // `justOnboarded` is what turns TodayPage's no-digest state into the
          // first-run brewing state — this generation is the one it's waiting on.
          // TodayPage clears the flag when the digest lands.
          updateSession({ userId, isSetUp: true, contentMix, justOnboarded: true });
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
