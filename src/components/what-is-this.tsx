"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { FIELD_HIERARCHY } from "@/lib/field-hierarchy";
import {
  ActionButton, BODY_SM, BODY_STYLE, BORDER, DIM, DISPLAY_LG, DISPLAY_SM,
  HAIRLINE, INK, MUTED, SHADOW, SURFACE, TopicChip,
} from "@/components/design-system";

/*
 * "What is Learning et al.?" — the logged-out explainer.
 *
 * A first-time visitor lands straight on the admin's digest with nothing saying
 * it was generated from somebody's interests and that they can have their own.
 * This is the only place that says it. Three beats, and the first one is not a
 * description of the interest picker but the picker's own chips: what you see in
 * the explainer is literally what you touch in onboarding, so nothing here can
 * drift out of step with the thing it is promising.
 *
 * No new tokens. The frame is the Card object (2px ink, `5px 5px 0`, no radius),
 * the type is four of the five styles, and the chips take their fill from
 * `FIELD_HIERARCHY` rather than a hex written here — a field's slot is fixed and
 * this surface is not allowed to have an opinion about it.
 *
 * Click-only. A modal that opens itself on first paint is the opposite of this
 * product's calm, and the trigger sits exactly where a confused visitor's eye
 * already is.
 *
 * Two contexts, one surface. `public` is the logged-out digest and the shared
 * permalink, where the closing line can point at the digest behind the window
 * and the CTA is Sign in. `onboarding` is the same three beats reached from the
 * interest step, where the reader has already signed in and the honest closing
 * line is what happens when they press the button. Only the trigger's words and
 * that last line differ — the beats are deliberately identical, because the
 * whole point is that there is one explanation of this product, not two.
 */

const COPY = {
  public: {
    trigger: "What is Learning et al.?",
    closing: "The digest behind this window is a live example.",
  },
  onboarding: {
    trigger: "What happens next?",
    closing: "Your first digest takes a minute or two to make.",
  },
} as const;

/**
 * The three chips, as interest tags doing their real job. They carry words, so
 * this is not the banned swatch row; the colour is identity, not ornament.
 * `field` is a `FIELD_HIERARCHY` key, which is where the slot comes from.
 */
const SAMPLE_INTERESTS: { label: string; field: string }[] = [
  { label: "sleep science", field: "Medicine" },
  { label: "quantum computing", field: "Physics & Engineering" },
  { label: "behavioral economics", field: "Social Sciences" },
];

function Beat({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ padding: "18px 0", borderBottom: HAIRLINE }}>
      <div style={{ ...DISPLAY_SM, marginBottom: 8 }}>{title}</div>
      {children}
    </div>
  );
}

export function WhatIsThis({ onSignIn, variant = "public" }: {
  onSignIn?: () => void;
  variant?: keyof typeof COPY;
}) {
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState(false);
  const copy = COPY[variant];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {/* The trigger names the product, not the machinery, so it is the body
          face rather than a mono Label — and an ink underline rather than a
          button, so it stays quieter than the digest title beside it. */}
      <DialogTrigger
        render={
          <button
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
            style={{
              ...BODY_SM,
              color: INK,
              background: "none",
              border: "none",
              padding: 0,
              cursor: "pointer",
              textDecoration: "underline",
              textDecorationThickness: hover ? "3px" : "2px",
              textUnderlineOffset: "3px",
              transition: "text-decoration-thickness 140ms",
              whiteSpace: "nowrap",
            }}
          />
        }
      >
        {copy.trigger}
      </DialogTrigger>

      <DialogContent
        className="w-screen h-[100dvh] max-w-none overflow-y-auto p-0 gap-0 md:w-full md:max-w-[480px] md:h-auto"
        style={{ borderRadius: 0, border: BORDER, boxShadow: SHADOW, background: SURFACE }}
        showCloseButton={false}
      >
        <div style={{ padding: "22px 24px 24px" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
            <DialogTitle style={{ ...DISPLAY_LG, margin: 0 }}>
              What is Learning et al.?
            </DialogTitle>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close"
              style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: 18, lineHeight: 1, color: MUTED, marginTop: 6 }}
            >×</button>
          </div>

          <div style={{ marginTop: 14 }}>
            <Beat title="Pick your interests">
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {SAMPLE_INTERESTS.map(({ label, field }) => (
                  <TopicChip
                    key={label}
                    label={label}
                    selected
                    tint={FIELD_HIERARCHY[field]?.color}
                  />
                ))}
              </div>
            </Beat>

            <Beat title="Get one idea every morning">
              <p style={{ ...BODY_STYLE, color: DIM, margin: 0 }}>
                Each day we find real papers that connect your interests and write a
                short argument around one question.
              </p>
            </Beat>

            <Beat title="Save what hooks you">
              <p style={{ ...BODY_STYLE, color: DIM, margin: 0 }}>
                Saved papers go to your vault and get a reading companion, so you can
                dig deeper later.
              </p>
            </Beat>
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginTop: 20 }}>
            <p style={{ ...BODY_SM, color: DIM, margin: 0, maxWidth: 220 }}>
              {copy.closing}
            </p>
            {onSignIn && (
              <ActionButton
                variant="primary"
                onClick={() => { setOpen(false); onSignIn(); }}
              >
                Sign in to get yours
              </ActionButton>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
