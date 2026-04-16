import type { ReactNode } from "react";

export function Callout({
  children,
  title,
  tone = "info"
}: {
  readonly children: ReactNode;
  readonly title?: string;
  readonly tone?: "info" | "warning";
}) {
  return (
    <div className="docs-callout" data-tone={tone}>
      {title ? <strong>{title}</strong> : null}
      <div>{children}</div>
    </div>
  );
}
