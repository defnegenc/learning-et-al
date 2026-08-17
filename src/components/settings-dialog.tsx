"use client";

import { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Settings, Loader2, CheckCircle, RefreshCw, LogOut } from "lucide-react";
import { useSession as useAuthSession } from "next-auth/react";
import { FIELD_HIERARCHY } from "@/lib/field-hierarchy";
import type { S2Field } from "@/lib/field-hierarchy";
import { InterestLedger, MAX_INTERESTS, type CustomTopics } from "@/components/interest-ledger";
import {
  ACID_GREEN, ActionButton, BODY_STYLE, DIM, DISPLAY_SM, FIELD, HAIRLINE, INK,
  MUTED, PageTitle, SectionLabel, Segmented, SiteHeader, SURFACE,
} from "@/components/design-system";

export type SettingsTab = "interests" | "account";

interface SelectedTopic {
  keyword: string;
  field: S2Field;
  fieldLabel: string;
  color: string;
}

interface SettingsDialogProps {
  updateSession: (updates: Record<string, unknown>) => void;
  onRefreshDigest?: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  startTab?: SettingsTab;
  isAdmin?: boolean;
  onRegenerate?: () => void;
}

const CADENCE = [
  { key: "daily" as const, label: "Daily", desc: "The morning digest, every day." },
  { key: "biweekly" as const, label: "Bi-weekly", desc: "Tuesday and Friday mornings." },
  { key: "weekly" as const, label: "Weekly", desc: "One Sunday recap." },
];

