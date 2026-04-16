import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { isValidElement } from "react";

function getCodeLabel(children: ReactNode) {
  if (!isValidElement(children)) {
    return null;
  }

  const props = children.props as { className?: string };
  const className = props.className ?? "";
  const language = className.replace("language-", "");

  if (!language || language === className) {
    return null;
  }

  return language;
}

export function CodeBlock({
  children,
  ...props
}: ComponentPropsWithoutRef<"pre">) {
  const label = getCodeLabel(children);

  return (
    <div className="docs-code-block">
      {label ? <div className="docs-code-block__label">{label}</div> : null}
      <pre {...props}>{children}</pre>
    </div>
  );
}
