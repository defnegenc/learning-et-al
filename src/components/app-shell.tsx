"use client";

import { useState, useRef, useEffect } from "react";
import { LogOut, BookOpen, Archive, BarChart3 } from "lucide-react";
import { AdminDashboard } from "@/components/admin-dashboard";
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
  const [activeTab, setActiveTab] = useState<"today" | "vault" | "admin">("today");
  const isAdmin = session.userId === (typeof window !== "undefined" ? undefined : process.env.ADMIN_USER_ID);
  // Check admin via API on mount
  const [adminVerified, setAdminVerified] = useState(false);
  useEffect(() => {
    fetch("/api/admin").then(r => { if (r.ok) setAdminVerified(true); }).catch(() => {});
  }, []);
  const refreshDigestRef = useRef<(() => void) | null>(null);

  return (
    <div className="relative min-h-screen flex flex-col" style={{ background: "white" }}>
      <NoiseOverlay />

      {/* Header */}
      <header
        className="sticky top-0 z-40 flex items-center justify-between px-4 md:px-8"
        style={{ borderBottom: "4px solid #1a1a1a", background: "white", height: "56px" }}
      >
        <h1
          className="hidden md:block"
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

        {/* Mobile: show current section name */}
        <span
          className="block md:hidden"
          style={{
            fontSize: "0.7rem",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "2px",
            color: "#1a1a1a",
            fontFamily: "var(--font-mono), monospace",
          }}
        >
          {activeTab === "today" ? "Today's Digest" : "Vault"}
        </span>

        {/* Desktop tabs */}
        <div className="hidden md:flex items-center gap-1">
          {(["today", "vault", ...(adminVerified ? ["admin" as const] : [])] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: "6px 16px",
                fontSize: "0.8rem",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "2px",
                fontFamily: "var(--font-mono), monospace",
                border: activeTab === tab ? "2px solid #1a1a1a" : "2px solid transparent",
                background: activeTab === tab ? "#1a1a1a" : "transparent",
                color: activeTab === tab ? "white" : "#888",
                boxShadow: activeTab === tab ? "2px 2px 0px 0px rgba(0,0,0,1)" : "none",
                transition: "all 0.15s ease",
                cursor: "pointer",
              }}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 md:gap-2">
          <SettingsDialog
            session={session}
            updateSession={updateSession}
            onRefreshDigest={() => refreshDigestRef.current?.()}
          />
          <button
            onClick={async () => {
              localStorage.removeItem("pp_session");
              await fetch("/api/auth/logout", { method: "POST" });
              window.location.href = "/";
            }}
            title="Sign out"
            style={{ background: "none", border: "none", cursor: "pointer", padding: "6px", color: "#888" }}
            className="hover:text-[#1a1a1a] transition-colors"
          >
            <LogOut size={16} />
          </button>
        </div>
      </header>

      <main className="relative z-10 flex-1 pb-16 md:pb-0">
        {/* Both tabs always mounted */}
        <div style={{ display: activeTab === "today" ? "contents" : "none" }}>
          <TodayPage
            session={session}
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
            border: "none",
            cursor: "pointer",
            transition: "all 0.15s",
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
            border: "none",
            cursor: "pointer",
            borderLeft: "2px solid #1a1a1a",
            transition: "all 0.15s",
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
              border: "none",
              cursor: "pointer",
              borderLeft: "2px solid #1a1a1a",
              transition: "all 0.15s",
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
