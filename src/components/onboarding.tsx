"use client";

import { useState, type KeyboardEvent } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { KeyRound, Sparkles, X, Loader2, ArrowRight } from "lucide-react";

type Provider = "openai" | "anthropic" | "other";

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
    openai: { model: "gpt-4o-mini", baseUrl: "https://api.openai.com/v1", label: "OpenAI" },
    anthropic: { model: "claude-sonnet-4-20250514", baseUrl: "https://api.anthropic.com", label: "Anthropic" },
    other: { model: "", baseUrl: "", label: "Other" },
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

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Setup failed");
      }

      const { userId } = await res.json();
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
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 p-4 dark:bg-zinc-950">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            {step === 1 ? (
              <>
                <KeyRound className="size-5 text-primary" />
                Connect your AI provider
              </>
            ) : (
              <>
                <Sparkles className="size-5 text-primary" />
                What are you interested in?
              </>
            )}
          </CardTitle>
          <CardDescription>
            {step === 1
              ? "Learning et al. uses an LLM to summarize and rank papers. Enter your API key to get started."
              : "Add 3\u201310 short phrases describing your research interests. Press Enter after each one."}
          </CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col gap-5">
          {step === 1 && (
            <>
              {/* Provider selector */}
              <div className="flex gap-1 rounded-lg bg-muted p-1">
                {(["openai", "anthropic", "other"] as Provider[]).map((p) => (
                  <button
                    key={p}
                    onClick={() => handleProviderChange(p)}
                    className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                      provider === p
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {providerDefaults[p].label}
                  </button>
                ))}
              </div>

              {/* API key */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="api-key" className="text-sm font-medium">
                  API Key
                </label>
                <Input
                  id="api-key"
                  type="password"
                  placeholder={`sk-...`}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleStepOneNext()}
                />
              </div>

              {/* Model (pre-filled) */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="model" className="text-sm font-medium">
                  Model
                </label>
                <Input
                  id="model"
                  placeholder="e.g. gpt-4o-mini"
                  value={model || providerDefaults[provider].model}
                  onChange={(e) => setModel(e.target.value)}
                />
              </div>

              {/* Base URL (collapsible for "other") */}
              {provider === "other" && (
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="base-url" className="text-sm font-medium">
                    Base URL
                  </label>
                  <Input
                    id="base-url"
                    placeholder="https://api.example.com/v1"
                    value={baseUrl}
                    onChange={(e) => setBaseUrl(e.target.value)}
                  />
                </div>
              )}

              <Button
                size="lg"
                disabled={!apiKey.trim()}
                onClick={handleStepOneNext}
                className="mt-1 w-full"
              >
                Continue
                <ArrowRight className="ml-1 size-4" data-icon="inline-end" />
              </Button>
            </>
          )}

          {step === 2 && (
            <>
              {/* Interest input */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="interest" className="text-sm font-medium">
                  Add an interest
                </label>
                <Input
                  id="interest"
                  placeholder='e.g. "transformer architectures" then press Enter'
                  value={interestInput}
                  onChange={(e) => setInterestInput(e.target.value)}
                  onKeyDown={handleAddInterest}
                  disabled={submitting}
                />
              </div>

              {/* Interest badges */}
              {interests.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {interests.map((interest) => (
                    <Badge
                      key={interest}
                      variant="secondary"
                      className="group/interest cursor-pointer gap-1 pr-1.5 transition-colors hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => handleRemoveInterest(interest)}
                    >
                      {interest}
                      <X className="size-3 opacity-0 transition-opacity group-hover/interest:opacity-100" />
                    </Badge>
                  ))}
                </div>
              )}

              {interests.length < 3 && (
                <p className="text-xs text-muted-foreground">
                  Add at least {3 - interests.length} more {3 - interests.length === 1 ? "interest" : "interests"} to continue.
                </p>
              )}

              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setStep(1)}
                  disabled={submitting}
                >
                  Back
                </Button>
                <Button
                  size="lg"
                  className="flex-1"
                  disabled={interests.length < 3 || submitting}
                  onClick={handleSubmit}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="size-4 animate-spin" data-icon="inline-start" />
                      Setting up...
                    </>
                  ) : (
                    "Start exploring"
                  )}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
