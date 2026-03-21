"use client";

import { useSession } from "@/lib/hooks/use-session";
import { Onboarding } from "@/components/onboarding";
import { AppShell } from "@/components/app-shell";
import { PublicDigest } from "@/components/public-digest";
import { signIn } from "next-auth/react";

export default function Home() {
  const { session, updateSession, loaded } = useSession();

  if (!loaded) {
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

  // Has a userId (signed in via Google) but hasn't picked interests yet — onboard
  if (session.userId) {
    return (
      <Onboarding
        onComplete={({ apiKey, provider, model, baseUrl, userId, contentMix }) => {
          updateSession({
            apiKey,
            provider,
            model,
            baseUrl,
            userId,
            isSetUp: true,
            contentMix,
          });
        }}
      />
    );
  }

  // Not signed in — show public digest with sign-in CTA
  return (
    <div className="relative min-h-screen flex flex-col" style={{ background: "white" }}>
      {/* Header */}
      <header
        className="sticky top-0 z-40 flex items-center justify-between px-5 md:px-8"
        style={{ borderBottom: "4px solid #1a1a1a", background: "white", height: "64px" }}
      >
        <h1
          style={{
            fontSize: "1.25rem",
            fontWeight: 900,
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: "#1a1a1a",
            fontFamily: "var(--font-display), sans-serif",
          }}
        >
          LEARNING ET AL.
        </h1>
        <button
          onClick={() => signIn("google")}
          style={{
            padding: "8px 20px",
            background: "#1a1a1a",
            color: "white",
            border: "2px solid #1a1a1a",
            fontSize: "0.7rem",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "2px",
            fontFamily: "var(--font-mono), monospace",
            cursor: "pointer",
            boxShadow: "3px 3px 0px 0px rgba(0,0,0,1)",
          }}
        >
          Sign In
        </button>
      </header>

      <main className="flex-1">
        <PublicDigest onSignIn={() => signIn("google")} />
      </main>
    </div>
  );
}
