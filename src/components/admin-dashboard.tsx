"use client";

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import {
  ACID_GREEN, ACID_PINK, BODY_STYLE, BODY_SM, BORDER, DIM, DISPLAY_LG, DISPLAY_SM,
  HAIRLINE, INK, Label, LABEL_STYLE, MUTED, SHADOW, SURFACE, Tag, wordSlot,
} from "@/components/design-system";

interface UserStat {
  id: string;
  name: string | null;
  email: string | null;
  digestPaused: boolean;
  createdAt: string;
  lastActive: string;
  digestCount: number;
  starredCount: number;
  digDeepCount: number;
  regenerateCount: number;
  interestCount: number;
  interests: string[];
}

interface EventItem {
  id: string;
  userId: string;
  type: string;
  digestId: string | null;
  createdAt: string;
  metadata: Record<string, unknown> | null;
  userName: string;
  digestTheme: string;
}

interface ThemeItem {
  id: string;
  theme: string | null;
  date: string;
  starred: boolean | null;
  userName: string;
  userId: string;
}

interface AdminData {
  users: UserStat[];
  events: EventItem[];
  themes: ThemeItem[];
  totals: { users: number; digests: number; events: number; starred: number };
}

type Tab = "users" | "activity" | "themes";

export function AdminDashboard() {
  const [data, setData] = useState<AdminData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>("users");
  const [togglingId, setTogglingId] = useState<string | null>(null);

  async function togglePause(u: UserStat) {
    if (togglingId) return;
    setTogglingId(u.id);
    const next = !u.digestPaused;
    try {
      const res = await fetch("/api/admin", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: u.id, digestPaused: next }),
      });
      if (res.ok) {
        setData(d => d ? { ...d, users: d.users.map(x => x.id === u.id ? { ...x, digestPaused: next } : x) } : d);
      }
    } catch { /* leave state as-is */ }
    finally { setTogglingId(null); }
  }

  useEffect(() => {
    fetch("/api/admin")
      .then(r => r.json())
      .then(d => { if (d.error) setError(d.error); else setData(d); })
      .catch(() => setError("Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 size={20} className="animate-spin" style={{ color: MUTED }} /></div>;
  if (error) return <div style={{ padding: 40, ...BODY_STYLE, color: ACID_PINK }}>{error}</div>;
  if (!data) return null;

  return (
    <div className="flex-1 overflow-y-auto px-4 md:px-8" style={{ maxWidth: 1400, margin: "0 auto", paddingTop: 32, paddingBottom: 80 }}>
      {/* Stats row */}
      <div style={{ display: "flex", gap: "16px", marginBottom: "32px", flexWrap: "wrap" }}>
        {[
          { label: "Users", value: data.totals.users },
          { label: "Digests", value: data.totals.digests },
          { label: "Starred", value: data.totals.starred },
          { label: "Events", value: data.totals.events },
        ].map(s => (
          <div key={s.label} style={{
            padding: "18px 24px", border: BORDER,
            boxShadow: SHADOW, background: SURFACE, minWidth: 120,
          }}>
            <p style={{ ...DISPLAY_LG, margin: "0 0 4px" }}>{s.value}</p>
            <Label>{s.label}</Label>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 0, borderBottom: `2px solid ${INK}`, marginBottom: 24 }}>
        {(["users", "activity", "themes"] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              ...LABEL_STYLE,
              padding: "12px 20px",
              background: tab === t ? INK : "transparent",
              color: tab === t ? SURFACE : MUTED,
              border: "none", cursor: "pointer",
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Users tab */}
      {tab === "users" && (
        <table className="w-full" style={{ borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: `2px solid ${INK}` }}>
              {["User", "Auto-digest", "Joined", "Last active", "Digests", "Stars", "Questions", "Regens", "Interests"].map(h => (
                <th key={h} style={{ ...LABEL_STYLE, textAlign: "left", padding: "10px 12px" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.users.map(u => (
              <tr key={u.id} style={{ borderBottom: HAIRLINE }}>
                <td style={{ padding: "12px" }}>
                  <p style={{ ...BODY_SM, fontWeight: 600, margin: 0 }}>{u.name || "—"}</p>
                  <p style={{ ...BODY_SM, color: MUTED, margin: 0 }}>{u.email || "—"}</p>
                </td>
                <td style={{ padding: "10px 12px" }}>
                  <button
                    onClick={() => togglePause(u)}
                    disabled={togglingId === u.id}
                    title={u.digestPaused ? "Resume automatic digest generation" : "Pause automatic digest generation"}
                    style={{
                      ...BODY_SM, fontWeight: 600, padding: "4px 10px", whiteSpace: "nowrap",
                      border: `1px solid ${INK}`, cursor: "pointer",
                      background: SURFACE,
                      color: u.digestPaused ? ACID_PINK : ACID_GREEN,
                      opacity: togglingId === u.id ? 0.5 : 1,
                    }}
                  >
                    {u.digestPaused ? "Paused" : "On"}
                  </button>
                </td>
                <td style={{ padding: 12, ...BODY_SM, color: MUTED }}>{u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "—"}</td>
                <td style={{ padding: 12, ...BODY_SM, color: MUTED }}>{u.lastActive ? new Date(u.lastActive).toLocaleDateString() : "—"}</td>
                <td style={{ padding: 12, ...BODY_SM, fontWeight: 600 }}>{u.digestCount}</td>
                <td style={{ padding: 12, ...BODY_SM, fontWeight: 600 }}>{u.starredCount}</td>
                <td style={{ padding: 12, ...BODY_SM, fontWeight: 600 }}>{u.digDeepCount}</td>
                <td style={{ padding: 12, ...BODY_SM, fontWeight: 600 }}>{u.regenerateCount}</td>
                <td style={{ padding: 12 }}>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                    {u.interests.slice(0, 5).map(k => <Tag key={k} label={k} tint={wordSlot(k)} />)}
                    {u.interests.length > 5 && <span style={{ ...BODY_SM, color: MUTED }}>+{u.interests.length - 5}</span>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Activity tab */}
      {tab === "activity" && (
        <div className="space-y-2">
          {data.events.map(e => (
            <div key={e.id} style={{ padding: "12px 0", borderBottom: HAIRLINE, display: "flex", gap: 14, alignItems: "flex-start" }}>
              <span style={{ ...LABEL_STYLE, whiteSpace: "nowrap", minWidth: 110, flexShrink: 0 }}>
                {e.createdAt ? new Date(e.createdAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"}
              </span>
              {/* Event kind takes its own hashed spectrum slot — same rule as
                  every other tag, so no per-type colour table. */}
              <Tag label={e.type.replace(/_/g, " ")} tint={wordSlot(e.type)} style={{ flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <span style={{ ...BODY_SM, fontWeight: 600 }}>{e.userName}</span>
                {e.digestTheme && <span style={{ ...BODY_SM, color: DIM }}> — {e.digestTheme}</span>}
                {e.metadata && typeof e.metadata === "object" && "question" in e.metadata && <p style={{ ...BODY_SM, color: MUTED, margin: "4px 0 0" }}>{`"${String(e.metadata.question)}"`}</p>}
              </div>
            </div>
          ))}
          {data.events.length === 0 && <p style={{ ...BODY_STYLE, color: MUTED }}>No events yet</p>}
        </div>
      )}

      {/* Themes tab */}
      {tab === "themes" && (
        <div className="space-y-2">
          {data.themes.map(t => (
            <div key={t.id} style={{ padding: "14px 0", borderBottom: HAIRLINE, display: "flex", gap: 14, alignItems: "center" }}>
              <span style={{ ...LABEL_STYLE, whiteSpace: "nowrap", minWidth: 110, flexShrink: 0 }}>{t.date}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ ...DISPLAY_SM, margin: 0 }}>{t.theme || "Untitled"}</p>
                <p style={{ ...BODY_SM, color: MUTED, margin: "2px 0 0" }}>{t.userName}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
