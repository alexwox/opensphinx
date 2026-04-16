"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { docsPages } from "../../lib/docs";

export function DocsSidebar() {
  const pathname = usePathname();

  return (
    <aside className="docs-sidebar">
      <div className="docs-sidebar__card docs-card">
        <p className="docs-sidebar__title">Docs</p>
        <nav aria-label="Documentation">
          {docsPages.map((page) => {
            const isActive = pathname === page.href;

            return (
              <Link
                key={page.href}
                className="docs-sidebar__link"
                data-active={isActive}
                href={page.href}
              >
                {page.title}
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
