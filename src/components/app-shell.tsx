"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Settings, Menu, X } from "lucide-react";
import { AdminDashboard } from "@/components/admin-dashboard";
import { FirstSaveConfirmation, useOpenLibrary } from "@/components/save-nux";
import { TodayPage } from "@/components/today/today-page";
import { VaultPage } from "@/components/vault/vault-page";
import { SettingsDialog } from "@/components/settings-dialog";
import { NoiseOverlay } from "@/components/noise-overlay";
import type { SettingsTab } from "@/components/settings-dialog";
import { BORDER, DISPLAY_SM, HAIRLINE, INK, MUTED, NavTab, SiteHeader, SURFACE } from "@/components/design-system";

interface Session {
  userId: string | null;
  isSetUp: boolean;
}

/** A row in the mobile slide-down menu — Display/SM, 52px tall, thumb-sized. */
function MenuItem({ label, active, onClick, last = false }: {
  label: string;
  active: boolean;
  onClick: () => void;
  last?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        ...DISPLAY_SM,
        display: "block", width: "100%", textAlign: "left",
        padding: "16px 20px", border: "none", background: "transparent",
        borderBottom: last ? "none" : HAIRLINE,
        borderLeft: `2px solid ${active ? INK : "transparent"}`,
        color: active ? INK : MUTED,
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}

interface AppShellProps {
  session: Session;
  updateSession: (updates: Record<string, unknown>) => void;
}

export function AppShell({ session, updateSession }: AppShellProps) {
  const [activeTab, setActiveTab] = useState<"today" | "vault" | "admin">("today");
  const [adminVerified, setAdminVerified] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<SettingsTab>("account");
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!session.userId) return;
    fetch("/api/admin/check").then(r => { if (r.ok) setAdminVerified(true); }).catch(() => {});
  }, [session.userId]);

  // "Go to library →" on the first-save confirmation. The vault listens for the
  // same event and opens on the saved shelf rather than the digest archive.
  useOpenLibrary(useCallback(() => setActiveTab("vault"), []));

  const refreshDigestRef = useRef<(() => void) | null>(null);

  const openSettings = (tab: SettingsTab = "account") => {
    setSettingsTab(tab);
    setSettingsOpen(true);
  };

  return (
    <div className="relative min-h-screen flex flex-col" style={{ background: SURFACE }}>
      <NoiseOverlay />

      <SiteHeader right={
        <div className="flex items-center gap-1 md:gap-0">
          {/* Desktop nav tabs */}
          <div className="hidden md:flex items-center gap-6 mr-4">
            {(["today", "vault"] as const).map(tab => (
              <NavTab key={tab} active={activeTab === tab} onClick={() => setActiveTab(tab)}>{tab}</NavTab>
            ))}
            {adminVerified && (
              <NavTab active={activeTab === "admin"} onClick={() => setActiveTab("admin")}>admin</NavTab>
            )}
          </div>

          {/* Hamburger — mobile only */}
          <button
            className="flex md:hidden items-center justify-center"
            onClick={() => setMenuOpen(v => !v)}
            style={{ background: "none", border: "none", cursor: "pointer", padding: 6, color: MUTED }}
            aria-label="Menu"
          >
            {menuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>

          {/* Settings gear — desktop only */}
          <button
            onClick={() => openSettings("account")}
            title="Settings"
            style={{ background: "none", border: "none", cursor: "pointer", padding: 6, color: MUTED }}
            className="hidden md:flex transition-colors"
          >
            <Settings size={16} />
          </button>

          {/* Controlled dialog (no trigger needed — opened via buttons above) */}
          <SettingsDialog
            updateSession={updateSession}
            onRefreshDigest={() => refreshDigestRef.current?.()}
            open={settingsOpen}
            onOpenChange={setSettingsOpen}
            startTab={settingsTab}
            isAdmin={adminVerified}
            onRegenerate={() => refreshDigestRef.current?.()}
          />
        </div>
      } />

      {/* Mobile slide-down nav menu */}
      {menuOpen && (
        <>
          <div className="fixed inset-0 z-30 md:hidden" onClick={() => setMenuOpen(false)} />
          <div
            className="fixed md:hidden"
            style={{ top: 52, right: 0, left: 0, zIndex: 40, background: SURFACE, borderBottom: BORDER }}
          >
            {([
              { key: "today", label: "Today" },
              { key: "vault", label: "Vault" },
              ...(adminVerified ? [{ key: "admin" as const, label: "Admin" }] : []),
            ] satisfies { key: "today" | "vault" | "admin"; label: string }[]).map(item => (
              <MenuItem
                key={item.key}
                label={item.label}
                active={activeTab === item.key}
                onClick={() => { setActiveTab(item.key); setMenuOpen(false); }}
              />
            ))}
            <MenuItem
              label="Settings"
              active={false}
              last
              onClick={() => { setMenuOpen(false); openSettings("interests"); }}
            />
          </div>
        </>
      )}

      <main className="relative z-10 flex-1 pb-0">
        <div style={{ display: activeTab === "today" ? "contents" : "none" }}>
          <TodayPage
            session={session}
            isAdmin={adminVerified}
            onRegisterRefresh={(fn) => { refreshDigestRef.current = fn; }}
          />
        </div>
        <div style={{ display: activeTab === "vault" ? "contents" : "none" }}>
          <VaultPage />
        </div>
        {adminVerified && (
          <div style={{ display: activeTab === "admin" ? "contents" : "none" }}>
            <AdminDashboard />
          </div>
        )}
      </main>

      {/* The first save, confirmed — and the only place the background reading
          prep is ever mentioned. Mounted on the shell so it survives the tab a
          reader happened to save from. */}
      <FirstSaveConfirmation />
    </div>
  );
}
