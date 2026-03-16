"use client";

import { useState, useEffect } from "react";

interface Session {
  userId: string | null;
  apiKey: string;
  provider: "openai" | "anthropic" | "other";
  model: string;
  baseUrl: string;
  isSetUp: boolean;
}

const DEFAULT_SESSION: Session = {
  userId: null,
  apiKey: "",
  provider: "openai",
  model: "",
  baseUrl: "",
  isSetUp: false,
};

export function useSession() {
  const [session, setSession] = useState<Session>(DEFAULT_SESSION);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("pp_session");
    if (stored) {
      try {
        setSession(JSON.parse(stored));
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
