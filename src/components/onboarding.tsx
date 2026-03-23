"use client";

import { useState } from "react";
import { Loader2, ArrowRight, Plus, ChevronDown, ChevronRight } from "lucide-react";
import { NoiseOverlay } from "@/components/noise-overlay";
import { FIELD_HIERARCHY } from "@/lib/field-hierarchy";
import type { S2Field } from "@/lib/field-hierarchy";

type Provider = "openai" | "anthropic" | "gemini" | "other";

interface SelectedTopic {
  keyword: string;
  field: S2Field;
  fieldLabel: string;
  color: string;
}

interface OnboardingProps {
  skipApiKey?: boolean;
  defaultApiKey?: string;
  defaultProvider?: Provider;
  onComplete: (data: {
    apiKey: string;
    provider: Provider;
    model: string;
    baseUrl: string;
    userId: string;
    contentMix: number;
  }) => void;
}

export function Onboarding({ onComplete, skipApiKey, defaultApiKey, defaultProvider }: OnboardingProps) {
  const [step, setStep] = useState<1 | 2>(skipApiKey ? 2 : 1);

  const [provider, setProvider] = useState<Provider>(defaultProvider || "gemini");
  const [apiKey, setApiKey] = useState(defaultApiKey || "");
  const [model, setModel] = useState("");
  const [baseUrl, setBaseUrl] = useState("");

  const [selectedTopics, setSelectedTopics] = useState<SelectedTopic[]>([]);
  const [expandedField, setExpandedField] = useState<string | null>(null);
  const [customFieldKey, setCustomFieldKey] = useState<string | null>(null);
  const [customInput, setCustomInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [codeError, setCodeError] = useState("");
  const [validatingCode, setValidatingCode] = useState(false);

  const providerDefaults: Record<Provider, { model: string; baseUrl: string; label: string }> = {
    openai: { model: "gpt-4o-mini", baseUrl: "https://api.openai.com/v1", label: "OPENAI" },
    anthropic: { model: "claude-sonnet-4-20250514", baseUrl: "https://api.anthropic.com", label: "ANTHROPIC" },
    gemini: { model: "gemini-2.5-flash", baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai", label: "GEMINI" },
    other: { model: "", baseUrl: "", label: "OTHER" },
  };

  function handleProviderChange(p: Provider) {
    if (p !== provider) setApiKey("");
    setProvider(p);
    setModel(providerDefaults[p].model);
    setBaseUrl(providerDefaults[p].baseUrl);
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

  async function handleCodeSubmit() {
    if (!inviteCode.trim() || validatingCode) return;
    setValidatingCode(true);
    setCodeError("");
    try {
      const res = await fetch("/api/validate-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: inviteCode }),
      });
      const data = await res.json();
      if (data.valid) {
        setProvider(data.provider || "gemini");
        setApiKey(data.apiKey || "");
        setModel(data.model || "");
        setBaseUrl(data.baseUrl || "");
        setStep(2);
      } else {
        setCodeError("Invalid code");
      }
    } catch { setCodeError("Something went wrong"); }
    setValidatingCode(false);
  }

  async function handleSubmit() {
    if (selectedTopics.length < 3) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          interests: selectedTopics.map(t => ({ keyword: t.keyword, field: t.field, level: "beginner" })),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          contentMix: 33,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Setup failed");
      onComplete({
        apiKey, provider,
        model: model || providerDefaults[provider].model,
        baseUrl: baseUrl || providerDefaults[provider].baseUrl,
        userId: data.userId,
        contentMix: 33,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setSubmitting(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center p-3 md:p-4" style={{ background: "white" }}>
      <NoiseOverlay />
      <div
        className="relative z-10 w-full flex flex-col"
        style={{
          maxWidth: step === 2 ? "600px" : "480px",
          maxHeight: "90vh",
          border: "4px solid #1a1a1a",
          background: "white",
          boxShadow: "8px 8px 0px 0px rgba(0,0,0,1)",
        }}
      >
        <div style={{ padding: "24px 24px 16px", borderBottom: "3px solid #1a1a1a" }}>
          <h2 style={{ fontSize: "1.4rem", fontWeight: 800, fontFamily: "var(--font-display), sans-serif", marginBottom: "4px" }}>
            {step === 1 ? "Connect AI Provider" : "What are you curious about?"}
          </h2>
          <p style={{ fontSize: "0.85rem", color: "#666" }}>
            {step === 1 ? "We use an LLM to generate your daily digest." : "Pick at least 3 topics. We'll find papers and news that connect them."}
          </p>
        </div>

        {/* STEP 1 */}
        {step === 1 && (
          <div style={{ padding: "20px 24px" }} className="space-y-4">
            <div className="flex gap-0 flex-wrap">
              {(["gemini", "anthropic", "openai", "other"] as Provider[]).map((p) => (
                <button key={p} onClick={() => handleProviderChange(p)}
                  className={`flex-1 px-2 py-2.5 text-[0.7rem] font-bold uppercase tracking-[1px] ${provider === p ? "bg-[#1a1a1a] text-white" : "text-[#1a1a1a] hover:bg-gray-50"}`}
                  style={{ border: "2px solid #1a1a1a", marginRight: "-2px", fontFamily: "var(--font-mono), monospace" }}>
                  {providerDefaults[p].label}
                </button>
              ))}
            </div>
            <input type="password" placeholder="Paste your API key..." value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && apiKey.trim() && setStep(2)}
              className="w-full bg-transparent px-4 py-3 text-[0.9rem] placeholder:text-[#bbb] focus:outline-none"
              style={{ border: "2px solid #1a1a1a" }} />
            {provider === "other" && (
              <div className="flex gap-3">
                <input value={model} onChange={(e) => setModel(e.target.value)} placeholder="Model" className="flex-1 bg-transparent px-3 py-2 text-[0.85rem] placeholder:text-[#bbb] focus:outline-none" style={{ border: "2px solid #1a1a1a" }} />
                <input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="Base URL" className="flex-1 bg-transparent px-3 py-2 text-[0.85rem] placeholder:text-[#bbb] focus:outline-none" style={{ border: "2px solid #1a1a1a" }} />
              </div>
            )}
            <button disabled={!apiKey.trim()} onClick={() => setStep(2)}
              className="w-full bg-[#1a1a1a] text-white px-4 py-3 text-[0.8rem] uppercase tracking-[2px] hover:bg-[#333] disabled:opacity-50 flex items-center justify-center gap-2"
              style={{ border: "2px solid #1a1a1a", fontFamily: "var(--font-mono), monospace", boxShadow: "4px 4px 0px 0px rgba(0,0,0,1)" }}>
              Continue <ArrowRight className="size-3.5" />
            </button>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div style={{ flex: 1, height: "1px", background: "#e5e7eb" }} />
              <span style={{ fontSize: "0.65rem", color: "#999", fontFamily: "var(--font-mono), monospace" }}>OR</span>
              <div style={{ flex: 1, height: "1px", background: "#e5e7eb" }} />
            </div>
            <div>
              <p style={{ fontSize: "0.75rem", color: "#666", marginBottom: "6px" }}>Have an invite code?</p>
              <div style={{ display: "flex", gap: "6px" }}>
                <input value={inviteCode} onChange={(e) => { setInviteCode(e.target.value); setCodeError(""); }}
                  onKeyDown={(e) => e.key === "Enter" && inviteCode.trim() && handleCodeSubmit()}
                  placeholder="Enter code..." style={{ flex: 1, padding: "10px 12px", border: "2px solid #1a1a1a", fontSize: "0.85rem", fontFamily: "var(--font-mono), monospace", outline: "none" }} />
                <button onClick={handleCodeSubmit} disabled={!inviteCode.trim() || validatingCode}
                  style={{ padding: "10px 16px", background: "#1a1a1a", color: "white", border: "2px solid #1a1a1a", fontSize: "0.7rem", fontWeight: 700, fontFamily: "var(--font-mono), monospace", cursor: "pointer", opacity: !inviteCode.trim() || validatingCode ? 0.5 : 1 }}>
                  {validatingCode ? "..." : "Go"}
                </button>
              </div>
              {codeError && <p style={{ fontSize: "0.7rem", color: "#ff007f", marginTop: "4px" }}>{codeError}</p>}
            </div>
          </div>
        )}

        {/* STEP 2 — expandable categories */}
        {step === 2 && (
          <>
            <div className="flex-1 overflow-y-auto" style={{ padding: "12px 24px" }}>
              {Object.entries(FIELD_HIERARCHY).map(([fieldKey, fieldDef]) => {
                const isExpanded = expandedField === fieldKey;
                const selectedInField = selectedTopics.filter(t => t.field === fieldDef.s2Field).length;
                const isCustomOpen = customFieldKey === fieldKey;
                return (
                  <div key={fieldKey} style={{ borderBottom: "1px solid #eee" }}>
                    <button
                      onClick={() => setExpandedField(isExpanded ? null : fieldKey)}
                      style={{
                        width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                        padding: "12px 0", background: "none", border: "none", cursor: "pointer",
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <div style={{ width: "10px", height: "10px", background: fieldDef.color, border: "1.5px solid #1a1a1a" }} />
                        <span style={{ fontSize: "0.85rem", fontWeight: 700 }}>{fieldKey}</span>
                        {selectedInField > 0 && (
                          <span style={{ fontSize: "0.6rem", color: "#888", fontFamily: "var(--font-mono), monospace" }}>
                            {selectedInField} selected
                          </span>
                        )}
                      </div>
                      {isExpanded ? <ChevronDown size={14} color="#888" /> : <ChevronRight size={14} color="#888" />}
                    </button>
                    {isExpanded && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", paddingBottom: "12px" }}>
                        {fieldDef.topics.map(topic => {
                          const isSelected = selectedTopics.some(t => t.keyword === topic);
                          return (
                            <button key={topic} onClick={() => toggleTopic(topic, fieldKey)} style={{
                              padding: "5px 12px", fontSize: "0.75rem", fontWeight: 600,
                              border: "1.5px solid #1a1a1a",
                              background: isSelected ? "#1a1a1a" : "white",
                              color: isSelected ? "white" : "#1a1a1a",
                              cursor: "pointer",
                              boxShadow: isSelected ? "none" : "2px 2px 0px 0px rgba(0,0,0,1)",
                            }}>
                              {topic}
                            </button>
                          );
                        })}
                        {isCustomOpen ? (
                          <div style={{ display: "inline-flex" }}>
                            <input autoFocus value={customInput}
                              onChange={e => setCustomInput(e.target.value)}
                              onKeyDown={e => { if (e.key === "Enter") addCustomTopicToCategory(fieldKey); if (e.key === "Escape") { setCustomFieldKey(null); setCustomInput(""); } }}
                              onBlur={() => { if (!customInput.trim()) { setCustomFieldKey(null); setCustomInput(""); } }}
                              placeholder="add topic..."
                              style={{ padding: "5px 10px", fontSize: "0.75rem", border: "1.5px solid #1a1a1a", borderRight: "none", background: fieldDef.color, outline: "none", width: "130px" }} />
                            <button onClick={() => addCustomTopicToCategory(fieldKey)} style={{ padding: "5px 10px", fontSize: "0.75rem", fontWeight: 700, border: "1.5px solid #1a1a1a", background: "#1a1a1a", color: "white", cursor: "pointer" }}>
                              Add
                            </button>
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

            {/* Footer */}
            <div style={{ borderTop: "3px solid #1a1a1a", padding: "12px 24px", background: "#fafafa" }}>
              {selectedTopics.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "5px", marginBottom: "10px", maxHeight: "60px", overflowY: "auto" }}>
                  {selectedTopics.map(t => (
                    <span key={t.keyword} style={{ display: "inline-flex", alignItems: "center", border: "1.5px solid #1a1a1a", fontSize: "0.65rem", fontWeight: 600, background: t.color }}>
                      <span style={{ padding: "3px 8px" }}>{t.keyword}</span>
                      <button onClick={() => setSelectedTopics(prev => prev.filter(x => x.keyword !== t.keyword))} className="hover:bg-[#1a1a1a] hover:text-white transition-colors" style={{ padding: "3px 6px", borderLeft: "1px solid #1a1a1a", background: "none", cursor: "pointer" }}>×</button>
                    </span>
                  ))}
                </div>
              )}
              {error && <p style={{ fontSize: "0.75rem", color: "#ff007f", marginBottom: "6px" }}>{error}</p>}
              <div className="flex gap-2">
                {!skipApiKey && (
                  <button onClick={() => setStep(1)} disabled={submitting} style={{ padding: "10px 16px", border: "2px solid #1a1a1a", background: "white", fontSize: "0.75rem", fontWeight: 700, fontFamily: "var(--font-mono), monospace", cursor: "pointer" }}>
                    Back
                  </button>
                )}
                <button onClick={handleSubmit} disabled={selectedTopics.length < 3 || submitting}
                  className="flex-1 flex items-center justify-center gap-2"
                  style={{ padding: "10px", background: "#1a1a1a", color: "white", border: "2px solid #1a1a1a", fontSize: "0.8rem", fontWeight: 700, fontFamily: "var(--font-mono), monospace", cursor: "pointer", boxShadow: "4px 4px 0px 0px rgba(0,0,0,1)", opacity: selectedTopics.length < 3 || submitting ? 0.5 : 1 }}>
                  {submitting ? <><Loader2 className="size-3.5 animate-spin" /> Setting up...</> : `Start Exploring (${selectedTopics.length}/3+)`}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
