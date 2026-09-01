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

/**
 * The day a digest belongs to, or null when it is this morning's.
 *
 * Every digest is shareable from the moment it exists, but only one of them is
 * today's. Sharing one out of the vault archive used to announce it as "Today's
 * question", which is the single claim the recipient can check against the date
 * printed on the page they land on.
 */
function archiveDay(date?: string | null): string | null {
  if (!date) return null;
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  if (date === today) return null;
  const day = new Date(`${date}T12:00:00`);
  if (Number.isNaN(day.getTime())) return null;
  return day.toLocaleDateString("en-US", { month: "long", day: "numeric" });
}

export function ShareDigestButton({ digestId, theme, date, compact = false }: {
  digestId: string;
  theme?: string | null;
  /** The digest's own `YYYY-MM-DD`. Omitted reads as today's. */
  date?: string | null;
  compact?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (resetTimer.current) clearTimeout(resetTimer.current);
  }, []);

  const day = archiveDay(date);
  const title = theme || (day ? `A research digest from ${day}` : "Today's research digest");
  const text = theme
    ? (day ? `The question on ${day}: ${theme}` : `Today's question: ${theme}`)
    : "A research digest from Learning et al.";

  const share = async () => {
    const url = `${window.location.origin}/digest/${digestId}`;
    try {
      if (navigator.share) {
        await navigator.share({ title, text, url });
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
