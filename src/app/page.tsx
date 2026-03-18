"use client";

import { useSession } from "@/lib/hooks/use-session";
import { Onboarding } from "@/components/onboarding";
import { AppShell } from "@/components/app-shell";

export default function Home() {
  const { session, updateSession, loaded } = useSession();

  if (!loaded) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ background: "white" }}>
        <div className="size-6 animate-spin border-[1.5px] border-[#1a1a1a] border-t-transparent" />
      </div>
    );
  }

  if (!session.isSetUp) {
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

  return <AppShell session={session} updateSession={updateSession} />;
}
