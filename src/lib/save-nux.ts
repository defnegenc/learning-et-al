"use client";

/*
 * Save NUX — the two moments that teach what saving does.
 *
 * Saving is the most agentic thing in the product: it fires the companion
 * walkthrough and the citing-work scout, and until now it did all of that with
 * an unlabelled 16px bookmark and no feedback whatsoever. Two moments fix that,
 * and this module is the state they share:
 *
 *  · BEFORE — a strip above the digest, shown only while the reader has nothing
 *    saved. Dismissible, and it self-retires the moment the first save lands,
 *    because saving IS the dismissal.
 *  · AFTER — a confirmation panel on the first-ever save, which is also the only
 *    place the background prep is ever mentioned.
 *
 * Both flags are localStorage (the `use-session` idiom), so they are per-device.
 * The strip's real gate is server truth — the reader's save count — and the flag
 * only records "they told us to stop showing it here".
 */

const TIP_KEY = "nux_save_tip";
const FIRST_SAVE_KEY = "nux_first_save";

/** A save landed and it was this device's first. Payload: the paper. */
export const FIRST_SAVE_EVENT = "letal:first-save";
/** "Go to library →" — the app shell listens and switches to the saved shelf. */
export const OPEN_LIBRARY_EVENT = "letal:open-library";

export interface FirstSaveDetail {
  paperId: string;
  title: string;
}

function read(key: string): boolean {
  if (typeof window === "undefined") return true;
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return true; // private mode: fail quiet rather than nag every load
  }
}

function write(key: string) {
  try {
    localStorage.setItem(key, "1");
  } catch {
    /* nothing to do — the tip just reappears next visit */
  }
}

export function saveTipDismissed(): boolean {
  return read(TIP_KEY) || read(FIRST_SAVE_KEY);
}

export function dismissSaveTip() {
  write(TIP_KEY);
}

/**
 * Called by the bookmark control once the save has actually landed. On the first
 * one it retires the tip and announces itself so the confirmation panel can
 * explain what the librarian is now doing. Later saves are silent.
 */
export function announceSave(detail: FirstSaveDetail) {
  if (read(FIRST_SAVE_KEY)) return;
  write(FIRST_SAVE_KEY);
  write(TIP_KEY);
  window.dispatchEvent(new CustomEvent<FirstSaveDetail>(FIRST_SAVE_EVENT, { detail }));
}

/**
 * "Go to library →". Inside the app shell a listener claims the event and just
 * switches tabs; on a shared-digest permalink there is no shell to claim it, so
 * an unclaimed event falls back to a real navigation.
 */
export function openLibrary() {
  const handled = !window.dispatchEvent(new CustomEvent(OPEN_LIBRARY_EVENT, { cancelable: true }));
  if (!handled) window.location.href = "/";
}
