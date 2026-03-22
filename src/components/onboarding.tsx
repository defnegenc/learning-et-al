"use client";

import { useState } from "react";
import { Loader2, ArrowRight, Plus } from "lucide-react";
import { NoiseOverlay } from "@/components/noise-overlay";
import { FIELD_HIERARCHY } from "@/lib/field-hierarchy";
import type { ExpertiseLevel, S2Field } from "@/lib/field-hierarchy";

type Provider = "openai" | "anthropic" | "gemini" | "other";

const LEVELS: ExpertiseLevel[] = ["beginner", "intermediate", "expert"];
const LEVEL_LABELS: Record<ExpertiseLevel, string> = { beginner: "BEG", intermediate: "INT", expert: "ADV" };

interface SelectedTopic {
  keyword: string;
  field: S2Field;
  fieldLabel: string;
  level: ExpertiseLevel;
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

  // Step 1
  const [provider, setProvider] = useState<Provider>(defaultProvider || "gemini");
  const [apiKey, setApiKey] = useState(defaultApiKey || "");
  const [model, setModel] = useState("");
  const [baseUrl, setBaseUrl] = useState("");

  // Step 2
  const [selectedTopics, setSelectedTopics] = useState<SelectedTopic[]>([]);
  const [categoryLevels, setCategoryLevels] = useState<Record<string, ExpertiseLevel>>({});
  const [customFieldKey, setCustomFieldKey] = useState<string | null>(null);
  const [customInput, setCustomInput] = useState("");
  const [contentMix, setContentMix] = useState(33);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [codeError, setCodeError] = useState("");
  const [validatingCode, setValidatingCode] = useState(false);

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
        setStep(2); // Skip to interests
      } else {
        setCodeError("Invalid code");
      }
    } catch {
      setCodeError("Something went wrong");
    }
    setValidatingCode(false);
  }

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
      const level = categoryLevels[fieldKey] || "beginner";
      setSelectedTopics(prev => [...prev, {
        keyword, field: fieldDef.s2Field, fieldLabel: fieldDef.label, level, color: fieldDef.color,
      }]);
    }
  }

  function setCategoryLevel(fieldKey: string, level: ExpertiseLevel) {
    setCategoryLevels(prev => ({ ...prev, [fieldKey]: level }));
    const fieldDef = FIELD_HIERARCHY[fieldKey];
    setSelectedTopics(prev => prev.map(t =>
      t.field === fieldDef.s2Field ? { ...t, level } : t
    ));
  }

  function addCustomTopicToCategory(fieldKey: string) {
    const val = customInput.trim();
    if (!val || selectedTopics.length >= 20) return;
    const fieldDef = FIELD_HIERARCHY[fieldKey];
    const level = categoryLevels[fieldKey] || "beginner";
    setSelectedTopics(prev => [...prev, {
      keyword: val, field: fieldDef.s2Field, fieldLabel: fieldDef.label, level, color: fieldDef.color,
    }]);
    setCustomInput("");
    setCustomFieldKey(null);
  }

  function getMixLabel() {
    if (contentMix <= 20) return "3 research papers";
    if (contentMix <= 50) return "2 papers, 1 news — recommended";
    if (contentMix <= 80) return "1 paper, 2 news";
    return "3 news articles";
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
          interests: selectedTopics.map(t => ({ keyword: t.keyword, field: t.field, level: t.level })),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          contentMix,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Setup failed");
      onComplete({
        apiKey, provider,
        model: model || providerDefaults[provider].model,
        baseUrl: baseUrl || providerDefaults[provider].baseUrl,
        userId: data.userId,
        contentMix,
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
          maxWidth: step === 2 ? "1000px" : "512px",
          maxHeight: "90vh",
          border: "4px solid #1a1a1a",
          background: "white",
          boxShadow: "8px 8px 0px 0px rgba(0,0,0,1)",
        }}
      >
        {/* Header */}
        <div style={{ padding: "24px 28px 16px", borderBottom: "3px solid #1a1a1a" }}>
          <h2 style={{
            fontSize: "1.5rem", fontWeight: 800,
            fontFamily: "var(--font-display), sans-serif",
            letterSpacing: "-0.02em", marginBottom: "4px",
          }}>
            {step === 1 ? "Connect AI Provider" : "Pick Your Interests"}
          </h2>
          <p style={{ fontSize: "0.85rem", color: "#666" }}>
            {step === 1
              ? "We use an LLM to generate your daily digest. Gemini's free tier works great."
              : "Select topics you're curious about. We'll find papers and news that connect them in surprising ways."}
          </p>
        </div>

        {/* STEP 1 — API Key */}
        {step === 1 && (
          <div style={{ padding: "24px 28px" }} className="space-y-5">
            <div className="flex gap-0 flex-wrap md:flex-nowrap">
              {(["gemini", "anthropic", "openai", "other"] as Provider[]).map((p) => (
                <button
                  key={p}
                  onClick={() => handleProviderChange(p)}
                  className={`flex-1 px-2 py-3 text-[0.75rem] font-bold uppercase tracking-[1px] transition-colors ${
                    provider === p ? "bg-[#1a1a1a] text-white" : "text-[#1a1a1a] hover:bg-gray-50"
                  }`}
                  style={{ border: "2px solid #1a1a1a", marginRight: "-2px", fontFamily: "var(--font-mono), monospace" }}
                >
                  {providerDefaults[p].label}
                </button>
              ))}
            </div>

            <div>
              <label style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "2px", color: "#888", fontFamily: "var(--font-mono), monospace", display: "block", marginBottom: "6px" }}>
                API Key
              </label>
              <input
                type="password"
                placeholder="Paste your API key..."
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && apiKey.trim() && setStep(2)}
                className="w-full bg-transparent px-4 py-3 text-[0.95rem] placeholder:text-[#bbb] focus:outline-none"
                style={{ border: "2px solid #1a1a1a" }}
              />
            </div>

            {provider === "other" && (
              <div className="flex gap-3">
                <div className="flex-1">
                  <label style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "2px", color: "#888", fontFamily: "var(--font-mono), monospace", display: "block", marginBottom: "6px" }}>Model</label>
                  <input value={model} onChange={(e) => setModel(e.target.value)} placeholder="e.g. gpt-4o" className="w-full bg-transparent px-3 py-2 text-[0.9rem] placeholder:text-[#bbb] focus:outline-none" style={{ border: "2px solid #1a1a1a" }} />
                </div>
                <div className="flex-1">
                  <label style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "2px", color: "#888", fontFamily: "var(--font-mono), monospace", display: "block", marginBottom: "6px" }}>Base URL</label>
                  <input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://..." className="w-full bg-transparent px-3 py-2 text-[0.9rem] placeholder:text-[#bbb] focus:outline-none" style={{ border: "2px solid #1a1a1a" }} />
                </div>
              </div>
            )}

            <button
              disabled={!apiKey.trim()}
              onClick={() => setStep(2)}
              className="w-full bg-[#1a1a1a] text-white px-4 py-3 text-[0.8rem] uppercase tracking-[2px] hover:bg-[#333] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              style={{ border: "2px solid #1a1a1a", fontFamily: "var(--font-mono), monospace", boxShadow: "4px 4px 0px 0px rgba(0,0,0,1)" }}
            >
              Continue <ArrowRight className="size-3.5" />
            </button>

            {/* Or use invite code */}
            <div style={{ display: "flex", alignItems: "center", gap: "12px", margin: "4px 0" }}>
              <div style={{ flex: 1, height: "1px", background: "#e5e7eb" }} />
              <span style={{ fontSize: "0.7rem", color: "#999", fontFamily: "var(--font-mono), monospace", textTransform: "uppercase", letterSpacing: "1px" }}>or</span>
              <div style={{ flex: 1, height: "1px", background: "#e5e7eb" }} />
            </div>

            <div>
              <p style={{ fontSize: "0.75rem", color: "#666", marginBottom: "8px" }}>
                Have an invite code? Skip the API key.
              </p>
              <div style={{ display: "flex", gap: "6px" }}>
                <input
                  value={inviteCode}
                  onChange={(e) => { setInviteCode(e.target.value); setCodeError(""); }}
                  onKeyDown={(e) => e.key === "Enter" && inviteCode.trim() && handleCodeSubmit()}
                  placeholder="Enter code..."
                  style={{
                    flex: 1, padding: "10px 12px", border: "2px solid #1a1a1a",
                    fontSize: "0.85rem", fontFamily: "var(--font-mono), monospace", outline: "none",
                  }}
                />
                <button
                  onClick={handleCodeSubmit}
                  disabled={!inviteCode.trim() || validatingCode}
                  style={{
                    padding: "10px 16px", background: "#1a1a1a", color: "white",
                    border: "2px solid #1a1a1a", fontSize: "0.7rem", fontWeight: 700,
                    textTransform: "uppercase", letterSpacing: "1px",
                    fontFamily: "var(--font-mono), monospace", cursor: "pointer",
                    opacity: !inviteCode.trim() || validatingCode ? 0.5 : 1,
                  }}
                >
                  {validatingCode ? "..." : "Go"}
                </button>
              </div>
              {codeError && <p style={{ fontSize: "0.7rem", color: "#ff007f", marginTop: "4px" }}>{codeError}</p>}
            </div>
          </div>
        )}

        {/* STEP 2 — Interests (same table as settings) */}
        {step === 2 && (
          <>
            <div className="flex-1 overflow-y-auto" style={{ padding: "0 28px" }}>
              <table className="w-full border-collapse" style={{ border: "2px solid #1a1a1a", marginTop: "20px" }}>
                <thead className="sticky top-0 z-10">
                  <tr style={{ background: "#f5f5f5", borderBottom: "2px solid #1a1a1a" }}>
                    <th style={{ textAlign: "left", padding: "12px 16px", fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "2px", fontFamily: "var(--font-mono), monospace", borderRight: "2px solid #1a1a1a", width: "220px" }}>
                      Category
                    </th>
                    <th style={{ textAlign: "left", padding: "12px 16px", fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "2px", fontFamily: "var(--font-mono), monospace" }}>
                      Topics
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(FIELD_HIERARCHY).map(([fieldKey, fieldDef]) => {
                    const currentLevel = categoryLevels[fieldKey] || "beginner";
                    const allTopics = Object.values(fieldDef.subfields).flat();
                    const isCustomOpen = customFieldKey === fieldKey;
                    return (
                      <tr key={fieldKey} style={{ borderBottom: "1px solid #e5e7eb" }} className="hover:bg-gray-50/30">
                        <td style={{ padding: "14px 16px", borderRight: "2px solid #1a1a1a", verticalAlign: "top" }}>
                          <div className="flex items-center gap-2 mb-1.5">
                            <div style={{ width: "10px", height: "10px", background: fieldDef.color, border: "1.5px solid #1a1a1a", flexShrink: 0 }} />
                            <span style={{ fontSize: "0.8rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.3px" }}>
                              {fieldKey}
                            </span>
                          </div>
                          <span style={{ fontSize: "0.55rem", fontFamily: "var(--font-mono), monospace", color: "#aaa", display: "block", marginBottom: "8px" }}>
                            {fieldDef.label}
                          </span>
                          <div style={{ display: "inline-flex", border: "1.5px solid #1a1a1a", borderRadius: "999px", overflow: "hidden" }}>
                            {LEVELS.map(lvl => (
                              <button
                                key={lvl}
                                onClick={() => setCategoryLevel(fieldKey, lvl)}
                                style={{
                                  padding: "3px 8px", fontSize: "0.55rem", fontWeight: 700,
                                  fontFamily: "var(--font-mono), monospace",
                                  background: currentLevel === lvl ? "#1a1a1a" : "transparent",
                                  color: currentLevel === lvl ? "white" : "#888",
                                  border: "none", cursor: "pointer",
                                }}
                              >
                                {LEVEL_LABELS[lvl]}
                              </button>
                            ))}
                          </div>
                        </td>
                        <td style={{ padding: "14px 16px" }}>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                            {allTopics.map(topic => {
                              const isSelected = selectedTopics.some(t => t.keyword === topic);
                              return (
                                <button
                                  key={topic}
                                  onClick={() => toggleTopic(topic, fieldKey)}
                                  style={{
                                    padding: "5px 12px", fontSize: "0.75rem", fontWeight: 600,
                                    border: "1.5px solid #1a1a1a",
                                    background: isSelected ? "#1a1a1a" : "white",
                                    color: isSelected ? "white" : "#1a1a1a",
                                    cursor: "pointer", transition: "all 0.1s",
                                    boxShadow: isSelected ? "none" : "2px 2px 0px 0px rgba(0,0,0,1)",
                                  }}
                                >
                                  {topic}
                                </button>
                              );
                            })}
                            {isCustomOpen ? (
                              <div style={{ display: "inline-flex" }}>
                                <input
                                  autoFocus value={customInput}
                                  onChange={e => setCustomInput(e.target.value)}
                                  onKeyDown={e => { if (e.key === "Enter") addCustomTopicToCategory(fieldKey); if (e.key === "Escape") { setCustomFieldKey(null); setCustomInput(""); } }}
                                  onBlur={() => { if (!customInput.trim()) { setCustomFieldKey(null); setCustomInput(""); } }}
                                  placeholder="type topic..."
                                  style={{ padding: "5px 10px", fontSize: "0.75rem", fontWeight: 600, border: "1.5px solid #1a1a1a", borderRight: "none", background: fieldDef.color, outline: "none", width: "140px" }}
                                />
                                <button onClick={() => addCustomTopicToCategory(fieldKey)} style={{ padding: "5px 10px", fontSize: "0.75rem", fontWeight: 700, border: "1.5px solid #1a1a1a", background: "#1a1a1a", color: "white", cursor: "pointer" }}>
                                  Add
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => { setCustomFieldKey(fieldKey); setCustomInput(""); }}
                                style={{ padding: "5px 10px", fontSize: "0.75rem", fontWeight: 700, border: "1.5px dashed #aaa", background: fieldDef.color, color: "#666", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "4px" }}
                              >
                                <Plus size={11} /> custom
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div style={{ borderTop: "3px solid #1a1a1a", background: "#fafafa", padding: "12px 28px" }}>
              {/* Selected chips */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <span style={{ fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "2px", fontFamily: "var(--font-mono), monospace" }}>
                  Selected ({selectedTopics.length}/20)
                </span>
                {selectedTopics.length > 0 && (
                  <button onClick={() => setSelectedTopics([])} style={{ fontSize: "0.6rem", fontWeight: 700, color: "#888", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>
                    Clear All
                  </button>
                )}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "5px", marginBottom: "12px", maxHeight: "50px", overflowY: "auto" }}>
                {selectedTopics.map(t => (
                  <span key={t.keyword} style={{ display: "inline-flex", alignItems: "center", border: "2px solid #1a1a1a", fontSize: "0.6rem", fontWeight: 700, textTransform: "uppercase", background: t.color }}>
                    <span style={{ padding: "2px 6px", borderRight: "1px solid #1a1a1a", fontSize: "0.5rem", fontFamily: "var(--font-mono), monospace", opacity: 0.6 }}>{t.fieldLabel}</span>
                    <span style={{ padding: "2px 8px" }}>{t.keyword}</span>
                    <button onClick={() => setSelectedTopics(prev => prev.filter(x => x.keyword !== t.keyword))} className="hover:bg-[#1a1a1a] hover:text-white transition-colors" style={{ padding: "2px 5px", borderLeft: "1px solid #1a1a1a", background: "none", cursor: "pointer", fontSize: "0.65rem" }}>×</button>
                  </span>
                ))}
              </div>

              {/* Content mix */}
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
                <span style={{ fontSize: "0.6rem", fontFamily: "var(--font-mono), monospace", color: "#999", whiteSpace: "nowrap" }}>Just research</span>
                <input type="range" min={0} max={100} step={5} value={contentMix} onChange={(e) => setContentMix(Number(e.target.value))} className="flex-1 h-1 appearance-none bg-[#1a1a1a] outline-none" style={{ accentColor: "#1a1a1a" }} />
                <span style={{ fontSize: "0.6rem", fontFamily: "var(--font-mono), monospace", color: "#999", whiteSpace: "nowrap" }}>Just news</span>
                <span style={{ fontSize: "0.6rem", fontFamily: "var(--font-mono), monospace", color: "#666", whiteSpace: "nowrap" }}>{getMixLabel()}</span>
              </div>

              {error && <p style={{ fontSize: "0.8rem", color: "#ff007f", marginBottom: "8px" }}>{error}</p>}

              <div className="flex gap-2">
                <button onClick={() => setStep(1)} disabled={submitting} style={{ padding: "10px 20px", border: "2px solid #1a1a1a", background: "white", fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "2px", fontFamily: "var(--font-mono), monospace", cursor: "pointer" }}>
                  Back
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={selectedTopics.length < 3 || submitting}
                  className="flex-1 flex items-center justify-center gap-2"
                  style={{ padding: "10px", background: "#1a1a1a", color: "white", border: "2px solid #1a1a1a", fontSize: "0.8rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "2px", fontFamily: "var(--font-mono), monospace", cursor: "pointer", boxShadow: "4px 4px 0px 0px rgba(0,0,0,1)", opacity: selectedTopics.length < 3 || submitting ? 0.5 : 1 }}
                >
                  {submitting ? <><Loader2 className="size-3.5 animate-spin" /> Setting up...</> : "Start Exploring"}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
