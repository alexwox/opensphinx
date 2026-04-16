import Link from "next/link";

export function DemoCta({
  title = "Try the live demo",
  description = "See the seed-step opening, adaptive follow-up, and completion flow in the running site."
}: {
  readonly title?: string;
  readonly description?: string;
}) {
  return (
    <div className="docs-demo-cta">
      <h3>{title}</h3>
      <p>{description}</p>
      <div className="docs-demo-cta__actions">
        <Link className="button button--primary" href="/demo">
          Open demo
        </Link>
        <Link className="button button--secondary" href="/docs/quickstart">
          Read quickstart
        </Link>
      </div>
    </div>
  );
}
