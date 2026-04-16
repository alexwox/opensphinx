import type { AnswerValue, ScoreResult, Step } from "../../schemas";

export interface SphinxFormProgress {
  readonly current: number;
  readonly max: number;
}

export interface SphinxFormStepSubmission {
  readonly step: Step;
  readonly answers: AnswerValue[];
  readonly stepIndex: number;
  readonly totalSteps: number;
  readonly remainingSteps: number;
}

export interface SphinxFormFlowCompletion {
  readonly submissions: readonly SphinxFormStepSubmission[];
}

export interface SphinxFormPrefetchRequest {
  readonly submission: SphinxFormStepSubmission;
  readonly submissions: readonly SphinxFormStepSubmission[];
  readonly remainingSteps: number;
}

export type SphinxFormPrefetchResult =
  | {
      readonly type: "steps";
      readonly steps: readonly Step[];
    }
  | {
      readonly type: "complete";
      readonly scores?: ScoreResult;
    }
  | void;

interface SphinxFormBaseProps {
  readonly onComplete?: (scores: ScoreResult) => void;
  readonly isLoading?: boolean;
  readonly progress?: SphinxFormProgress;
  readonly className?: string;
}

/** Step-first form: pass `steps` and/or `step` (source of truth for what to render). */
export interface SphinxFormProps extends SphinxFormBaseProps {
  readonly step?: Step;
  readonly steps?: readonly Step[];
  readonly allowBack?: boolean;
  readonly onAnswer?: (answer: AnswerValue) => void;
  readonly onStepSubmit?: (submission: SphinxFormStepSubmission) => void;
  readonly onStepsComplete?: (completion: SphinxFormFlowCompletion) => void;
  readonly onRequestPrefetch?:
    | ((
        request: SphinxFormPrefetchRequest
      ) => Promise<SphinxFormPrefetchResult> | SphinxFormPrefetchResult)
    | undefined;
  readonly prefetchWhenRemainingSteps?: number;
}
