"use client";

import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import type { PaperItem } from "@/lib/types";
import { BriefDigest } from "@/components/today/brief-digest";
import {
  ACID_PINK, ActionButton, BODY_STYLE, BORDER, DIM, DISPLAY_LG, DISPLAY_SM, INK, Label, MUTED, PageLoader, RULE, SURFACE,
} from "@/components/design-system";

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

const REQUEST_TIMEOUT_MS = 15_000;

async function fetchJson(url: string, signal: AbortSignal) {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`Request failed with ${response.status}`);
  return response.json();
}

// Derive a display title for digests without a stored theme (same fallback the
// old vault drawer used).
function displayTheme(d: { theme?: string | null; synthesisContent?: string | null }): string {
  if (d.theme) return d.theme;
  const firstLine = (d.synthesisContent || "").split("\n").find(l => l.trim()) ?? "";
  return firstLine.replace(/^#+\s*/, "").replace(/\*\*/g, "").replace(/^Today[^.!?]*[.!?]\s*/i, "").trim().slice(0, 80) || "Untitled digest";
}

export function DigestHistory() {
  const [list, setList] = useState<DigestListItem[] | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [digest, setDigest] = useState<LoadedDigest | null>(null);
  const [papers, setPapers] = useState<PaperItem[]>([]);
  const [listError, setListError] = useState(false);
  const [digestError, setDigestError] = useState(false);
  const [listAttempt, setListAttempt] = useState(0);
  const [digestAttempt, setDigestAttempt] = useState(0);
  // Which papers are already saved — re-reading an old digest shows its
  // bookmarks filled rather than offering to save what's already in the vault.
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  // Derived, not state: the selected digest is loading until its data arrives.
  const loadingDigest = activeId !== null && digest?.id !== activeId;

  useEffect(() => {
    fetch("/api/papers/bookmarks")
      .then(r => (r.ok ? r.json() : { ids: [] }))
      .then(d => setSavedIds(new Set(d.ids ?? [])))
      .catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    fetchJson("/api/digest?all=true", controller.signal)
      .then(d => {
        if (cancelled) return;
        const items: DigestListItem[] = (d.digests ?? []).map((x: { id: string; date: string; theme?: string | null; synthesisContent?: string | null }) => ({
          id: x.id, date: x.date, theme: displayTheme(x),
        }));
        setList(items);
        if (items.length > 0) setActiveId(items[0].id);
      })
      .catch(() => {
        if (!cancelled) setListError(true);
      })
      .finally(() => window.clearTimeout(timeout));
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [listAttempt]);

  useEffect(() => {
    if (!activeId) return;
    let cancelled = false;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    fetchJson(`/api/digest?id=${encodeURIComponent(activeId)}`, controller.signal)
      .then(d => {
        if (cancelled) return;
        if (!d.digest) throw new Error("Digest not found");
        setDigest({
          ...d.digest,
          keyConcepts: asArray(d.digest.keyConcepts),
          suggestedQuestions: asArray(d.digest.suggestedQuestions),
          suggestedAnswers: asArray(d.digest.suggestedAnswers),
        });
        setPapers(d.papers ?? []);
      })
      .catch(() => {
        if (!cancelled) setDigestError(true);
      })
      .finally(() => window.clearTimeout(timeout));
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [activeId, digestAttempt]);

  // Keep the page loader for the initial archive request. Once the list exists,
  // a selected digest owns its loading and error state inside the reading pane.
  if (list === null && !listError) return <PageLoader />;
  if (listError) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, padding: "80px 0" }}>
        <p style={{ ...BODY_STYLE, color: ACID_PINK, margin: 0 }}>We couldn&rsquo;t load your digests.</p>
        <ActionButton onClick={() => {
          setListError(false);
          setList(null);
          setListAttempt(value => value + 1);
        }}>Try again</ActionButton>
      </div>
    );
  }
  if (!list) return null;
  if (list.length === 0) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: "80px 0" }}>
        <span style={DISPLAY_SM}>No digests yet — generate your first from Today</span>
      </div>
    );
  }

  const rail = (
    <div style={{ border: BORDER, background: SURFACE, overflowY: "auto", maxHeight: "calc(100vh - 180px)" }}>
      {list.map((item, i) => {
        const isActive = activeId === item.id;
        return (
          <button
            key={item.id}
            onClick={() => {
              setDigestError(false);
              setActiveId(item.id);
            }}
            style={{
              display: "flex", flexDirection: "column", gap: 6,
              width: "100%", padding: "14px 16px", textAlign: "left",
              background: isActive ? INK : "transparent",
              border: "none", borderBottom: i === list.length - 1 ? "none" : `1px solid ${isActive ? INK : RULE}`,
              color: isActive ? SURFACE : INK, cursor: "pointer", transition: "background 140ms",
            }}
          >
            <Label style={{ color: isActive ? RULE : MUTED }}>{item.date}</Label>
            <span style={{ ...BODY_STYLE, fontWeight: isActive ? 600 : 400, color: "inherit" }}>
              {item.theme}
            </span>
          </button>
        );
      })}
    </div>
  );

  const pane = digestError ? (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, padding: "80px 0" }}>
      <p style={{ ...BODY_STYLE, color: ACID_PINK, margin: 0 }}>This digest couldn&rsquo;t be loaded.</p>
      <ActionButton onClick={() => {
        setDigestError(false);
        setDigestAttempt(value => value + 1);
      }}>Try again</ActionButton>
    </div>
  ) : loadingDigest || !digest ? (
    <div style={{ padding: "80px 0" }}><PageLoader inline /></div>
  ) : (
    <div>
      <Label style={{ marginBottom: 12 }}>
        {new Date(digest.date + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
      </Label>
      <h2 style={{ ...DISPLAY_LG, margin: "0 0 10px" }}>{displayTheme(digest)}</h2>
      {digest.gist && <p style={{ ...BODY_STYLE, fontWeight: 600, color: INK, margin: "0 0 28px" }}>{digest.gist}</p>}
      {digest.synthesisContent ? (
        <BriefDigest
          key={digest.id}
          revealAll
          synthesis={digest.synthesisContent}
          theme={digest.theme ?? undefined}
          keyConcepts={digest.keyConcepts}
          papers={papers}
          digestId={digest.id}
          loggedIn
          savedIds={savedIds}
        />
      ) : (
        <p style={{ ...BODY_STYLE, color: MUTED, fontStyle: "italic" }}>This digest has no synthesis.</p>
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
        {activeId ? (
          <div>
            <button onClick={() => { setActiveId(null); setDigest(null); }} style={{ ...BODY_STYLE, display: "inline-flex", alignItems: "center", gap: 8, background: "none", border: "none", cursor: "pointer", color: DIM, padding: 0, marginBottom: 20 }}>
              <ArrowLeft size={15} /> All digests
            </button>
            {pane}
          </div>
        ) : rail}
      </div>
    </>
  );
}
