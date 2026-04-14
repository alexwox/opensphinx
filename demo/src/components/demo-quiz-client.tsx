"use client";

import { useState } from "react";

import { SphinxQuiz } from "../../../src/react";
import type {
  AnswerValue,
  EngineStepResponse,
  ScoreResult,
  SessionHistoryItem,
  SessionState,
  Step
} from "../../../src/schemas";
import type {
  SphinxQuizPrefetchRequest,
  SphinxQuizPrefetchResult
} from "../../../src/react";
import type { SphinxQuizThemeConfig } from "../../../src/react";

import { demoQuizConfig } from "../lib/quiz-config";

const demoQuizTheme: SphinxQuizThemeConfig = {
  surface: "rgba(11, 16, 32, 0.88)",
  surfaceAlt: "rgba(15, 23, 42, 0.92)",
  border: "rgba(148, 163, 184, 0.18)",
  accent: "#7c9cff",
  accentForeground: "#f8fbff",
  text: "#e5edf8",
  mutedText: "#9db0c9",
  radius: 22
};

type DemoApiResponse = {
  next: EngineStepResponse;
  report?: string;
  error?: string;
};

function buildInitialSession(): SessionState {
  return {
    sessionId: crypto.randomUUID(),
    config: demoQuizConfig,
    history: [],
    pendingQuestions: [],
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
  submission: SphinxQuizPrefetchRequest["submission"]
): SessionHistoryItem[] {
  return submission.step.questions.map((question, index) => ({
    question,
    answer: submission.answers[index] as AnswerValue
  }));
}

export function DemoQuizClient() {
  const [session, setSession] = useState<SessionState>(() => buildInitialSession());
  const [initialSteps, setInitialSteps] = useState<readonly Step[]>([]);
  const [isStarting, setIsStarting] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scores, setScores] = useState<ScoreResult | null>(null);
  const [report, setReport] = useState<string | null>(null);

  const startDemo = async () => {
    setIsStarting(true);
    setError(null);
    setScores(null);
    setReport(null);

    const nextSession = buildInitialSession();

    try {
      const payload = await requestNextStep(nextSession);

      if (payload.next.type === "complete") {
        setScores(payload.next.scores);
        setReport(payload.report ?? null);
        setSession(nextSession);
        setInitialSteps([]);
        setIsReady(true);
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
    request: SphinxQuizPrefetchRequest
  ): Promise<SphinxQuizPrefetchResult> => {
    const nextSession: SessionState = {
      ...session,
      history: [...session.history, ...mergeStepIntoHistory(request.submission)],
      completedSteps: session.completedSteps + 1
    };

    setSession(nextSession);

    const payload = await requestNextStep(nextSession);

    if (payload.next.type === "complete") {
      setScores(payload.next.scores);
      setReport(payload.report ?? null);

      return {
        type: "complete",
        scores: payload.next.scores
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
    setScores(null);
    setReport(null);
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
        <p className="demo-hint">
          Tip: add `OPENAI_API_KEY` to let the demo use a real model. Without it, the
          engine still demonstrates the step flow using its safe fallback behavior.
        </p>
      </section>

      {error && (
        <section className="demo-panel">
          <h2>Error</h2>
          <p>{error}</p>
        </section>
      )}

      {scores && (
        <section className="demo-panel">
          <h2>Scores</h2>
          <pre>{JSON.stringify(scores, null, 2)}</pre>
        </section>
      )}

      {report && (
        <section className="demo-panel">
          <h2>Report</h2>
          <pre>{report}</pre>
        </section>
      )}

      {isReady && initialSteps.length > 0 && !scores && (
        <section className="demo-panel">
          <SphinxQuiz
            onRequestPrefetch={handlePrefetch}
            prefetchWhenRemainingSteps={0}
            steps={initialSteps}
            theme={demoQuizTheme}
          />
        </section>
      )}
    </main>
  );
}
