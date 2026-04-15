import { type CSSProperties, type ReactNode, useId, useMemo, useState } from "react";

import type {
  AnswerValue,
  QuestionSpec,
  ScoreResult,
  Step
} from "../../schemas";

import { LoadingSkeleton } from "./loading-skeleton";
import { ProgressBar } from "./progress-bar";
import {
  QuestionRenderer,
  type QuestionDraftValue
} from "./question-renderer";

export interface SphinxQuizProgress {
  readonly current: number;
  readonly max: number;
}

export interface SphinxQuizThemeConfig {
  readonly surface?: string;
  readonly surfaceAlt?: string;
  readonly border?: string;
  readonly accent?: string;
  readonly accentForeground?: string;
  readonly text?: string;
  readonly mutedText?: string;
  readonly radius?: string | number;
}

export type SphinxQuizTheme = "default" | SphinxQuizThemeConfig;

export interface SphinxQuizStepSubmission {
  readonly step: Step;
  readonly answers: AnswerValue[];
  readonly stepIndex: number;
  readonly totalSteps: number;
  readonly remainingSteps: number;
}

export interface SphinxQuizFlowCompletion {
  readonly submissions: readonly SphinxQuizStepSubmission[];
}

export interface SphinxQuizPrefetchRequest {
  readonly submission: SphinxQuizStepSubmission;
  readonly submissions: readonly SphinxQuizStepSubmission[];
  readonly remainingSteps: number;
}

export type SphinxQuizPrefetchResult =
  | {
      readonly type: "steps";
      readonly steps: readonly Step[];
    }
  | {
      readonly type: "complete";
      readonly scores?: ScoreResult;
    }
  | void;

interface SphinxQuizBaseProps {
  readonly onComplete?: (scores: ScoreResult) => void;
  readonly isLoading?: boolean;
  readonly progress?: SphinxQuizProgress;
  readonly theme?: SphinxQuizTheme;
  readonly className?: string;
}

export interface SphinxQuizSingleQuestionProps extends SphinxQuizBaseProps {
  readonly question: QuestionSpec;
  readonly onAnswer: (answer: AnswerValue) => void;
  readonly step?: never;
  readonly steps?: never;
  readonly onStepSubmit?: never;
  readonly onStepsComplete?: never;
}

export interface SphinxQuizStepFlowProps extends SphinxQuizBaseProps {
  readonly step?: Step;
  readonly steps?: readonly Step[];
  readonly onAnswer?: (answer: AnswerValue) => void;
  readonly onStepSubmit?: (submission: SphinxQuizStepSubmission) => void;
  readonly onStepsComplete?: (completion: SphinxQuizFlowCompletion) => void;
  readonly onRequestPrefetch?:
    | ((
        request: SphinxQuizPrefetchRequest
      ) => Promise<SphinxQuizPrefetchResult> | SphinxQuizPrefetchResult)
    | undefined;
  readonly prefetchWhenRemainingSteps?: number;
  readonly question?: never;
}

/** Step-first quiz UI (default export {@link SphinxQuiz}). */
export type SphinxQuizProps = SphinxQuizStepFlowProps;

function getInitialDraft(question: QuestionSpec): QuestionDraftValue {
  switch (question.type) {
    case "mcq":
      return question.allowMultiple ? [] : "";
    case "free_text":
      return "";
    case "slider":
      return question.min;
    case "rating":
      return undefined;
    case "yes_no":
      return undefined;
    case "number":
      return "";
    case "date":
      return "";
    case "multi_select":
      return [];
    default: {
      const exhaustiveCheck: never = question;
      return exhaustiveCheck;
    }
  }
}

