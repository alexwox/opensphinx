import { type ReactNode, useId, useState } from "react";

import type { AnswerValue, ScoreResult, Step } from "../../schemas";

import { LoadingSkeleton } from "./loading-skeleton";
import { ProgressBar } from "./progress-bar";
import type { QuestionDraftValue } from "./question-renderer";
import { StepQuestionsForm } from "./step-questions-form";
import type {
  SphinxQuizFlowCompletion,
  SphinxQuizPrefetchRequest,
  SphinxQuizPrefetchResult,
  SphinxQuizProgress,
  SphinxQuizStepSubmission
} from "./sphinx-quiz-types";
import {
  cloneDrafts,
  getStepHeading,
  getStepKey,
  joinClassNames
} from "./sphinx-quiz-utils";

export interface StepFlowSessionProps {
  readonly steps: readonly Step[];
  readonly allowBack: boolean;
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

export function StepFlowSession({
  steps,
  allowBack,
  onAnswer,
  onComplete,
  onRequestPrefetch,
  onStepSubmit,
  onStepsComplete,
  prefetchWhenRemainingSteps,
  isLoading,
  progress,
  className
}: StepFlowSessionProps) {
  const inputName = useId();
  const [queuedSteps, setQueuedSteps] = useState<readonly Step[]>(steps);
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [submissions, setSubmissions] = useState<SphinxQuizStepSubmission[]>([]);
  const [draftCache, setDraftCache] = useState<Map<number, QuestionDraftValue[]>>(
    () => new Map()
  );
  const [isPrefetching, setIsPrefetching] = useState(false);
  const [isAwaitingReplacementStep, setIsAwaitingReplacementStep] = useState(false);

  const activeStep = queuedSteps[activeStepIndex];
  const allQueuedStepsComplete =
    queuedSteps.length > 0 && activeStepIndex >= queuedSteps.length;

  function cacheDrafts(stepIndex: number, drafts: readonly QuestionDraftValue[]) {
    setDraftCache((current) => {
      const next = new Map(current);
      next.set(stepIndex, cloneDrafts(drafts));
      return next;
    });
  }

  if (!activeStep) {
    return (
      <QuizShell
        className={className}
        progress={progress}
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
  const submitLabel = "Next";

  return (
    <QuizShell
      className={className}
      progress={progress}
    >
      <header className="opensphinx-card__header">
        <p className="opensphinx-question-type">Step {activeStepIndex + 1}</p>
        <h2 className="opensphinx-question">{getStepHeading(activeStep)}</h2>
      </header>

      {isLoading ? (
        <LoadingSkeleton />
      ) : (
        <StepQuestionsForm
          key={`${activeStepIndex}:${getStepKey(activeStep)}`}
          canGoBack={allowBack && activeStepIndex > 0}
          initialDrafts={draftCache.get(activeStepIndex)}
          inputName={inputName}
          isLoading={isLoading || isAwaitingReplacementStep}
          onBack={(drafts) => {
            cacheDrafts(activeStepIndex, drafts);
            setActiveStepIndex((currentIndex) => currentIndex - 1);
          }}
          onSubmitStep={({ answers, drafts }) => {
            cacheDrafts(activeStepIndex, drafts);

            const submission: SphinxQuizStepSubmission = {
              step: activeStep,
              answers,
              stepIndex: activeStepIndex,
              totalSteps: queuedSteps.length,
              remainingSteps: Math.max(0, queuedSteps.length - activeStepIndex - 1)
            };

            const isPreviouslySubmittedStep = activeStepIndex < submissions.length;
            const isBeforeSubmittedFrontier =
              activeStepIndex < submissions.length - 1;
            const nextSubmissions = isPreviouslySubmittedStep
              ? submissions.map((currentSubmission, submissionIndex) =>
                  submissionIndex === activeStepIndex
                    ? submission
                    : currentSubmission
                )
              : [...submissions, submission];

            setSubmissions(nextSubmissions);

            if (isBeforeSubmittedFrontier) {
              setActiveStepIndex((currentIndex) => currentIndex + 1);
              return;
            }

            answers.forEach((answer) => {
              onAnswer?.(answer);
            });
            onStepSubmit?.(submission);

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
