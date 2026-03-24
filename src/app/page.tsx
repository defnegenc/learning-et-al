"use client";

import { useState, useEffect } from "react";
import { useSession } from "@/lib/hooks/use-session";
import { useSession as useAuthSession, signIn } from "next-auth/react";
import { Onboarding } from "@/components/onboarding";
import { AppShell } from "@/components/app-shell";
import { PublicDigest } from "@/components/public-digest";

export default function Home() {
  const { session, updateSession, loaded } = useSession();
  const { data: authSession, status: authStatus } = useAuthSession();
  const [showAuthModal, setShowAuthModal] = useState(true);

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
  }, [authStatus, authSession, session.userId, session.isSetUp, updateSession]);

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

  // Signed in but no interests yet — onboard (skip API key if invite code was used)
  if (session.userId) {
    return (
      <Onboarding
        skipApiKey={!!session.apiKey}
        defaultApiKey={session.apiKey}
        defaultProvider={(session.provider || "gemini") as "openai" | "anthropic" | "gemini" | "other"}
        onComplete={({ apiKey, provider, model, baseUrl, userId, contentMix }) => {
          updateSession({ apiKey, provider, model, baseUrl, userId, isSetUp: true, contentMix });
        }}
      />
    );
  }

  // Not signed in — public digest with auth overlay
  return (
    <div className="relative min-h-screen flex flex-col" style={{ background: "white" }}>
      <header
        className="sticky top-0 z-40 flex items-center justify-between px-5 md:px-8"
        style={{ borderBottom: "4px solid #1a1a1a", background: "white", height: "64px" }}
      >
        <h1 style={{
          fontSize: "1.25rem", fontWeight: 900, letterSpacing: "0.2em",
          textTransform: "uppercase", color: "#1a1a1a",
          fontFamily: "var(--font-display), sans-serif",
        }}>
          LEARNING ET AL.
        </h1>
        <button
          onClick={() => { setShowAuthModal(true); }}
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

      <main className="flex-1">
        <PublicDigest onSignIn={() => { setShowAuthModal(true); }} />
      </main>

      {/* Auth modal */}
      {showAuthModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}
        >
          <div style={{
            background: "white", border: "4px solid #1a1a1a",
            boxShadow: "12px 12px 0px 0px rgba(0,0,0,1)",
            padding: "48px 40px", maxWidth: "420px", width: "calc(100% - 2rem)",
            textAlign: "center",
          }}>

            {/* Step 1: Sign in or Guest */}
            {modalStep === "main" && (
              <>
                <h2 style={{
                  fontSize: "1.5rem", fontWeight: 800,
                  fontFamily: "var(--font-display), sans-serif",
                  letterSpacing: "-0.02em", marginBottom: "8px",
                }}>
                  Your daily research companion
                </h2>
                <p style={{ fontSize: "0.9rem", color: "#666", marginBottom: "28px", lineHeight: 1.6 }}>
                  Every day, we find research papers and news that connect in surprising ways. Sign in to get your own personalized digest.
                </p>

                <button
                  onClick={() => signIn("google")}
                  style={{
                    width: "100%", padding: "14px", background: "#1a1a1a", color: "white",
                    border: "2px solid #1a1a1a", fontSize: "0.8rem", fontWeight: 700,
                    textTransform: "uppercase", letterSpacing: "2px",
                    fontFamily: "var(--font-mono), monospace", cursor: "pointer",
                    boxShadow: "4px 4px 0px 0px rgba(0,0,0,1)", marginBottom: "16px",
                  }}
                >
                  Sign in with Google
                </button>

                <button
                  onClick={() => setShowAuthModal(false)}
                  style={{
                    width: "100%", padding: "12px", background: "white", color: "#aaa",
                    border: "none", fontSize: "0.75rem", fontWeight: 600,
                    fontFamily: "var(--font-mono), monospace", cursor: "pointer",
                    textTransform: "uppercase", letterSpacing: "1.5px",
                  }}
                >
                  Continue as Guest
                </button>
              </>
            )}

          </div>
        </div>
      )}
    </div>
  );
}
