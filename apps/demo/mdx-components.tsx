import type { ComponentPropsWithoutRef } from "react";

import type { MDXComponents } from "mdx/types";

import { Callout } from "./src/components/docs/callout";
import { CodeBlock } from "./src/components/docs/code-block";
import { DemoCta } from "./src/components/docs/demo-cta";
import { FeatureCard, FeatureGrid } from "./src/components/docs/feature-grid";
import { PackageBadge } from "./src/components/docs/package-badge";
import { PackageTabs } from "./src/components/docs/package-tabs";

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    pre: (props: ComponentPropsWithoutRef<"pre">) => <CodeBlock {...props} />,
    Callout,
    DemoCta,
    FeatureCard,
    FeatureGrid,
    PackageBadge,
    PackageTabs,
    ...components
  };
}
