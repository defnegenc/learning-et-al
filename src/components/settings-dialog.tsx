"use client";

import { useState, useEffect } from "react";
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
  ACID_GREEN, ActionButton, BODY_STYLE, BORDER, DIM, FIELD, HAIRLINE, INK, Label, MUTED,
  NavTab, PageTitle, SectionLabel, Segmented, SiteHeader, SURFACE,
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
      >
        {/* ── Top bar — tabs live here on desktop, under it on mobile ── */}
        <SiteHeader style={{ flexShrink: 0 }} right={
          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-4">
              {navItems.map(n => (
                <NavTab key={n.key} active={tab === n.key} onClick={() => setTab(n.key)}>{n.label}</NavTab>
              ))}
            </div>
            <ActionButton variant="plain" onClick={() => setOpen(false)}>Done</ActionButton>
          </div>
        } />

        {/* Mobile tab bar — full width, thumb-sized, so Account is never a
            9px word tucked in the corner of the header. */}
        <div className="md:hidden px-4 pt-3 pb-1" style={{ flexShrink: 0 }}>
          <Segmented
            value={tab}
            onChange={setTab}
            options={navItems.map(n => ({ key: n.key, label: n.label }))}
          />
        </div>

        <main className="flex-1 flex flex-col overflow-hidden">
          {/* ── Interests tab ── */}
          {tab === "interests" && (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="px-4 pt-5 pb-3 md:px-10 md:pt-8 md:pb-4" style={{ flexShrink: 0 }}>
                <Label style={{ marginBottom: 12 }}>Preferences / Interests</Label>
                <PageTitle style={{ marginBottom: 12 }}>Curate your feed</PageTitle>
                <p style={{ ...BODY_STYLE, color: DIM, maxWidth: 560, margin: 0 }}>
                  Pick the topics your daily digest thinks with. Breadth beats depth — the algorithm samples across everything you choose.
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
              <Label style={{ marginBottom: 12 }}>Preferences / Account</Label>
              <PageTitle style={{ marginBottom: 24 }}>Account</PageTitle>

              {authSession?.user && (
                <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 28, paddingBottom: 24, borderBottom: HAIRLINE }}>
                  {authSession.user.image && (
                    <img src={authSession.user.image} alt="" style={{ width: 40, height: 40, border: `1px solid ${INK}` }} />
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
                <SectionLabel style={{ marginBottom: 12 }}>How often</SectionLabel>
                <Segmented
                  value={cadence}
                  onChange={setCadence}
                  options={CADENCE.map(c => ({ key: c.key, label: c.label }))}
                />
                <p style={{ ...BODY_STYLE, color: MUTED, margin: "10px 0 0" }}>
                  {CADENCE.find(c => c.key === cadence)?.desc}
                </p>

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, marginTop: 24 }}>
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
                      width: 46, height: 26, border: BORDER,
                      background: emailOptOut ? SURFACE : INK,
                      position: "relative", cursor: "pointer", flexShrink: 0, transition: "background 140ms",
                    }}
                  >
                    <span style={{
                      position: "absolute", top: 2, left: emailOptOut ? 2 : 20,
                      width: 18, height: 18,
                      background: emailOptOut ? INK : SURFACE,
                      transition: "left 140ms",
                    }} />
                  </button>
                </div>
              </div>

              {isAdmin && (
                <div style={{ marginBottom: 28, paddingBottom: 24, borderBottom: HAIRLINE }}>
                  <SectionLabel style={{ marginBottom: 6 }}>Today&rsquo;s digest</SectionLabel>
                  <p style={{ ...BODY_STYLE, color: MUTED, margin: "0 0 14px" }}>
                    Build it again from scratch — new question, new papers.
                  </p>
                  <ActionButton onClick={() => { onRegenerate?.(); setOpen(false); }} style={{ width: "100%", justifyContent: "center" }}>
                    <RefreshCw className="size-3.5" />
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
                <LogOut className="size-3.5" />
                Sign out
              </ActionButton>
            </div>
          )}
        </main>

        {/* ── One footer for both tabs — Save is never scrolled off ── */}
        <div
          className="px-4 md:px-10"
          style={{
            borderTop: HAIRLINE, background: SURFACE, flexShrink: 0,
            paddingTop: 16, paddingBottom: "max(16px, env(safe-area-inset-bottom))",
            display: "flex", alignItems: "center", gap: 16,
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
            <ActionButton variant="plain" onClick={() => { setSelectedTopics([]); setCustomTopics({}); }} style={{ color: MUTED }}>
              Clear all
            </ActionButton>
          )}
          <ActionButton variant="primary" disabled={saving} onClick={handleSave}>
            {saving ? <Loader2 size={15} className="animate-spin" /> : tab === "interests" ? "Save interests" : "Save"}
          </ActionButton>
        </div>
      </DialogContent>
    </Dialog>
  );
}
