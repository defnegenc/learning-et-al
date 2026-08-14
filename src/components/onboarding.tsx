"use client";

import { useState } from "react";
import { Loader2, ArrowRight } from "lucide-react";
import { NoiseOverlay } from "@/components/noise-overlay";
import { InterestLedger, useInterestLedger } from "@/components/interest-ledger";

type Provider = "openai" | "anthropic" | "gemini" | "other";

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

  const { selected: selectedTopics, custom, toggle, addCustom, removeCustom } = useInterestLedger();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [codeError, setCodeError] = useState("");
  const [validatingCode, setValidatingCode] = useState(false);

  const providerDefaults: Record<Provider, { model: string; baseUrl: string; label: string }> = {
    openai: { model: "gpt-4o-mini", baseUrl: "https://api.openai.com/v1", label: "OPENAI" },
    anthropic: { model: "claude-sonnet-4-6", baseUrl: "https://api.anthropic.com", label: "ANTHROPIC" },
    gemini: { model: "gemini-2.5-flash", baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai", label: "GEMINI" },
    other: { model: "", baseUrl: "", label: "OTHER" },
  };

  function handleProviderChange(p: Provider) {
    if (p !== provider) setApiKey("");
    setProvider(p);
    setModel(providerDefaults[p].model);
    setBaseUrl(providerDefaults[p].baseUrl);
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
          maxWidth: step === 2 ? "860px" : "480px",
          maxHeight: "92vh",
          border: "2px solid #1a1a1a",
          background: "white",
          boxShadow: "6px 6px 0 0 rgba(0,0,0,1)",
        }}
      >
        <div style={{ padding: "28px 28px 20px", borderBottom: "2px solid #1a1a1a" }}>
          <h2 style={{ fontSize: "1.6rem", fontWeight: 800, letterSpacing: "-0.02em", fontFamily: "var(--font-display), sans-serif", margin: "0 0 8px" }}>
            {step === 1 ? "Connect an AI provider" : "What are you curious about?"}
          </h2>
          <p style={{ fontSize: "1rem", color: "#666", lineHeight: 1.6, margin: 0 }}>
            {step === 1 ? "We use an LLM to generate your daily digest." : "Pick at least 3 topics. We'll find papers and news that connect them."}
          </p>
        </div>

        {/* STEP 1 */}
        {step === 1 && (
          <div style={{ padding: "20px 24px" }} className="space-y-4">
            <div className="flex gap-0 flex-wrap">
              {(["gemini", "anthropic", "openai", "other"] as Provider[]).map((p) => (
                <button key={p} onClick={() => handleProviderChange(p)}
                  className={`flex-1 px-2 py-2.5 text-[0.88rem] font-bold ${provider === p ? "bg-[#1a1a1a] text-white" : "text-[#1a1a1a] hover:bg-gray-50"}`}
                  style={{ border: "2px solid #1a1a1a", marginRight: "-2px", fontFamily: "var(--font-display), sans-serif" }}>
                  {providerDefaults[p].label}
                </button>
              ))}
            </div>
            <input type="password" placeholder="Paste your API key…" value={apiKey}
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
              className="w-full bg-[#1a1a1a] text-white px-4 py-3 text-[0.9rem] font-bold hover:bg-[#333] disabled:opacity-50 flex items-center justify-center gap-2"
              style={{ border: "2px solid #1a1a1a", fontFamily: "var(--font-display), sans-serif", boxShadow: "4px 4px 0 0 rgba(0,0,0,1)" }}>
              Continue <ArrowRight className="size-3.5" />
            </button>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div style={{ flex: 1, height: "1px", background: "rgba(26,26,26,0.12)" }} />
              <span style={{ fontSize: "0.85rem", color: "#666" }}>or</span>
              <div style={{ flex: 1, height: "1px", background: "rgba(26,26,26,0.12)" }} />
            </div>
            <div>
              <p style={{ fontSize: "0.9rem", color: "#666", marginBottom: "8px" }}>Have an invite code?</p>
              <div style={{ display: "flex", gap: "6px" }}>
                <input value={inviteCode} onChange={(e) => { setInviteCode(e.target.value); setCodeError(""); }}
                  onKeyDown={(e) => e.key === "Enter" && inviteCode.trim() && handleCodeSubmit()}
                  placeholder="Enter code…" style={{ flex: 1, padding: "10px 12px", border: "2px solid #1a1a1a", fontSize: "0.9rem", outline: "none" }} />
                <button onClick={handleCodeSubmit} disabled={!inviteCode.trim() || validatingCode}
                  style={{ padding: "10px 18px", background: "#1a1a1a", color: "white", border: "2px solid #1a1a1a", fontSize: "0.88rem", fontWeight: 700, fontFamily: "var(--font-display), sans-serif", cursor: "pointer", opacity: !inviteCode.trim() || validatingCode ? 0.5 : 1 }}>
                  {validatingCode ? "…" : "Go"}
                </button>
              </div>
              {codeError && <p style={{ fontSize: "0.85rem", color: "#ff007f", marginTop: "6px" }}>{codeError}</p>}
            </div>
          </div>
        )}

        {/* STEP 2 — ledger */}
        {step === 2 && (
          <>
            <div className="flex-1 overflow-y-auto" style={{ padding: "20px 24px" }}>
              <InterestLedger
                selected={selectedTopics}
                custom={custom}
                onToggle={toggle}
                onAddCustom={addCustom}
                onRemoveCustom={removeCustom}
              />
            </div>

            {/* Footer */}
            <div style={{ borderTop: "2px solid #1a1a1a", padding: "14px 28px", background: "#fff" }}>
              {error && <p style={{ fontSize: "0.85rem", color: "#ff007f", marginBottom: "8px" }}>{error}</p>}
              <div className="flex gap-2">
                {!skipApiKey && (
                  <button onClick={() => setStep(1)} disabled={submitting} style={{ padding: "10px 18px", border: "2px solid #1a1a1a", background: "white", fontSize: "0.88rem", fontWeight: 700, fontFamily: "var(--font-display), sans-serif", cursor: "pointer" }}>
                    Back
                  </button>
                )}
                <button onClick={handleSubmit} disabled={selectedTopics.length < 3 || submitting}
                  className="flex-1 flex items-center justify-center gap-2"
                  style={{ padding: "11px", background: "#1a1a1a", color: "white", border: "2px solid #1a1a1a", fontSize: "0.9rem", fontWeight: 700, fontFamily: "var(--font-display), sans-serif", cursor: "pointer", boxShadow: "4px 4px 0 0 rgba(0,0,0,1)", opacity: selectedTopics.length < 3 || submitting ? 0.5 : 1 }}>
                  {submitting ? <><Loader2 className="size-3.5 animate-spin" /> Setting up…</> : `Start exploring (${selectedTopics.length}/3+)`}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
