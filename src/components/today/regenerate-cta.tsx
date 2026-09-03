"use client";

import { useState } from "react";
import { X, Loader2 } from "lucide-react";
import { ActionButton, BODY_STYLE, DIM, DISPLAY_SM, Label, MUTED, TextInput } from "@/components/design-system";

const MIN_REASON_WORDS = 3;

function wordCount(value: string) {
  return value.trim().split(/\s+/).filter(word => /[\p{L}\p{N}]/u.test(word)).length;
}

// End-of-digest escape hatch: big centered dark-grey text + X. Clicking reveals
// a one-line reason input; submitting files digest feedback and
// force-regenerates. The current edition is NOT hidden here: the pipeline
// retires it atomically the moment the replacement is ready to insert (force
// path in generateDigest), so the site never sits with no visible edition for
// today while a multi-minute generation runs - or if it fails. Named after its
// reward (a fresh digest), not the complaint.
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
    } catch { /* non-critical — still regenerate */ }
    onRegenerate();
  };

  if (submitted && generating) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 10, padding: "36px 0", color: MUTED }}>
        <Loader2 size={14} className="animate-spin" />
        <Label>Generating a new digest…</Label>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, padding: "36px 0 8px", textAlign: "center" }}>
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, background: "none", border: "none", cursor: "pointer", color: DIM }}
          className="hover:opacity-70"
        >
          <X size={28} strokeWidth={2.5} style={{ color: DIM }} />
          <span style={{ ...DISPLAY_SM, color: DIM }}>
            Don&apos;t like this digest? Regenerate.
          </span>
        </button>
      ) : (
        <div style={{ width: "100%", maxWidth: 420, display: "flex", flexDirection: "column", gap: 10 }}>
          <p style={{ ...BODY_STYLE, color: DIM, margin: 0 }}>
            Tell us why and we&apos;ll regenerate.
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            <TextInput
              value={reason}
              onChange={setReason}
              onKeyDown={e => { if (e.key === "Enter" && hasEnoughWords) submit(); }}
              placeholder="e.g. too technical, already know this topic…"
              autoFocus
            />
            <ActionButton variant="primary" onClick={submit} disabled={!hasEnoughWords || generating} shadow={false}>
              {generating ? <Loader2 size={14} className="animate-spin" /> : "Regenerate"}
            </ActionButton>
          </div>
          <p id="regenerate-reason-requirement" style={{ ...BODY_STYLE, fontSize: 13, color: MUTED, margin: 0, textAlign: "left" }}>
            {hasEnoughWords ? "Thanks, that helps." : `Please enter at least ${MIN_REASON_WORDS} words.`}
          </p>
        </div>
      )}
    </div>
  );
}
