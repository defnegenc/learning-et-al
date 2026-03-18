"use client";

import { useState, useEffect } from "react";
import { Plus, Check } from "lucide-react";

interface KeywordTagProps {
  keyword: string;
  color?: string;
  textColor?: string;
  onClick?: () => void;
}

const PASTEL_COLORS = ["#d4edda", "#f8d7da", "#e2d5f1", "#cce5ff", "#ffeeba"];

export function KeywordTag({ keyword, color, textColor, onClick }: KeywordTagProps) {
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

  const bg = color || PASTEL_COLORS[0];
  const showAddButton = !isInterest && (hovered || isTouchDevice);

  return (
    <span
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        padding: "2px 8px",
        paddingRight: !isInterest ? "22px" : "8px",
        background: bg,
        border: "1px solid rgba(26,26,26,0.2)",
        color: textColor || "#1a1a1a",
        fontSize: "0.6rem",
        textTransform: "uppercase",
        letterSpacing: "0.5px",
        fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
        cursor: onClick ? "pointer" : "default",
      }}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {keyword}
      {showAddButton && (
        <button
          onClick={handleAdd}
          style={{
            position: "absolute",
            right: "1px",
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
            right: "1px",
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
