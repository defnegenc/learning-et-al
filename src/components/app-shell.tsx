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
    <div className="relative min-h-screen flex flex-col" style={{ background: "#e8e8e8" }}>
      <NoiseOverlay />

      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-[#1a1a1a]" style={{ borderWidth: "1.5px", background: "#e8e8e8" }}>
        <div className="relative flex items-center justify-center h-12">
          {/* Horizontal line behind */}
          <div className="absolute inset-x-0 top-1/2 h-[1.5px] bg-[#1a1a1a]" />

          {/* Centered title box */}
          <div className="relative z-10 border border-[#1a1a1a] px-6 py-1" style={{ borderWidth: "1.5px", background: "#e8e8e8" }}>
            <h1 className="text-xs font-bold uppercase tracking-[3px] text-[#1a1a1a]" style={{ fontFamily: '"Courier New", Courier, monospace' }}>
              LEARNING ET AL.
            </h1>
          </div>

          {/* Settings button - right side */}
          <div className="absolute right-4 z-10">
            <SettingsDialog session={session} updateSession={updateSession} />
          </div>
        </div>

        {/* Tab buttons */}
        <div className="flex items-center gap-0 border-t border-[#1a1a1a]" style={{ borderTopWidth: "1.5px" }}>
          <button
            onClick={() => setActiveTab("today")}
            className={`px-6 py-1.5 text-[0.65rem] font-bold uppercase tracking-[2px] transition-colors border-r border-[#1a1a1a] ${
              activeTab === "today"
                ? "bg-[#1a1a1a] text-[#e8e8e8]"
                : "text-[#1a1a1a] hover:bg-[#d8d8d8]"
            }`}
            style={{ fontFamily: '"Courier New", Courier, monospace', borderRightWidth: "1.5px" }}
          >
            TODAY
          </button>
          <button
            onClick={() => setActiveTab("vault")}
            className={`px-6 py-1.5 text-[0.65rem] font-bold uppercase tracking-[2px] transition-colors border-r border-[#1a1a1a] ${
              activeTab === "vault"
                ? "bg-[#1a1a1a] text-[#e8e8e8]"
                : "text-[#1a1a1a] hover:bg-[#d8d8d8]"
            }`}
            style={{ fontFamily: '"Courier New", Courier, monospace', borderRightWidth: "1.5px" }}
          >
            VAULT
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className="relative z-10 flex-1">
        {activeTab === "today" && <TodayPage session={session} />}
        {activeTab === "vault" && (
          <div className="p-4">
            <VaultPage session={session} />
          </div>
        )}
      </main>

      {/* Footer */}
      <footer
        className="relative z-10 border-t border-[#1a1a1a] px-4 py-2 flex items-center justify-between"
        style={{ borderTopWidth: "1.5px", fontFamily: '"Courier New", Courier, monospace' }}
      >
        <div className="flex items-center gap-3">
          <span className="status-dot" />
          <span className="text-[0.6rem] uppercase tracking-[2px] text-[#555]">
            SYSTEM: ACTIVE
          </span>
        </div>
        <div className="text-[0.6rem] uppercase tracking-[2px] text-[#555]">
          LAST_SYNC: {new Date().toLocaleTimeString("en-US", { hour12: false })} // NODE_COUNT: {session.userId ? "1" : "0"}
        </div>
        <div className="text-[0.6rem] uppercase tracking-[2px] text-[#555]">
          V0.1.0 // LEARNING_ET_AL
        </div>
      </footer>
    </div>
  );
}