function normalizeAnswer(
  question: QuestionSpec,
  draft: QuestionDraftValue
): AnswerValue | null {
  switch (question.type) {
    case "mcq":
      if (question.allowMultiple) {
        return Array.isArray(draft) && draft.length > 0 ? draft : null;
      }

      return typeof draft === "string" && draft.length > 0 ? draft : null;
    case "free_text": {
      const value = typeof draft === "string" ? draft.trim() : "";
      return value.length > 0 ? value : null;
    }
    case "slider":
      return typeof draft === "number" ? draft : null;
    case "rating":
      return typeof draft === "number" ? draft : null;
    case "yes_no":
      return typeof draft === "boolean" ? draft : null;
    case "number": {
      if (typeof draft !== "string" || draft.trim().length === 0) {
        return null;
      }

      const parsed = Number(draft);

      if (Number.isNaN(parsed)) {
        return null;
      }

      if (question.min !== undefined && parsed < question.min) {
        return null;
      }

      if (question.max !== undefined && parsed > question.max) {
        return null;
      }

      return parsed;
    }
    case "date": {
      if (typeof draft !== "string" || draft.length === 0) {
        return null;
      }

      const parsed = new Date(`${draft}T00:00:00.000Z`);

      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
    case "multi_select":
      return Array.isArray(draft) && draft.length > 0 ? draft : null;
    default: {
      const exhaustiveCheck: never = question;
      return exhaustiveCheck;
    }
  }
}

function joinClassNames(...values: Array<string | undefined>) {
  return values.filter(Boolean).join(" ");
}

function getStepQueue(props: SphinxQuizStepFlowProps) {
  if (props.steps && props.steps.length > 0) {
    return props.steps;
  }

  if (props.step) {
    return [props.step];
  }

  return [];
}

function getQuestionOffset(steps: readonly Step[], stepIndex: number) {
  return steps
    .slice(0, stepIndex)
    .reduce((total, step) => total + step.questions.length, 0);
}

function getAutoProgress(
  steps: readonly Step[],
  currentStepIndex: number,
  currentQuestionIndex: number
): SphinxQuizProgress {
  const max = steps.reduce((total, step) => total + step.questions.length, 0);
  const current =
    getQuestionOffset(steps, currentStepIndex) + currentQuestionIndex + 1;

  return {
    current,
    max
  };
}

function getQuestionKey(question: QuestionSpec) {
  return JSON.stringify(question);
}

function getStepsKey(steps: readonly Step[]) {
  return JSON.stringify(steps);
}

function buildThemeStyles(theme?: SphinxQuizTheme): CSSProperties | undefined {
  if (!theme || theme === "default") {
    return undefined;
  }

  return {
    "--opensphinx-surface": theme.surface,
    "--opensphinx-surface-alt": theme.surfaceAlt,
    "--opensphinx-border": theme.border,
    "--opensphinx-accent": theme.accent,
    "--opensphinx-accent-foreground": theme.accentForeground,
    "--opensphinx-text": theme.text,
    "--opensphinx-muted-text": theme.mutedText,
    "--opensphinx-radius":
      typeof theme.radius === "number" ? `${theme.radius}px` : theme.radius
  } as CSSProperties;
}

function QuizShell({
  children,
  className,
  progress,
  theme
}: {
  readonly children: ReactNode;
  readonly className?: string;
  readonly progress?: SphinxQuizProgress;
  readonly theme?: SphinxQuizTheme;
}) {
  const themeName = typeof theme === "string" ? theme : "custom";
  const themeStyles = buildThemeStyles(theme);

  return (
    <section
      className={joinClassNames("opensphinx-quiz", className)}
      data-theme={themeName}
      style={themeStyles}
    >
      {progress && <ProgressBar current={progress.current} max={progress.max} />}
      <div className="opensphinx-card">{children}</div>
    </section>
  );
}

/** One question at a time (legacy / minimal). Prefer {@link SphinxQuiz} with `steps`. */
export function SphinxQuizSingle({
  question,
  onAnswer,
  onComplete,
  isLoading = false,
  progress,
  theme = "default",
  className
}: SphinxQuizSingleQuestionProps) {
  void onComplete;

  return (
    <QuizShell
      className={className}
      progress={progress}
      theme={theme}
    >
      <header className="opensphinx-card__header">
        <p className="opensphinx-question-type">{question.type}</p>
        <h2 className="opensphinx-question">{question.question}</h2>
      </header>

      {isLoading ? (
        <LoadingSkeleton />
      ) : (
        <SingleQuestionForm
          key={getQuestionKey(question)}
          isLoading={isLoading}
          onAnswer={onAnswer}
          question={question}
        />
      )}
    </QuizShell>
  );
}

function SingleQuestionForm({
  question,
  onAnswer,
  isLoading
}: {
  readonly question: QuestionSpec;
  readonly onAnswer: (answer: AnswerValue) => void;
  readonly isLoading: boolean;
}) {
  const inputName = useId();
  const [draft, setDraft] = useState<QuestionDraftValue>(() =>
    getInitialDraft(question)
  );

  const normalizedAnswer = useMemo(
    () => normalizeAnswer(question, draft),
    [draft, question]
  );

  const isReadyToSubmit = normalizedAnswer !== null && !isLoading;

  return (
    <form
      className="opensphinx-form"
      onSubmit={(event) => {
        event.preventDefault();

        if (normalizedAnswer === null) {
          return;
        }

        onAnswer(normalizedAnswer);
      }}
    >
      <QuestionRenderer
        disabled={isLoading}
        draft={draft}
        inputName={inputName}
        onChange={setDraft}
        question={question}
      />

      <div className="opensphinx-actions">
        <button
          className="opensphinx-submit"
          disabled={!isReadyToSubmit}
          type="submit"
        >
          Continue
        </button>
      </div>
    </form>
  );
}

function StepFlowQuiz({
  onAnswer,
  onComplete,
  onStepSubmit,
  onStepsComplete,
  onRequestPrefetch,
  prefetchWhenRemainingSteps = 1,
  isLoading = false,
  progress,
  theme = "default",
  className,
  ...rest
}: SphinxQuizStepFlowProps) {
  const steps = getStepQueue(rest);

  return (
    <StepFlowSession
      key={getStepsKey(steps)}
      className={className}
      isLoading={isLoading}
      onAnswer={onAnswer}
      onComplete={onComplete}
      onRequestPrefetch={onRequestPrefetch}
      onStepSubmit={onStepSubmit}
      onStepsComplete={onStepsComplete}
      prefetchWhenRemainingSteps={prefetchWhenRemainingSteps}
      progress={progress}
      steps={steps}
      theme={theme}
    />
  );
}

function StepFlowSession({
  steps,
  onAnswer,
  onComplete,
  onRequestPrefetch,
  onStepSubmit,
  onStepsComplete,
  prefetchWhenRemainingSteps,
  isLoading,
  progress,
  theme,
  className
}: {
  readonly steps: readonly Step[];
  readonly onAnswer?: (answer: AnswerValue) => void;
  readonly onComplete?: (scores: ScoreResult) => void;
  readonly onRequestPrefetch?:
    | ((
        request: SphinxQuizPrefetchRequest
      ) => Promise<SphinxQuizPrefetchResult> | SphinxQuizPrefetchResult)
    | undefined;
  readonly onStepSubmit?: (submission: SphinxQuizStepSubmission) => void;
  readonly onStepsComplete?: (completion: SphinxQuizFlowCompletion) => void;
  readonly prefetchWhenRemainingSteps: number;
  readonly isLoading: boolean;
  readonly progress?: SphinxQuizProgress;
  readonly theme: SphinxQuizTheme;
  readonly className?: string;
}) {
  const inputName = useId();
  const [queuedSteps, setQueuedSteps] = useState<readonly Step[]>(steps);
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);
  const [currentAnswers, setCurrentAnswers] = useState<AnswerValue[]>([]);
  const [submissions, setSubmissions] = useState<SphinxQuizStepSubmission[]>([]);
  const [isPrefetching, setIsPrefetching] = useState(false);
  const [isAwaitingReplacementStep, setIsAwaitingReplacementStep] = useState(false);

  const activeStep = queuedSteps[activeStepIndex];
  const activeQuestion = activeStep?.questions[activeQuestionIndex];
  const resolvedProgress =
    progress ??
    (activeQuestion
      ? getAutoProgress(queuedSteps, activeStepIndex, activeQuestionIndex)
      : undefined);
  const allQueuedStepsComplete =
    queuedSteps.length > 0 && activeStepIndex >= queuedSteps.length;

  if (!activeQuestion) {
    return (
      <QuizShell
        className={className}
        progress={resolvedProgress}
        theme={theme}
      >
        {isLoading ? (
          <LoadingSkeleton />
        ) : (
          <div className="opensphinx-card__header">
            <p className="opensphinx-question-type">steps</p>
            <h2 className="opensphinx-question">
              {allQueuedStepsComplete
                ? "All queued steps are complete."
                : "No step is available yet."}
            </h2>
          </div>
        )}
      </QuizShell>
    );
  }

  const isLastQuestionInStep = activeQuestionIndex === activeStep.questions.length - 1;
  const isLastStepInQueue = activeStepIndex === queuedSteps.length - 1;
  const submitLabel = isLastQuestionInStep
    ? isLastStepInQueue
      ? "Submit step"
      : "Next step"
    : "Next question";

  return (
    <QuizShell
      className={className}
      progress={resolvedProgress}
      theme={theme}
    >
      <header className="opensphinx-card__header">
        <p className="opensphinx-question-type">
          Step {Math.min(activeStepIndex + 1, queuedSteps.length)} of {queuedSteps.length}
        </p>
        <h2 className="opensphinx-question">{activeQuestion.question}</h2>
      </header>

      {isLoading ? (
        <LoadingSkeleton />
      ) : (
        <StepQuestionForm
          key={`${activeStepIndex}:${activeQuestionIndex}:${getQuestionKey(activeQuestion)}`}
          inputName={inputName}
          isLoading={isLoading || isAwaitingReplacementStep}
          onSubmitAnswer={(normalizedAnswer) => {
            onAnswer?.(normalizedAnswer);

            if (!isLastQuestionInStep) {
              setCurrentAnswers((previous) => {
                const next = [...previous];
                next[activeQuestionIndex] = normalizedAnswer;
                return next;
              });
              setActiveQuestionIndex((currentIndex) => currentIndex + 1);
              return;
            }

            const answers = [...currentAnswers];
            answers[activeQuestionIndex] = normalizedAnswer;

            const submission: SphinxQuizStepSubmission = {
              step: activeStep,
              answers,
              stepIndex: activeStepIndex,
              totalSteps: queuedSteps.length,
              remainingSteps: Math.max(0, queuedSteps.length - activeStepIndex - 1)
            };

            onStepSubmit?.(submission);

            const nextSubmissions = [...submissions, submission];
            setSubmissions(nextSubmissions);

            const remainingSteps = Math.max(
              0,
              queuedSteps.length - activeStepIndex - 1
            );
            const shouldPrefetch =
              onRequestPrefetch !== undefined &&
              !isPrefetching &&
              remainingSteps <= prefetchWhenRemainingSteps;

            if (shouldPrefetch && onRequestPrefetch) {
              setIsPrefetching(true);
              const nextVisibleStepIndex = queuedSteps.length;

              void Promise.resolve(
                onRequestPrefetch({
                  submission,
                  submissions: nextSubmissions,
                  remainingSteps
                })
              )
                .then((result) => {
                  if (!result) {
                    setIsAwaitingReplacementStep(false);
                    return;
                  }

                  if (result.type === "steps" && result.steps.length > 0) {
                    setQueuedSteps((current) => [...current, ...result.steps]);

                    if (isLastStepInQueue) {
                      setActiveStepIndex(nextVisibleStepIndex);
                      setActiveQuestionIndex(0);
                      setCurrentAnswers([]);
                      setIsAwaitingReplacementStep(false);
                    }

                    return;
                  }

                  if (result.type === "complete") {
                    setIsAwaitingReplacementStep(false);
                    onComplete?.(result.scores ?? { dimensions: [] });
                    onStepsComplete?.({
                      submissions: nextSubmissions
                    });
                  }
                })
                .catch(() => {
                  setIsAwaitingReplacementStep(false);
                })
                .finally(() => {
                  setIsPrefetching(false);
                });
            }

            if (isLastStepInQueue) {
              if (!shouldPrefetch) {
                onStepsComplete?.({
                  submissions: nextSubmissions
                });
                setActiveStepIndex(queuedSteps.length);
                setActiveQuestionIndex(0);
                setCurrentAnswers([]);
                return;
              }

              setIsAwaitingReplacementStep(true);
              return;
            }

            setActiveStepIndex((currentIndex) => currentIndex + 1);
            setActiveQuestionIndex(0);
            setCurrentAnswers([]);
          }}
          question={activeQuestion}
          submitLabel={submitLabel}
        />
      )}
    </QuizShell>
  );
}

