import type { ReactNode } from "react";

export function FeatureGrid({ children }: { readonly children: ReactNode }) {
  return <div className="feature-grid docs-feature-grid">{children}</div>;
}

export function FeatureCard({
  title,
  description
}: {
  readonly title: string;
  readonly description: string;
}) {
  return (
    <article className="feature-card">
      <h3>{title}</h3>
      <p>{description}</p>
    </article>
  );
}
