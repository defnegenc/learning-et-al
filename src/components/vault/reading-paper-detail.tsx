"use client";

import React, { useEffect, useRef, useState } from "react";
import { Bookmark, Loader2, Send } from "lucide-react";
import type { PaperItem } from "@/components/today/paper-card";
import { SOURCE_PALETTES, dispersedWash } from "@/components/today/source-card";
import { TermChip } from "@/components/today/brief-digest";
import { journalName } from "@/lib/venue-name";

const MONO = "var(--font-mono), monospace";
const DISPLAY = "var(--font-display), sans-serif";

type Jargon = { term: string; def: string };

interface Companion {
  gist: string;
  did: string;
  found: string;
  caveats: string;
  remember: string;
  glossary: Jargon[];
  questions: string[];
}

interface HomeworkItem {
  openAlexId: string;
  title: string;
  authors: string[];
  year: number | null;
  venue: string | null;
  url: string | null;
  pdfUrl: string | null;
  abstract: string;
  citationCount: number;
}

interface QaPair { id: string; question: string; answer: string; }

// Interleave TermChips into a text block at the first occurrence of each term.
function annotateText(text: string, jargon: Jargon[]): React.ReactNode[] {
  const sorted = [...jargon].sort((a, b) => b.term.length - a.term.length);
  const out: React.ReactNode[] = [];
  const used = new Set<string>();
  let rest = text;
  let key = 0;
  while (rest) {
    let best: { i: number; len: number; j: Jargon } | null = null;
    for (const j of sorted) {
      if (used.has(j.term.toLowerCase())) continue;
      const i = rest.toLowerCase().indexOf(j.term.toLowerCase());
      if (i >= 0 && (!best || i < best.i)) best = { i, len: j.term.length, j };
    }
    if (!best) { out.push(<span key={key++}>{rest}</span>); break; }
    used.add(best.j.term.toLowerCase());
    if (best.i > 0) out.push(<span key={key++}>{rest.slice(0, best.i)}</span>);
    out.push(<TermChip key={key++} text={rest.slice(best.i, best.i + best.len)} def={best.j.def} />);
    rest = rest.slice(best.i + best.len);
  }
  return out;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontFamily: MONO, fontSize: "0.56rem", letterSpacing: "1.5px", textTransform: "uppercase", color: "#999", marginBottom: 7 }}>
      {children}
    </div>
  );
}

function CompanionSection({ label, text, glossary }: { label: string; text: string; glossary: Jargon[] }) {
  if (!text) return null;
  return (
    <div style={{ marginBottom: 18 }}>
      <SectionLabel>{label}</SectionLabel>
      <p style={{ fontSize: "0.92rem", lineHeight: 1.7, color: "#333", margin: 0 }}>{annotateText(text, glossary)}</p>
    </div>
  );
}

function HomeworkCard({ item, sourcePaperId }: { item: HomeworkItem; sourcePaperId: string }) {
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  async function save(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (saved || saving) return;
    setSaving(true);
    try {
      const res = await fetch("/api/papers/save-external", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourcePaperId, item }),
      });
      if (res.ok) setSaved(true);
    } catch { /* leave unsaved */ }
    finally { setSaving(false); }
  }

  return (
    <a
      href={item.url || "#"}
      target="_blank"
      rel="noopener noreferrer"
      onClick={e => { if (!item.url) e.preventDefault(); }}
      style={{ display: "block", background: "#fff", border: "2px solid #1a1a1a", boxShadow: "3px 3px 0 0 rgba(0,0,0,1)", padding: "12px 14px", textDecoration: "none", color: "#1a1a1a" }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
        <div style={{ fontFamily: MONO, fontSize: "0.55rem", letterSpacing: "1px", textTransform: "uppercase", color: "#888" }}>
          {item.year || ""}{item.venue ? ` · ${item.venue}` : ""}
          {item.citationCount > 0 ? ` · ${item.citationCount} citations` : ""}
        </div>
        <button
          onClick={save}
          title={saved ? "In your reading list" : "Save to reading list"}
          style={{ background: "none", border: "none", cursor: saved ? "default" : "pointer", padding: 0, flexShrink: 0, color: "#1a1a1a" }}
        >
          {saving
            ? <Loader2 size={14} className="animate-spin" />
            : <Bookmark size={14} fill={saved ? "#1a1a1a" : "none"} />}
        </button>
      </div>
      <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: "0.85rem", lineHeight: 1.35, margin: "6px 0 4px" }}>{item.title}</div>
      {item.authors.length > 0 && (
        <div style={{ fontSize: "0.68rem", fontStyle: "italic", color: "#666" }}>
          {item.authors.slice(0, 3).join(", ")}{item.authors.length > 3 ? " et al." : ""}
        </div>
      )}
    </a>
  );
}

