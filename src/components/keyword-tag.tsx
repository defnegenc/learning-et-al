"use client";

import { useState, useEffect } from "react";
import { Plus, Check } from "lucide-react";

interface KeywordTagProps {
  keyword: string;
  color?: string;
  textColor?: string;
  definition?: string;
  onClick?: () => void;
}

const PASTEL_COLORS = ["#bbf7d0", "#fbcfe8", "#e9d5ff", "#bfdbfe", "#fef08a"];

export function KeywordTag({ keyword, color, textColor, definition, onClick }: KeywordTagProps) {
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
          (i: { keyword: string }) =>
            i.keyword.toLowerCase() === keyword.toLowerCase()
        );
        setIsInterest(exists);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
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

  const bg = color || "rgba(255, 255, 255, 0.85)";
  const showAddButton = !isInterest && (hovered || isTouchDevice);

  return (
    <span
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        padding: "4px 12px",
        paddingRight: !isInterest ? "26px" : "12px",
        background: bg,
        border: "2px solid #1a1a1a",
        boxShadow: "2px 2px 0px 0px rgba(0,0,0,1)",
        color: textColor || "#1a1a1a",
        fontSize: "9px",
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.5px",
        fontFamily: "var(--font-mono), monospace",
        cursor: onClick ? "pointer" : "default",
      }}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {keyword}
      {definition && hovered && (
        <span
          style={{
            position: "absolute",
            bottom: "calc(100% + 6px)",
            left: "0",
            background: "#1a1a1a",
            color: "white",
            fontSize: "0.7rem",
            fontWeight: 400,
            textTransform: "none",
            letterSpacing: "0",
            fontFamily: "inherit",
            lineHeight: 1.4,
            padding: "6px 10px",
            whiteSpace: "normal",
            width: "220px",
            zIndex: 50,
            pointerEvents: "none",
            boxShadow: "2px 2px 0px 0px rgba(0,0,0,0.4)",
          }}
        >
          {definition}
        </span>
      )}
      {showAddButton && (
        <button
          onClick={handleAdd}
          style={{
            position: "absolute",
            right: "2px",
            top: "50%",
            transform: "translateY(-50%)",
            background: "none",
            border: "none",
            padding: "4px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#1a1a1a",
            opacity: 0.7,
            minWidth: "20px",
            minHeight: "20px",
          }}
        >
          <Plus style={{ width: "10px", height: "10px" }} />
        </button>
      )}
      {added && (
        <span
          style={{
            position: "absolute",
            right: "2px",
            top: "50%",
            transform: "translateY(-50%)",
            display: "flex",
            alignItems: "center",
            color: "#38b000",
          }}
        >
          <Check style={{ width: "10px", height: "10px" }} />
        </span>
      )}
    </span>
  );
}
