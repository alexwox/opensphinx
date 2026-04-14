import type { Metadata } from "next";
import type { ReactNode } from "react";

import "./globals.css";

export const metadata: Metadata = {
  title: "OpenSphinx Demo",
  description: "Minimal Next.js demo for the OpenSphinx package."
};

export default function RootLayout({
  children
}: {
  readonly children: ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
