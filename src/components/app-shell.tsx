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
      <header className="sticky top-0 z-40 border-b border-[#1a1a1a] flex items-center justify-between px-3 md:px-5 h-11" style={{ borderBottomWidth: "1.5px", background: "white" }}>
        <h1
          className="text-[0.6rem] md:text-[0.7rem] font-bold uppercase tracking-[2px] md:tracking-[3px] text-[#1a1a1a]"
          style={{ fontFamily: '"Courier New", Courier, monospace' }}
        >
          LEARNING ET AL.
        </h1>

        <div className="flex items-center gap-0">
          <button
            onClick={() => setActiveTab("today")}
            className={`px-3 md:px-4 py-1 text-[0.6rem] font-bold uppercase tracking-[1px] md:tracking-[2px] transition-colors ${
              activeTab === "today"
                ? "bg-[#1a1a1a] text-[#e8e8e8]"
                : "text-[#888] hover:text-[#1a1a1a]"
            }`}
            style={{ fontFamily: '"Courier New", Courier, monospace' }}
          >
            TODAY
          </button>
          <button
            onClick={() => setActiveTab("vault")}
            className={`px-3 md:px-4 py-1 text-[0.6rem] font-bold uppercase tracking-[1px] md:tracking-[2px] transition-colors ${
              activeTab === "vault"
                ? "bg-[#1a1a1a] text-[#e8e8e8]"
                : "text-[#888] hover:text-[#1a1a1a]"
            }`}
            style={{ fontFamily: '"Courier New", Courier, monospace' }}
          >
            VAULT
          </button>
        </div>

        <SettingsDialog session={session} updateSession={updateSession} />
      </header>

      {/* Main content */}
      <main className="relative z-10 flex-1">
        {activeTab === "today" && <TodayPage session={session} />}
        {activeTab === "vault" && <VaultPage session={session} />}
      </main>

    </div>
  );
}
