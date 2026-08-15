"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import {
  BODY_STYLE, BORDER, DIM, DISPLAY_LG, FIELD, INK, Label, MONO, PageLoader, SURFACE,
} from "@/components/design-system";

function ErrorContent() {
  const params = useSearchParams();
  const error = params.get("error");

  return (
    <div style={{ maxWidth: 680, margin: "0 auto", background: SURFACE }} className="px-5 md:px-8 pt-12 pb-24">
      <Label style={{ marginBottom: 12 }}>Auth / Error</Label>
      <h1 style={{ ...DISPLAY_LG, margin: "0 0 16px" }}>Sign-in didn&rsquo;t go through</h1>

      <p style={{ ...BODY_STYLE, margin: "0 0 8px" }}>
        <strong style={{ fontWeight: 600 }}>Error code:</strong> {error || "unknown"}
      </p>
      {error === "Configuration" && (
        <p style={{ ...BODY_STYLE, color: DIM, margin: "0 0 20px" }}>
          Auth.js reported a configuration error. Check the Vercel runtime logs for
          <code style={{ fontFamily: MONO }}> [auth][error]</code> details — usually a missing env var,
          an adapter incompatibility, or a misconfigured provider.
        </p>
      )}

      <pre style={{ ...BODY_STYLE, fontFamily: MONO, border: BORDER, background: FIELD, padding: 16, overflow: "auto", margin: "20px 0" }}>
        {JSON.stringify(Object.fromEntries(params.entries()), null, 2)}
      </pre>

      <a href="/" style={{ ...BODY_STYLE, color: INK, textDecoration: "underline", textUnderlineOffset: 4 }}>
        ← Back to today&rsquo;s digest
      </a>
    </div>
  );
}

export default function AuthErrorPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <ErrorContent />
    </Suspense>
  );
}
