"use client";

import { useSession } from "@/lib/hooks/use-session";
import { Onboarding } from "@/components/onboarding";

export default function Home() {
  const { session, updateSession, loaded } = useSession();

  if (!loaded) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!session.isSetUp) {
    return (
      <Onboarding
        onComplete={({ apiKey, provider, model, baseUrl, userId }) => {
          updateSession({
            apiKey,
            provider,
            model,
            baseUrl,
            userId,
            isSetUp: true,
          });
        }}
      />
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950">
      <div className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
        <p className="mt-2 text-muted-foreground">
          Your paper feed is being prepared.
        </p>
      </div>
    </div>
  );
}
