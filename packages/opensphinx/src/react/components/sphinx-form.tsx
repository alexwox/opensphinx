import { StepFlowSession } from "./step-flow-session";
import type {
  SphinxFormFlowCompletion,
  SphinxFormPrefetchRequest,
  SphinxFormPrefetchResult,
  SphinxFormProgress,
  SphinxFormProps,
  SphinxFormStepSubmission
} from "./sphinx-form-types";
import { getStepQueue, getStepsKey } from "./sphinx-form-utils";

export type {
  SphinxFormFlowCompletion,
  SphinxFormPrefetchRequest,
  SphinxFormPrefetchResult,
  SphinxFormProgress,
  SphinxFormProps,
  SphinxFormStepSubmission
};

export function SphinxForm(props: SphinxFormProps) {
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
