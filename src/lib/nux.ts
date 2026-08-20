"use client";

/**
 * First-visit flags.
 *
 * Every tip in this product is one localStorage key that gets written once —
 * the `use-session` idiom, without the session. Reads fail closed: in private
 * mode we would rather show nothing than show the same tip every load.
 */

export function nuxSeen(key: string): boolean {
  if (typeof window === "undefined") return true;
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return true;
  }
}

export function markNuxSeen(key: string) {
  try {
    localStorage.setItem(key, "1");
  } catch {
    /* the tip just reappears next visit */
  }
}

/** Highlight-to-dig-deeper, taught once in the reading view. */
export const READING_TIP_KEY = "nux_reading_tip";
