import type { Metadata } from "next";

import { DemoFormClient } from "../../components/demo-form-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Demo",
  description:
    "Run the OpenSphinx demo form and inspect the live adaptive question flow."
};

export default function DemoPage() {
  const hasOpenAiKey = Boolean(process.env.OPENAI_API_KEY?.trim());

  return (
    <main className="demo-page site-container">
      <div className="demo-page__intro">
        <span className="eyebrow">Reference implementation</span>
        <h1>Live demo route</h1>
        <p>
          This route runs the same OpenSphinx package flow you would wire into your
          own app: config on the server, generated step responses, and React-driven
          rendering on the client.
        </p>
      </div>

      <div className="demo-page__grid">
        <div className="demo-page__frame">
          <DemoFormClient showOpenAiKeyHint={!hasOpenAiKey} />
        </div>

        <div className="demo-page__side">
          <section className="demo-sidecard docs-card">
            <h2>What this shows</h2>
            <ul>
              <li>Seed steps from a fixed form config</li>
              <li>Adaptive follow-up generated from session history</li>
              <li>Completion when the engine has enough signal</li>
            </ul>
          </section>

          <section className="demo-sidecard docs-card">
            <h2>Fallback mode</h2>
            <p>
              If <code>OPENAI_API_KEY</code> is not set, the route still demonstrates
              the runtime loop using OpenSphinx&apos;s safe fallback behavior.
            </p>
          </section>

          <section className="demo-sidecard docs-card">
            <h2>Production note</h2>
            <p>
              Session state should remain authoritative on the server in a production
              app. This route is intentionally a compact reference implementation.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
