"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { siteConfig } from "../../lib/site-config";

function Mark() {
  return (
    <svg
      className="site-wordmark__mark"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M12 2L4 7v10l8 5 8-5V7l-8-5z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M12 12l8-5M12 12v10M12 12L4 7"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const primaryLinks = [
  { href: "/demo", label: "Demo" },
  { href: "/docs", label: "Docs" }
] as const;

const externalLinks = [
  { href: siteConfig.links.github, label: "GitHub" },
  { href: siteConfig.links.npm, label: "npm" }
] as const;

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="site-header">
      <div className="site-header__inner site-container">
        <Link className="site-wordmark" href="/">
          <Mark />
          {siteConfig.name}
        </Link>

        <nav className="site-nav" aria-label="Primary">
          {primaryLinks.map((link) => {
            const isActive =
              pathname === link.href || pathname.startsWith(`${link.href}/`);

            return (
              <Link
                key={link.href}
                className="site-nav__link"
                data-active={isActive}
                href={link.href}
              >
                {link.label}
              </Link>
            );
          })}

          {externalLinks.map((link) => (
            <a
              key={link.href}
              className="site-nav__link"
              href={link.href}
              rel="noreferrer"
              target="_blank"
            >
              {link.label}
            </a>
          ))}
        </nav>
      </div>
    </header>
  );
}
