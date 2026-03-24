"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Settings, Loader2, CheckCircle, XCircle, RefreshCw, Plus, LogOut, ChevronDown, ChevronRight } from "lucide-react";
import { useSession as useAuthSession, signOut } from "next-auth/react";
import { FIELD_HIERARCHY } from "@/lib/field-hierarchy";
import type { S2Field } from "@/lib/field-hierarchy";

type Provider = "openai" | "anthropic" | "gemini" | "other";
type SettingsTab = "api" | "interests";

interface SettingsDialogProps {
  session: {
    apiKey: string;
    provider: string;
    model: string;
    baseUrl: string;
  };
  updateSession: (updates: Record<string, unknown>) => void;
  onRefreshDigest?: () => void;
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

function SettingsInterestPicker({ selectedTopics, setSelectedTopics, customFieldKey, setCustomFieldKey, customInput, setCustomInput, toggleTopic, addCustomTopicToCategory }: {
  selectedTopics: SelectedTopic[]; setSelectedTopics: (fn: (prev: SelectedTopic[]) => SelectedTopic[]) => void;
  customFieldKey: string | null; setCustomFieldKey: (v: string | null) => void;
  customInput: string; setCustomInput: (v: string) => void;
  toggleTopic: (kw: string, fk: string) => void; addCustomTopicToCategory: (fk: string) => void;
}) {
  const [expandedField, setExpandedField] = useState<string | null>(null);
  return (
    <div>
      {Object.entries(FIELD_HIERARCHY).map(([fieldKey, fieldDef]) => {
        const isExpanded = expandedField === fieldKey;
        const selectedInField = selectedTopics.filter(t => t.field === fieldDef.s2Field).length;
        const isCustomOpen = customFieldKey === fieldKey;
        return (
          <div key={fieldKey} style={{ borderBottom: "1px solid #eee" }}>
            <button onClick={() => setExpandedField(isExpanded ? null : fieldKey)}
              style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0", background: "none", border: "none", cursor: "pointer" }}>
              <div className="flex items-center gap-2">
                <div style={{ width: "10px", height: "10px", background: fieldDef.color, border: "1.5px solid #1a1a1a" }} />
                <span style={{ fontSize: "0.85rem", fontWeight: 700 }}>{fieldKey}</span>
                {selectedInField > 0 && <span style={{ fontSize: "0.6rem", color: "#888", fontFamily: "var(--font-mono), monospace" }}>{selectedInField} selected</span>}
              </div>
              {isExpanded ? <ChevronDown size={14} color="#888" /> : <ChevronRight size={14} color="#888" />}
            </button>
            {isExpanded && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", paddingBottom: "12px" }}>
                {fieldDef.topics.map(topic => {
                  const isSelected = selectedTopics.some(t => t.keyword === topic);
                  return (
                    <button key={topic} onClick={() => toggleTopic(topic, fieldKey)} style={{
                      padding: "5px 12px", fontSize: "0.75rem", fontWeight: 600, border: "1.5px solid #1a1a1a",
                      background: isSelected ? "#1a1a1a" : "white", color: isSelected ? "white" : "#1a1a1a",
                      cursor: "pointer", boxShadow: isSelected ? "none" : "2px 2px 0px 0px rgba(0,0,0,1)",
                    }}>{topic}</button>
                  );
                })}
                {isCustomOpen ? (
                  <div style={{ display: "inline-flex" }}>
                    <input autoFocus value={customInput} onChange={e => setCustomInput(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") addCustomTopicToCategory(fieldKey); if (e.key === "Escape") { setCustomFieldKey(null); setCustomInput(""); } }}
                      onBlur={() => { if (!customInput.trim()) { setCustomFieldKey(null); setCustomInput(""); } }}
                      placeholder="add topic..." style={{ padding: "5px 10px", fontSize: "0.75rem", border: "1.5px solid #1a1a1a", borderRight: "none", background: fieldDef.color, outline: "none", width: "130px" }} />
                    <button onClick={() => addCustomTopicToCategory(fieldKey)} style={{ padding: "5px 10px", fontSize: "0.75rem", fontWeight: 700, border: "1.5px solid #1a1a1a", background: "#1a1a1a", color: "white", cursor: "pointer" }}>Add</button>
                  </div>
                ) : (
                  <button onClick={() => { setCustomFieldKey(fieldKey); setCustomInput(""); }}
                    style={{ padding: "5px 10px", fontSize: "0.75rem", fontWeight: 600, border: "1.5px dashed #bbb", background: fieldDef.color, color: "#888", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "3px" }}>
                    <Plus size={10} /> custom
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function SettingsDialog({ session, updateSession, onRefreshDigest }: SettingsDialogProps) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<SettingsTab>("interests");
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

  // Interests state
  const [selectedTopics, setSelectedTopics] = useState<SelectedTopic[]>([]);
  const [customFieldKey, setCustomFieldKey] = useState<string | null>(null);
  const [customInput, setCustomInput] = useState("");
  const [loadingInterests, setLoadingInterests] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (open) {
      setProvider(session.provider as Provider);
      setApiKey(session.apiKey);
      setModel(session.model);
      setBaseUrl(session.baseUrl);
      setTestResult(null);
      loadInterests();
    }
  }, [open, session]);

  async function loadInterests() {
    setLoadingInterests(true);
    try {
      const res = await fetch("/api/interests");
      if (!res.ok) return;
      const data = await res.json();
      const entries: SelectedTopic[] = (data.interests ?? []).map(
        (i: { keyword: string; field: string; level: string }) => {
          const fieldEntry = Object.entries(FIELD_HIERARCHY).find(([, f]) => f.s2Field === i.field);
          return {
            keyword: i.keyword,
            field: (i.field || "Computer Science") as S2Field,
            fieldLabel: fieldEntry ? fieldEntry[1].label : "CS",
            color: fieldEntry ? fieldEntry[1].color : "#e5e7eb",
          };
        }
      );
      setSelectedTopics(entries);
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
    const exists = selectedTopics.findIndex(t => t.keyword === keyword);
    if (exists > -1) {
      setSelectedTopics(prev => prev.filter(t => t.keyword !== keyword));
    } else if (selectedTopics.length < 20) {
      setSelectedTopics(prev => [...prev, {
        keyword, field: fieldDef.s2Field, fieldLabel: fieldDef.label, color: fieldDef.color,
      }]);
    }
  }

  function addCustomTopicToCategory(fieldKey: string) {
    const val = customInput.trim();
    if (!val || selectedTopics.length >= 20) return;
    const fieldDef = FIELD_HIERARCHY[fieldKey];
    setSelectedTopics(prev => [...prev, {
      keyword: val, field: fieldDef.s2Field, fieldLabel: fieldDef.label, color: fieldDef.color,
    }]);
    setCustomInput("");
    setCustomFieldKey(null);
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
    { key: "api", label: "API" },
  ];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" size="icon" />}>
        <Settings className="size-4" />
      </DialogTrigger>
      <DialogContent
        className="flex flex-col md:flex-row p-0 gap-0"
        style={{ width: "100vw", height: "100vh", maxWidth: "100vw", maxHeight: "100vh", borderRadius: 0 }}
      >
        {/* ── Sidebar: horizontal tab bar on mobile, vertical sidebar on desktop ── */}
        <aside className="shrink-0 flex flex-row md:flex-col md:w-[220px] border-b-[3px] md:border-b-0 md:border-r-[3px] border-[#1a1a1a]" style={{ background: "white" }}>
          <div className="hidden md:block" style={{ padding: "28px 24px 20px", borderBottom: "3px solid #1a1a1a" }}>
            <h2 style={{ fontSize: "1.5rem", fontWeight: 800, fontFamily: "var(--font-display), sans-serif", letterSpacing: "-0.02em" }}>
              Settings
            </h2>
          </div>
          <nav className="flex flex-row md:flex-col md:flex-1 md:pt-2">
            {navItems.map(item => (
              <button
                key={item.key}
                onClick={() => setTab(item.key)}
                className={tab !== item.key ? "hover:bg-gray-50" : ""}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center",
                  padding: "12px 16px", textAlign: "center",
                  fontSize: "0.8rem", fontWeight: tab === item.key ? 800 : 600,
                  background: tab === item.key ? "#1a1a1a" : "transparent",
                  color: tab === item.key ? "white" : "#1a1a1a",
                  border: "none", cursor: "pointer", transition: "all 0.1s",
                  fontFamily: "var(--font-mono), monospace", textTransform: "uppercase", letterSpacing: "1.5px",
                }}
              >
                {item.label}
              </button>
            ))}
          </nav>
          {/* Account — desktop only */}
          <div className="hidden md:block" style={{ padding: "16px 24px", borderTop: "3px solid #1a1a1a" }}>
            {authSession?.user && (
              <div style={{ marginBottom: "12px" }}>
                <div className="flex items-center gap-2 mb-2">
                  {authSession.user.image && (
                    <img src={authSession.user.image} alt="" style={{ width: "28px", height: "28px", borderRadius: "50%", border: "1.5px solid #1a1a1a" }} />
                  )}
                  <div>
                    <p style={{ fontSize: "0.75rem", fontWeight: 700, color: "#1a1a1a", lineHeight: 1.2 }}>
                      {authSession.user.name}
                    </p>
                    <p style={{ fontSize: "0.6rem", color: "#888" }}>
                      {authSession.user.email}
                    </p>
                  </div>
                </div>
              </div>
            )}
            <button
              onClick={() => {
                localStorage.removeItem("pp_session");
                signOut({ callbackUrl: "/" });
              }}
              className="w-full flex items-center justify-center gap-2 py-2 text-[0.7rem] uppercase tracking-[1.5px] text-[#888] hover:text-[#1a1a1a] hover:bg-gray-50 transition-colors"
              style={{ border: "1.5px solid #ddd", fontFamily: "var(--font-mono), monospace" }}
            >
              <LogOut className="size-3" /> Sign Out
            </button>
          </div>
        </aside>

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
                  Pick topics to personalize your daily digest. Set expertise level per category.
                </p>
              </div>

              {/* Table */}
              <div className="flex-1 overflow-y-auto px-5 md:px-10">
                {loadingInterests ? (
                  <div className="flex items-center justify-center py-16"><Loader2 className="size-5 animate-spin text-[#888]" /></div>
                ) : (
                  <SettingsInterestPicker
                    selectedTopics={selectedTopics}
                    setSelectedTopics={setSelectedTopics}
                    customFieldKey={customFieldKey}
                    setCustomFieldKey={setCustomFieldKey}
                    customInput={customInput}
                    setCustomInput={setCustomInput}
                    toggleTopic={toggleTopic}
                    addCustomTopicToCategory={addCustomTopicToCategory}
                  />
                )}
              </div>

              {/* Selected footer */}
              <div className="px-5 md:px-10" style={{ borderTop: "3px solid #1a1a1a", background: "#fafafa", paddingTop: "12px", paddingBottom: "12px", flexShrink: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                  <span style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "2px", fontFamily: "var(--font-mono), monospace" }}>
                    Selected ({selectedTopics.length}/20)
                  </span>
                  <button
                    onClick={() => setSelectedTopics([])}
                    style={{ fontSize: "0.65rem", fontWeight: 700, color: "#888", background: "none", border: "none", cursor: "pointer", textDecoration: "underline", textUnderlineOffset: "2px" }}
                  >
                    Clear All
                  </button>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", maxHeight: "64px", overflowY: "auto" }}>
                  {selectedTopics.map(t => (
                    <div
                      key={t.keyword}
                      style={{
                        display: "inline-flex", alignItems: "center",
                        border: "2px solid #1a1a1a", fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase",
                        background: t.color || "#e5e7eb",
                      }}
                    >
                      <span style={{ padding: "3px 7px", borderRight: "1px solid #1a1a1a", fontSize: "0.5rem", fontFamily: "var(--font-mono), monospace", opacity: 0.6 }}>
                        {t.fieldLabel}
                      </span>
                      <span style={{ padding: "3px 8px" }}>{t.keyword}</span>
                      <button
                        onClick={() => setSelectedTopics(prev => prev.filter(x => x.keyword !== t.keyword))}
                        className="hover:bg-[#1a1a1a] hover:text-white transition-colors"
                        style={{ padding: "3px 6px", borderLeft: "1px solid #1a1a1a", background: "none", cursor: "pointer", fontSize: "0.7rem" }}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          {/* Bottom action bar */}
          <div className="px-5 md:px-10" style={{
            borderTop: "3px solid #1a1a1a", background: "white",
            paddingTop: "14px", paddingBottom: "14px", display: "flex", justifyContent: "flex-end",
            alignItems: "center", gap: "10px", flexShrink: 0,
          }}>
            {saved && (
              <span className="flex items-center gap-1 text-[#38b000] text-[0.7rem]" style={{ marginRight: "auto" }}>
                <CheckCircle className="size-3" /> Saved
              </span>
            )}
            <button
              onClick={() => {
                localStorage.removeItem("pp_session");
                signOut({ callbackUrl: "/" });
              }}
              className="md:hidden flex items-center gap-1.5 px-3 py-2.5 text-[0.65rem] uppercase tracking-[1.5px] text-[#888] hover:text-[#1a1a1a] transition-colors"
              style={{ border: "1.5px solid #ddd", fontFamily: "var(--font-mono), monospace", marginRight: "auto" }}
            >
              <LogOut className="size-3" /> Sign Out
            </button>
            <button
              onClick={handleRefreshDigest}
              disabled={!apiKey.trim()}
              className="flex items-center gap-2 px-4 py-2.5 text-[0.65rem] uppercase tracking-[1.5px] hover:bg-gray-50 transition-colors disabled:opacity-50"
              style={{ border: "2px solid #1a1a1a", fontFamily: "var(--font-mono), monospace" }}
            >
              <RefreshCw className="size-3" /> Refresh Digest
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2.5 text-[0.7rem] font-bold uppercase tracking-[2px] bg-[#1a1a1a] text-white hover:bg-[#333] transition-colors disabled:opacity-50"
              style={{ border: "2px solid #1a1a1a", fontFamily: "var(--font-mono), monospace", boxShadow: "4px 4px 0px 0px rgba(0,0,0,1)" }}
            >
              {saving ? <Loader2 className="size-3 animate-spin" /> : "Save"}
            </button>
          </div>
        </main>
      </DialogContent>
    </Dialog>
  );
}
