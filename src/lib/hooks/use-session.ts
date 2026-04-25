"use client";

import { useState, useEffect } from "react";

interface Session {
  userId: string | null;
  isSetUp: boolean;
  contentMix: number;
  inviteCode?: string;
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
