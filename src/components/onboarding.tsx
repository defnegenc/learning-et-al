"use client";

import { useState } from "react";
import { Loader2, ArrowRight } from "lucide-react";
import { NoiseOverlay } from "@/components/noise-overlay";
import { InterestLedger, useInterestLedger } from "@/components/interest-ledger";
import {
  ACID_PINK, ActionButton, BODY_STYLE, BORDER, DIM, DISPLAY_LG, HAIRLINE, INK,
  Label, MUTED, RULE, Segmented, SHADOW, SURFACE, TextInput,
} from "@/components/design-system";

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
    openai: { model: "gpt-4o-mini", baseUrl: "https://api.openai.com/v1", label: "OpenAI" },
    anthropic: { model: "claude-sonnet-4-6", baseUrl: "https://api.anthropic.com", label: "Anthropic" },
    gemini: { model: "gemini-2.5-flash", baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai", label: "Gemini" },
    other: { model: "", baseUrl: "", label: "Other" },
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
    <div className="relative flex min-h-screen items-center justify-center p-3 md:p-4" style={{ background: SURFACE }}>
      <NoiseOverlay />
      <div
        className="relative z-10 w-full flex flex-col"
        style={{
          maxWidth: step === 2 ? 860 : 480,
          maxHeight: "92vh",
          border: BORDER,
          background: SURFACE,
          boxShadow: SHADOW,
        }}
      >
        <div style={{ padding: "28px 28px 22px", borderBottom: BORDER }}>
          <Label style={{ marginBottom: 12 }}>{step === 1 ? "Setup / Provider" : "Setup / Interests"}</Label>
          <h2 style={{ ...DISPLAY_LG, margin: "0 0 10px" }}>
            {step === 1 ? "Connect an AI provider" : "What are you curious about?"}
          </h2>
          <p style={{ ...BODY_STYLE, color: DIM, margin: 0 }}>
            {step === 1 ? "We use an LLM to generate your daily digest." : "Pick at least 3 topics. We'll turn them into a daily digest that connects papers, news, and ideas."}
          </p>
        </div>

        {/* STEP 1 */}
        {step === 1 && (
          <div style={{ padding: "22px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
            <Segmented
              value={provider}
              onChange={handleProviderChange}
              options={(["gemini", "anthropic", "openai", "other"] as Provider[]).map(p => ({ key: p, label: providerDefaults[p].label }))}
            />
            <TextInput type="password" placeholder="Paste your API key…" value={apiKey} onChange={setApiKey}
              onKeyDown={(e) => { if (e.key === "Enter" && apiKey.trim()) setStep(2); }} />
            {provider === "other" && (
              <div style={{ display: "flex", gap: 12 }}>
                <TextInput value={model} onChange={setModel} placeholder="Model" />
                <TextInput value={baseUrl} onChange={setBaseUrl} placeholder="Base URL" />
              </div>
            )}
            <ActionButton variant="primary" disabled={!apiKey.trim()} onClick={() => setStep(2)} style={{ width: "100%" }}>
              Continue <ArrowRight size={15} />
            </ActionButton>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ flex: 1, height: 1, background: RULE }} />
              <span style={{ ...BODY_STYLE, color: MUTED }}>or</span>
              <div style={{ flex: 1, height: 1, background: RULE }} />
            </div>
            <div>
              <p style={{ ...BODY_STYLE, color: MUTED, margin: "0 0 10px" }}>Have an invite code?</p>
              <div style={{ display: "flex", gap: 8 }}>
                <TextInput value={inviteCode} onChange={(v) => { setInviteCode(v); setCodeError(""); }}
                  onKeyDown={(e) => { if (e.key === "Enter" && inviteCode.trim()) handleCodeSubmit(); }}
                  placeholder="Enter code…" />
                <ActionButton variant="primary" shadow={false} onClick={handleCodeSubmit} disabled={!inviteCode.trim() || validatingCode}>
                  {validatingCode ? "…" : "Go"}
                </ActionButton>
              </div>
              {codeError && <p style={{ ...BODY_STYLE, color: ACID_PINK, margin: "8px 0 0" }}>{codeError}</p>}
            </div>
          </div>
        )}

        {/* STEP 2 — ledger */}
        {step === 2 && (
          <>
            <div className="flex-1 overflow-y-auto" style={{ padding: "4px 20px 8px" }}>
              <InterestLedger
                selected={selectedTopics}
                custom={custom}
                onToggle={toggle}
                onAddCustom={addCustom}
                onRemoveCustom={removeCustom}
              />
            </div>

            {/* Footer */}
            <div style={{ borderTop: HAIRLINE, padding: "16px 20px max(16px, env(safe-area-inset-bottom))", background: SURFACE }}>
              {error && <p style={{ ...BODY_STYLE, color: ACID_PINK, margin: "0 0 10px" }}>{error}</p>}
              <div className="flex items-center gap-3">
                {!skipApiKey && (
                  <ActionButton onClick={() => setStep(1)} disabled={submitting} shadow={false}>Back</ActionButton>
                )}
                <ActionButton
                  variant="primary"
                  onClick={handleSubmit}
                  disabled={selectedTopics.length < 3 || submitting}
                  style={{ flex: 1 }}
                >
                  {submitting
                    ? <><Loader2 size={15} className="animate-spin" /> Setting up…</>
                    : selectedTopics.length < 3
                      ? `Pick ${3 - selectedTopics.length} more topic${selectedTopics.length === 2 ? "" : "s"}`
                      : "Create my first digest"}
                </ActionButton>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
