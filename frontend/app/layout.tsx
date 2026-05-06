import type { Metadata } from "next";
import { Geist, Geist_Mono, Caveat } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const caveat = Caveat({
  variable: "--font-handdrawn",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
});

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "paper-time",
  alternateName: ["Feynman and Friends", "Feynman & Friends", "papertime"],
  url: "https://paper-time.app",
  applicationCategory: "EducationalApplication",
  operatingSystem: "Web",
  description:
    "paper-time turns any long-form learning material into an animated scrollytelling explainer taught by three voice personas — Feynman, a Skeptic, and a Newbie.",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  keywords: "paper-time, Feynman and Friends, AI tutor, animated scrollytelling, Manim, voice agents, education, GOSIM",
};

export const metadata: Metadata = {
  metadataBase: new URL("https://paper-time.app"),
  title: {
    default: "paper-time — Feynman & Friends",
    template: "%s · paper-time",
  },
  description:
    "paper-time turns any paper, textbook chapter, or lecture into an animated scrollytelling lesson taught by three voice personas you can interrupt.",
  applicationName: "paper-time",
  keywords: [
    "paper-time",
    "Feynman and Friends",
    "AI tutor",
    "animated scrollytelling",
    "Manim",
    "voice agents",
    "education",
    "research paper explainer",
    "GOSIM 2026",
  ],
  openGraph: {
    type: "website",
    url: "https://paper-time.app",
    siteName: "paper-time",
    title: "paper-time — Feynman & Friends",
    description:
      "An AI tutor that turns any paper, textbook chapter, or lecture into an animated scrollytelling lesson taught by three voice personas — Feynman, a Skeptic, and a Newbie.",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "paper-time — Feynman & Friends teaching a paper through animation",
      },
    ],
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    site: "@m2moiz",
    creator: "@m2moiz",
    title: "paper-time — Feynman & Friends",
    description:
      "An AI tutor that turns any paper, textbook chapter, or lecture into an animated scrollytelling lesson taught by three voice personas — Feynman, a Skeptic, and a Newbie.",
    images: ["/og.png"],
  },
  icons: {
    icon: [
      { url: "/icon.png", type: "image/png" },
      { url: "/icon.png", sizes: "any" },
    ],
    apple: [{ url: "/icon.png", type: "image/png" }],
  },
  alternates: {
    canonical: "https://paper-time.app",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${caveat.variable} antialiased min-h-dvh bg-[var(--paper-cream)] text-[var(--ink-black)]`}
      >
        <div className="min-h-dvh">{children}</div>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
