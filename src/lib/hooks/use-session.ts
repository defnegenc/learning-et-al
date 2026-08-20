"use client";

import { useState, useEffect } from "react";

interface Session {
  userId: string | null;
  isSetUp: boolean;
  contentMix: number;
  inviteCode?: string;
  /**
   * True between finishing onboarding and the first digest landing. Drives
   * TodayPage's first-run brewing state; TodayPage clears it once a digest
   * arrives. Persisted with the rest of the session so a refresh mid-wait
   * doesn't drop the reader into the generic "check back soon" copy.
   */
  justOnboarded?: boolean;
}

const DEFAULT_SESSION: Session = {
  userId: null,
  isSetUp: false,
  contentMix: 50,
};

export function useSession() {
  const [session, setSession] = useState<Session>(DEFAULT_SESSION);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("pp_session");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setSession({ ...DEFAULT_SESSION, ...parsed });
      } catch {
        // ignore corrupted data
      }
    }
    setLoaded(true);
  }, []);

  const updateSession = (updates: Partial<Session>) => {
    const newSession = { ...session, ...updates };
    setSession(newSession);
    localStorage.setItem("pp_session", JSON.stringify(newSession));
  };

  return { session, updateSession, loaded };
}
