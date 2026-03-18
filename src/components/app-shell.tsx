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

        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveTab("today")}
            style={{
              padding: "6px 16px",
              fontSize: "0.8rem",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "2px",
              fontFamily: "var(--font-mono), monospace",
              border: activeTab === "today" ? "2px solid #1a1a1a" : "2px solid transparent",
              background: activeTab === "today" ? "#1a1a1a" : "transparent",
              color: activeTab === "today" ? "white" : "#888",
              boxShadow: activeTab === "today" ? "2px 2px 0px 0px rgba(0,0,0,1)" : "none",
              transition: "all 0.15s ease",
              cursor: "pointer",
            }}
            onMouseEnter={(e) => {
              if (activeTab !== "today") {
                (e.currentTarget as HTMLElement).style.border = "2px solid #1a1a1a";
              }
            }}
            onMouseLeave={(e) => {
              if (activeTab !== "today") {
                (e.currentTarget as HTMLElement).style.border = "2px solid transparent";
              }
            }}
          >
            TODAY
          </button>
          <button
            onClick={() => setActiveTab("vault")}
            style={{
              padding: "6px 16px",
              fontSize: "0.8rem",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "2px",
              fontFamily: "var(--font-mono), monospace",
              border: activeTab === "vault" ? "2px solid #1a1a1a" : "2px solid transparent",
              background: activeTab === "vault" ? "#1a1a1a" : "transparent",
              color: activeTab === "vault" ? "white" : "#888",
              boxShadow: activeTab === "vault" ? "2px 2px 0px 0px rgba(0,0,0,1)" : "none",
              transition: "all 0.15s ease",
              cursor: "pointer",
            }}
            onMouseEnter={(e) => {
              if (activeTab !== "vault") {
                (e.currentTarget as HTMLElement).style.border = "2px solid #1a1a1a";
              }
            }}
            onMouseLeave={(e) => {
              if (activeTab !== "vault") {
                (e.currentTarget as HTMLElement).style.border = "2px solid transparent";
              }
            }}
          >
            VAULT
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
