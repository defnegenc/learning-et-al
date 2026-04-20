"use client";

import { useState, useEffect } from "react";
import { useSession } from "@/lib/hooks/use-session";
import { useSession as useAuthSession, signIn } from "next-auth/react";
import { Onboarding } from "@/components/onboarding";
import { AppShell } from "@/components/app-shell";
import { TodayPage } from "@/components/today/today-page";
import { NoiseOverlay } from "@/components/noise-overlay";

export default function Home() {
  const { session, updateSession, loaded } = useSession();
  const { data: authSession, status: authStatus } = useAuthSession();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  // Re-validate invite code on load to pick up server-side config changes
  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem("pp_session") || "{}");
    if (stored.inviteCode && stored.isSetUp) {
      fetch("/api/validate-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: stored.inviteCode }),
      })
        .then(r => r.json())
        .then(data => {
          if (data.valid && data.apiKey) {
            updateSession({ apiKey: data.apiKey, provider: data.provider, model: data.model, baseUrl: data.baseUrl || "" });
          }
        })
        .catch(() => {});
    }
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
              const parsedStored = JSON.parse(localStorage.getItem("pp_session") || "{}");
              updateSession({
                userId: authSession.user!.id,
                isSetUp: true,
                ...(parsedStored.apiKey ? { apiKey: parsedStored.apiKey, provider: parsedStored.provider, model: parsedStored.model, baseUrl: parsedStored.baseUrl } : {}),
              });
            }
          })
          .catch(() => {});
      }
    }
  }, [authStatus, authSession, session.userId, session.isSetUp, updateSession, isAdmin]);

  if (!loaded || authStatus === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ background: "white" }}>
        <div className="size-6 animate-spin border-[1.5px] border-[#1a1a1a] border-t-transparent" />
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
        defaultApiKey={session.apiKey}
        defaultProvider={(session.provider || "gemini") as "openai" | "anthropic" | "gemini" | "other"}
        onComplete={async ({ apiKey, provider, model, baseUrl, userId, contentMix }) => {
          // Kick off first digest generation with shared server-side credentials.
          // Fire-and-forget: users land on the Today page and see "brewing" while it runs.
          fetch("/api/digest/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ apiKey, provider, model, baseUrl, force: true }),
          }).catch(() => {});
          updateSession({ apiKey, provider, model, baseUrl, userId, isSetUp: true, contentMix });
        }}
      />
    );
  }

  // Not signed in — show same today page layout as logged-in users
  return (
    <div className="relative min-h-screen flex flex-col" style={{ background: "white" }}>
      <NoiseOverlay />

      {/* Header — matches AppShell header */}
      <header
        className="sticky top-0 z-40 flex items-center justify-between px-4 md:px-8"
        style={{ borderBottom: "4px solid #1a1a1a", background: "white", height: "56px" }}
      >
        <h1
          className="hidden md:block"
          style={{
            fontSize: "1.25rem", fontWeight: 900, letterSpacing: "0.2em",
            textTransform: "uppercase", color: "#1a1a1a",
            fontFamily: "var(--font-display), sans-serif",
          }}
        >
          LEARNING ET AL.
        </h1>
        <span
          className="block md:hidden"
          style={{
            fontSize: "0.85rem", fontWeight: 900, textTransform: "uppercase",
            letterSpacing: "0.15em", color: "#1a1a1a",
            fontFamily: "var(--font-display), sans-serif",
          }}
        >
          Learning et al.
        </span>

        <button
          onClick={() => signIn("google")}
          style={{
            padding: "8px 20px", background: "#1a1a1a", color: "white",
            border: "2px solid #1a1a1a", fontSize: "0.7rem", fontWeight: 700,
            textTransform: "uppercase", letterSpacing: "2px",
            fontFamily: "var(--font-mono), monospace", cursor: "pointer",
            boxShadow: "3px 3px 0px 0px rgba(0,0,0,1)",
          }}
        >
          Sign In
        </button>
      </header>

      <main className="relative z-10 flex-1">
        <TodayPage onSignIn={() => signIn("google")} />
      </main>
    </div>
  );
}
