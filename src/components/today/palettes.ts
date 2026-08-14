/*
 * Card palette + blob-wash helpers.
 *
 * Kept apart from source-card.tsx so the default reading path can use the
 * palette (the sweep title) without pulling the classic-mode card component
 * into the first-load bundle.
 */

import type React from "react";

export const SOURCE_PALETTES: [string, string][] = [
  ["#6EE9A8", "#D4F04A"],
  ["#FF85A8", "#FFD020"],
  ["#60AAE8", "#A878E8"],
  ["#FFD020", "#FF85A8"],
];

export function hex2rgba(hex: string, a: number) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

const BLOB_LAYOUTS = [
  // card 0: top-left dominant, bottom-right reach, top-right wisp
  (c1: string, c2: string) => `
    radial-gradient(circle 280px at 5% 8%, ${c1} 0%, transparent 60%),
    radial-gradient(circle 200px at 92% 5%, ${c2} 0%, transparent 55%),
    radial-gradient(circle 260px at 96% 96%, ${c1} 0%, transparent 60%),
    #fff`,
  // card 1: bottom-left blob, top-right reach, bottom-right accent
  (c1: string, c2: string) => `
    radial-gradient(circle 270px at 2% 95%, ${c2} 0%, transparent 60%),
    radial-gradient(circle 220px at 90% 5%, ${c1} 0%, transparent 55%),
    radial-gradient(circle 200px at 98% 88%, ${c2} 0%, transparent 55%),
    #fff`,
  // card 2: top-right dominant, left-center reach, small bottom-left
  (c1: string, c2: string) => `
    radial-gradient(circle 280px at 98% 4%, ${c1} 0%, transparent 60%),
    radial-gradient(circle 220px at 2% 45%, ${c2} 0%, transparent 55%),
    radial-gradient(circle 190px at 8% 98%, ${c1} 0%, transparent 55%),
    #fff`,
  // card 3: both bottom corners reaching up, small top-right
  (c1: string, c2: string) => `
    radial-gradient(circle 260px at 3% 98%, ${c1} 0%, transparent 60%),
    radial-gradient(circle 250px at 97% 92%, ${c2} 0%, transparent 60%),
    radial-gradient(circle 180px at 88% 3%, ${c1} 0%, transparent 50%),
    #fff`,
];

export function dispersedWash(palette: [string, string], hover = false, idx = 0): React.CSSProperties {
  const [h1, h2] = palette;
  const a = hover ? 0.55 : 0.42;
  const c1 = hex2rgba(h1, a);
  const c2 = hex2rgba(h2, a);
  return { background: BLOB_LAYOUTS[idx % BLOB_LAYOUTS.length](c1, c2) } as React.CSSProperties;
}
