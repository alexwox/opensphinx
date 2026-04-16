import type { Metadata } from "next";

import { DemoFormClient } from "../../components/demo-form-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Demo — Runtime Walkthrough",
  description:
    "Step through the OpenSphinx runtime loop live: seed steps, adaptive follow-up, and completion explained as you go."
};

export default function DemoPage() {
  const hasOpenAiKey = Boolean(process.env.OPENAI_API_KEY?.trim());

  return (
    <main className="demo-page site-container">
      <div className="demo-page__intro">
        <span className="eyebrow">Runtime walkthrough</span>
        <h1>See what happens at every step</h1>
        <p>
          Start the form and watch the inspector panel explain each step as it
          arrives. When the seed steps run out, the AI model takes over and
          generates follow-up questions based on your answers.
        </p>
      </div>

      <DemoFormClient
        showOpenAiKeyHint={!hasOpenAiKey}
        hasModelOnServer={hasOpenAiKey}
      />
    </main>
  );
}
