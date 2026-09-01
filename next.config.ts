import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

// One static policy for every response. No nonces: the app has no third-party
// scripts (Vercel analytics/insights are served same-origin), so 'self' plus
// Next's inline bootstrap covers it. Dev needs eval (source maps) and ws (HMR).
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  // Fontshare serves the Cabinet Grotesk stylesheet (api.) and woff files (cdn.)
  "style-src 'self' 'unsafe-inline' https://api.fontshare.com",
  "img-src 'self' data: blob: https://*.googleusercontent.com",
  "font-src 'self' https://cdn.fontshare.com",
  `connect-src 'self'${isDev ? " ws:" : ""}`,
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  // Chrome applies form-action to post-submit redirects; the OAuth flow lands on Google
  "form-action 'self' https://accounts.google.com",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  serverExternalPackages: ["@xenova/transformers"],
  poweredByHeader: false,
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
