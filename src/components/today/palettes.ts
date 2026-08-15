/*
 * Card colour — a thin re-export of the design system's one stride.
 *
 * This file used to hold four tables: SOURCE_PALETTES (saturated), CARD_PALETTES
 * (pastel), PALETTES and HOVER_PALETTES. Ten fields shared five distinguishable
 * hues between them, and the digest and the vault could disagree about which
 * colour a card was. All four are replaced by `wash(index)` in
 * design-system.tsx: card i takes spectrum slot i×3 and the one next to it.
 *
 * Kept as a module so the reading path can pull the wash without importing the
 * card component.
 */

export { SPECTRUM, wash, washSlots, foundationalWash, wordSlot } from "@/components/design-system";
