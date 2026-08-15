import type { Metadata } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Providers } from "@/components/providers";
import { auth } from "@/lib/auth";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
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
    "A daily research digest that finds, synthesizes, and contrasts academic papers and news based on your interests. One provocative question a day.",
  applicationName: "Learning et al.",
  keywords: ["research digest", "AI", "papers", "synthesis", "daily reading"],
  openGraph: {
    type: "website",
    url: "https://learningetal.com",
    siteName: "Learning et al.",
    /* Matches the line on the share card — iMessage prints this under the
       image, so the two saying different things reads as a mismatch. */
    title: "Learning et al. — Color me curious.",
    description:
      "A daily research digest that finds, synthesizes, and contrasts academic papers and news based on your interests. One provocative question a day.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Learning et al. — Color me curious.",
    description:
      "A daily research digest that finds, synthesizes, and contrasts academic papers and news based on your interests.",
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
    <html lang="en" className={`${inter.variable} ${geistMono.variable}`}>
      <head>
        {/* Cabinet Grotesk is self-hosted in globals.css (see @font-face) — no
            runtime fontshare CDN dependency, so the display font never flashes
            a fallback sans. Bold is the only weight the menu uses. */}
        <link rel="preload" href="/fonts/CabinetGrotesk-Bold.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
      </head>
      <body className="antialiased">
        <Providers session={session}>{children}</Providers>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
