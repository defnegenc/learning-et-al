"use client";

import { useState } from "react";
import { TodayPage } from "@/components/today/today-page";
import { VaultPage } from "@/components/vault/vault-page";
import { SettingsDialog } from "@/components/settings-dialog";
import { NoiseOverlay } from "@/components/noise-overlay";

interface Session {
  userId: string | null;
  apiKey: string;
  provider: string;
  model: string;
  baseUrl: string;
  isSetUp: boolean;
}

interface AppShellProps {
  session: Session;
  updateSession: (updates: Record<string, unknown>) => void;
}

export function AppShell({ session, updateSession }: AppShellProps) {
  const [activeTab, setActiveTab] = useState<"today" | "vault">("today");

  return (
    <div className="relative min-h-screen flex flex-col" style={{ background: "white" }}>
      <NoiseOverlay />

      {/* Header */}
      <header
        className="sticky top-0 z-40 border-b border-[#1a1a1a] flex items-center justify-between px-5 md:px-8"
        style={{ borderBottomWidth: "1.5px", background: "white", height: "56px" }}
      >
        <h1
          style={{
            fontSize: "1rem",
            fontWeight: 700,
            letterSpacing: "3px",
            textTransform: "uppercase",
            color: "#1a1a1a",
            fontFamily: "var(--font-mono), monospace",
          }}
        >
          LEARNING ET AL.
        </h1>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveTab("today")}
            style={{
              padding: "8px 16px",
              fontSize: "0.85rem",
              fontWeight: activeTab === "today" ? 700 : 400,
              color: activeTab === "today" ? "#1a1a1a" : "#999",
              background: activeTab === "today" ? "#f0f0f0" : "transparent",
              border: "none",
              cursor: "pointer",
              transition: "all 0.15s ease",
              letterSpacing: "0.3px",
            }}
          >
            Today
          </button>
          <button
            onClick={() => setActiveTab("vault")}
            style={{
              padding: "8px 16px",
              fontSize: "0.85rem",
              fontWeight: activeTab === "vault" ? 700 : 400,
              color: activeTab === "vault" ? "#1a1a1a" : "#999",
              background: activeTab === "vault" ? "#f0f0f0" : "transparent",
              border: "none",
              cursor: "pointer",
              transition: "all 0.15s ease",
              letterSpacing: "0.3px",
            }}
          >
            Vault
          </button>
        </div>

        <SettingsDialog session={session} updateSession={updateSession} />
      </header>

      <main className="relative z-10 flex-1">
        {activeTab === "today" && <TodayPage session={session} />}
        {activeTab === "vault" && <VaultPage session={session} />}
      </main>
    </div>
  );
}
