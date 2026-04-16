export type DocPage = {
  readonly slug: string;
  readonly href: string;
  readonly title: string;
  readonly description: string;
};

export const docsPages: readonly DocPage[] = [
  {
    slug: "",
    href: "/docs",
    title: "Docs",
    description: "Start here for the OpenSphinx mental model and navigation."
  },
  {
    slug: "quickstart",
    href: "/docs/quickstart",
    title: "Quickstart",
    description: "Install the package, define config, generate steps, render them."
  },
  {
    slug: "concepts",
    href: "/docs/concepts",
    title: "Concepts",
    description: "Core mental model and runtime loop."
  },
  {
    slug: "react",
    href: "/docs/react",
    title: "React",
    description: "Render steps with SphinxForm and prefetch follow-up steps."
  },
  {
    slug: "engine",
    href: "/docs/engine",
    title: "Engine",
    description: "Server-side generation and provider injection."
  },
  {
    slug: "schemas",
    href: "/docs/schemas",
    title: "Schemas",
    description: "Shared runtime contracts and typing boundaries."
  },
  {
    slug: "examples",
    href: "/docs/examples",
    title: "Examples",
    description: "Minimal patterns and the AI readiness audit demo."
  },
  {
    slug: "deployment",
    href: "/docs/deployment",
    title: "Deployment",
    description: "Vercel-oriented deployment notes and environment setup."
  }
] as const;
