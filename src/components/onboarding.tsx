"use client";

import { useState, type KeyboardEvent } from "react";
import { KeyRound, Sparkles, X, Loader2, ArrowRight } from "lucide-react";
import { NoiseOverlay } from "@/components/noise-overlay";

type Provider = "openai" | "anthropic" | "gemini" | "other";

interface OnboardingProps {
  onComplete: (data: {
    apiKey: string;
    provider: Provider;
    model: string;
    baseUrl: string;
    userId: string;
  }) => void;
}

export function Onboarding({ onComplete }: OnboardingProps) {
  const [step, setStep] = useState<1 | 2>(1);

  // Step 1 state
  const [provider, setProvider] = useState<Provider>("openai");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");
  const [baseUrl, setBaseUrl] = useState("");

  // Step 2 state
  const [interests, setInterests] = useState<string[]>([]);
  const [interestInput, setInterestInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const providerDefaults: Record<Provider, { model: string; baseUrl: string; label: string }> = {
    openai: { model: "gpt-4o-mini", baseUrl: "https://api.openai.com/v1", label: "OPENAI" },
    anthropic: { model: "claude-sonnet-4-20250514", baseUrl: "https://api.anthropic.com", label: "ANTHROPIC" },
    gemini: { model: "gemini-2.5-flash", baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai", label: "GEMINI" },
    other: { model: "", baseUrl: "", label: "OTHER" },
  };

  function handleProviderChange(p: Provider) {
    setProvider(p);
    setModel(providerDefaults[p].model);
    setBaseUrl(providerDefaults[p].baseUrl);
  }

  function handleStepOneNext() {
    if (!apiKey.trim()) return;
    setStep(2);
  }

  function handleAddInterest(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && interestInput.trim()) {
      e.preventDefault();
      const value = interestInput.trim().toLowerCase();
      if (!interests.includes(value) && interests.length < 10) {
        setInterests([...interests, value]);
      }
      setInterestInput("");
    }
  }

  function handleRemoveInterest(interest: string) {
    setInterests(interests.filter((i) => i !== interest));
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
          interestStrings: interests,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Setup failed");
      }

      const { userId } = data;
      onComplete({
        apiKey,
        provider,
        model: model || providerDefaults[provider].model,
        baseUrl: baseUrl || providerDefaults[provider].baseUrl,
        userId,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setSubmitting(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center p-4" style={{ background: "#e8e8e8" }}>
      <NoiseOverlay />

      <div className="relative z-10 w-full max-w-lg border border-[#1a1a1a] p-6 space-y-5" style={{ borderWidth: "1.5px", background: "#e8e8e8" }}>
        {/* Header */}
        <div className="space-y-2">
          <h2 className="flex items-center gap-2 text-[0.8rem] font-bold uppercase tracking-[2px] text-[#1a1a1a]" style={{ fontFamily: '"Courier New", Courier, monospace' }}>
            {step === 1 ? (
              <>
                <KeyRound className="size-4" />
                CONNECT_AI_PROVIDER
              </>
            ) : (
              <>
                <Sparkles className="size-4" />
                DEFINE_INTERESTS
              </>
            )}
          </h2>
          <p className="text-[0.75rem] text-[#555]">
            {step === 1
              ? "Learning et al. uses an LLM to summarize and rank papers. Enter your API key to get started."
              : "Add 3\u201310 short phrases describing your research interests. Press Enter after each one."}
          </p>
        </div>

        {step === 1 && (
          <div className="space-y-4">
            {/* Provider selector */}
            <div className="flex gap-0">
              {(["openai", "anthropic", "gemini", "other"] as Provider[]).map((p) => (
                <button
                  key={p}
                  onClick={() => handleProviderChange(p)}
                  className={`flex-1 border border-[#1a1a1a] px-2 py-1.5 text-[0.6rem] font-bold uppercase tracking-[1px] transition-colors ${
                    provider === p
                      ? "bg-[#1a1a1a] text-[#e8e8e8]"
                      : "text-[#1a1a1a] hover:bg-[#d8d8d8]"
                  }`}
                  style={{ borderWidth: "1.5px", marginRight: "-1.5px", fontFamily: '"Courier New", Courier, monospace' }}
                >
                  {providerDefaults[p].label}
                </button>
              ))}
            </div>

            {/* API key */}
            <div className="space-y-1">
              <label
                htmlFor="api-key"
                className="text-[0.6rem] uppercase tracking-[2px] text-[#555]"
                style={{ fontFamily: '"Courier New", Courier, monospace' }}
              >
                API_KEY
              </label>
              <input
                id="api-key"
                type="password"
                placeholder="sk-..."
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleStepOneNext()}
                className="w-full border border-[#1a1a1a] bg-transparent px-3 py-1.5 text-[0.8rem] placeholder:text-[#555] focus:outline-none"
                style={{ borderWidth: "1.5px" }}
              />
            </div>

            {/* Model + Base URL (only for "other") */}
            {provider === "other" && (
              <div className="space-y-1">
                <label
                  htmlFor="model"
                  className="text-[0.6rem] uppercase tracking-[2px] text-[#555]"
                  style={{ fontFamily: '"Courier New", Courier, monospace' }}
                >
                  MODEL
                </label>
                <input
                  id="model"
                  placeholder="e.g. gpt-4o-mini"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="w-full border border-[#1a1a1a] bg-transparent px-3 py-1.5 text-[0.8rem] placeholder:text-[#555] focus:outline-none"
                  style={{ borderWidth: "1.5px" }}
                />
              </div>
            )}

            {provider === "other" && (
              <div className="space-y-1">
                <label
                  htmlFor="base-url"
                  className="text-[0.6rem] uppercase tracking-[2px] text-[#555]"
                  style={{ fontFamily: '"Courier New", Courier, monospace' }}
                >
                  BASE_URL
                </label>
                <input
                  id="base-url"
                  placeholder="https://api.example.com/v1"
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  className="w-full border border-[#1a1a1a] bg-transparent px-3 py-1.5 text-[0.8rem] placeholder:text-[#555] focus:outline-none"
                  style={{ borderWidth: "1.5px" }}
                />
              </div>
            )}

            <button
              disabled={!apiKey.trim()}
              onClick={handleStepOneNext}
              className="w-full border border-[#1a1a1a] bg-[#1a1a1a] text-[#e8e8e8] px-4 py-2 text-[0.7rem] uppercase tracking-[2px] hover:bg-[#333] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              style={{ borderWidth: "1.5px", fontFamily: '"Courier New", Courier, monospace' }}
            >
              CONTINUE
              <ArrowRight className="size-3" />
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            {/* Interest input */}
            <div className="space-y-1">
              <label
                htmlFor="interest"
                className="text-[0.6rem] uppercase tracking-[2px] text-[#555]"
                style={{ fontFamily: '"Courier New", Courier, monospace' }}
              >
                ADD_INTEREST
              </label>
              <input
                id="interest"
                placeholder='"transformer architectures" then press Enter'
                value={interestInput}
                onChange={(e) => setInterestInput(e.target.value)}
                onKeyDown={handleAddInterest}
                disabled={submitting}
                className="w-full border border-[#1a1a1a] bg-transparent px-3 py-1.5 text-[0.8rem] placeholder:text-[#555] focus:outline-none disabled:opacity-50"
                style={{ borderWidth: "1.5px" }}
              />
            </div>

            {/* Interest tags */}
            {interests.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {interests.map((interest) => (
                  <button
                    key={interest}
                    onClick={() => handleRemoveInterest(interest)}
                    className="group/interest border border-[#1a1a1a] px-2 py-0.5 text-[0.65rem] uppercase tracking-[1px] text-[#1a1a1a] hover:border-[#ff007f] hover:text-[#ff007f] transition-colors flex items-center gap-1"
                    style={{ borderWidth: "1.5px", fontFamily: '"Courier New", Courier, monospace' }}
                  >
                    {interest}
                    <X className="size-2.5 opacity-0 group-hover/interest:opacity-100 transition-opacity" />
                  </button>
                ))}
              </div>
            )}

            {interests.length < 3 && (
              <p
                className="text-[0.65rem] text-[#555] uppercase tracking-[1px]"
                style={{ fontFamily: '"Courier New", Courier, monospace' }}
              >
                ADD AT LEAST {3 - interests.length} MORE {3 - interests.length === 1 ? "INTEREST" : "INTERESTS"} TO CONTINUE.
              </p>
            )}

            {error && (
              <p className="text-[0.75rem] text-[#ff007f]">{error}</p>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => setStep(1)}
                disabled={submitting}
                className="border border-[#1a1a1a] px-4 py-2 text-[0.7rem] uppercase tracking-[2px] text-[#1a1a1a] hover:bg-[#d8d8d8] transition-colors disabled:opacity-50"
                style={{ borderWidth: "1.5px", fontFamily: '"Courier New", Courier, monospace' }}
              >
                BACK
              </button>
              <button
                disabled={interests.length < 3 || submitting}
                onClick={handleSubmit}
                className="flex-1 border border-[#1a1a1a] bg-[#1a1a1a] text-[#e8e8e8] px-4 py-2 text-[0.7rem] uppercase tracking-[2px] hover:bg-[#333] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                style={{ borderWidth: "1.5px", fontFamily: '"Courier New", Courier, monospace' }}
              >
                {submitting ? (
                  <>
                    <Loader2 className="size-3 animate-spin" />
                    SETTING_UP...
                  </>
                ) : (
                  "START_EXPLORING"
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
