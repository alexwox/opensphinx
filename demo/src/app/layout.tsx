import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans, Instrument_Serif } from "next/font/google";
import type { ReactNode } from "react";

import { SiteFooter } from "../components/site/site-footer";
import { SiteHeader } from "../components/site/site-header";
import { siteConfig } from "../lib/site-config";

import "./globals.css";

const sans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap"
});

const serif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-display"
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
  variable: "--font-mono"
});

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.siteUrl),
  title: {
    default: "OpenSphinx",
    template: "%s | OpenSphinx"
  },
  description:
    "Open-source AI quiz engine for adaptive, server-driven question flows. Try the demo, read the quickstart, and ship smarter question experiences.",
  applicationName: "OpenSphinx",
  alternates: {
    canonical: "/"
  },
  openGraph: {
    type: "website",
    url: siteConfig.siteUrl,
    title: "OpenSphinx",
    description:
      "Open-source AI quiz engine for adaptive, server-driven question flows.",
    siteName: "OpenSphinx"
  },
  twitter: {
    card: "summary_large_image",
    title: "OpenSphinx",
    description:
      "Open-source AI quiz engine for adaptive, server-driven question flows."
  }
};

export default function RootLayout({
  children
}: {
  readonly children: ReactNode;
}) {
  return (
    <html lang="en" className={`${sans.className} ${serif.variable} ${mono.variable}`}>
      <body>
        <div className="site-frame">
          <SiteHeader />
          {children}
          <SiteFooter />
        </div>
      </body>
    </html>
  );
}
