import type { AnswerValue, ScoreResult, Step } from "../../schemas";

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
  readonly allowBack?: boolean;
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
