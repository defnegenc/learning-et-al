"use client";

import { SessionProvider } from "next-auth/react";
import type { Session } from "next-auth";
import { PendingSharedSaves } from "@/components/pending-shared-saves";

// `session` is resolved server-side in the root layout and handed over here, so
// the client never spends a round trip on /api/auth/session before it can start
// fetching the digest. Without it, useSession() starts as "loading" and the
// whole first paint waits on that request.
export function Providers({ children, session }: { children: React.ReactNode; session: Session | null }) {
  return (
    <SessionProvider session={session}>
      <PendingSharedSaves />
      {children}
    </SessionProvider>
  );
}
