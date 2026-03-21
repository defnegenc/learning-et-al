"use client";

import { useState } from "react";
import { KeyRound, Sparkles, Loader2, ArrowRight } from "lucide-react";
import { NoiseOverlay } from "@/components/noise-overlay";
import { InterestPicker } from "@/components/interest-picker";
import type { InterestEntry } from "@/lib/field-hierarchy";

type Provider = "openai" | "anthropic" | "gemini" | "other";

interface OnboardingProps {
  onComplete: (data: {
    apiKey: string;
    provider: Provider;
    model: string;
    baseUrl: string;
    userId: string;
    contentMix: number;
  }) => void;
}

export function Onboarding({ onComplete }: OnboardingProps) {
  const [step, setStep] = useState<1 | 2>(1);

  // Step 1
  const [provider, setProvider] = useState<Provider>("openai");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");
  const [baseUrl, setBaseUrl] = useState("");

  // Step 2
  const [interests, setInterests] = useState<InterestEntry[]>([]);
  const [contentMix, setContentMix] = useState(33);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

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

  async function handleSubmit() {
    if (interests.length < 3) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          interests: interests.map((i) => ({ keyword: i.keyword, field: i.field, level: i.level })),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          contentMix,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Setup failed");
      onComplete({
        apiKey,
        provider,
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

  function getMixLabel() {
    if (contentMix <= 20) return "3 research papers";
    if (contentMix <= 50) return "2 papers, 1 news — recommended";
    if (contentMix <= 80) return "1 paper, 2 news";
    return "3 news articles";
  }

  return (
    <div
      className="relative flex min-h-screen items-center justify-center p-3 md:p-4"
      style={{ background: "white" }}
    >
      <NoiseOverlay />

      <div
        className="relative z-10 w-full p-4 md:p-6 space-y-5"
        style={{
          maxWidth: step === 2 ? "860px" : "512px",
          border: "4px solid #1a1a1a",
          background: "white",
          boxShadow: "8px 8px 0px 0px rgba(0,0,0,1)",
        }}
      >
        {/* Header */}
        <div className="space-y-1">
          <h2
            className="flex items-center gap-2 text-[0.95rem] font-bold uppercase tracking-[2px] text-[#1a1a1a]"
            style={{ fontFamily: "var(--font-display), sans-serif" }}
          >
            {step === 1 ? (
              <><KeyRound className="size-4" />Connect AI Provider</>
            ) : (
              <><Sparkles className="size-4" />Build Your Interests</>
            )}
          </h2>
          <p
            className="text-[0.75rem] text-[#666]"
            style={{ fontFamily: "inherit" }}
          >
            {step === 1
              ? "Learning et al. uses an LLM to summarize and rank papers."
              : "Pick fields to explore. We'll suggest topics and filter papers to your domain."}
          </p>
        </div>

        {/* STEP 1 */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="flex gap-0 flex-wrap md:flex-nowrap">
              {(["openai", "anthropic", "gemini", "other"] as Provider[]).map((p) => (
                <button
                  key={p}
                  onClick={() => handleProviderChange(p)}
                  className={`flex-1 px-2 py-2 md:py-1.5 text-[0.7rem] font-bold uppercase tracking-[1px] transition-colors min-h-[44px] md:min-h-0 ${
                    provider === p ? "bg-[#1a1a1a] text-white" : "text-[#1a1a1a] hover:bg-gray-100"
                  }`}
                  style={{
                    border: "2px solid #1a1a1a",
                    marginRight: "-2px",
                    fontFamily: "var(--font-mono), monospace",
                    boxShadow: provider === p ? "2px 2px 0px 0px rgba(0,0,0,1)" : "none",
                  }}
                >
                  {providerDefaults[p].label}
                </button>
              ))}
            </div>

            <div className="space-y-1">
              <label
                htmlFor="api-key"
                className="text-[0.7rem] uppercase tracking-[2px] text-[#666]"
                style={{ fontFamily: "var(--font-mono), monospace" }}
              >
                API Key
              </label>
              <input
                id="api-key"
                type="password"
                placeholder="sk-..."
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && apiKey.trim() && setStep(2)}
                className="w-full bg-transparent px-3 py-1.5 text-[0.9rem] placeholder:text-[#666] focus:outline-none"
                style={{ border: "2px solid #1a1a1a" }}
              />
            </div>

            {provider === "other" && (
              <>
                <div className="space-y-1">
                  <label
                    htmlFor="model"
                    className="text-[0.7rem] uppercase tracking-[2px] text-[#666]"
                    style={{ fontFamily: "var(--font-mono), monospace" }}
                  >
                    Model
                  </label>
                  <input
                    id="model"
                    placeholder="e.g. gpt-4o-mini"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className="w-full bg-transparent px-3 py-1.5 text-[0.9rem] placeholder:text-[#666] focus:outline-none"
                    style={{ border: "2px solid #1a1a1a" }}
                  />
                </div>
                <div className="space-y-1">
                  <label
                    htmlFor="base-url"
                    className="text-[0.7rem] uppercase tracking-[2px] text-[#666]"
                    style={{ fontFamily: "var(--font-mono), monospace" }}
                  >
                    Base URL
                  </label>
                  <input
                    id="base-url"
                    placeholder="https://api.example.com/v1"
                    value={baseUrl}
                    onChange={(e) => setBaseUrl(e.target.value)}
                    className="w-full bg-transparent px-3 py-1.5 text-[0.9rem] placeholder:text-[#666] focus:outline-none"
                    style={{ border: "2px solid #1a1a1a" }}
                  />
                </div>
              </>
            )}

            <button
              disabled={!apiKey.trim()}
              onClick={() => setStep(2)}
              className="w-full bg-[#1a1a1a] text-white px-4 py-2 text-[0.75rem] uppercase tracking-[2px] hover:bg-[#333] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              style={{
                border: "2px solid #1a1a1a",
                fontFamily: "var(--font-mono), monospace",
                boxShadow: "3px 3px 0px 0px rgba(0,0,0,0.12)",
              }}
            >
              Continue <ArrowRight className="size-3" />
            </button>
          </div>
        )}

        {/* STEP 2 */}
        {step === 2 && (
          <div className="space-y-5">
            <InterestPicker interests={interests} onChange={setInterests} />

            {interests.length < 3 && (
              <p
                className="text-[0.65rem] text-[#999] uppercase tracking-[1px]"
                style={{ fontFamily: "var(--font-mono), monospace" }}
              >
                Add at least {3 - interests.length} more topic{3 - interests.length !== 1 ? "s" : ""} to continue
              </p>
            )}

            {/* Content mix */}
            <div className="space-y-2 p-3" style={{ border: "2px solid #1a1a1a" }}>
              <div className="flex items-center justify-between">
                <label
                  className="text-[0.7rem] uppercase tracking-[2px] text-[#1a1a1a] font-bold"
                  style={{ fontFamily: "var(--font-mono), monospace" }}
                >
                  Content Mix
                </label>
                <span
                  className="text-[0.65rem] uppercase tracking-[1px] text-[#666]"
                  style={{ fontFamily: "var(--font-mono), monospace" }}
                >
                  {getMixLabel()}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className="text-[0.6rem] uppercase tracking-[1px] text-[#999] whitespace-nowrap"
                  style={{ fontFamily: "var(--font-mono), monospace" }}
                >
                  Just research
                </span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={contentMix}
                  onChange={(e) => setContentMix(Number(e.target.value))}
                  className="flex-1 h-1 appearance-none bg-[#1a1a1a] outline-none"
                  style={{ cursor: "crosshair", accentColor: "#1a1a1a" }}
                />
                <span
                  className="text-[0.6rem] uppercase tracking-[1px] text-[#999] whitespace-nowrap"
                  style={{ fontFamily: "var(--font-mono), monospace" }}
                >
                  Just news
                </span>
              </div>
            </div>

            {error && <p className="text-[0.8rem] text-[#ff007f]">{error}</p>}

            <div className="flex gap-2">
              <button
                onClick={() => setStep(1)}
                disabled={submitting}
                className="px-4 py-2 text-[0.75rem] uppercase tracking-[2px] text-[#1a1a1a] hover:bg-gray-100 transition-colors disabled:opacity-50"
                style={{ border: "2px solid #1a1a1a", fontFamily: "var(--font-mono), monospace" }}
              >
                Back
              </button>
              <button
                disabled={interests.length < 3 || submitting}
                onClick={handleSubmit}
                className="flex-1 bg-[#1a1a1a] text-white px-4 py-2 text-[0.75rem] uppercase tracking-[2px] hover:bg-[#333] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                style={{
                  border: "2px solid #1a1a1a",
                  fontFamily: "var(--font-mono), monospace",
                  boxShadow: "3px 3px 0px 0px rgba(0,0,0,0.12)",
                }}
              >
                {submitting ? (
                  <><Loader2 className="size-3 animate-spin" /> Setting up...</>
                ) : (
                  "Start Exploring"
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
