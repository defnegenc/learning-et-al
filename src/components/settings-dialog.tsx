"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Settings, Loader2, CheckCircle, XCircle, RefreshCw, LogOut, X } from "lucide-react";
import { CATEGORY_PALETTES } from "@/components/interest-ledger";
import { useSession as useAuthSession } from "next-auth/react";
import { FIELD_HIERARCHY } from "@/lib/field-hierarchy";
import type { S2Field } from "@/lib/field-hierarchy";
import { InterestLedger, type CustomTopics } from "@/components/interest-ledger";

type Provider = "openai" | "anthropic" | "gemini" | "other";
export type SettingsTab = "api" | "interests" | "account";

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

const providerDefaults: Record<Provider, { model: string; label: string }> = {
  openai: { model: "gpt-4o-mini", label: "OPENAI" },
  anthropic: { model: "claude-sonnet-4-20250514", label: "ANTHROPIC" },
  gemini: { model: "gemini-2.5-flash", label: "GEMINI" },
  other: { model: "", label: "OTHER" },
};


interface SelectedTopic {
  keyword: string;
  field: S2Field;
  fieldLabel: string;
  color: string;
}


export function SettingsDialog({ session, updateSession, onRefreshDigest, open: controlledOpen, onOpenChange, startTab }: SettingsDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = (v: boolean) => { isControlled ? onOpenChange?.(v) : setInternalOpen(v); };
  const [tab, setTab] = useState<SettingsTab>("api");
  const { data: authSession } = useAuthSession();

  // API state
  const [provider, setProvider] = useState<Provider>(session.provider as Provider);
  const [apiKey, setApiKey] = useState(session.apiKey);
  const [model, setModel] = useState(session.model);
  const [baseUrl, setBaseUrl] = useState(session.baseUrl);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Invite code state
  const [inviteCode, setInviteCode] = useState("");
  const [codeStatus, setCodeStatus] = useState<"idle" | "checking" | "valid" | "invalid">("idle");

  // Cadence state
  const [cadence, setCadence] = useState<"daily" | "biweekly" | "weekly">("daily");

  // Interests state
  const [selectedTopics, setSelectedTopics] = useState<SelectedTopic[]>([]);
  const [customTopics, setCustomTopics] = useState<CustomTopics>({});
  const [loadingInterests, setLoadingInterests] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (open) {
      setTab(startTab || "api");
      setProvider(session.provider as Provider);
      setApiKey(session.apiKey);
      setModel(session.model);
      setBaseUrl(session.baseUrl);
      setTestResult(null);
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
    } finally {
      setLoadingInterests(false);
    }
  }

  async function handleCodeSubmit() {
    if (!inviteCode.trim() || codeStatus === "checking") return;
    setCodeStatus("checking");
    try {
      const res = await fetch("/api/validate-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: inviteCode }),
      });
      const data = await res.json();
      if (data.valid) {
        setCodeStatus("valid");
        setApiKey(data.apiKey);
        setProvider(data.provider as Provider);
        setModel(data.model);
        setBaseUrl(data.baseUrl || "");
        updateSession({
          apiKey: data.apiKey,
          provider: data.provider,
          model: data.model,
          baseUrl: data.baseUrl || "",
          inviteCode: inviteCode.trim().toLowerCase(),
        });
      } else {
        setCodeStatus("invalid");
      }
    } catch {
      setCodeStatus("invalid");
    }
  }

  function handleProviderChange(p: Provider) {
    if (p !== provider) setApiKey("");
    setProvider(p);
    setModel(providerDefaults[p].model);
    setTestResult(null);
  }

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/test-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey, provider, model: model || providerDefaults[provider].model, baseUrl }),
      });
      const data = await res.json();
      setTestResult(data.success ? { success: true, message: "OK" } : { success: false, message: data.error });
    } catch { setTestResult({ success: false, message: "Network error" }); }
    setTesting(false);
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
      return [...prev, {
        keyword: val, field: fieldDef.s2Field, fieldLabel: fieldDef.label, color: fieldDef.color,
      }];
    });
  }

  function removeCustom(fieldKey: string, topic: string) {
    setCustomTopics(prev => ({
      ...prev,
      [fieldKey]: (prev[fieldKey] || []).filter(x => x !== topic),
    }));
    setSelectedTopics(prev => prev.filter(t => t.keyword !== topic));
  }

  async function handleSave() {
    setSaving(true);
    try {
      updateSession({ apiKey, provider, model: model || providerDefaults[provider].model, baseUrl });
      if (selectedTopics.length >= 3) {
        await fetch("/api/interests", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            interests: selectedTopics.map(t => ({ keyword: t.keyword, field: t.field, level: "beginner" })),
          }),
        });
      }
      // Save cadence
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

  function handleRefreshDigest() {
    handleSave();
    onRefreshDigest?.();
    setOpen(false);
  }

  const navItems: { key: SettingsTab; label: string }[] = [
    { key: "interests", label: "Interests" },
    { key: "api", label: "API Key" },
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
        {/* ── Top bar — matches app-shell header style ── */}
        <header
          className="sticky top-0 z-40 flex items-center justify-between px-4 md:px-8"
          style={{ borderBottom: "1px solid #1a1a1a", background: "white", height: "52px", flexShrink: 0 }}
        >
          <span
            style={{
              fontSize: "1.25rem", fontWeight: 900, letterSpacing: "0.2em",
              textTransform: "uppercase", color: "#1a1a1a",
              fontFamily: "var(--font-display), sans-serif",
            }}
          >
            LEARNING ET AL.
          </span>

          {/* Nav tabs — same style as app-shell */}
          <div className="flex items-center gap-6">
            {navItems.map(item => (
              <button
                key={item.key}
                onClick={() => setTab(item.key)}
                style={{
                  padding: "4px 0",
                  fontSize: "0.625rem", fontWeight: 600,
                  textTransform: "uppercase", letterSpacing: "0.12em",
                  fontFamily: "var(--font-mono), monospace",
                  border: "none", background: "transparent",
                  color: tab === item.key ? "#1a1a1a" : "#999",
                  borderBottom: tab === item.key ? "1.5px solid #1a1a1a" : "1.5px solid transparent",
                  cursor: "pointer", transition: "color 0.15s",
                  whiteSpace: "nowrap",
                }}
              >
                {item.label}
              </button>
            ))}
          </div>

          <button
            onClick={() => setOpen(false)}
            className="flex items-center justify-center text-[#888] hover:text-[#1a1a1a] transition-colors"
            style={{ background: "none", border: "none", cursor: "pointer", padding: "8px" }}
            title="Close"
          >
            <X className="size-5" />
          </button>
        </header>

        {/* ── Main content ── */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {/* ── API Tab ── */}
          {tab === "api" && (
            <div className="flex-1 overflow-y-auto px-5 py-6 md:p-10">
              <h3 style={{ fontSize: "2rem", fontWeight: 800, fontFamily: "var(--font-display), sans-serif", marginBottom: "8px", letterSpacing: "-0.02em" }}>
                AI Provider
              </h3>
              <p style={{ fontSize: "0.9rem", color: "#666", marginBottom: "32px" }}>
                Enter an invite code, or connect your own AI provider.
              </p>

              {/* Invite code */}
              <div className="mb-8" style={{ paddingBottom: "24px", borderBottom: "2px solid #e5e7eb" }}>
                <label style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "2px", color: "#888", fontFamily: "var(--font-mono), monospace", display: "block", marginBottom: "8px" }}>
                  Invite Code
                </label>
                <div className="flex gap-3">
                  <input
                    value={inviteCode}
                    onChange={(e) => { setInviteCode(e.target.value); setCodeStatus("idle"); }}
                    onKeyDown={(e) => e.key === "Enter" && inviteCode.trim() && handleCodeSubmit()}
                    placeholder="Enter code..."
                    className="flex-1 bg-transparent px-4 py-3 text-[1rem] placeholder:text-[#bbb] focus:outline-none"
                    style={{ border: "2px solid #1a1a1a", fontFamily: "var(--font-mono), monospace", textAlign: "center" }}
                  />
                  <button
                    onClick={handleCodeSubmit}
                    disabled={!inviteCode.trim() || codeStatus === "checking"}
                    className="px-5 py-3 text-[0.75rem] uppercase tracking-[1.5px] hover:bg-gray-50 transition-colors disabled:opacity-50 flex items-center gap-2 shrink-0"
                    style={{ border: "2px solid #1a1a1a", fontFamily: "var(--font-mono), monospace" }}
                  >
                    {codeStatus === "checking" ? <Loader2 className="size-3.5 animate-spin" /> : codeStatus === "valid" ? <CheckCircle className="size-3.5 text-[#38b000]" /> : codeStatus === "invalid" ? <XCircle className="size-3.5 text-[#ff007f]" /> : null}
                    Apply
                  </button>
                </div>
                {codeStatus === "invalid" && <p style={{ fontSize: "0.75rem", color: "#ff007f", marginTop: "8px", fontFamily: "var(--font-mono), monospace" }}>Invalid code</p>}
                {codeStatus === "valid" && <p style={{ fontSize: "0.75rem", color: "#38b000", marginTop: "8px", fontFamily: "var(--font-mono), monospace" }}>Code applied — API key updated</p>}
              </div>

              <label style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "2px", color: "#888", fontFamily: "var(--font-mono), monospace", display: "block", marginBottom: "12px" }}>
                Or use your own key
              </label>
              <div className="flex gap-0 flex-wrap md:flex-nowrap mb-6">
                {(["openai", "anthropic", "gemini", "other"] as Provider[]).map((p) => (
                  <button
                    key={p}
                    onClick={() => handleProviderChange(p)}
                    className={`flex-1 px-3 py-3 text-[0.8rem] font-bold uppercase tracking-[1px] transition-colors ${
                      provider === p ? "bg-[#1a1a1a] text-white" : "text-[#1a1a1a] hover:bg-gray-50"
                    }`}
                    style={{ border: "2px solid #1a1a1a", marginRight: "-2px", fontFamily: "var(--font-mono), monospace" }}
                  >
                    {providerDefaults[p].label}
                  </button>
                ))}
              </div>

              <div className="mb-4">
                <label style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "2px", color: "#888", fontFamily: "var(--font-mono), monospace", display: "block", marginBottom: "8px" }}>
                  API Key
                </label>
                <div className="flex gap-3">
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => { setApiKey(e.target.value); setTestResult(null); }}
                    placeholder="sk-..."
                    className="flex-1 bg-transparent px-4 py-3 text-[1rem] placeholder:text-[#bbb] focus:outline-none"
                    style={{ border: "2px solid #1a1a1a" }}
                  />
                  <button
                    onClick={handleTest}
                    disabled={testing || !apiKey.trim()}
                    className="px-5 py-3 text-[0.75rem] uppercase tracking-[1.5px] hover:bg-gray-50 transition-colors disabled:opacity-50 flex items-center gap-2 shrink-0"
                    style={{ border: "2px solid #1a1a1a", fontFamily: "var(--font-mono), monospace" }}
                  >
                    {testing ? <Loader2 className="size-3.5 animate-spin" /> : testResult?.success ? <CheckCircle className="size-3.5 text-[#38b000]" /> : testResult ? <XCircle className="size-3.5 text-[#ff007f]" /> : null}
                    Test
                  </button>
                </div>
              </div>

              {provider === "other" && (
                <div className="flex gap-3 mt-4">
                  <div className="flex-1">
                    <label style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "2px", color: "#888", fontFamily: "var(--font-mono), monospace", display: "block", marginBottom: "6px" }}>Model</label>
                    <input value={model} onChange={(e) => setModel(e.target.value)} placeholder="e.g. gpt-4o" className="w-full bg-transparent px-4 py-3 text-[1rem] placeholder:text-[#bbb] focus:outline-none" style={{ border: "2px solid #1a1a1a" }} />
                  </div>
                  <div className="flex-1">
                    <label style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "2px", color: "#888", fontFamily: "var(--font-mono), monospace", display: "block", marginBottom: "6px" }}>Base URL</label>
                    <input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://api.example.com/v1" className="w-full bg-transparent px-4 py-3 text-[1rem] placeholder:text-[#bbb] focus:outline-none" style={{ border: "2px solid #1a1a1a" }} />
                  </div>
                </div>
              )}

              {testResult && !testResult.success && (
                <p style={{ fontSize: "0.8rem", color: "#ff007f", marginTop: "12px", fontFamily: "var(--font-mono), monospace" }}>
                  {testResult.message}
                </p>
              )}
            </div>
          )}

          {/* ── Interests Tab ── */}
          {tab === "interests" && (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="px-5 pt-6 pb-4 md:px-10 md:pt-10 md:pb-5">
                <h3 style={{ fontSize: "2rem", fontWeight: 800, fontFamily: "var(--font-display), sans-serif", marginBottom: "8px", letterSpacing: "-0.02em" }}>
                  Curate Your Feed
                </h3>
                <p style={{ fontSize: "0.9rem", color: "#666", marginBottom: "0" }}>
                  Pick topics to personalize your daily digest.
                </p>
              </div>

              {/* Delivery Cadence */}
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

              {/* Topics */}
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

              {/* Selected footer */}
              {selectedTopics.length > 0 && (
                <div className="px-5 md:px-10" style={{ borderTop: "3px solid #1a1a1a", background: "#fafafa", paddingTop: "12px", paddingBottom: "12px", flexShrink: 0 }}>
                  <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", marginBottom: "8px" }}>
                    <button
                      onClick={() => setSelectedTopics([])}
                      style={{ fontSize: "0.65rem", fontWeight: 700, color: "#888", background: "none", border: "none", cursor: "pointer", textDecoration: "underline", textUnderlineOffset: "2px" }}
                    >
                      Clear All
                    </button>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", maxHeight: "72px", overflowY: "auto" }}>
                    {selectedTopics.map(t => {
                      const fieldEntry = Object.entries(FIELD_HIERARCHY).find(([, def]) => def.s2Field === t.field);
                      const pal = fieldEntry ? CATEGORY_PALETTES[fieldEntry[0]] : null;
                      const gradient = pal ? `linear-gradient(135deg, ${pal[0]} 0%, ${pal[1]} 100%)` : (t.color || "#e5e7eb");
                      return (
                        <span
                          key={t.keyword}
                          style={{
                            display: "inline-flex", alignItems: "center", gap: "4px",
                            border: "1px solid rgba(26,26,26,0.25)", fontSize: "0.65rem",
                            fontWeight: 600, textTransform: "uppercase", borderRadius: "3px",
                            background: gradient, padding: "4px 6px 4px 8px",
                            fontFamily: "var(--font-mono), monospace",
                          }}
                        >
                          {t.keyword}
                          <button
                            onClick={() => setSelectedTopics(prev => prev.filter(x => x.keyword !== t.keyword))}
                            style={{ background: "none", border: "none", cursor: "pointer", padding: "0 2px", fontSize: "0.75rem", lineHeight: 1, color: "rgba(26,26,26,0.5)" }}
                            className="hover:text-[#1a1a1a] transition-colors"
                          >
                            ×
                          </button>
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Account Tab ── */}
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
          )}

          {/* Bottom action bar — only on api/interests tabs */}
          {tab !== "account" && (
            <div className="px-4 md:px-10" style={{
              borderTop: "3px solid #1a1a1a", background: "white",
              paddingTop: "12px", paddingBottom: "12px", display: "flex", flexWrap: "wrap",
              justifyContent: "flex-end", alignItems: "center", gap: "8px", flexShrink: 0,
            }}>
              {saved && (
                <span className="flex items-center gap-1 text-[#38b000] text-[0.7rem]" style={{ marginRight: "auto" }}>
                  <CheckCircle className="size-3" /> Saved
                </span>
              )}
              <button
                onClick={handleRefreshDigest}
                disabled={!apiKey.trim()}
                className="flex items-center gap-2 px-3 md:px-4 py-2.5 text-[0.6rem] md:text-[0.65rem] uppercase tracking-[1.5px] hover:bg-gray-50 transition-colors disabled:opacity-50"
                style={{ border: "2px solid #1a1a1a", fontFamily: "var(--font-mono), monospace", height: "40px" }}
              >
                <RefreshCw className="size-3" /> Refresh
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-4 md:px-6 py-2.5 text-[0.6rem] md:text-[0.7rem] font-bold uppercase tracking-[1.5px] md:tracking-[2px] bg-[#1a1a1a] text-white hover:bg-[#333] transition-colors disabled:opacity-50"
                style={{ border: "2px solid #1a1a1a", fontFamily: "var(--font-mono), monospace", boxShadow: "4px 4px 0px 0px rgba(0,0,0,1)", height: "40px" }}
              >
                {saving ? <Loader2 className="size-3 animate-spin" /> : "Save"}
              </button>
            </div>
          )}
        </main>
      </DialogContent>
    </Dialog>
  );
}
