"use client";

import { type ComponentProps, useEffect, useRef, useState } from "react";

import { SphinxForm } from "opensphinx/react";
import type {
  AnswerValue,
  EngineStepResponse,
  SessionHistoryItem,
  SessionState,
  Step
} from "opensphinx/schemas";

import { demoFormConfig } from "../lib/form-config";
import { OpenSphinxMark } from "./site/opensphinx-mark";
import { StepInspector, type StepEvent, type StepOrigin } from "./step-inspector";

type FormProps = ComponentProps<typeof SphinxForm>;
type PrefetchHandler = NonNullable<FormProps["onRequestPrefetch"]>;
type PrefetchRequest = Parameters<PrefetchHandler>[0];
type PrefetchResult = Awaited<ReturnType<PrefetchHandler>>;

type DemoApiResponse = {
  next: EngineStepResponse;
  meta?: {
    origin: StepOrigin;
    completedSteps: number;
    historyLength: number;
    hasModel: boolean;
  };
  error?: string;
};

function buildInitialSession(): SessionState {
  return {
    sessionId: crypto.randomUUID(),
    config: demoFormConfig,
    history: [],
    pendingSteps: [],
    completedSteps: 0
  };
}

async function requestNextStep(session: SessionState) {
  const response = await fetch("/api/form", {
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
    throw new Error(payload.error ?? "Form request failed.");
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
      <OpenSphinxMark className="demo-wordmark__mark" size={18} />
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

export function DemoFormClient({
  showOpenAiKeyHint = true,
  hasModelOnServer = false,
  mode = "full",
  autoStart = false,
  showInspector = mode === "full",
  initialSession,
  initialSteps,
  initialEvents,
  onStepEvent
}: {
  readonly showOpenAiKeyHint?: boolean;
  readonly hasModelOnServer?: boolean;
  readonly mode?: "full" | "preview";
  readonly autoStart?: boolean;
  readonly showInspector?: boolean;
  readonly initialSession?: SessionState;
  readonly initialSteps?: readonly Step[];
  readonly initialEvents?: readonly StepEvent[];
  readonly onStepEvent?: (event: StepEvent) => void;
}) {
  const [session, setSession] = useState<SessionState>(
    () => initialSession ?? buildInitialSession()
  );
  const [initialRenderedSteps, setInitialRenderedSteps] = useState<readonly Step[]>(
    () => initialSteps ?? []
  );
  const [isStarting, setIsStarting] = useState(false);
  const [isReady, setIsReady] = useState(() => (initialSteps?.length ?? 0) > 0);
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stepEvents, setStepEvents] = useState<StepEvent[]>(() => [...(initialEvents ?? [])]);
  const hasAutoStarted = useRef(false);
  const isAutoStartPreview = mode === "preview" && autoStart;
  const isSeededPreview = mode === "preview" && (initialSteps?.length ?? 0) > 0;

  const recordEvent = (payload: DemoApiResponse) => {
    if (!payload.meta) return;

    const questionCount =
      payload.next.type === "step" ? payload.next.step.questions.length : 0;

    const event: StepEvent = {
      origin: payload.meta.origin,
      completedSteps: payload.meta.completedSteps,
      historyLength: payload.meta.historyLength,
      hasModel: payload.meta.hasModel,
      questionCount,
      timestamp: Date.now()
    };

    setStepEvents((prev) => [...prev, event]);
    onStepEvent?.(event);
  };

  const startDemo = async () => {
    setIsStarting(true);
    setError(null);
    setIsComplete(false);
    setStepEvents([]);

    const nextSession = buildInitialSession();

    try {
      const payload = await requestNextStep(nextSession);
      recordEvent(payload);

      if (payload.next.type === "complete") {
        setSession(nextSession);
        setInitialRenderedSteps([]);
        setIsReady(true);
        setIsComplete(true);
        return;
      }

      setSession(nextSession);
      setInitialRenderedSteps([payload.next.step]);
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
    recordEvent(payload);

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
    setInitialRenderedSteps([]);
    setIsComplete(false);
    setError(null);
    setIsReady(false);
    setStepEvents([]);
  };

  useEffect(() => {
    if (!autoStart || hasAutoStarted.current) {
      return;
    }

    hasAutoStarted.current = true;
    void startDemo();
  }, [autoStart]);

  const formContent = (
    <div className="demo-shell__form">
      <header className="demo-header">
        <SphinxWordmark />
        <h1>{mode === "preview" ? "Product Discovery" : "Runtime Walkthrough"}</h1>
        <p className="demo-copy">
          {mode === "preview"
            ? isAutoStartPreview || isSeededPreview
              ? "This preview starts on the first step so you can inspect the runtime loop immediately."
              : hasModelOnServer
                ? "Start the demo to see seed steps, adaptive follow-up, and the engine loop in action."
                : "Start the demo to see seed steps, fallback follow-up, and the engine loop in action."
            : "Answer the form and watch the inspector explain each step as it arrives."}
        </p>
        {!isAutoStartPreview && !isSeededPreview && (
          <div className="demo-actions">
            <button disabled={isStarting} onClick={startDemo} type="button">
              {isStarting ? "Starting..." : "Start demo"}
            </button>
            <button onClick={resetDemo} type="button">
              Reset
            </button>
          </div>
        )}
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
            <h2>Form Complete</h2>
            <p>
              The engine returned a <code>complete</code> response for this
              session after {stepEvents.length} step
              {stepEvents.length === 1 ? "" : "s"}.
            </p>
          </section>
        )}

        {isReady && initialRenderedSteps.length > 0 && !isComplete && (
          <section className="demo-panel">
            <SphinxForm
              allowBack
              onRequestPrefetch={handlePrefetch}
              prefetchWhenRemainingSteps={0}
              steps={initialRenderedSteps}
            />
          </section>
        )}
      </div>
    </div>
  );

  if (mode === "preview") {
    return (
      <div
        className={`demo-shell demo-shell--preview${showInspector ? " demo-shell--preview-with-inspector" : ""}`}
      >
        {formContent}
        {showInspector && (
          <div className="demo-shell__aside">
            <StepInspector
              events={stepEvents}
              hasModelOnServer={hasModelOnServer}
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="demo-shell demo-shell--full">
      {formContent}
      {showInspector && (
        <div className="demo-shell__aside">
          <StepInspector events={stepEvents} hasModelOnServer={hasModelOnServer} />
        </div>
      )}
    </div>
  );
}
