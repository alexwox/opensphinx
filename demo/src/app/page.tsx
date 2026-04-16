import Link from "next/link";

import { DemoQuizClient } from "../components/demo-quiz-client";
import { FeatureCard, FeatureGrid } from "../components/docs/feature-grid";
import { PackageTabs } from "../components/docs/package-tabs";
import { siteConfig } from "../lib/site-config";

const installSnippet = `pnpm add opensphinx @ai-sdk/openai
pnpm add react react-dom`;

const quickstartSnippet = `import { openai } from "@ai-sdk/openai";
import { createQuizEngine } from "opensphinx/engine";
import { SphinxQuiz } from "opensphinx/react";

const engine = createQuizEngine({
  model: openai("gpt-4o-mini"),
  config: quizConfig
});`;

export default function HomePage() {
  return (
    <main>
      <section className="hero">
        <div className="hero__grid site-container">
          <div className="hero__content">
            <span className="eyebrow">Open-source AI quiz engine</span>
            <h1>
              Adaptive, server-driven question flows without building the engine
              yourself.
            </h1>
            <p className="hero__lede">
              OpenSphinx gives you typed schemas, a generation engine, and a React
              renderer for quizzes that adapt step by step. It is built for
              developers who want a working package, not a vague AI demo.
            </p>
            <div className="hero__actions">
              <Link className="button button--primary" href="/demo">
                Try demo
              </Link>
              <Link className="button button--secondary" href="/docs/quickstart">
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
          </div>

          <div className="hero__demo">
            <div className="hero__demo-card">
              <div className="hero__demo-header">
                <div>
                  <p className="hero__demo-label">Live preview</p>
                  <h2>AI Readiness Audit</h2>
                </div>
                <Link href="/demo">Open full demo</Link>
              </div>
              <DemoQuizClient mode="preview" showOpenAiKeyHint={false} />
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
              <h3>Define the quiz contract</h3>
              <p>
                Write a <code>QuizConfig</code> with goals, limits, scoring
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
                Pass the returned <code>Step</code> into <code>SphinxQuiz</code>,
                append answers to session state, and repeat until complete.
              </p>
            </article>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="site-container example-demo">
          <div className="example-demo__content">
            <div className="section-heading">
              <span className="eyebrow">Example demo</span>
              <h2>The reference app is embedded on the landing page too.</h2>
            </div>
            <p className="example-demo__lede">
              This is the same AI readiness audit example that powers the dedicated
              demo route. It shows seeded opening steps, adaptive follow-up, and the
              server-driven step loop in a package-shaped Next.js app.
            </p>
            <div className="example-demo__notes">
              <p>
                Use it as the quickest way to understand the product surface and the
                runtime feel before reading the docs.
              </p>
              <div className="example-demo__actions">
                <Link className="button button--primary" href="/demo">
                  Open full demo route
                </Link>
                <Link className="button button--secondary" href="/docs/examples">
                  Read examples
                </Link>
              </div>
            </div>
          </div>

          <div className="example-demo__panel">
            <div className="hero__demo-card">
              <div className="hero__demo-header">
                <div>
                  <p className="hero__demo-label">Embedded example</p>
                  <h2>AI Readiness Audit</h2>
                </div>
                <Link href="/demo">Open full demo</Link>
              </div>
              <DemoQuizClient mode="preview" showOpenAiKeyHint={false} />
            </div>
          </div>
        </div>
      </section>

      <section className="section section--split">
        <div className="site-container split-layout">
          <div>
            <div className="section-heading">
              <span className="eyebrow">Quickstart</span>
              <h2>Install the package, wire a model, render the returned step.</h2>
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
                    "Server-side generation. Build the engine with your model and call generateStep(session)."
                },
                {
                  label: "opensphinx/react",
                  value: "react",
                  content:
                    "Render the current step, collect answers, and prefetch upcoming steps in the background."
                },
                {
                  label: "opensphinx/schemas",
                  value: "schemas",
                  content:
                    "Shared runtime contracts for QuizConfig, SessionState, Step, answers, and scoring metadata."
                }
              ]}
            />
          </div>
        </div>
      </section>

      <section className="section">
        <div className="site-container">
          <div className="section-heading">
            <span className="eyebrow">Designed for</span>
            <h2>Question flows that need structure, not chatbot improvisation.</h2>
          </div>
          <FeatureGrid>
            <FeatureCard
              title="Adaptive audits"
              description="Readiness checks, discovery interviews, qualification flows, and internal diagnostics."
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
