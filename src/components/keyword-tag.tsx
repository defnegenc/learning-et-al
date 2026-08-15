"use client";

import { useState, useEffect } from "react";
import { Plus, Check } from "lucide-react";
import { ACID_GREEN, INK, InkTip, Tag } from "@/components/design-system";

/**
 * A keyword, anywhere it appears on a white ground: the body face, sentence
 * case, a 1px ink rule and a fill taken from the word's own spectrum slot — so
 * "microbiome" is the same colour in today's digest, in the vault and in a
 * paper detail. Hovering reveals its definition in the one ink tooltip; the +
 * follows the topic.
 */
interface KeywordTagProps {
  keyword: string;
  /** Override the hash-derived fill (a field's fixed slot, say). */
  color?: string;
  definition?: string;
  onClick?: () => void;
}

export function KeywordTag({ keyword, color, definition, onClick }: KeywordTagProps) {
  const [hovered, setHovered] = useState(false);
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);
  const [isInterest, setIsInterest] = useState(false);
  const [isTouchDevice, setIsTouchDevice] = useState(false);

  useEffect(() => {
    setIsTouchDevice("ontouchstart" in window || navigator.maxTouchPoints > 0);
  }, []);

  // Check if keyword is already in interests on mount
  useEffect(() => {
    let cancelled = false;
    fetch("/api/interests")
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const exists = (data.interests ?? []).some(
          (i: { keyword: string }) => i.keyword.toLowerCase() === keyword.toLowerCase()
        );
        setIsInterest(exists);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [keyword]);

  const handleAdd = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (adding || isInterest) return;
    setAdding(true);
    try {
      const res = await fetch("/api/interests/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyword }),
      });
      const data = await res.json();
      if (data.added) {
        setAdded(true);
        setIsInterest(true);
        setTimeout(() => setAdded(false), 1200);
      }
    } catch {
      // silently fail
    } finally {
      setAdding(false);
    }
  };

  const showAdd = !isInterest && (hovered || isTouchDevice);

  return (
    <span
      style={{ position: "relative", display: "inline-flex" }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <Tag
        label={keyword}
        tint={color}
        onClick={definition ? () => setHovered(v => !v) : onClick}
        trailing={
          added ? <Check size={12} style={{ color: ACID_GREEN }} />
            : showAdd ? <Plus size={12} style={{ color: INK, opacity: 0.7, cursor: "pointer" }} onClick={handleAdd} />
            : null
        }
      />
      {definition && hovered && (
        <span style={{ position: "absolute", bottom: "calc(100% + 6px)", left: 0, zIndex: 50 }}>
          <InkTip>{definition}</InkTip>
        </span>
      )}
    </span>
  );
}
