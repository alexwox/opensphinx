import { StepFlowSession } from "./step-flow-session";
import type {
  SphinxQuizFlowCompletion,
  SphinxQuizPrefetchRequest,
  SphinxQuizPrefetchResult,
  SphinxQuizProgress,
  SphinxQuizProps,
  SphinxQuizStepSubmission
} from "./sphinx-quiz-types";
import { getStepQueue, getStepsKey } from "./sphinx-quiz-utils";

export type {
  SphinxQuizFlowCompletion,
  SphinxQuizPrefetchRequest,
  SphinxQuizPrefetchResult,
  SphinxQuizProgress,
  SphinxQuizProps,
  SphinxQuizStepSubmission
};

export function SphinxQuiz(props: SphinxQuizProps) {
  const {
    allowBack = false,
    step,
    steps,
    onAnswer,
    onComplete,
    onRequestPrefetch,
    onStepSubmit,
    onStepsComplete,
    prefetchWhenRemainingSteps = 1,
    isLoading = false,
    progress,
    className
  } = props;

  const stepQueue = getStepQueue(step, steps);

  return (
    <StepFlowSession
      key={getStepsKey(stepQueue)}
      allowBack={allowBack}
      className={className}
      isLoading={isLoading}
      onAnswer={onAnswer}
      onComplete={onComplete}
      onRequestPrefetch={onRequestPrefetch}
      onStepSubmit={onStepSubmit}
      onStepsComplete={onStepsComplete}
      prefetchWhenRemainingSteps={prefetchWhenRemainingSteps}
      progress={progress}
      steps={stepQueue}
    />
  );
}
