"use client";

import React, { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { InkTip, MUTED } from "@/components/design-system";

type Definition = { term: string; def: string };
type Placement = { left: number; top: number; width: number; maxHeight: number };

export function parseDefinitions(keyConcepts: string[]): Definition[] {
  return keyConcepts
    .map((concept) => {
      const separator = concept.indexOf(":");
      if (separator <= 0) return null;
      const term = concept.slice(0, separator).trim();
      const def = concept.slice(separator + 1).trim();
      return term && def ? { term, def } : null;
    })
    .filter((definition): definition is Definition => definition !== null)
    .sort((a, b) => b.term.length - a.term.length);
}

/**
 * An inline glossary term whose explanation lives in a body-level portal.
 * Portalling lets the tip escape clipped cards and narrow content columns; the
 * measured placement also keeps every edge inside the browser viewport.
 *
 * `tint` marks the term as a highlight in a spectrum hue instead of the dotted
 * grey rule. The synthesis passes nothing and stays on the rule, because a
 * paragraph there may carry terms belonging to three different papers and a hue
 * would claim each of them for the wrong card. The reading view passes the hue
 * of the paper being read, where every term on the page belongs to that one
 * paper and the highlight says which paper you are inside.
 */
export function DefinitionTerm({ text, def, tint }: { text: string; def: string; tint?: string }) {
  const anchorRef = useRef<HTMLSpanElement>(null);
  const tipRef = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState<Placement | null>(null);
  const tooltipId = useId();

  useEffect(() => {
    if (!open) return;

    const positionTip = () => {
      const anchor = anchorRef.current?.getBoundingClientRect();
      const tip = tipRef.current;
      if (!anchor || !tip) return;

      const gutter = 12;
      const gap = 8;
      const width = Math.min(280, window.innerWidth - gutter * 2);
      const measuredHeight = tip.getBoundingClientRect().height;
      const roomAbove = Math.max(0, anchor.top - gap - gutter);
      const roomBelow = Math.max(0, window.innerHeight - anchor.bottom - gap - gutter);
      const placeAbove = roomAbove >= measuredHeight || roomAbove > roomBelow;
      // If neither side is tall enough, the clamped tip may overlap the anchor;
      // keeping the complete definition on-screen matters more than the gap.
      const maxHeight = window.innerHeight - gutter * 2;
      const renderedHeight = Math.min(measuredHeight, maxHeight);
      const top = placeAbove
        ? Math.max(gutter, anchor.top - gap - renderedHeight)
        : Math.min(window.innerHeight - gutter - renderedHeight, anchor.bottom + gap);
      const left = Math.max(
        gutter,
        Math.min(anchor.left, window.innerWidth - gutter - width),
      );

      setPlacement({ left, top, width, maxHeight });
    };

    positionTip();
    window.addEventListener("resize", positionTip);
    window.addEventListener("scroll", positionTip, true);
    return () => {
      window.removeEventListener("resize", positionTip);
      window.removeEventListener("scroll", positionTip, true);
    };
  }, [open, def]);

  const show = () => {
    setPlacement(null);
    setOpen(true);
  };

  return (
    <>
      <span
        ref={anchorRef}
        role="button"
        tabIndex={0}
        aria-describedby={open ? tooltipId : undefined}
        aria-expanded={open}
        onMouseEnter={show}
        onMouseLeave={() => {
          if (document.activeElement !== anchorRef.current) setOpen(false);
        }}
        onFocus={show}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") setOpen(false);
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setOpen((value) => !value);
          }
        }}
        style={tint
          ? {
            background: tint,
            // `clone` so a term that wraps carries the highlight on both lines
            // rather than stretching one box behind the break.
            boxDecorationBreak: "clone",
            WebkitBoxDecorationBreak: "clone",
            padding: "2px 4px",
            cursor: "help",
          }
          : {
            borderBottom: `2px dotted ${MUTED}`,
            cursor: "help",
            textDecorationSkipInk: "none",
          }}
      >
        {text}
      </span>
      {open && typeof document !== "undefined" && createPortal(
        <span
          ref={tipRef}
          id={tooltipId}
          role="tooltip"
          style={{
            position: "fixed",
            display: "block",
            zIndex: 100,
            left: placement?.left ?? 0,
            top: placement?.top ?? 0,
            width: placement?.width ?? Math.min(280, window.innerWidth - 24),
            maxHeight: placement?.maxHeight ?? window.innerHeight - 24,
            overflowY: "auto",
            visibility: placement ? "visible" : "hidden",
          }}
        >
          <InkTip style={{ width: "100%", maxWidth: "none" }}>{def}</InkTip>
        </span>,
        document.body,
      )}
    </>
  );
}

function isWordCharacter(character: string | undefined): boolean {
  return !!character && /[\p{L}\p{N}]/u.test(character);
}

function findTerm(text: string, term: string): { index: number; length: number } | null {
  const haystack = text.toLocaleLowerCase();
  const needle = term.toLocaleLowerCase();
  let from = 0;

  while (from < haystack.length) {
    const index = haystack.indexOf(needle, from);
    if (index < 0) return null;
    const before = text[index - 1];
    const after = text[index + needle.length];
    if (!isWordCharacter(before) && !isWordCharacter(after)) {
      return { index, length: needle.length };
    }
    from = index + needle.length;
  }
  return null;
}

/** Underlines the first mention of each glossary term in a short passage. */
export function DefinitionText({ text, keyConcepts }: { text: string; keyConcepts: string[] }) {
  const definitions = parseDefinitions(keyConcepts);
  const used = new Set<string>();
  const parts: React.ReactNode[] = [];
  let rest = text;
  let key = 0;

  while (rest) {
    let match: (Definition & { index: number; length: number }) | null = null;
    for (const definition of definitions) {
      if (used.has(definition.term)) continue;
      const found = findTerm(rest, definition.term);
      if (found && (!match || found.index < match.index)) {
        match = { ...definition, ...found };
      }
    }

    if (!match) {
      parts.push(rest);
      break;
    }
    if (match.index > 0) parts.push(rest.slice(0, match.index));
    const visibleText = rest.slice(match.index, match.index + match.length);
    parts.push(<DefinitionTerm key={key++} text={visibleText} def={match.def} />);
    used.add(match.term);
    rest = rest.slice(match.index + match.length);
  }

  return <>{parts}</>;
}
