"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Settings, Loader2, CheckCircle, XCircle } from "lucide-react";

type Provider = "openai" | "anthropic" | "gemini" | "other";

interface SettingsDialogProps {
  session: {
    apiKey: string;
    provider: string;
    model: string;
    baseUrl: string;
  };
  updateSession: (updates: Record<string, unknown>) => void;
}

const providerDefaults: Record<Provider, { model: string; label: string }> = {
  openai: { model: "gpt-4o-mini", label: "OPENAI" },
  anthropic: { model: "claude-sonnet-4-20250514", label: "ANTHROPIC" },
  gemini: { model: "gemini-2.5-flash", label: "GEMINI" },
  other: { model: "", label: "OTHER" },
};

export function SettingsDialog({ session, updateSession }: SettingsDialogProps) {
  const [open, setOpen] = useState(false);
  const [provider, setProvider] = useState<Provider>(session.provider as Provider);
  const [apiKey, setApiKey] = useState(session.apiKey);
  const [model, setModel] = useState(session.model);
  const [baseUrl, setBaseUrl] = useState(session.baseUrl);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    if (open) {
      setProvider(session.provider as Provider);
      setApiKey(session.apiKey);
      setModel(session.model);
      setBaseUrl(session.baseUrl);
      setTestResult(null);
    }
  }, [open, session]);

  function handleProviderChange(p: Provider) {
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
      if (data.success) {
        setTestResult({ success: true, message: "CONNECTION_OK" });
      } else {
        setTestResult({ success: false, message: data.error });
      }
    } catch {
      setTestResult({ success: false, message: "NETWORK_ERROR" });
    }
    setTesting(false);
  }

  function handleSave() {
    updateSession({ apiKey, provider, model: model || providerDefaults[provider].model, baseUrl });
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" size="icon" />}>
        <Settings className="size-4" />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-[0.75rem] font-bold uppercase tracking-[2px]" style={{ fontFamily: '"Courier New", Courier, monospace' }}>
            SETTINGS
          </DialogTitle>
          <DialogDescription className="text-[0.7rem] text-[#555]">
            Update your AI provider and API key.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {/* Provider selector */}
          <div className="flex gap-0">
            {(["openai", "anthropic", "gemini", "other"] as Provider[]).map((p) => (
              <button
                key={p}
                onClick={() => handleProviderChange(p)}
                className={`flex-1 border border-[#1a1a1a] px-2 py-1.5 text-[0.55rem] font-bold uppercase tracking-[1px] transition-colors ${
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

          <div className="space-y-1">
            <label className="text-[0.6rem] uppercase tracking-[2px] text-[#555]" style={{ fontFamily: '"Courier New", Courier, monospace' }}>
              API_KEY
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => { setApiKey(e.target.value); setTestResult(null); }}
              placeholder="sk-..."
              className="w-full border border-[#1a1a1a] bg-transparent px-3 py-1.5 text-[0.8rem] placeholder:text-[#555] focus:outline-none"
              style={{ borderWidth: "1.5px" }}
            />
          </div>

          {provider === "other" && (
            <div className="space-y-1">
              <label className="text-[0.6rem] uppercase tracking-[2px] text-[#555]" style={{ fontFamily: '"Courier New", Courier, monospace' }}>
                MODEL
              </label>
              <input
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="e.g. gpt-4o-mini"
                className="w-full border border-[#1a1a1a] bg-transparent px-3 py-1.5 text-[0.8rem] placeholder:text-[#555] focus:outline-none"
                style={{ borderWidth: "1.5px" }}
              />
            </div>
          )}

          {provider === "other" && (
            <div className="space-y-1">
              <label className="text-[0.6rem] uppercase tracking-[2px] text-[#555]" style={{ fontFamily: '"Courier New", Courier, monospace' }}>
                BASE_URL
              </label>
              <input
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="https://api.example.com/v1"
                className="w-full border border-[#1a1a1a] bg-transparent px-3 py-1.5 text-[0.8rem] placeholder:text-[#555] focus:outline-none"
                style={{ borderWidth: "1.5px" }}
              />
            </div>
          )}

          {/* Test connection */}
          <button
            onClick={handleTest}
            disabled={testing || !apiKey.trim()}
            className="border border-[#1a1a1a] px-3 py-1.5 text-[0.65rem] uppercase tracking-[2px] text-[#1a1a1a] hover:bg-[#d8d8d8] transition-colors disabled:opacity-50 flex items-center gap-1.5 w-fit"
            style={{ borderWidth: "1.5px", fontFamily: '"Courier New", Courier, monospace' }}
          >
            {testing ? <><Loader2 className="size-3 animate-spin" /> TESTING...</> : "TEST_CONNECTION"}
          </button>

          {testResult && (
            <div className={`flex items-center gap-2 text-[0.7rem] ${testResult.success ? "text-[#38b000]" : "text-[#ff007f]"}`}>
              {testResult.success ? <CheckCircle className="size-3" /> : <XCircle className="size-3" />}
              <span
                className="uppercase tracking-[1px]"
                style={{ fontFamily: '"Courier New", Courier, monospace' }}
              >
                {testResult.message}
              </span>
            </div>
          )}
        </div>

        <DialogFooter>
          <button
            onClick={handleSave}
            disabled={!apiKey.trim()}
            className="border border-[#1a1a1a] bg-[#1a1a1a] text-[#e8e8e8] px-4 py-1.5 text-[0.65rem] uppercase tracking-[2px] hover:bg-[#333] transition-colors disabled:opacity-50"
            style={{ borderWidth: "1.5px", fontFamily: '"Courier New", Courier, monospace' }}
          >
            SAVE
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
