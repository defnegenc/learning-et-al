"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function ErrorContent() {
  const params = useSearchParams();
  const error = params.get("error");

  return (
    <div style={{ padding: "40px", maxWidth: "600px", margin: "0 auto", fontFamily: "monospace" }}>
      <h1 style={{ fontSize: "1.5rem", marginBottom: "20px" }}>Auth Error Debug</h1>
      <p><strong>Error code:</strong> {error}</p>
      <p style={{ marginTop: "10px", fontSize: "0.9rem", color: "#666" }}>
        {error === "Configuration" && (
          <>
            Auth.js &quot;Configuration&quot; error. Check Vercel runtime logs for [auth][error] details.
            This usually means: missing env vars, adapter incompatibility, or provider misconfiguration.
          </>
        )}
      </p>
      <pre style={{ marginTop: "20px", padding: "16px", background: "#f5f5f5", fontSize: "0.8rem", overflow: "auto" }}>
        {JSON.stringify(Object.fromEntries(params.entries()), null, 2)}
      </pre>
      <a href="/" style={{ display: "inline-block", marginTop: "20px", color: "#1a1a1a" }}>← Back to home</a>
    </div>
  );
}

export default function AuthErrorPage() {
  return (
    <Suspense fallback={<div style={{ padding: "40px" }}>Loading...</div>}>
      <ErrorContent />
    </Suspense>
  );
}