export function ReadingPaperDetail({ paper, index, onClose }: { paper: PaperItem; index: number; onClose: () => void }) {
  const idx = Math.max(index, 0);
  const palette = SOURCE_PALETTES[idx % SOURCE_PALETTES.length];
  const journal = journalName(paper.sourceUrl, paper.authors);

  const [companion, setCompanion] = useState<Companion | null>(null);
  const [companionPending, setCompanionPending] = useState(true);
  const [homework, setHomework] = useState<HomeworkItem[] | null>(null);
  const [qaPairs, setQaPairs] = useState<QaPair[]>([]);
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [askError, setAskError] = useState(false);
  const threadEndRef = useRef<HTMLDivElement>(null);

  // Companion + homework: use the cache if the bookmark already generated
  // them, otherwise trigger generation now and wait.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/papers/${paper.id}/companion`);
        let data = await res.json();
        if (!data.companion) {
          const gen = await fetch(`/api/papers/${paper.id}/companion`, { method: "POST" });
          data = await gen.json();
        }
        if (!cancelled) setCompanion(data.companion ?? null);
      } catch { /* companion stays null */ }
      finally { if (!cancelled) setCompanionPending(false); }
    })();
    (async () => {
      try {
        const res = await fetch(`/api/papers/${paper.id}/homework`);
        let data = await res.json();
        if (!data.homework) {
          const gen = await fetch(`/api/papers/${paper.id}/homework`, { method: "POST" });
          data = await gen.json();
        }
        if (!cancelled) setHomework(data.homework ?? []);
      } catch { if (!cancelled) setHomework([]); }
    })();
    fetch(`/api/papers/${paper.id}/qa`)
      .then(r => r.json())
      .then(d => { if (!cancelled) setQaPairs(d.qaPairs ?? []); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [paper.id]);

  async function ask(q: string) {
    const trimmed = q.trim();
    if (!trimmed || asking) return;
    setAsking(true);
    setAskError(false);
    setQuestion("");
    try {
      const res = await fetch(`/api/papers/${paper.id}/qa`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: trimmed }),
      });
      const data = await res.json();
      if (data.qaPair) {
        setQaPairs(prev => [...prev, data.qaPair]);
        setTimeout(() => threadEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 50);
      } else {
        setAskError(true);
        setQuestion(trimmed);
      }
    } catch {
      setAskError(true);
      setQuestion(trimmed);
    } finally {
      setAsking(false);
    }
  }

  const glossary = companion?.glossary ?? [];
  const askedQuestions = new Set(qaPairs.map(p => p.question));
  const suggested = (companion?.questions ?? []).filter(q => !askedQuestions.has(q));

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 80, background: "rgba(26,26,26,0.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ ...dispersedWash(palette, false, idx), maxWidth: 720, width: "100%", maxHeight: "90vh", overflowY: "auto", border: "2px solid #1a1a1a", boxShadow: "8px 8px 0 0 rgba(0,0,0,1)", padding: "26px 30px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <span style={{ fontFamily: MONO, fontSize: "0.6rem", letterSpacing: "1.5px", textTransform: "uppercase", color: "#666" }}>
            {(paper.sourceUrl || "").toLowerCase().includes("arxiv") ? "arXiv" : paper.source === "rss" ? "News" : "Paper"}
            {paper.year ? ` · ${paper.year}` : ""}
            {paper.digestTheme ? ` · From “${paper.digestTheme}”${paper.digestDate ? ` (${paper.digestDate})` : ""}` : ""}
          </span>
          <button onClick={onClose} style={{ fontSize: "0.78rem", background: "none", border: "none", cursor: "pointer", color: "#888" }}>✕ Close</button>
        </div>

        <h3 style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: "1.35rem", lineHeight: 1.25, margin: "0 0 8px" }}>{paper.title}</h3>
        {(paper.authors.length > 0 || journal) && (
          <p style={{ fontSize: "0.75rem", fontStyle: "italic", color: "#666", margin: "0 0 20px" }}>
            {paper.authors.slice(0, 6).join(", ")}
            {paper.authors.length > 0 && journal ? " — " : ""}
            {journal}
          </p>
        )}

        {/* ── Reading companion ── */}
        {companionPending ? (
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "18px 0 22px" }}>
            <Loader2 size={13} className="animate-spin" style={{ color: "#666" }} />
            <span style={{ fontFamily: MONO, fontSize: "0.62rem", letterSpacing: "1.5px", textTransform: "uppercase", color: "#888" }}>
              Preparing your reading companion…
            </span>
          </div>
        ) : companion ? (
          <>
            <div style={{ background: "#FFF4B8", border: "2px solid #1a1a1a", padding: "14px 16px", marginBottom: 20 }}>
              <div style={{ fontFamily: MONO, fontSize: "0.56rem", letterSpacing: "1.5px", textTransform: "uppercase", color: "#1a1a1a", marginBottom: 7, fontWeight: 700 }}>The gist</div>
              <p style={{ fontSize: "0.9rem", lineHeight: 1.65, color: "#1a1a1a", margin: 0 }}>{companion.gist}</p>
            </div>
            <CompanionSection label="What they did" text={companion.did} glossary={glossary} />
            <CompanionSection label="What they found" text={companion.found} glossary={glossary} />
            <CompanionSection label="Where it's shaky" text={companion.caveats} glossary={glossary} />
            {companion.remember && (
              <div style={{ borderLeft: "4px solid #1a1a1a", padding: "4px 0 4px 12px", marginBottom: 22 }}>
                <SectionLabel>Remember this</SectionLabel>
                <p style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: "0.95rem", lineHeight: 1.5, color: "#1a1a1a", margin: 0 }}>{companion.remember}</p>
              </div>
            )}
          </>
        ) : paper.abstract ? (
          <div style={{ marginBottom: 22 }}>
            <SectionLabel>Abstract</SectionLabel>
            <p style={{ fontSize: "0.92rem", lineHeight: 1.7, color: "#333", margin: 0 }}>{paper.abstract}</p>
          </div>
        ) : (
          <p style={{ fontSize: "0.88rem", color: "#999", fontStyle: "italic", marginBottom: 22 }}>No abstract available.</p>
        )}

        {/* ── Ask this paper — Q&A grounded in the full text ── */}
        <div style={{ borderTop: "1px solid #1a1a1a", paddingTop: 18, marginBottom: 24 }}>
          <SectionLabel>Ask this paper</SectionLabel>
          {qaPairs.map(pair => (
            <div key={pair.id} style={{ marginBottom: 14 }}>
              <p style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: "0.88rem", margin: "0 0 5px", color: "#1a1a1a" }}>{pair.question}</p>
              <p style={{ fontSize: "0.88rem", lineHeight: 1.65, color: "#333", margin: 0, whiteSpace: "pre-wrap" }}>{pair.answer}</p>
            </div>
          ))}
          {suggested.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
              {suggested.map(q => (
                <button
                  key={q}
                  onClick={() => ask(q)}
                  disabled={asking}
                  style={{ fontFamily: MONO, fontSize: "0.62rem", letterSpacing: "0.5px", background: "#fff", border: "2px solid #1a1a1a", padding: "7px 10px", cursor: asking ? "wait" : "pointer", color: "#1a1a1a", textAlign: "left" }}
                >
                  {q}
                </button>
              ))}
            </div>
          )}
          <form
            onSubmit={e => { e.preventDefault(); ask(question); }}
            style={{ display: "flex", gap: 8 }}
          >
            <input
              value={question}
              onChange={e => setQuestion(e.target.value)}
              placeholder="Ask anything — answers come from the full text"
              disabled={asking}
              style={{ flex: 1, fontSize: "0.85rem", border: "2px solid #1a1a1a", background: "#fff", padding: "9px 12px", outline: "none", color: "#1a1a1a" }}
            />
            <button
              type="submit"
              disabled={asking || !question.trim()}
              style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: MONO, fontSize: "0.65rem", fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", background: "#1a1a1a", color: "#fff", border: "2px solid #1a1a1a", padding: "9px 14px", cursor: asking ? "wait" : "pointer", opacity: !question.trim() && !asking ? 0.5 : 1 }}
            >
              {asking ? <Loader2 size={11} className="animate-spin" /> : <Send size={11} />}
            </button>
          </form>
          {askError && <p style={{ fontSize: "0.7rem", color: "#ff007f", marginTop: 8 }}>Couldn&apos;t answer that — try again.</p>}
          <div ref={threadEndRef} />
        </div>

        {/* ── Homework: what's happened since ── */}
        <div style={{ borderTop: "1px solid #1a1a1a", paddingTop: 18, marginBottom: 24 }}>
          <SectionLabel>Homework — what&apos;s happened since?</SectionLabel>
          {homework === null ? (
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0" }}>
              <Loader2 size={12} className="animate-spin" style={{ color: "#666" }} />
              <span style={{ fontSize: "0.75rem", color: "#888" }}>Looking for follow-up work…</span>
            </div>
          ) : homework.length === 0 ? (
            <p style={{ fontSize: "0.78rem", color: "#999", fontStyle: "italic", margin: 0 }}>Nothing citing this yet — it may be too new.</p>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12 }}>
              {homework.map(item => (
                <HomeworkCard key={item.openAlexId || item.title} item={item} sourcePaperId={paper.id} />
              ))}
            </div>
          )}
        </div>

        {paper.sourceUrl && (
          <a href={paper.sourceUrl} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 8, fontFamily: MONO, fontSize: "0.65rem", letterSpacing: "1px", textTransform: "uppercase", background: "#1a1a1a", color: "#fff", padding: "10px 16px", textDecoration: "none" }}>
            Read the full paper ↗
          </a>
        )}
      </div>
    </div>
  );
}
