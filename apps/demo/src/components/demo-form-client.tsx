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

type FormProps = ComponentProps<typeof SphinxForm>;
type PrefetchHandler = NonNullable<FormProps["onRequestPrefetch"]>;
type PrefetchRequest = Parameters<PrefetchHandler>[0];
type PrefetchResult = Awaited<ReturnType<PrefetchHandler>>;

type StepOrigin = "seed" | "model" | "fallback" | "complete";

type StepEvent = {
  readonly origin: StepOrigin;
  readonly completedSteps: number;
  readonly historyLength: number;
  readonly hasModel: boolean;
  readonly questionCount: number;
  readonly timestamp: number;
};

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

const ORIGIN_LABELS: Record<StepOrigin, string> = {
  seed: "Seed step",
  model: "AI-generated",
  fallback: "Fallback",
  complete: "Complete"
};

const ORIGIN_DESCRIPTIONS: Record<StepOrigin, string> = {
  seed: "Defined in FormConfig.seedSteps - deterministic and repeatable every session.",
  model: "The AI model read your previous answers and generated this follow-up. These questions did not exist until your answers created them.",
  fallback: "No model is configured. The engine produced a safe placeholder step so the loop continues.",
  complete: "The engine has enough signal and returned complete."
};

function StepInspector({
  events,
  hasModelOnServer
}: {
  readonly events: readonly StepEvent[];
  readonly hasModelOnServer: boolean;
}) {
  const hasSeenModel = events.some((e) => e.origin === "model");
  const latest = events.length > 0 ? events[events.length - 1] : null;
  const justTransitionedToModel =
    latest?.origin === "model" &&
    events.filter((e) => e.origin === "model").length === 1;

  if (events.length === 0) {
    return (
      <div className="demo-inspector">
        <div className="demo-inspector__header">
          <h3>What&apos;s happening</h3>
        </div>
        <p className="demo-inspector__empty">
          Press <strong>Start demo</strong> to begin. The first steps come from
          a fixed config (seed steps).{" "}
          {hasModelOnServer
            ? "After that, the AI model generates questions based on your answers."
            : "After that, the engine continues with fallback questions so you can still inspect the runtime loop."}
        </p>

        <div className="demo-inspector__legend">
          <div className="demo-inspector__legend-item">
            <span className="demo-inspector__dot demo-inspector__dot--seed" />
            <span><strong>Seed</strong> - predefined in config</span>
          </div>
          <div className="demo-inspector__legend-item">
            <span className="demo-inspector__dot demo-inspector__dot--model" />
            <span><strong>AI-generated</strong> - created from your answers</span>
          </div>
          <div className="demo-inspector__legend-item">
            <span className="demo-inspector__dot demo-inspector__dot--fallback" />
            <span><strong>Fallback</strong> - no model configured</span>
          </div>
        </div>

        {!hasModelOnServer && (
          <p className="demo-inspector__mode-hint">
            No <code>OPENAI_API_KEY</code> is set. You will see seed steps
            followed by fallback questions. Add a key to see adaptive AI
            follow-up.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="demo-inspector">
      {justTransitionedToModel && (
        <div className="demo-inspector__callout">
          <strong>This is the value add.</strong> The questions you see now were
          not predefined. The AI model read your answers and decided what to ask
          next. This is what OpenSphinx does that a static form cannot.
        </div>
      )}

      <div className="demo-inspector__header">
        <h3>Step {events.length}</h3>
        <span className={`demo-inspector__badge demo-inspector__badge--${latest!.origin}`}>
          {ORIGIN_LABELS[latest!.origin]}
        </span>
      </div>

      <p className="demo-inspector__description">
        {ORIGIN_DESCRIPTIONS[latest!.origin]}
      </p>

      <div className="demo-inspector__snapshot">
        <div className="demo-inspector__row">
          <span>Completed steps</span>
          <code>{latest!.completedSteps}</code>
        </div>
        <div className="demo-inspector__row">
          <span>Questions answered</span>
          <code>{latest!.historyLength}</code>
        </div>
        <div className="demo-inspector__row">
          <span>Questions in this step</span>
          <code>{latest!.questionCount}</code>
        </div>
        <div className="demo-inspector__row">
          <span>Engine mode</span>
          <code>{latest!.hasModel ? "model" : "fallback-only"}</code>
        </div>
      </div>

      {hasSeenModel && !justTransitionedToModel && latest!.origin === "model" && (
        <p className="demo-inspector__ai-note">
          Still AI-generated. The model continues adapting based on everything
          you have answered so far.
        </p>
      )}

      {events.length > 1 && (
        <div className="demo-inspector__timeline-section">
          <h4>Step timeline</h4>
          <ol className="demo-inspector__timeline">
            {events.map((event, index) => (
              <li key={event.timestamp}>
                <span className={`demo-inspector__dot demo-inspector__dot--${event.origin}`} />
                <span>
                  Step {index + 1}: {ORIGIN_LABELS[event.origin]}
                  {event.origin !== "complete" &&
                    ` - ${event.questionCount} question${event.questionCount === 1 ? "" : "s"}`}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
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
  initialEvents
}: {
  readonly showOpenAiKeyHint?: boolean;
  readonly hasModelOnServer?: boolean;
  readonly mode?: "full" | "preview";
  readonly autoStart?: boolean;
  readonly showInspector?: boolean;
  readonly initialSession?: SessionState;
  readonly initialSteps?: readonly Step[];
  readonly initialEvents?: readonly StepEvent[];
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

    setStepEvents((prev) => [
      ...prev,
      {
        origin: payload.meta!.origin,
        completedSteps: payload.meta!.completedSteps,
        historyLength: payload.meta!.historyLength,
        hasModel: payload.meta!.hasModel,
        questionCount,
        timestamp: Date.now()
      }
    ]);
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
