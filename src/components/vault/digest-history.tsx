"use client";

import { useEffect, useState } from "react";
import { Loader2, ArrowLeft } from "lucide-react";
import type { PaperItem } from "@/components/today/paper-card";
import { BriefDigest } from "@/components/today/brief-digest";

const MONO = "var(--font-mono), monospace";
const DISPLAY = "var(--font-display), sans-serif";

interface DigestListItem {
  id: string;
  date: string;
  theme: string;
}

interface LoadedDigest {
  id: string;
  theme: string | null;
  synthesisContent: string | null;
  keyConcepts: string[];
  suggestedQuestions: string[];
  suggestedAnswers?: string[];
  gist?: string | null;
  date: string;
}

const asArray = (v: unknown): string[] =>
  Array.isArray(v) ? v : typeof v === "string" && v.trim() ? (() => { try { return JSON.parse(v); } catch { return []; } })() : [];

// Derive a display title for digests without a stored theme (same fallback the
// old vault drawer used).
function displayTheme(d: { theme?: string | null; synthesisContent?: string | null }): string {
  if (d.theme) return d.theme;
  const firstLine = (d.synthesisContent || "").split("\n").find(l => l.trim()) ?? "";
  return firstLine.replace(/^#+\s*/, "").replace(/\*\*/g, "").replace(/^Today[^.!?]*[.!?]\s*/i, "").trim().slice(0, 80) || "Untitled digest";
}

export function DigestHistory({ loggedIn }: { loggedIn: boolean }) {
  const [list, setList] = useState<DigestListItem[] | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [digest, setDigest] = useState<LoadedDigest | null>(null);
  const [papers, setPapers] = useState<PaperItem[]>([]);
  // Derived, not state: the selected digest is loading until its data arrives.
  const loadingDigest = activeId !== null && digest?.id !== activeId;

  useEffect(() => {
    fetch("/api/digest?all=true")
      .then(r => (r.ok ? r.json() : { digests: [] }))
      .then(d => {
        const items: DigestListItem[] = (d.digests ?? []).map((x: { id: string; date: string; theme?: string | null; synthesisContent?: string | null }) => ({
          id: x.id, date: x.date, theme: displayTheme(x),
        }));
        setList(items);
        if (items.length > 0) setActiveId(items[0].id);
      })
      .catch(() => setList([]));
  }, []);

  useEffect(() => {
    if (!activeId) return;
    let cancelled = false;
    fetch(`/api/digest?id=${activeId}`)
      .then(r => r.json())
      .then(d => {
        if (cancelled || !d.digest) return;
        setDigest({
          ...d.digest,
          keyConcepts: asArray(d.digest.keyConcepts),
          suggestedQuestions: asArray(d.digest.suggestedQuestions),
          suggestedAnswers: asArray(d.digest.suggestedAnswers),
        });
        setPapers(d.papers ?? []);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [activeId]);

  if (list === null) {
    return <div style={{ display: "flex", justifyContent: "center", padding: "80px 0" }}><Loader2 className="size-6 animate-spin" style={{ color: "#666" }} /></div>;
  }
  if (list.length === 0) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: "80px 0" }}>
        <span style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "2px", color: "#888", fontFamily: MONO }}>
          No digests yet — generate your first from Today
        </span>
      </div>
    );
  }

  const rail = (
    <div style={{ border: "2px solid #1a1a1a", background: "white", overflowY: "auto", maxHeight: "calc(100vh - 180px)" }}>
      {list.map((item, i) => {
        const isActive = activeId === item.id;
        return (
          <button
            key={item.id}
            onClick={() => setActiveId(item.id)}
            style={{
              display: "flex", flexDirection: "column", gap: "4px",
              width: "100%", padding: "12px 16px", textAlign: "left",
              background: isActive ? "#1a1a1a" : "transparent",
              border: "none", borderBottom: i === list.length - 1 ? "none" : "1px solid rgba(26,26,26,0.08)",
              color: isActive ? "white" : "#1a1a1a", cursor: "pointer", transition: "background 100ms",
            }}
            className={isActive ? "" : "hover:bg-[#f5f5f5]"}
          >
            <span style={{ fontFamily: MONO, fontSize: "0.55rem", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: isActive ? "rgba(255,255,255,0.5)" : "#aaa" }}>
              {item.date}
            </span>
            <span style={{ fontFamily: DISPLAY, fontSize: "0.8rem", fontWeight: isActive ? 700 : 500, lineHeight: 1.3 }}>
              {item.theme}
            </span>
          </button>
        );
      })}
    </div>
  );

  const pane = loadingDigest || !digest ? (
    <div style={{ display: "flex", justifyContent: "center", padding: "80px 0" }}><Loader2 className="size-5 animate-spin" style={{ color: "#666" }} /></div>
  ) : (
    <div>
      <div style={{ fontFamily: MONO, fontSize: "0.6rem", letterSpacing: "1.5px", textTransform: "uppercase", color: "#999", marginBottom: 10 }}>
        {new Date(digest.date + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
      </div>
      <h2 style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: "1.6rem", lineHeight: 1.25, letterSpacing: "-0.03em", color: "#1a1a1a", margin: "0 0 8px" }}>
        {displayTheme(digest)}
      </h2>
      {digest.gist && <p style={{ fontSize: "0.95rem", color: "#555", margin: "0 0 24px", lineHeight: 1.6 }}>{digest.gist}</p>}
      {digest.synthesisContent ? (
        <BriefDigest
          key={digest.id}
          revealAll
          synthesis={digest.synthesisContent}
          theme={digest.theme ?? undefined}
          keyConcepts={digest.keyConcepts}
          papers={papers}
          digestId={digest.id}
          seeds={digest.suggestedQuestions}
          guestAnswers={digest.suggestedAnswers}
          isLoggedIn={loggedIn}
        />
      ) : (
        <p style={{ fontSize: "0.85rem", color: "#999", fontStyle: "italic" }}>This digest has no synthesis.</p>
      )}
    </div>
  );

  return (
    <>
      {/* Desktop: chat-style two-pane. Mobile: list, then full-screen digest with back. */}
      <div className="hidden md:grid" style={{ gridTemplateColumns: "300px 1fr", gap: "32px", alignItems: "start" }}>
        {rail}
        {pane}
      </div>
      <div className="md:hidden">
        {activeId && digest ? (
          <div>
            <button onClick={() => { setActiveId(null); setDigest(null); }} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: MONO, fontSize: "0.6rem", fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", background: "none", border: "none", cursor: "pointer", color: "#666", padding: 0, marginBottom: 16 }}>
              <ArrowLeft size={11} /> All digests
            </button>
            {pane}
          </div>
        ) : rail}
      </div>
    </>
  );
}
