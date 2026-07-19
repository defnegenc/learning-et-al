"use client";

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";

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

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="size-5 animate-spin text-[#888]" /></div>;
  if (error) return <div style={{ padding: "40px", color: "#ff007f", fontFamily: "var(--font-mono), monospace" }}>{error}</div>;
  if (!data) return null;

  return (
    <div className="flex-1 overflow-y-auto" style={{ padding: "24px 40px" }}>
      {/* Stats row */}
      <div style={{ display: "flex", gap: "16px", marginBottom: "32px", flexWrap: "wrap" }}>
        {[
          { label: "Users", value: data.totals.users },
          { label: "Digests", value: data.totals.digests },
          { label: "Starred", value: data.totals.starred },
          { label: "Events", value: data.totals.events },
        ].map(s => (
          <div key={s.label} style={{
            padding: "16px 24px", border: "3px solid #1a1a1a",
            boxShadow: "4px 4px 0px 0px rgba(0,0,0,1)", background: "white", minWidth: "120px",
          }}>
            <p style={{ fontSize: "2rem", fontWeight: 800, fontFamily: "var(--font-display), sans-serif" }}>{s.value}</p>
            <p style={{ fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "2px", color: "#888", fontFamily: "var(--font-mono), monospace" }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "0", borderBottom: "3px solid #1a1a1a", marginBottom: "24px" }}>
        {(["users", "activity", "themes"] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: "10px 20px", fontSize: "0.75rem", fontWeight: 700,
              textTransform: "uppercase", letterSpacing: "2px",
              fontFamily: "var(--font-mono), monospace",
              background: tab === t ? "#1a1a1a" : "transparent",
              color: tab === t ? "white" : "#888",
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
            <tr style={{ borderBottom: "2px solid #1a1a1a" }}>
              {["User", "Auto-Digest", "Joined", "Last Active", "Digests", "Stars", "Questions", "Regens", "Interests"].map(h => (
                <th key={h} style={{ textAlign: "left", padding: "8px 12px", fontSize: "0.6rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", fontFamily: "var(--font-mono), monospace", color: "#888" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.users.map(u => (
              <tr key={u.id} style={{ borderBottom: "1px solid #eee" }} className="hover:bg-gray-50">
                <td style={{ padding: "10px 12px" }}>
                  <p style={{ fontSize: "0.85rem", fontWeight: 700 }}>{u.name || "—"}</p>
                  <p style={{ fontSize: "0.65rem", color: "#888" }}>{u.email || "—"}</p>
                </td>
                <td style={{ padding: "10px 12px" }}>
                  <button
                    onClick={() => togglePause(u)}
                    disabled={togglingId === u.id}
                    title={u.digestPaused ? "Resume automatic digest generation" : "Pause automatic digest generation"}
                    style={{
                      fontSize: "0.55rem", fontWeight: 700, padding: "3px 8px",
                      fontFamily: "var(--font-mono), monospace", textTransform: "uppercase",
                      letterSpacing: "1px", whiteSpace: "nowrap",
                      border: "1.5px solid #1a1a1a", cursor: "pointer",
                      background: u.digestPaused ? "#f8d7da" : "#d4edda",
                      color: "#1a1a1a", opacity: togglingId === u.id ? 0.5 : 1,
                    }}
                  >
                    {u.digestPaused ? "Paused" : "On"}
                  </button>
                </td>
                <td style={{ padding: "10px 12px", fontSize: "0.75rem", color: "#666" }}>{u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "—"}</td>
                <td style={{ padding: "10px 12px", fontSize: "0.75rem", color: "#666" }}>{u.lastActive ? new Date(u.lastActive).toLocaleDateString() : "—"}</td>
                <td style={{ padding: "10px 12px", fontSize: "0.85rem", fontWeight: 600 }}>{u.digestCount}</td>
                <td style={{ padding: "10px 12px", fontSize: "0.85rem", fontWeight: 600, color: "#f59e0b" }}>{u.starredCount}</td>
                <td style={{ padding: "10px 12px", fontSize: "0.85rem", fontWeight: 600 }}>{u.digDeepCount}</td>
                <td style={{ padding: "10px 12px", fontSize: "0.85rem", fontWeight: 600 }}>{u.regenerateCount}</td>
                <td style={{ padding: "10px 12px" }}>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "3px" }}>
                    {u.interests.slice(0, 5).map(k => (
                      <span key={k} style={{ fontSize: "0.55rem", padding: "2px 6px", background: "#f3f4f6", border: "1px solid #e5e7eb", fontFamily: "var(--font-mono), monospace" }}>{k}</span>
                    ))}
                    {u.interests.length > 5 && <span style={{ fontSize: "0.55rem", color: "#888" }}>+{u.interests.length - 5}</span>}
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
            <div key={e.id} style={{ padding: "10px 14px", borderBottom: "1px solid #eee", display: "flex", gap: "12px", alignItems: "flex-start" }}>
              <span style={{ fontSize: "0.6rem", color: "#aaa", fontFamily: "var(--font-mono), monospace", whiteSpace: "nowrap", minWidth: "80px" }}>
                {e.createdAt ? new Date(e.createdAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"}
              </span>
              <span style={{
                fontSize: "0.6rem", fontWeight: 700, padding: "2px 8px",
                background: e.type === "dig_deeper" ? "#dbeafe" : e.type === "star_digest" ? "#fef9c3" : e.type === "digest_generate" ? "#dcfce7" : "#f3f4f6",
                fontFamily: "var(--font-mono), monospace", textTransform: "uppercase", whiteSpace: "nowrap",
              }}>
                {e.type.replace(/_/g, " ")}
              </span>
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: "0.8rem", fontWeight: 600 }}>{e.userName}</span>
                {e.digestTheme && <span style={{ fontSize: "0.75rem", color: "#666" }}> — {e.digestTheme}</span>}
                {e.metadata && typeof e.metadata === "object" && "question" in e.metadata && <p style={{ fontSize: "0.75rem", color: "#888", marginTop: "2px" }}>{`"${String(e.metadata.question)}"`}</p>}
              </div>
            </div>
          ))}
          {data.events.length === 0 && <p style={{ color: "#888", fontSize: "0.8rem" }}>No events yet</p>}
        </div>
      )}

      {/* Themes tab */}
      {tab === "themes" && (
        <div className="space-y-2">
          {data.themes.map(t => (
            <div key={t.id} style={{ padding: "12px 14px", borderBottom: "1px solid #eee", display: "flex", gap: "12px", alignItems: "center" }}>
              <span style={{ fontSize: "0.65rem", color: "#aaa", fontFamily: "var(--font-mono), monospace", whiteSpace: "nowrap", minWidth: "80px" }}>
                {t.date}
              </span>
              {t.starred && <span style={{ color: "#f59e0b" }}>★</span>}
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: "0.9rem", fontWeight: 700, fontFamily: "var(--font-display), sans-serif" }}>{t.theme || "Untitled"}</p>
                <p style={{ fontSize: "0.65rem", color: "#888" }}>{t.userName}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
