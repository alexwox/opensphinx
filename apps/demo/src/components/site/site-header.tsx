"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { siteConfig } from "../../lib/site-config";

import { OpenSphinxMark } from "./opensphinx-mark";

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
          <OpenSphinxMark className="site-wordmark__mark" size={20} />
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
