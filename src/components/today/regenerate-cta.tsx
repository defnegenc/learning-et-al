"use client";

import { useState } from "react";
import { X, Loader2 } from "lucide-react";

const MONO = "var(--font-mono), monospace";
const DISPLAY = "var(--font-display), sans-serif";
const MIN_REASON_WORDS = 3;

function wordCount(value: string) {
  return value.trim().split(/\s+/).filter(word => /[\p{L}\p{N}]/u.test(word)).length;
}

// End-of-digest escape hatch: big centered dark-grey text + X. Clicking reveals
// a one-line reason input; submitting files digest feedback, hides the digest,
// and force-regenerates. Named after its reward (a fresh digest), not the complaint.
export function RegenerateCta({ digestId, generating, onRegenerate }: {
  digestId: string;
  generating: boolean;
  onRegenerate: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const reasonWordCount = wordCount(reason);
  const hasEnoughWords = reasonWordCount >= MIN_REASON_WORDS;

  const submit = async () => {
    if (!hasEnoughWords || submitted) return;
    setSubmitted(true);
    try {
      await fetch("/api/digest/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ digestId, reason: reason.trim() }),
      });
      await fetch("/api/digest/hide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ digestId }),
      });
    } catch { /* non-critical — still regenerate */ }
    onRegenerate();
  };

  if (submitted && generating) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 10, padding: "36px 0", color: "#888", fontFamily: MONO, fontSize: "0.75rem" }}>
        <Loader2 size={14} className="animate-spin" /> Generating a new digest…
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, padding: "36px 0 8px", textAlign: "center" }}>
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, background: "none", border: "none", cursor: "pointer", color: "#555" }}
          className="hover:opacity-70"
        >
          <X size={28} strokeWidth={2.5} style={{ color: "#555" }} />
          <span style={{ fontFamily: DISPLAY, fontSize: "1.05rem", fontWeight: 700, color: "#555", letterSpacing: "-0.01em" }}>
            Don&apos;t like this digest? Regenerate.
          </span>
        </button>
      ) : (
        <div style={{ width: "100%", maxWidth: 420, display: "flex", flexDirection: "column", gap: 10 }}>
          <p style={{ fontSize: "0.8rem", color: "#555", fontFamily: MONO, margin: 0 }}>
            Tell us why and we&apos;ll regenerate.
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={reason}
              onChange={e => setReason(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && hasEnoughWords) submit(); }}
              placeholder="e.g. too technical, already know this topic…"
              autoFocus
              aria-describedby="regenerate-reason-requirement"
              style={{ flex: 1, padding: "8px 10px", border: "1.5px solid #1a1a1a", fontSize: "0.8rem", outline: "none", fontFamily: "var(--font-inter), sans-serif" }}
            />
            <button
              onClick={submit}
              disabled={!hasEnoughWords || generating}
              className="hover:bg-[#333] disabled:opacity-40"
              style={{ padding: "8px 14px", background: "#1a1a1a", color: "white", border: "none", cursor: "pointer", fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", fontFamily: MONO }}
            >
              {generating ? <Loader2 size={12} className="animate-spin" /> : "Regenerate"}
            </button>
          </div>
          <p id="regenerate-reason-requirement" style={{ fontSize: "0.68rem", color: "#888", fontFamily: MONO, margin: 0, textAlign: "left" }}>
            {hasEnoughWords ? "Thanks — that helps." : `Please enter at least ${MIN_REASON_WORDS} words.`}
          </p>
        </div>
      )}
    </div>
  );
}
