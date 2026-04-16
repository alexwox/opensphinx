import type { Metadata } from "next";
import { Inter } from "next/font/google";
import type { ReactNode } from "react";

import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap"
});

export const metadata: Metadata = {
  title: "OpenSphinx — AI Quiz Engine Demo",
  description:
    "See how OpenSphinx adapts questions in real time. Seed steps, adaptive follow-up, and intelligent completion."
};

export default function RootLayout({
  children
}: {
  readonly children: ReactNode;
}) {
  return (
    <html lang="en" className={inter.className}>
      <body>{children}</body>
    </html>
  );
}
