"use client";

import { type ComponentProps, useState } from "react";

import { SphinxQuiz } from "opensphinx/react";
import type {
  AnswerValue,
  EngineStepResponse,
  SessionHistoryItem,
  SessionState,
  Step
} from "opensphinx/schemas";

import { demoQuizConfig } from "../lib/quiz-config";

type QuizProps = ComponentProps<typeof SphinxQuiz>;
type PrefetchHandler = NonNullable<QuizProps["onRequestPrefetch"]>;
type PrefetchRequest = Parameters<PrefetchHandler>[0];
type PrefetchResult = Awaited<ReturnType<PrefetchHandler>>;

type DemoApiResponse = {
  next: EngineStepResponse;
  error?: string;
};

function buildInitialSession(): SessionState {
  return {
    sessionId: crypto.randomUUID(),
    config: demoQuizConfig,
    history: [],
    pendingSteps: [],
    completedSteps: 0
  };
}

async function requestNextStep(session: SessionState) {
  const response = await fetch("/api/quiz", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      session
    })
  });

  const payload = (await response.json()) as DemoApiResponse;

  if (!response.ok || payload.error) {
    throw new Error(payload.error ?? "Quiz request failed.");
  }

  return payload;
}

function mergeStepIntoHistory(
  submission: PrefetchRequest["submission"]
): SessionHistoryItem[] {
  return submission.step.questions.map((question, index) => ({
    question,
    answer: submission.answers[index] as AnswerValue
  }));
}

export function DemoQuizClient({
  showOpenAiKeyHint = true
}: {
  readonly showOpenAiKeyHint?: boolean;
}) {
  const [session, setSession] = useState<SessionState>(() => buildInitialSession());
  const [initialSteps, setInitialSteps] = useState<readonly Step[]>([]);
  const [isStarting, setIsStarting] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startDemo = async () => {
    setIsStarting(true);
    setError(null);
    setIsComplete(false);

    const nextSession = buildInitialSession();

    try {
      const payload = await requestNextStep(nextSession);

      if (payload.next.type === "complete") {
        setSession(nextSession);
        setInitialSteps([]);
        setIsReady(true);
        setIsComplete(true);
        return;
      }

      setSession(nextSession);
      setInitialSteps([payload.next.step]);
      setIsReady(true);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Failed to start the demo."
      );
    } finally {
      setIsStarting(false);
    }
  };

  const handlePrefetch = async (
    request: PrefetchRequest
  ): Promise<PrefetchResult> => {
    const nextSession: SessionState = {
      ...session,
      history: [...session.history, ...mergeStepIntoHistory(request.submission)],
      completedSteps: session.completedSteps + 1
    };

    setSession(nextSession);

    const payload = await requestNextStep(nextSession);

    if (payload.next.type === "complete") {
      setIsComplete(true);

      return {
        type: "complete"
      };
    }

    return {
      type: "steps",
      steps: [payload.next.step]
    };
  };

  const resetDemo = () => {
    setSession(buildInitialSession());
    setInitialSteps([]);
    setIsComplete(false);
    setError(null);
    setIsReady(false);
  };

  return (
    <main className="demo-shell">
      <section className="demo-header">
        <p className="demo-kicker">OpenSphinx Demo</p>
        <h1>AI Readiness Audit</h1>
        <p className="demo-copy">
          This demo shows seed-first steps, adaptive follow-up, and step prefetching
          using the local `opensphinx` package.
        </p>
        <div className="demo-actions">
          <button disabled={isStarting} onClick={startDemo} type="button">
            {isStarting ? "Starting..." : "Start demo"}
          </button>
          <button onClick={resetDemo} type="button">
            Reset
          </button>
        </div>
        {showOpenAiKeyHint && (
          <p className="demo-hint">
            Tip: add `OPENAI_API_KEY` to let the demo use a real model. Without it, the
            engine still demonstrates the step flow using its safe fallback behavior.
          </p>
        )}
      </section>

      {error && (
        <section className="demo-panel">
          <h2>Error</h2>
          <p>{error}</p>
        </section>
      )}

      {isComplete && (
        <section className="demo-panel">
          <h2>Quiz complete</h2>
          <p>The engine returned a `complete` response for this session.</p>
        </section>
      )}

      {isReady && initialSteps.length > 0 && !isComplete && (
        <section className="demo-panel">
          <SphinxQuiz
            onRequestPrefetch={handlePrefetch}
            prefetchWhenRemainingSteps={0}
            steps={initialSteps}
          />
        </section>
      )}
    </main>
  );
}
