"use client";

export type StepOrigin = "seed" | "model" | "fallback" | "complete";

export type StepEvent = {
  readonly origin: StepOrigin;
  readonly completedSteps: number;
  readonly historyLength: number;
  readonly hasModel: boolean;
  readonly questionCount: number;
  readonly timestamp: number;
};

export const ORIGIN_LABELS: Record<StepOrigin, string> = {
  seed: "Seed step",
  model: "AI-generated",
  fallback: "Fallback",
  complete: "Complete"
};

export const ORIGIN_DESCRIPTIONS: Record<StepOrigin, string> = {
  seed: "Defined in FormConfig.seedSteps - deterministic and repeatable every session.",
  model:
    "The AI model read your previous answers and generated this follow-up. These questions did not exist until your answers created them.",
  fallback:
    "No model is configured. The engine produced a safe placeholder step so the loop continues.",
  complete: "The engine has enough signal and returned complete."
};

export function StepInspector({
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
            <span>
              <strong>Seed</strong> - predefined in config
            </span>
          </div>
          <div className="demo-inspector__legend-item">
            <span className="demo-inspector__dot demo-inspector__dot--model" />
            <span>
              <strong>AI-generated</strong> - created from your answers
            </span>
          </div>
          <div className="demo-inspector__legend-item">
            <span className="demo-inspector__dot demo-inspector__dot--fallback" />
            <span>
              <strong>Fallback</strong> - no model configured
            </span>
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
        <span
          className={`demo-inspector__badge demo-inspector__badge--${latest!.origin}`}
        >
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

      {hasSeenModel &&
        !justTransitionedToModel &&
        latest!.origin === "model" && (
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
                <span
                  className={`demo-inspector__dot demo-inspector__dot--${event.origin}`}
                />
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
