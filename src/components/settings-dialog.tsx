"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Settings, Loader2, CheckCircle, RefreshCw, LogOut, X } from "lucide-react";
import { useSession as useAuthSession } from "next-auth/react";
import { FIELD_HIERARCHY } from "@/lib/field-hierarchy";
import type { S2Field } from "@/lib/field-hierarchy";
import { InterestLedger, type CustomTopics } from "@/components/interest-ledger";

export type SettingsTab = "interests" | "account";

interface SelectedTopic {
  keyword: string;
  field: S2Field;
  fieldLabel: string;
  color: string;
}

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
  isAdmin?: boolean;
  onRegenerate?: () => void;
}

export function SettingsDialog({ open: controlledOpen, onOpenChange, startTab, isAdmin, onRegenerate }: SettingsDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = (v: boolean) => { isControlled ? onOpenChange?.(v) : setInternalOpen(v); };
  const [tab, setTab] = useState<SettingsTab>("interests");
  const { data: authSession } = useAuthSession();

  // Interests state
  const [selectedTopics, setSelectedTopics] = useState<SelectedTopic[]>([]);
  const [customTopics, setCustomTopics] = useState<CustomTopics>({});
  const [loadingInterests, setLoadingInterests] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [cadence, setCadence] = useState<"daily" | "biweekly" | "weekly">("daily");

  useEffect(() => {
    if (open) {
      setTab(startTab || "interests");
      loadInterests();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, startTab]);

  async function loadInterests() {
    setLoadingInterests(true);
    try {
      const res = await fetch("/api/interests");
      if (!res.ok) return;
      const data = await res.json();
      const entries: SelectedTopic[] = [];
      const customByField: CustomTopics = {};
      for (const i of (data.interests ?? []) as { keyword: string; field: string; level: string }[]) {
        const fieldEntry = Object.entries(FIELD_HIERARCHY).find(([, f]) => f.s2Field === i.field);
        entries.push({
          keyword: i.keyword,
          field: (i.field || "Computer Science") as S2Field,
          fieldLabel: fieldEntry ? fieldEntry[1].label : "CS",
          color: fieldEntry ? fieldEntry[1].color : "#e5e7eb",
        });
        if (fieldEntry && !fieldEntry[1].topics.includes(i.keyword)) {
          const key = fieldEntry[0];
          (customByField[key] ||= []).push(i.keyword);
        }
      }
      setSelectedTopics(entries);
      setCustomTopics(customByField);
      if (data.cadence) setCadence(data.cadence);
    } finally {
      setLoadingInterests(false);
    }
  }

  function toggleTopic(keyword: string, fieldKey: string) {
    const fieldDef = FIELD_HIERARCHY[fieldKey];
    if (!fieldDef) return;
    const exists = selectedTopics.findIndex(t => t.keyword === keyword);
    if (exists > -1) {
      setSelectedTopics(prev => prev.filter(t => t.keyword !== keyword));
    } else if (selectedTopics.length < 20) {
      setSelectedTopics(prev => [...prev, {
        keyword, field: fieldDef.s2Field, fieldLabel: fieldDef.label, color: fieldDef.color,
      }]);
    }
  }

  function addCustom(fieldKey: string, topic: string) {
    const val = topic.trim();
    if (!val || selectedTopics.length >= 20) return;
    const fieldDef = FIELD_HIERARCHY[fieldKey];
    if (!fieldDef) return;
    setCustomTopics(prev => {
      const existing = prev[fieldKey] || [];
      if (existing.some(x => x.toLowerCase() === val.toLowerCase())) return prev;
      return { ...prev, [fieldKey]: [...existing, val] };
    });
    setSelectedTopics(prev => {
      if (prev.some(t => t.keyword === val)) return prev;
      return [...prev, { keyword: val, field: fieldDef.s2Field, fieldLabel: fieldDef.label, color: fieldDef.color }];
    });
  }

  function removeCustom(fieldKey: string, topic: string) {
    setCustomTopics(prev => ({ ...prev, [fieldKey]: (prev[fieldKey] || []).filter(x => x !== topic) }));
    setSelectedTopics(prev => prev.filter(t => t.keyword !== topic));
  }

  async function handleSave() {
    setSaving(true);
    try {
      if (selectedTopics.length >= 3) {
        await fetch("/api/interests", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ interests: selectedTopics.map(t => ({ keyword: t.keyword, field: t.field, level: "beginner" })) }),
        });
      }
      await fetch("/api/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cadence }),
      }).catch(() => {});
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  const navItems: { key: SettingsTab; label: string }[] = [
    { key: "interests", label: "Interests" },
    { key: "account", label: "Account" },
  ];

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
          <div className="flex items-center gap-4">
            {navItems.map(n => (
              <button
                key={n.key}
                onClick={() => setTab(n.key)}
                style={{
                  padding: "4px 0", fontSize: "0.625rem", fontWeight: 600,
                  textTransform: "uppercase", letterSpacing: "0.12em",
                  fontFamily: "var(--font-mono), monospace",
                  border: "none", background: "transparent",
                  color: tab === n.key ? "#1a1a1a" : "#999",
                  borderBottom: tab === n.key ? "1.5px solid #1a1a1a" : "1.5px solid transparent",
                  cursor: "pointer", transition: "color 0.15s",
                }}
              >
                {n.label}
              </button>
            ))}
            <button
              onClick={() => setOpen(false)}
              className="flex items-center justify-center text-[#888] hover:text-[#1a1a1a] transition-colors"
              style={{ background: "none", border: "none", cursor: "pointer", padding: "6px" }}
            >
              <X className="size-5" />
            </button>
          </div>
        </header>

        <main className="flex-1 flex flex-col overflow-hidden">
          {/* ── Interests tab ── */}
          {tab === "interests" && (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="px-5 pt-6 pb-4 md:px-10 md:pt-10 md:pb-5">
                <h3 style={{ fontSize: "2rem", fontWeight: 800, fontFamily: "var(--font-display), sans-serif", marginBottom: "8px", letterSpacing: "-0.02em" }}>
                  Curate Your Feed
                </h3>
                <p style={{ fontSize: "0.9rem", color: "#666" }}>Pick topics to personalize your daily digest.</p>
              </div>

              {/* Delivery cadence */}
              <div className="px-5 md:px-10 pb-4" style={{ borderBottom: "1px solid #eee" }}>
                <label style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "2px", color: "#888", fontFamily: "var(--font-mono), monospace", display: "block", marginBottom: "10px" }}>
                  Delivery Cadence
                </label>
                <div className="flex gap-0">
                  {([
                    { key: "daily" as const, label: "Daily", desc: "The morning digest." },
                    { key: "biweekly" as const, label: "Bi-Weekly", desc: "Tuesday & Friday." },
                    { key: "weekly" as const, label: "Weekly", desc: "The Sunday recap." },
                  ]).map(opt => (
                    <button
                      key={opt.key}
                      onClick={() => setCadence(opt.key)}
                      className="flex-1"
                      style={{
                        padding: "10px 8px", border: "2px solid #1a1a1a", marginRight: "-2px",
                        background: cadence === opt.key ? "#1a1a1a" : "white",
                        color: cadence === opt.key ? "white" : "#1a1a1a",
                        cursor: "pointer", textAlign: "center",
                      }}
                    >
                      <div style={{ fontSize: "0.8rem", fontWeight: 700 }}>{opt.label}</div>
                      <div style={{ fontSize: "0.6rem", color: cadence === opt.key ? "#ccc" : "#888", marginTop: "2px" }}>{opt.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-5 md:px-10 pt-4">
                {loadingInterests ? (
                  <div className="flex items-center justify-center py-16"><Loader2 className="size-5 animate-spin text-[#888]" /></div>
                ) : (
                  <InterestLedger
                    selected={selectedTopics}
                    custom={customTopics}
                    onToggle={toggleTopic}
                    onAddCustom={addCustom}
                    onRemoveCustom={removeCustom}
                  />
                )}
              </div>

              {selectedTopics.length > 0 && (
                <div className="px-5 md:px-10" style={{ borderTop: "1px solid #e5e7eb", paddingTop: "12px", paddingBottom: "12px", flexShrink: 0, display: "flex", justifyContent: "flex-end", alignItems: "center", gap: "8px" }}>
                  {saved && (
                    <span className="flex items-center gap-1 text-[#38b000] text-[0.7rem] mr-auto">
                      <CheckCircle className="size-3" /> Saved
                    </span>
                  )}
                  <button
                    onClick={() => setSelectedTopics([])}
                    style={{ fontSize: "0.65rem", fontWeight: 700, color: "#888", background: "none", border: "none", cursor: "pointer", textDecoration: "underline", textUnderlineOffset: "2px" }}
                  >
                    Clear All
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 hover:bg-[#333] disabled:opacity-50"
                    style={{
                      padding: "10px 20px", background: "#1a1a1a", color: "white",
                      border: "2px solid #1a1a1a", cursor: "pointer",
                      fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase",
                      letterSpacing: "1.5px", fontFamily: "var(--font-mono), monospace",
                    }}
                  >
                    {saving ? <Loader2 className="size-3 animate-spin" /> : "Save"}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── Account tab ── */}
          {tab === "account" && (
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
              <div style={{ display: "flex", flexDirection: "column", gap: "12px", alignItems: "flex-start" }}>
                {isAdmin && (
                  <button
                    onClick={() => { onRegenerate?.(); setOpen(false); }}
                    className="flex items-center gap-2 hover:bg-[#1a1a1a] hover:text-white transition-colors"
                    style={{
                      border: "2px solid #1a1a1a", padding: "10px 20px",
                      background: "white", cursor: "pointer",
                      fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase",
                      letterSpacing: "1.5px", fontFamily: "var(--font-mono), monospace",
                    }}
                  >
                    <RefreshCw className="size-3.5" />
                    Regenerate digest
                  </button>
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
            </div>
          )}
        </main>
      </DialogContent>
    </Dialog>
  );
}
