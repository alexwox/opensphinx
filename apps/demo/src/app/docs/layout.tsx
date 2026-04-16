import type { ReactNode } from "react";

import { DocsSidebar } from "../../components/docs/docs-sidebar";

export default function DocsLayout({
  children
}: {
  readonly children: ReactNode;
}) {
  return (
    <main className="docs-shell site-container">
      <div className="docs-layout">
        <DocsSidebar />
        <div className="docs-content">{children}</div>
      </div>
    </main>
  );
}