export function SettingsDialog({ open: controlledOpen, onOpenChange, startTab, isAdmin, onRegenerate, updateSession: _updateSession }: SettingsDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = (v: boolean) => { isControlled ? onOpenChange?.(v) : setInternalOpen(v); };
  const [tab, setTab] = useState<SettingsTab>("interests");
  const initialFocusRef = useRef<HTMLDivElement>(null);
  const { data: authSession } = useAuthSession();

  // Interests state
  const [selectedTopics, setSelectedTopics] = useState<SelectedTopic[]>([]);
  const [customTopics, setCustomTopics] = useState<CustomTopics>({});
  const [loadingInterests, setLoadingInterests] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [cadence, setCadence] = useState<"daily" | "biweekly" | "weekly">("daily");
  const [emailOptOut, setEmailOptOut] = useState(false);

  useEffect(() => {
    if (open) {
      setTab(startTab || "interests");
      loadInterests();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, startTab]);

  async function loadInterests() {
    setLoadingInterests(true);
    try {
      const res = await fetch("/api/interests");
      if (!res.ok) return;
      const data = await res.json();
      const entries: SelectedTopic[] = [];
      const customByField: CustomTopics = {};
      for (const i of (data.interests ?? []) as { keyword: string; field: string; level: string }[]) {
        const fieldEntry = Object.entries(FIELD_HIERARCHY).find(([, f]) => f.s2Field === i.field);
        entries.push({
          keyword: i.keyword,
          field: (i.field || "Computer Science") as S2Field,
          fieldLabel: fieldEntry ? fieldEntry[1].label : "CS",
          color: fieldEntry ? fieldEntry[1].color : FIELD,
        });
        if (fieldEntry && !fieldEntry[1].topics.includes(i.keyword)) {
          const key = fieldEntry[0];
          (customByField[key] ||= []).push(i.keyword);
        }
      }
      setSelectedTopics(entries);
      setCustomTopics(customByField);
      if (data.cadence) setCadence(data.cadence);
      if (typeof data.emailOptOut === "boolean") setEmailOptOut(data.emailOptOut);
    } finally {
      setLoadingInterests(false);
    }
  }

  function toggleTopic(keyword: string, fieldKey: string) {
    const fieldDef = FIELD_HIERARCHY[fieldKey];
    if (!fieldDef) return;
    const exists = selectedTopics.findIndex(t => t.keyword === keyword);
    if (exists > -1) {
      setSelectedTopics(prev => prev.filter(t => t.keyword !== keyword));
    } else if (selectedTopics.length < MAX_INTERESTS) {
      setSelectedTopics(prev => [...prev, {
        keyword, field: fieldDef.s2Field, fieldLabel: fieldDef.label, color: fieldDef.color,
      }]);
    }
  }

  function addCustom(fieldKey: string, topic: string) {
    const val = topic.trim();
    if (!val || selectedTopics.length >= MAX_INTERESTS) return;
    const fieldDef = FIELD_HIERARCHY[fieldKey];
    if (!fieldDef) return;
    setCustomTopics(prev => {
      const existing = prev[fieldKey] || [];
      if (existing.some(x => x.toLowerCase() === val.toLowerCase())) return prev;
      return { ...prev, [fieldKey]: [...existing, val] };
    });
    setSelectedTopics(prev => {
      if (prev.some(t => t.keyword === val)) return prev;
      return [...prev, { keyword: val, field: fieldDef.s2Field, fieldLabel: fieldDef.label, color: fieldDef.color }];
    });
  }

  function removeCustom(fieldKey: string, topic: string) {
    setCustomTopics(prev => ({ ...prev, [fieldKey]: (prev[fieldKey] || []).filter(x => x !== topic) }));
    setSelectedTopics(prev => prev.filter(t => t.keyword !== topic));
  }

  async function handleSave() {
    setSaving(true);
    try {
      if (selectedTopics.length >= 3) {
        await fetch("/api/interests", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ interests: selectedTopics.map(t => ({ keyword: t.keyword, field: t.field, level: "beginner" })) }),
        });
      }
      await fetch("/api/setup", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cadence, emailOptOut }),
      }).catch(() => {});
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  const navItems: { key: SettingsTab; label: string }[] = [
    { key: "interests", label: "Interests" },
    { key: "account", label: "Account" },
  ];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!isControlled && (
        <DialogTrigger render={<Button variant="ghost" size="icon" />}>
          <Settings className="size-4" />
        </DialogTrigger>
      )}
      <DialogContent
        className="flex flex-col p-0 gap-0 w-screen h-[100dvh] max-w-none rounded-none md:w-full md:max-w-[880px] md:h-[90vh]"
        style={{ borderRadius: 0 }}
        showCloseButton={false}
        // Focus the panel itself, not the first button in it — otherwise
        // "Done" opens wearing a focus ring and reads as a bordered control.
        initialFocus={initialFocusRef}
      >
        <div ref={initialFocusRef} tabIndex={-1} style={{ outline: "none", position: "absolute" }} aria-hidden />
        {/* ── Top bar ── */}
        <SiteHeader style={{ flexShrink: 0 }} right={
          <ActionButton variant="plain" onClick={() => setOpen(false)}>Done</ActionButton>
        } />

        {/* The settings shape everyone already knows: a nav rail on the left,
            the section on the right. Below md the rail becomes a tab strip
            across the top, since a phone has no width to spare for it. */}
        <div className="flex-1 flex overflow-hidden">
          <nav
            className="hidden md:block"
            style={{ width: 190, flexShrink: 0, borderRight: `1px solid ${INK}`, padding: "16px 0" }}
          >
            {navItems.map(n => (
              <button
                key={n.key}
                onClick={() => setTab(n.key)}
                aria-current={tab === n.key ? "page" : undefined}
                style={{
                  ...DISPLAY_SM,
                  display: "block", width: "100%", textAlign: "left",
                  padding: "12px 20px", background: "none", border: "none",
                  borderLeft: `2px solid ${tab === n.key ? INK : "transparent"}`,
                  color: tab === n.key ? INK : MUTED,
                  cursor: "pointer", transition: "color 140ms",
                }}
              >
                {n.label}
              </button>
            ))}
          </nav>

          <main className="flex-1 flex flex-col overflow-hidden min-w-0">
            <div className="md:hidden flex" style={{ flexShrink: 0, borderBottom: `1px solid ${INK}` }}>
              {navItems.map(n => (
                <button
                  key={n.key}
                  onClick={() => setTab(n.key)}
                  aria-current={tab === n.key ? "page" : undefined}
                  style={{
                    ...DISPLAY_SM,
                    flex: 1, padding: "14px 8px", background: "none", border: "none",
                    borderBottom: `2px solid ${tab === n.key ? INK : "transparent"}`,
                    marginBottom: -1,
                    color: tab === n.key ? INK : MUTED,
                    cursor: "pointer",
                  }}
                >
                  {n.label}
                </button>
              ))}
            </div>

          {/* ── Interests tab ── */}
          {tab === "interests" && (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="px-4 pt-5 pb-3 md:px-10 md:pt-8 md:pb-4" style={{ flexShrink: 0 }}>
                <PageTitle style={{ marginBottom: 12 }}>Curate your feed</PageTitle>
                <p style={{ ...BODY_STYLE, color: DIM, maxWidth: 560, margin: 0 }}>
                  Pick the topics your daily digest thinks with. Breadth beats depth, so it samples across everything you choose.
                </p>
              </div>

              <div className="flex-1 overflow-y-auto px-4 md:px-10">
                {loadingInterests ? (
                  <div className="flex items-center justify-center py-16"><Loader2 size={20} className="animate-spin" style={{ color: MUTED }} /></div>
                ) : (
                  <InterestLedger
                    selected={selectedTopics}
                    custom={customTopics}
                    onToggle={toggleTopic}
                    onAddCustom={addCustom}
                    onRemoveCustom={removeCustom}
                  />
                )}
              </div>
            </div>
          )}

          {/* ── Account tab — who you are, when it arrives, and the two buttons ── */}
          {tab === "account" && (
            <div className="flex-1 overflow-y-auto px-4 py-5 md:px-10 md:py-8">
              <PageTitle style={{ marginBottom: 24 }}>Account</PageTitle>

              {authSession?.user && (
                <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 28, paddingBottom: 24, borderBottom: HAIRLINE }}>
                  {authSession.user.image && (
                    <img src={authSession.user.image} alt="" style={{ width: "40px", height: "40px", borderRadius: "50%", border: "1.5px solid rgba(26,26,26,0.12)" }} />
                  )}
                  <div style={{ minWidth: 0 }}>
                    <div style={{ ...BODY_STYLE, fontWeight: 600 }}>{authSession.user.name}</div>
                    <div style={{ ...BODY_STYLE, color: MUTED, overflow: "hidden", textOverflow: "ellipsis" }}>{authSession.user.email}</div>
                  </div>
                </div>
              )}

              {/* Delivery — moved off the Interests tab so picking topics on a
                  phone isn't two screens of preferences before the first chip. */}
              <div style={{ marginBottom: 28, paddingBottom: 24, borderBottom: HAIRLINE }}>
                <SectionLabel style={{ marginBottom: "10px" }}>How often</SectionLabel>
                <Segmented
                  value={cadence}
                  onChange={setCadence}
                  options={CADENCE.map(c => ({ key: c.key, label: c.label }))}
                />
                <p style={{ ...BODY_STYLE, color: MUTED, margin: "10px 0 0" }}>
                  {CADENCE.find(c => c.key === cadence)?.desc}
                </p>

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, marginTop: 20 }}>
                  <div>
                    <SectionLabel>Email it to me</SectionLabel>
                    <div style={{ ...BODY_STYLE, color: MUTED, marginTop: 4 }}>Otherwise it waits for you on the site.</div>
                  </div>
                  <button
                    onClick={() => setEmailOptOut(v => !v)}
                    role="switch"
                    aria-checked={!emailOptOut}
                    aria-label="Email digests"
                    style={{
                      width: 46, height: 26, border: `2px solid ${INK}`,
                      background: emailOptOut ? SURFACE : INK,
                      position: "relative", cursor: "pointer", flexShrink: 0, transition: "background 0.15s",
                    }}
                  >
                    <span style={{
                      position: "absolute", top: 2, left: emailOptOut ? 2 : 20,
                      width: 18, height: 18,
                      background: emailOptOut ? INK : SURFACE,
                      transition: "left 0.15s",
                    }} />
                  </button>
                </div>
              </div>

              {isAdmin && (
                <div style={{ marginBottom: 28, paddingBottom: 24, borderBottom: HAIRLINE }}>
                  <SectionLabel style={{ marginBottom: "4px" }}>Today&rsquo;s digest</SectionLabel>
                  <p style={{ ...BODY_STYLE, color: MUTED, margin: "0 0 14px" }}>
                    Build it again from scratch. New question, new papers.
                  </p>
                  <ActionButton onClick={() => { onRegenerate?.(); setOpen(false); }} style={{ width: "100%", justifyContent: "center" }}>
                    <RefreshCw size={15} />
                    Regenerate digest
                  </ActionButton>
                </div>
              )}

              <ActionButton
                variant="outline"
                onClick={() => {
                  localStorage.removeItem("pp_session");
                  window.location.href = "/api/logout";
                }}
                style={{ width: "100%", justifyContent: "center" }}
              >
                <LogOut size={15} />
                Sign out
              </ActionButton>
            </div>
          )}
        {/* ── One footer for both tabs — Save is never scrolled off. Its rule
            is the header's rule: same 1px ink line top and bottom. ── */}
        <div
          className="px-4 md:px-10"
          style={{
            borderTop: HAIRLINE, background: SURFACE, flexShrink: 0,
            paddingTop: 12, paddingBottom: "max(12px, env(safe-area-inset-bottom))",
            display: "flex", alignItems: "center", gap: 10,
          }}
        >
          {saved ? (
            <span style={{ ...BODY_STYLE, fontWeight: 600, color: ACID_GREEN, display: "flex", alignItems: "center", gap: 8, marginRight: "auto" }}>
              <CheckCircle size={15} /> All changes saved
            </span>
          ) : (
            <span style={{ ...BODY_STYLE, color: MUTED, marginRight: "auto" }}>
              {tab === "interests" && selectedTopics.length < 3 ? "Pick at least 3 topics." : ""}
            </span>
          )}
          {tab === "interests" && selectedTopics.length > 0 && (
            <button
              onClick={() => { setSelectedTopics([]); setCustomTopics({}); }}
              style={{ ...DISPLAY_SM, color: MUTED, background: "none", border: "none", cursor: "pointer", padding: "8px 4px" }}
            >
              Clear all
            </button>
          )}
          <ActionButton variant="primary" disabled={saving} onClick={handleSave}>
            {saving ? <Loader2 size={15} className="animate-spin" /> : tab === "interests" ? "Save interests" : "Save"}
          </ActionButton>
            </div>
          </main>
        </div>
      </DialogContent>
    </Dialog>
  );
}
