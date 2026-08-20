"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Share2 } from "lucide-react";
import { ActionButton } from "@/components/design-system";

async function copyText(value: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }
  const input = document.createElement("textarea");
  input.value = value;
  input.style.position = "fixed";
  input.style.opacity = "0";
  document.body.appendChild(input);
  input.select();
  document.execCommand("copy");
  input.remove();
}

export function ShareDigestButton({ digestId, theme, compact = false }: {
  digestId: string;
  theme?: string | null;
  compact?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (resetTimer.current) clearTimeout(resetTimer.current);
  }, []);

  const share = async () => {
    const url = `${window.location.origin}/digest/${digestId}`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: theme || "Today's research digest",
          text: theme ? `Today's question: ${theme}` : "A research digest from Learning et al.",
          url,
        });
        return;
      }
      await copyText(url);
      setCopied(true);
      if (resetTimer.current) clearTimeout(resetTimer.current);
      resetTimer.current = setTimeout(() => setCopied(false), 2200);
    } catch (error) {
      // Closing the native share sheet is not an error the page needs to show.
      if (error instanceof DOMException && error.name === "AbortError") return;
      try {
        await copyText(url);
        setCopied(true);
      } catch { /* the browser blocked both native share and clipboard */ }
    }
  };

  return (
    <ActionButton
      variant="plain"
      shadow={false}
      onClick={share}
      title="Share this digest"
      style={compact ? { padding: "6px 2px" } : undefined}
    >
      {copied ? <Check size={15} /> : <Share2 size={15} />}
      {copied ? "Link copied" : "Share"}
    </ActionButton>
  );
}
