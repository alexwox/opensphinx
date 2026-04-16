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

function mergeSubmissionsIntoHistory(
  submissions: readonly PrefetchRequest["submission"][]
): SessionHistoryItem[] {
  return submissions.flatMap((submission) =>
    submission.step.questions.map((question, index) => ({
      question,
      answer: submission.answers[index] as AnswerValue
    }))
  );
}

function buildSessionFromSubmissions(
  currentSession: SessionState,
  submissions: readonly PrefetchRequest["submission"][]
): SessionState {
  return {
    ...currentSession,
    history: mergeSubmissionsIntoHistory(submissions),
    completedSteps: submissions.length
  };
}

function SphinxWordmark() {
  return (
    <div className="demo-wordmark">
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path
          d="M12 2L4 7v10l8 5 8-5V7l-8-5z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <path
          d="M12 12l8-5M12 12v10M12 12L4 7"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>
      OpenSphinx
    </div>
  );
}

function CheckIcon() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M5 13l4 4L19 7"
        stroke="#22c55e"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
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
    const nextSession = buildSessionFromSubmissions(session, request.submissions);

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
      <header className="demo-header">
        <SphinxWordmark />
        <h1>AI Readiness Audit</h1>
        <p className="demo-copy">
          Adaptive questions, intelligent follow-up, real-time step
          prefetching — powered by the OpenSphinx engine.
        </p>
        <div className="demo-actions">
          <button disabled={isStarting} onClick={startDemo} type="button">
            {isStarting ? "Starting\u2026" : "Start demo"}
          </button>
          <button onClick={resetDemo} type="button">
            Reset
          </button>
        </div>
        {showOpenAiKeyHint && (
          <p className="demo-hint">
            Add <code>OPENAI_API_KEY</code> to use a real model. Without it the
            engine demonstrates the step flow using its safe fallback.
          </p>
        )}
      </header>

      <div aria-live="polite">
        {error && (
          <section className="demo-panel demo-panel--error">
            <h2>Something went wrong</h2>
            <p>{error}</p>
          </section>
        )}

        {isComplete && (
          <section className="demo-panel demo-panel--complete">
            <div className="demo-complete-icon">
              <CheckIcon />
            </div>
            <h2>Quiz Complete</h2>
            <p>
              The engine returned a complete response for this session.
            </p>
          </section>
        )}

        {isReady && initialSteps.length > 0 && !isComplete && (
          <section className="demo-panel">
            <SphinxQuiz
              allowBack
              onRequestPrefetch={handlePrefetch}
              prefetchWhenRemainingSteps={0}
              steps={initialSteps}
            />
          </section>
        )}
      </div>
    </main>
  );
}
