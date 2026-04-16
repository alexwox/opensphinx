import { type ReactNode, useId, useMemo, useState } from "react";

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
  readonly className?: string;
}

/** Step-first quiz: pass `steps` and/or `step` (source of truth for what to render). */
export interface SphinxQuizProps extends SphinxQuizBaseProps {
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
}

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

function getStepQueue(props: SphinxQuizProps) {
  if (props.steps && props.steps.length > 0) {
    return props.steps;
  }

  if (props.step) {
    return [props.step];
  }

  return [];
}

function getAutoProgress(
  steps: readonly Step[],
  currentStepIndex: number
): SphinxQuizProgress {
  return {
    current: Math.min(currentStepIndex + 1, steps.length),
    max: steps.length
  };
}

function getQuestionKey(question: QuestionSpec) {
  return JSON.stringify(question);
}

function getStepKey(step: Step) {
  return JSON.stringify(step);
}

function getStepsKey(steps: readonly Step[]) {
  return JSON.stringify(steps);
}

function getStepHeading(step: Step) {
  if (step.questions.length === 1) {
    return step.questions[0]?.question ?? "Answer the question below.";
  }

  return "Answer the questions below.";
}

function isAnswerValue(answer: AnswerValue | null): answer is AnswerValue {
  return answer !== null;
}

function QuizShell({
  children,
  className,
  progress
}: {
  readonly children: ReactNode;
  readonly className?: string;
  readonly progress?: SphinxQuizProgress;
}) {
  return (
    <section className={joinClassNames("opensphinx-quiz", className)}>
      {progress && <ProgressBar current={progress.current} max={progress.max} />}
      <div className="opensphinx-card">{children}</div>
    </section>
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
  className,
  ...rest
}: SphinxQuizProps) {
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
  readonly className?: string;
}) {
  const inputName = useId();
  const [queuedSteps, setQueuedSteps] = useState<readonly Step[]>(steps);
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [submissions, setSubmissions] = useState<SphinxQuizStepSubmission[]>([]);
  const [isPrefetching, setIsPrefetching] = useState(false);
  const [isAwaitingReplacementStep, setIsAwaitingReplacementStep] = useState(false);

  const activeStep = queuedSteps[activeStepIndex];
  const resolvedProgress =
    progress ??
    (activeStep ? getAutoProgress(queuedSteps, activeStepIndex) : undefined);
  const allQueuedStepsComplete =
    queuedSteps.length > 0 && activeStepIndex >= queuedSteps.length;

  if (!activeStep) {
    return (
      <QuizShell
        className={className}
        progress={resolvedProgress}
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

  const isLastStepInQueue = activeStepIndex === queuedSteps.length - 1;
  const submitLabel = isLastStepInQueue ? "Submit step" : "Next step";

  return (
    <QuizShell
      className={className}
      progress={resolvedProgress}
    >
      <header className="opensphinx-card__header">
        <p className="opensphinx-question-type">
          Step {Math.min(activeStepIndex + 1, queuedSteps.length)} of {queuedSteps.length}
        </p>
        <h2 className="opensphinx-question">{getStepHeading(activeStep)}</h2>
      </header>

      {isLoading ? (
        <LoadingSkeleton />
      ) : (
        <StepQuestionsForm
          key={`${activeStepIndex}:${getStepKey(activeStep)}`}
          inputName={inputName}
          isLoading={isLoading || isAwaitingReplacementStep}
          onSubmitStep={(answers) => {
            const submission: SphinxQuizStepSubmission = {
              step: activeStep,
              answers,
              stepIndex: activeStepIndex,
              totalSteps: queuedSteps.length,
              remainingSteps: Math.max(0, queuedSteps.length - activeStepIndex - 1)
            };

            answers.forEach((answer) => {
              onAnswer?.(answer);
            });
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
                return;
              }

              setIsAwaitingReplacementStep(true);
              return;
            }

            setActiveStepIndex((currentIndex) => currentIndex + 1);
          }}
          showQuestionHeadings={activeStep.questions.length > 1}
          step={activeStep}
          submitLabel={submitLabel}
        />
      )}
    </QuizShell>
  );
}

function StepQuestionsForm({
  step,
  inputName,
  submitLabel,
  isLoading,
  showQuestionHeadings,
  onSubmitStep
}: {
  readonly step: Step;
  readonly inputName: string;
  readonly submitLabel: string;
  readonly isLoading: boolean;
  readonly showQuestionHeadings: boolean;
  readonly onSubmitStep: (answers: AnswerValue[]) => void;
}) {
  const [drafts, setDrafts] = useState<QuestionDraftValue[]>(() =>
    step.questions.map((question) => getInitialDraft(question))
  );

  const normalizedAnswers = useMemo(
    () =>
      step.questions.map((question, questionIndex) =>
        normalizeAnswer(question, drafts[questionIndex])
      ),
    [drafts, step]
  );

  const isReadyToSubmit = normalizedAnswers.every(isAnswerValue) && !isLoading;

  return (
    <form
      className="opensphinx-form"
      onSubmit={(event) => {
        event.preventDefault();

        if (!normalizedAnswers.every(isAnswerValue)) {
          return;
        }

        onSubmitStep(normalizedAnswers);
      }}
    >
      <div className="opensphinx-step-questions">
        {step.questions.map((question, questionIndex) => (
          <section
            className="opensphinx-step-question"
            key={`${questionIndex}:${getQuestionKey(question)}`}
          >
            {showQuestionHeadings && (
              <div className="opensphinx-step-question__header">
                <p className="opensphinx-question-type">Question {questionIndex + 1}</p>
                <h3 className="opensphinx-step-question__title">{question.question}</h3>
              </div>
            )}
            <QuestionRenderer
              disabled={isLoading}
              draft={drafts[questionIndex]}
              inputName={`${inputName}:${questionIndex}`}
              onChange={(nextDraft) => {
                setDrafts((current) => {
                  const next = [...current];
                  next[questionIndex] = nextDraft;
                  return next;
                });
              }}
              question={question}
            />
          </section>
        ))}
      </div>

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
