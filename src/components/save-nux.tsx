"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import {
  ACID_GREEN, BODY_SM, BODY_STYLE, BORDER, DIM, INK, LABEL_STYLE, MUTED, SHADOW, SURFACE,
} from "@/components/design-system";
import {
  FIRST_SAVE_EVENT, OPEN_LIBRARY_EVENT, dismissSaveTip, openLibrary, saveTipDismissed,
  subscribeSaveTip, type FirstSaveDetail,
} from "@/lib/save-nux";

/*
 * The two save-NUX surfaces. See `src/lib/save-nux.ts` for the state they share.
 *
 * Neither is anchored to a control. An anchored coachmark on the bookmark icon
 * would teach the control itself, but it fights scroll, it competes with the
 * foundational card's own tooltip, and it is the pattern that annoys hardest
 * when it misfires. The strip is page furniture and the confirmation arrives
 * only after the reader has already acted, so neither can point at nothing.
 *
 * Nothing new enters the menu: BORDER, SHADOW, the Label eyebrow, Body and
 * Body/SM, and acid green strictly as ink.
 */

/**
 * The "before" half — a band above the digest, while the reader has nothing
 * saved. One sentence, because the point is that saving starts a piece of work
 * rather than filing a link.
 */
export function SaveTipStrip({ show }: { show: boolean }) {
  // localStorage is an external store, and both things that retire the tip —
  // the × and the first save — happen outside React. The server snapshot is
  // "dismissed", so the strip never renders on the server and gets pulled away
  // on hydration; it fades in on the client or not at all.
  const dismissed = useSyncExternalStore(subscribeSaveTip, saveTipDismissed, () => true);

  if (!show || dismissed) return null;

  return (
    <div
      style={{
        border: BORDER,
        background: SURFACE,
        padding: "14px 16px",
        marginBottom: 28,
        display: "flex",
        alignItems: "flex-start",
        gap: 16,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ ...LABEL_STYLE, marginBottom: 6 }}>Tip</div>
        <p style={{ ...BODY_STYLE, color: DIM, margin: 0 }}>
          Save a paper and your librarian starts reading it: a guided
          walkthrough, key terms, and what&rsquo;s been published since, waiting
          in your library.
        </p>
      </div>
      <button
        onClick={dismissSaveTip}
        aria-label="Dismiss tip"
        style={{
          background: "none", border: "none", cursor: "pointer", padding: 0,
          fontSize: 18, lineHeight: 1, color: MUTED, flexShrink: 0, marginTop: 2,
        }}
      >
        ×
      </button>
    </div>
  );
}

/** How long the confirmation sits there before retiring itself. */
const CONFIRM_MS = 14_000;

/**
 * The "after" half — the first-ever save, confirmed.
 *
 * This is the highest-leverage piece of the two: it explains the feature at the
 * exact moment the reader acted, and it is the only thing in the product that
 * has ever mentioned the companion and scout generation that has always run in
 * the background on save. Acid green is ink here — the check and the word
 * "Saved" — never the panel's fill.
 */
export function FirstSaveConfirmation() {
  const [detail, setDetail] = useState<FirstSaveDetail | null>(null);

  useEffect(() => {
    const onSave = (e: Event) => setDetail((e as CustomEvent<FirstSaveDetail>).detail);
    window.addEventListener(FIRST_SAVE_EVENT, onSave);
    return () => window.removeEventListener(FIRST_SAVE_EVENT, onSave);
  }, []);

  useEffect(() => {
    if (!detail) return;
    const t = setTimeout(() => setDetail(null), CONFIRM_MS);
    return () => clearTimeout(t);
  }, [detail]);

  if (!detail) return null;

  return (
    <div
      role="status"
      style={{
        position: "fixed",
        bottom: 24,
        left: 24,
        right: "auto",
        zIndex: 10030,
        width: 320,
        maxWidth: "calc(100vw - 48px)",
        background: SURFACE,
        border: BORDER,
        boxShadow: SHADOW,
      }}
    >
      <div style={{ borderBottom: BORDER, padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <span style={{ ...LABEL_STYLE, color: ACID_GREEN }}>✓ Saved</span>
        <button
          onClick={() => setDetail(null)}
          aria-label="Dismiss"
          style={{ background: "none", border: "none", cursor: "pointer", padding: 0, fontSize: 18, lineHeight: 1, color: MUTED }}
        >
          ×
        </button>
      </div>
      <div style={{ padding: 14 }}>
        <p style={{ ...BODY_STYLE, color: DIM, margin: 0 }}>
          Your librarian is reading it now. A walkthrough and related work will
          be in your library in a minute or two.
        </p>
        <p style={{ ...BODY_SM, color: MUTED, fontStyle: "italic", margin: "8px 0 0" }}>
          {detail.title}
        </p>
        <button
          onClick={() => { openLibrary(); setDetail(null); }}
          style={{
            ...BODY_STYLE,
            background: "none",
            border: "none",
            padding: 0,
            marginTop: 12,
            color: INK,
            cursor: "pointer",
            textDecoration: "underline",
            textUnderlineOffset: 4,
          }}
        >
          Go to library →
        </button>
      </div>
    </div>
  );
}

/**
 * Wire the "Go to library →" link to a tab change. The shell owns navigation;
 * this keeps the panel from needing to know how the shell is built.
 */
export function useOpenLibrary(handler: () => void) {
  useEffect(() => {
    // Claiming the event is what tells `openLibrary` not to fall back to a full
    // navigation — see the note there.
    const claim = (e: Event) => { e.preventDefault(); handler(); };
    window.addEventListener(OPEN_LIBRARY_EVENT, claim);
    return () => window.removeEventListener(OPEN_LIBRARY_EVENT, claim);
  }, [handler]);
}
