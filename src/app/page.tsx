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

  // Sync Auth.js session → local session
  // When Google sign-in succeeds, authSession has the user but local session doesn't know
  useEffect(() => {
    if (authStatus === "authenticated" && authSession?.user?.id && !session.userId) {
      updateSession({ userId: authSession.user.id });
    }
  }, [authStatus, authSession, session.userId, updateSession]);

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

  // Has a userId (signed in via Google or legacy cookie) but hasn't picked interests yet — onboard
  if (session.userId) {
    return (
      <Onboarding
        onComplete={({ apiKey, provider, model, baseUrl, userId, contentMix }) => {
          updateSession({ apiKey, provider, model, baseUrl, userId, isSetUp: true, contentMix });
        }}
      />
    );
  }

  // Not signed in — show public digest with sign-in overlay
  return (
    <div className="relative min-h-screen flex flex-col" style={{ background: "white" }}>
      {/* Header */}
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
          onClick={() => setShowAuthModal(true)}
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
        <PublicDigest onSignIn={() => setShowAuthModal(true)} />
      </main>

      {/* Auth modal overlay */}
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
                boxShadow: "4px 4px 0px 0px rgba(0,0,0,1)", marginBottom: "12px",
              }}
            >
              Sign in with Google
            </button>
            <button
              onClick={() => setShowAuthModal(false)}
              style={{
                width: "100%", padding: "12px", background: "white", color: "#888",
                border: "2px solid #e5e7eb", fontSize: "0.75rem", fontWeight: 600,
                fontFamily: "var(--font-mono), monospace", cursor: "pointer",
                textTransform: "uppercase", letterSpacing: "1.5px",
              }}
            >
              Continue as Guest
            </button>
            <p style={{ fontSize: "0.7rem", color: "#aaa", marginTop: "8px" }}>
              Browse today&apos;s digest without an account
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
