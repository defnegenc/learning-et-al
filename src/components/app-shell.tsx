"use client";

import { useState, useRef, useEffect } from "react";
import { BookOpen, Archive, Settings, BarChart3 } from "lucide-react";
import { AdminDashboard } from "@/components/admin-dashboard";
import { TodayPage } from "@/components/today/today-page";
import { VaultPage } from "@/components/vault/vault-page";
import { SettingsDialog } from "@/components/settings-dialog";
import { NoiseOverlay } from "@/components/noise-overlay";
import type { SettingsTab } from "@/components/settings-dialog";

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
  const [activeTab, setActiveTab] = useState<"today" | "vault" | "admin">("today");
  const [adminVerified, setAdminVerified] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<SettingsTab>("api");

  useEffect(() => {
    if (!session.userId) return;
    fetch("/api/admin/check").then(r => { if (r.ok) setAdminVerified(true); }).catch(() => {});
  }, [session.userId]);

  const refreshDigestRef = useRef<(() => void) | null>(null);

  const openSettings = (tab: SettingsTab = "api") => {
    setSettingsTab(tab);
    setSettingsOpen(true);
  };

  return (
    <div className="relative min-h-screen flex flex-col" style={{ background: "white" }}>
      <NoiseOverlay />

      {/* Header */}
      <header
        className="sticky top-0 z-40 flex items-center justify-between px-4 md:px-8"
        style={{ borderBottom: "1px solid #1a1a1a", background: "white", height: "52px" }}
      >
        {/* Logo */}
        <h1
          className="hidden md:block"
          style={{
            fontSize: "1.25rem", fontWeight: 900, letterSpacing: "0.2em",
            textTransform: "uppercase", color: "#1a1a1a",
            fontFamily: "var(--font-display), sans-serif",
          }}
        >
          LEARNING ET AL.
        </h1>
        <span
          className="block md:hidden"
          style={{
            fontSize: "0.8rem", fontWeight: 900, textTransform: "uppercase",
            letterSpacing: "0.15em", color: "#1a1a1a",
            fontFamily: "var(--font-display), sans-serif",
          }}
        >
          Learning et al.
        </span>

        {/* Right side: nav tabs + settings */}
        <div className="flex items-center gap-1 md:gap-0">
          {/* Desktop nav tabs */}
          <div className="hidden md:flex items-center gap-6 mr-4">
            {(["today", "vault"] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  padding: "4px 0", fontSize: "0.625rem", fontWeight: 600,
                  textTransform: "uppercase", letterSpacing: "0.12em",
                  fontFamily: "var(--font-mono), monospace",
                  border: "none", background: "transparent",
                  color: activeTab === tab ? "#1a1a1a" : "#999",
                  borderBottom: activeTab === tab ? "1.5px solid #1a1a1a" : "1.5px solid transparent",
                  cursor: "pointer", transition: "color 0.15s",
                }}
              >
                {tab}
              </button>
            ))}
            {adminVerified && (
              <button
                onClick={() => setActiveTab("admin")}
                style={{
                  padding: "4px 0", fontSize: "0.625rem", fontWeight: 600,
                  textTransform: "uppercase", letterSpacing: "0.12em",
                  fontFamily: "var(--font-mono), monospace",
                  border: "none", background: "transparent",
                  color: activeTab === "admin" ? "#1a1a1a" : "#999",
                  borderBottom: activeTab === "admin" ? "1.5px solid #1a1a1a" : "1.5px solid transparent",
                  cursor: "pointer", transition: "color 0.15s",
                }}
              >
                admin
              </button>
            )}
          </div>

          {/* Settings gear — opens to API Key tab */}
          <button
            onClick={() => openSettings("api")}
            title="Settings"
            style={{ background: "none", border: "none", cursor: "pointer", padding: "6px", color: "#888" }}
            className="hover:text-[#1a1a1a] transition-colors"
          >
            <Settings size={16} />
          </button>

          {/* Controlled dialog (no trigger needed — opened via buttons above) */}
          <SettingsDialog
            session={session}
            updateSession={updateSession}
            onRefreshDigest={() => refreshDigestRef.current?.()}
            open={settingsOpen}
            onOpenChange={setSettingsOpen}
            startTab={settingsTab}
          />
        </div>
      </header>

      <main className="relative z-10 flex-1 pb-16 md:pb-0">
        <div style={{ display: activeTab === "today" ? "contents" : "none" }}>
          <TodayPage
            session={session}
            isAdmin={adminVerified}
            onRegisterRefresh={(fn) => { refreshDigestRef.current = fn; }}
          />
        </div>
        <div style={{ display: activeTab === "vault" ? "contents" : "none" }}>
          <VaultPage session={session} />
        </div>
        {adminVerified && (
          <div style={{ display: activeTab === "admin" ? "contents" : "none" }}>
            <AdminDashboard />
          </div>
        )}
      </main>

      {/* Mobile bottom nav */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 flex md:hidden"
        style={{ borderTop: "3px solid #1a1a1a", background: "white" }}
      >
        <button
          onClick={() => setActiveTab("today")}
          className="flex-1 flex flex-col items-center gap-1 py-3"
          style={{
            background: activeTab === "today" ? "#1a1a1a" : "white",
            color: activeTab === "today" ? "white" : "#888",
            border: "none", cursor: "pointer", transition: "all 0.15s",
          }}
        >
          <BookOpen size={18} />
          <span style={{ fontSize: "0.55rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "1.5px", fontFamily: "var(--font-mono), monospace" }}>
            Today
          </span>
        </button>
        <button
          onClick={() => setActiveTab("vault")}
          className="flex-1 flex flex-col items-center gap-1 py-3"
          style={{
            background: activeTab === "vault" ? "#1a1a1a" : "white",
            color: activeTab === "vault" ? "white" : "#888",
            border: "none", cursor: "pointer",
            borderLeft: "2px solid #1a1a1a", transition: "all 0.15s",
          }}
        >
          <Archive size={18} />
          <span style={{ fontSize: "0.55rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "1.5px", fontFamily: "var(--font-mono), monospace" }}>
            Vault
          </span>
        </button>
        {adminVerified && (
          <button
            onClick={() => setActiveTab("admin")}
            className="flex-1 flex flex-col items-center gap-1 py-3"
            style={{
              background: activeTab === "admin" ? "#1a1a1a" : "white",
              color: activeTab === "admin" ? "white" : "#888",
              border: "none", cursor: "pointer",
              borderLeft: "2px solid #1a1a1a", transition: "all 0.15s",
            }}
          >
            <BarChart3 size={18} />
            <span style={{ fontSize: "0.55rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "1.5px", fontFamily: "var(--font-mono), monospace" }}>
              Admin
            </span>
          </button>
        )}
      </nav>
    </div>
  );
}
