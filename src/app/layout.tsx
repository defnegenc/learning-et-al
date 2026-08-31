import type { Metadata } from "next";
import { Hanken_Grotesk, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Providers } from "@/components/providers";
import { auth } from "@/lib/auth";
import "./globals.css";

/* The body face. Variable font, so the menu's 400/500/600/700 (and italics)
   all come from one file; next/font self-hosts it at build time, keeping the
   repo free of files we can't redistribute. */
const hankenGrotesk = Hanken_Grotesk({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-hanken-grotesk",
  display: "swap",
});

// Three faces, not five. Geist Mono replaces IBM Plex Mono (the menu names it
// as the label face); Space Grotesk left with the Wordmark *style* — the
// wordmark is a lockup built from Display/SM, not a face of its own.
const geistMono = Geist_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-geist-mono",
  display: "swap",
});


export const metadata: Metadata = {
  metadataBase: new URL("https://learningetal.com"),
  title: {
    default: "Learning et al.",
    template: "%s — Learning et al.",
  },
  description:
    "A daily research digest that finds, synthesises, and contrasts papers around one provocative question.",
  applicationName: "Learning et al.",
  keywords: ["research digest", "AI", "papers", "synthesis", "daily reading"],
  openGraph: {
    type: "website",
    url: "https://learningetal.com",
    siteName: "Learning et al.",
    title: "Learning et al.",
    description:
      "A daily research digest that finds, synthesises, and contrasts papers around one provocative question.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Learning et al.",
    description:
      "A daily research digest that finds, synthesises, and contrasts papers around one provocative question.",
  },
};

// Async so the JWT session is decoded on the server and passed to the client
// provider — this trades `/` being prerendered for one fewer sequential request
// (/api/auth/session) before the digest fetch can start.
export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();

  return (
    /* The font variables go on <html>, not <body>: globals.css builds
       --font-body and --font-mono out of them at :root, and a custom property
       declared on :root can only see other properties declared on the same
       element. On <body> the whole chain resolved to invalid and every mono
       label fell back to the browser default. */
    <html lang="en" className={`${hankenGrotesk.variable} ${geistMono.variable}`}>
      <head>
        {/* Cabinet Grotesk loads from the official Fontshare API. This keeps the
            licensed font out of the public repository while restoring the
            intended display face. */}
        <link rel="preconnect" href="https://api.fontshare.com" />
        <link rel="preconnect" href="https://cdn.fontshare.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://api.fontshare.com/v2/css?f%5B%5D=cabinet-grotesk@700&display=swap"
        />
      </head>
      <body className="antialiased">
        <Providers session={session}>{children}</Providers>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
