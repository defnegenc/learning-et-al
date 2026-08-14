import type { Metadata } from "next";
import { Inter, IBM_Plex_Mono, Space_Grotesk } from "next/font/google";
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

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["700"],
  variable: "--font-logo",
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
    title: "Learning et al. — The digest that thinks.",
    description:
      "A daily research digest that finds, synthesizes, and contrasts academic papers and news based on your interests. One provocative question a day.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Learning et al. — The digest that thinks.",
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
    <html lang="en">
      <head>
        {/* Cabinet Grotesk is self-hosted in globals.css (see @font-face) — no
            runtime fontshare CDN dependency, so the display font never flashes
            a fallback sans. */}
        <link rel="preload" href="/fonts/CabinetGrotesk-Extrabold.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
      </head>
      <body className={`${inter.variable} ${plexMono.variable} ${spaceGrotesk.variable} antialiased`}>
        <Providers session={session}>{children}</Providers>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
