import type { Metadata } from "next";
import Link from "next/link";

import { docsPages } from "../../lib/docs";

export const metadata: Metadata = {
  title: "Docs",
  description: "Documentation index for OpenSphinx."
};

export default function DocsIndexPage() {
  const contentPages = docsPages.filter((page) => page.slug !== "");

  return (
    <article className="docs-article">
      <span className="eyebrow">Documentation</span>
      <h1>Start with the runtime loop, then copy the quickstart.</h1>
      <p>
        OpenSphinx intentionally keeps the API narrow: define a config, persist
        session state, generate the next step on the server, and render it with
        React. The pages below split that model into the smallest useful pieces.
      </p>

      <div className="docs-index-grid docs-index-list">
        {contentPages.map((page) => (
          <Link key={page.href} className="docs-card" href={page.href}>
            <h3>{page.title}</h3>
            <span>{page.description}</span>
          </Link>
        ))}
      </div>
    </article>
  );
}
