"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Settings, LogOut, X } from "lucide-react";
import { useSession as useAuthSession } from "next-auth/react";

export type SettingsTab = "account";

interface SettingsDialogProps {
  session: {
    apiKey: string;
    provider: string;
    model: string;
    baseUrl: string;
  };
  updateSession: (updates: Record<string, unknown>) => void;
  onRefreshDigest?: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  startTab?: SettingsTab;
}

export function SettingsDialog({ open: controlledOpen, onOpenChange }: SettingsDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = (v: boolean) => { isControlled ? onOpenChange?.(v) : setInternalOpen(v); };
  const { data: authSession } = useAuthSession();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!isControlled && (
        <DialogTrigger render={<Button variant="ghost" size="icon" />}>
          <Settings className="size-4" />
        </DialogTrigger>
      )}
      <DialogContent
        className="flex flex-col p-0 gap-0"
        style={{ width: "100%", height: "90vh", maxWidth: "880px", maxHeight: "90vh", borderRadius: 0 }}
        showCloseButton={false}
      >
        {/* ── Top bar ── */}
        <header
          className="sticky top-0 z-40 flex items-center justify-between px-4 md:px-8"
          style={{ borderBottom: "1px solid #1a1a1a", background: "white", height: "52px", flexShrink: 0 }}
        >
          <span style={{ fontSize: "1.25rem", fontWeight: 900, letterSpacing: "0.2em", textTransform: "uppercase", color: "#1a1a1a", fontFamily: "var(--font-display), sans-serif" }}>
            LEARNING ET AL.
          </span>
          <button
            onClick={() => setOpen(false)}
            className="flex items-center justify-center text-[#888] hover:text-[#1a1a1a] transition-colors"
            style={{ background: "none", border: "none", cursor: "pointer", padding: "8px" }}
            title="Close"
          >
            <X className="size-5" />
          </button>
        </header>

        {/* ── Account content ── */}
        <main className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto px-5 py-6 md:p-10">
            <h3 style={{ fontSize: "2rem", fontWeight: 800, fontFamily: "var(--font-display), sans-serif", marginBottom: "8px", letterSpacing: "-0.02em" }}>
              Account
            </h3>
            {authSession?.user && (
              <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "32px", paddingBottom: "24px", borderBottom: "1px solid #e5e7eb" }}>
                {authSession.user.image && (
                  <img src={authSession.user.image} alt="" style={{ width: "40px", height: "40px", borderRadius: "50%", border: "1.5px solid #ddd" }} />
                )}
                <div>
                  <div style={{ fontWeight: 700, fontSize: "0.9rem" }}>{authSession.user.name}</div>
                  <div style={{ fontSize: "0.8rem", color: "#888" }}>{authSession.user.email}</div>
                </div>
              </div>
            )}
            <button
              onClick={() => {
                localStorage.removeItem("pp_session");
                window.location.href = "/api/logout";
              }}
              className="flex items-center gap-2 hover:bg-[#1a1a1a] hover:text-white transition-colors"
              style={{
                border: "2px solid #1a1a1a", padding: "10px 20px",
                background: "white", cursor: "pointer",
                fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase",
                letterSpacing: "1.5px", fontFamily: "var(--font-mono), monospace",
              }}
            >
              <LogOut className="size-3.5" />
              Sign out
            </button>
          </div>
        </main>
      </DialogContent>
    </Dialog>
  );
}