function StepQuestionForm({
  question,
  inputName,
  submitLabel,
  isLoading,
  onSubmitAnswer
}: {
  readonly question: QuestionSpec;
  readonly inputName: string;
  readonly submitLabel: string;
  readonly isLoading: boolean;
  readonly onSubmitAnswer: (answer: AnswerValue) => void;
}) {
  const [draft, setDraft] = useState<QuestionDraftValue>(() =>
    getInitialDraft(question)
  );

  const normalizedAnswer = useMemo(
    () => normalizeAnswer(question, draft),
    [draft, question]
  );

  const isReadyToSubmit = normalizedAnswer !== null && !isLoading;

  return (
    <form
      className="opensphinx-form"
      onSubmit={(event) => {
        event.preventDefault();

        if (normalizedAnswer === null) {
          return;
        }

        onSubmitAnswer(normalizedAnswer);
      }}
    >
      <QuestionRenderer
        disabled={isLoading}
        draft={draft}
        inputName={inputName}
        onChange={setDraft}
        question={question}
      />

      <div className="opensphinx-actions">
        <button
          className="opensphinx-submit"
          disabled={!isReadyToSubmit}
          type="submit"
        >
          {submitLabel}
        </button>
      </div>
    </form>
  );
}

export function SphinxQuiz(props: SphinxQuizProps) {
  return <StepFlowQuiz {...props} />;
}
