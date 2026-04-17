import Link from "next/link";
import type { SessionState } from "opensphinx/schemas";

import { DemoFormClient } from "../components/demo-form-client";
import { FeatureCard, FeatureGrid } from "../components/docs/feature-grid";
import { PackageTabs } from "../components/docs/package-tabs";
import { demoFormConfig } from "../lib/form-config";
import { siteConfig } from "../lib/site-config";

const installSnippet = `pnpm add opensphinx @ai-sdk/openai
pnpm add react react-dom`;

const quickstartSnippet = `import { openai } from "@ai-sdk/openai";
import { createFormEngine } from "opensphinx/engine";
import { SphinxForm } from "opensphinx/react";

const engine = createFormEngine({
  model: openai("gpt-4o-mini"),
  config: formConfig
});`;

export default function HomePage() {
  const hasOpenAiKey = Boolean(process.env.OPENAI_API_KEY?.trim());
  const previewSession: SessionState = {
    sessionId: "landing-page-preview",
    config: demoFormConfig,
    history: [],
    pendingSteps: [],
    completedSteps: 0
  };
  const previewStep = demoFormConfig.seedSteps?.[0];

  return (
    <main>
      <section className="hero">
        <div className="hero__grid site-container">
          <div className="hero__content">
            <span className="eyebrow">Open-source AI form engine</span>
            <h1>AI-driven question flows</h1>
            <p className="hero__lede">
              OpenSphinx gives you typed schemas, a generation engine, and a
              React renderer for forms that adapt step by step.
              <br />
              Make your form flow smarter.
            </p>
            <div className="hero__actions">
              <Link className="button button--primary" href="/demo">
                Try demo
              </Link>
              <Link
                className="button button--secondary"
                href="/docs/quickstart"
              >
                Read quickstart
              </Link>
              <a
                className="button button--ghost"
                href={siteConfig.links.github}
                rel="noreferrer"
                target="_blank"
              >
                View GitHub
              </a>
            </div>
            <div className="hero__meta">
              <span>Typed package surfaces</span>
              <span>Optional model provider</span>
              <span>Safe fallback demo mode</span>
            </div>

            <div aria-hidden="true" className="hero__pointer">
              <svg
                className="hero__pointer-arrow"
                viewBox="0 0 220 120"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M6 108 C 40 96, 70 78, 100 60 S 170 22, 210 14"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  fill="none"
                />
                <path
                  d="M210 14 L 196 10 M 210 14 L 202 26"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
              </svg>
              <span className="hero__pointer-label">try it live</span>
            </div>
          </div>

          <div className="hero__demo">
            <div className="hero__demo-card">
              <div className="hero__demo-header">
                <div>
                  <p className="hero__demo-label">Live preview</p>
                  <h2>Runtime loop in action</h2>
                </div>
                <Link href="/demo">Open full walkthrough</Link>
              </div>
              <DemoFormClient
                hasModelOnServer={hasOpenAiKey}
                initialSession={previewSession}
                initialSteps={previewStep ? [previewStep] : []}
                mode="preview"
                showInspector={false}
                showOpenAiKeyHint={false}
              />
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="site-container">
          <div className="section-heading">
            <span className="eyebrow">How it works</span>
            <h2>One runtime loop, three package surfaces.</h2>
          </div>
          <div className="workflow-grid">
            <article className="workflow-card">
              <span>01</span>
              <h3>Define the form contract</h3>
              <p>
                Write a <code>FormConfig</code> with goals, limits, scoring
                dimensions, and seed steps.
              </p>
            </article>
            <article className="workflow-card">
              <span>02</span>
              <h3>Generate the next step on the server</h3>
              <p>
                Call <code>generateStep(session)</code> with a provider-backed
                model or use fallback mode during local development.
              </p>
            </article>
            <article className="workflow-card">
              <span>03</span>
              <h3>Render and loop</h3>
              <p>
                Pass the returned <code>Step</code> into <code>SphinxForm</code>
                , append answers to session state, and repeat until complete.
              </p>
            </article>
          </div>
        </div>
      </section>

      <section className="section section--split">
        <div className="site-container split-layout">
          <div>
            <div className="section-heading">
              <span className="eyebrow">Quickstart</span>
              <h2>
                Install the package, wire a model, render the returned step.
              </h2>
            </div>
            <div className="code-block">
              <div className="code-block__label">Install</div>
              <pre>
                <code>{installSnippet}</code>
              </pre>
            </div>
            <div className="code-block">
              <div className="code-block__label">Minimal server setup</div>
              <pre>
                <code>{quickstartSnippet}</code>
              </pre>
            </div>
          </div>

          <div>
            <div className="section-heading">
              <span className="eyebrow">Package surfaces</span>
              <h2>Use only the imports you need.</h2>
            </div>
            <PackageTabs
              tabs={[
                {
                  label: "opensphinx/engine",
                  value: "engine",
                  content:
                    "Server-side generation. Build the engine with your model and call generateStep(session).",
                },
                {
                  label: "opensphinx/react",
                  value: "react",
                  content:
                    "Render the current step, collect answers, and prefetch upcoming steps in the background.",
                },
                {
                  label: "opensphinx/schemas",
                  value: "schemas",
                  content:
                    "Shared runtime contracts for FormConfig, SessionState, Step, answers, and scoring metadata.",
                },
              ]}
            />
          </div>
        </div>
      </section>

      <section className="section">
        <div className="site-container">
          <div className="section-heading">
            <span className="eyebrow">Designed for</span>
            <h2>
              Question flows that need structure, not chatbot improvisation.
            </h2>
          </div>
          <FeatureGrid>
            <FeatureCard
              title="Adaptive intakes"
              description="Discovery forms, qualification flows, onboarding questionnaires, and internal diagnostics."
            />
            <FeatureCard
              title="Typed React delivery"
              description="Keep UI and server contracts aligned through explicit schemas rather than ad hoc payloads."
            />
            <FeatureCard
              title="Provider-agnostic engine"
              description="Inject any AI SDK-compatible model and keep your generation logic framework-neutral."
            />
          </FeatureGrid>
        </div>
      </section>
    </main>
  );
}
