import {
  EngineBatchResponse,
  EngineResponse,
  EngineStepResponse,
  QuizConfig,
  ScoreResult,
  SessionState,
  Step
} from "../schemas";
import type { input, output } from "zod";

import { generateScoreReport } from "./report";
import { scoreSession } from "./scoring";
import {
  generateStepWithRetry,
  type QuizModel
} from "./model-step";
import {
  buildFallbackStep,
  canComplete,
  getSeedStep,
  reachedHardLimit,
  sanitizeGeneratedStep,
  trimStepToRemainingQuestionBudget
} from "./step-helpers";

export type QuizConfigInput = input<typeof QuizConfig>;
export type SessionStateInput = input<typeof SessionState>;
export type ScoreResultInput = input<typeof ScoreResult>;
export type { QuizModel };

export interface EngineLogEvent {
  readonly type:
    | "pending-step-used"
    | "hard-limit-complete"
    | "seed-step-used"
    | "model-generation-started"
    | "model-generation-succeeded"
    | "model-generation-attempt-failed"
    | "model-generation-fallback"
    | "model-complete-accepted"
    | "model-complete-ignored"
    | "model-duplicates-filtered"
    | "model-output-fully-duplicated"
    | "completion-after-duplicate-filter"
    | "completion-after-generation-failure"
    | "minimums-complete-without-model"
    | "fallback-step-used";
  readonly message: string;
  readonly sessionId: string;
  readonly historyCount: number;
  readonly completedSteps: number;
  readonly questionCount?: number;
  readonly duplicateCount?: number;
  readonly error?: string;
}

export type EngineLogger = (event: EngineLogEvent) => void;

export interface CreateQuizEngineOptions {
  readonly model?: QuizModel;
  readonly config: QuizConfigInput;
  readonly logger?: EngineLogger;
}

export interface QuizEngine {
  readonly config: output<typeof QuizConfig>;
  /** Primary API: next {@link Step} or completion. */
  generateStep(
    sessionState: SessionStateInput
  ): Promise<output<typeof EngineStepResponse>>;
  /** Adapter: same as {@link generateStep} but expands a step to a flat question list. */
  generateBatch(
    sessionState: SessionStateInput
  ): Promise<output<typeof EngineBatchResponse>>;
  /** Adapter: returns only the first question of the next step (legacy one-question UI). */
  generateNext(sessionState: SessionStateInput): Promise<output<typeof EngineResponse>>;
  score(sessionState: SessionStateInput): Promise<output<typeof ScoreResult>>;
  generateReport(
    sessionState: SessionStateInput,
    scores: ScoreResultInput
  ): Promise<string>;
}

function normalizeConfig(config: QuizConfigInput) {
  return QuizConfig.parse(config);
}

function toErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function normalizeSession(
  sessionState: SessionStateInput,
  config: output<typeof QuizConfig>
) {
  return SessionState.parse({
    ...sessionState,
    config
  });
}

function firstQuestionOfPendingSteps(session: output<typeof SessionState>) {
  const first = session.pendingSteps[0]?.questions[0];
  return first ?? null;
}

function handleModelStepBranch(
  nextStep: Awaited<ReturnType<typeof generateStepWithRetry>>,
  config: output<typeof QuizConfig>,
  normalizedSession: output<typeof SessionState>,
  log: EngineLogger
): output<typeof EngineStepResponse> | null {
  if (nextStep.type === "complete" && canComplete(config, normalizedSession)) {
    log({
      type: "model-complete-accepted",
      message: "Model requested completion and minimums are satisfied.",
      sessionId: normalizedSession.sessionId,
      historyCount: normalizedSession.history.length,
      completedSteps: normalizedSession.completedSteps
    });
    return EngineStepResponse.parse({
      type: "complete",
      scores: scoreSession(normalizedSession)
    });
  }

  if (nextStep.type === "complete") {
    log({
      type: "model-complete-ignored",
      message: "Model requested completion before minimums were satisfied.",
      sessionId: normalizedSession.sessionId,
      historyCount: normalizedSession.history.length,
      completedSteps: normalizedSession.completedSteps
    });
    return null;
  }

  if (
    "fallbackReason" in nextStep &&
    nextStep.fallbackReason === "generation_failed" &&
    canComplete(config, normalizedSession)
  ) {
    log({
      type: "completion-after-generation-failure",
      message:
        "Model generation failed, but the quiz already satisfies minimums so it will complete.",
      sessionId: normalizedSession.sessionId,
      historyCount: normalizedSession.history.length,
      completedSteps: normalizedSession.completedSteps,
      error: "error" in nextStep ? toErrorMessage(nextStep.error) : undefined
    });
    return EngineStepResponse.parse({
      type: "complete",
      scores: scoreSession(normalizedSession)
    });
  }

  if ("fallbackReason" in nextStep && nextStep.fallbackReason === "generation_failed") {
    log({
      type: "model-generation-fallback",
      message:
        "Model generation failed and the engine is falling back to a generic step.",
      sessionId: normalizedSession.sessionId,
      historyCount: normalizedSession.history.length,
      completedSteps: normalizedSession.completedSteps,
      error: "error" in nextStep ? toErrorMessage(nextStep.error) : undefined,
      questionCount: nextStep.step.questions.length
    });
  } else {
    log({
      type: "model-generation-succeeded",
      message: "Model generation returned a candidate step.",
      sessionId: normalizedSession.sessionId,
      historyCount: normalizedSession.history.length,
      completedSteps: normalizedSession.completedSteps,
      questionCount: nextStep.step.questions.length
    });
  }

  const sanitizedQuestions = sanitizeGeneratedStep(nextStep.step, normalizedSession);
  const duplicateCount = nextStep.step.questions.length - sanitizedQuestions.length;

  if (duplicateCount > 0) {
    log({
      type: "model-duplicates-filtered",
      message:
        "Filtered duplicate or already-known questions from the model output.",
      sessionId: normalizedSession.sessionId,
      historyCount: normalizedSession.history.length,
      completedSteps: normalizedSession.completedSteps,
      questionCount: sanitizedQuestions.length,
      duplicateCount
    });
  }

  if (sanitizedQuestions.length === 0) {
    if (canComplete(config, normalizedSession)) {
      log({
        type: "completion-after-duplicate-filter",
        message:
          "All model questions were filtered out as duplicates and the quiz already satisfies minimums, so it will complete.",
        sessionId: normalizedSession.sessionId,
        historyCount: normalizedSession.history.length,
        completedSteps: normalizedSession.completedSteps,
        duplicateCount
      });
      return EngineStepResponse.parse({
        type: "complete",
        scores: scoreSession(normalizedSession)
      });
    }

    log({
      type: "model-output-fully-duplicated",
      message:
        "All model questions were filtered out as duplicates, so the engine is falling back to a generic step.",
      sessionId: normalizedSession.sessionId,
      historyCount: normalizedSession.history.length,
      completedSteps: normalizedSession.completedSteps,
      duplicateCount
    });
    return EngineStepResponse.parse({
      type: "step",
      step: buildFallbackStep(config, normalizedSession.history.length)
    });
  }

  const sanitizedStep = Step.parse({
    questions: sanitizedQuestions
  });

  return EngineStepResponse.parse({
    type: "step",
    step: trimStepToRemainingQuestionBudget(sanitizedStep, config, normalizedSession)
  });
}

export function createQuizEngine(
  options: CreateQuizEngineOptions
): QuizEngine {
  const config = normalizeConfig(options.config);
  const log: EngineLogger = (event) => {
    options.logger?.(event);
  };

  async function runGenerateStep(sessionState: SessionStateInput) {
    const normalizedSession = normalizeSession(sessionState, config);

    if (normalizedSession.pendingSteps.length > 0) {
      log({
        type: "pending-step-used",
        message: "Using an already queued pending step.",
        sessionId: normalizedSession.sessionId,
        historyCount: normalizedSession.history.length,
        completedSteps: normalizedSession.completedSteps,
        questionCount: normalizedSession.pendingSteps[0].questions.length
      });
      return EngineStepResponse.parse({
        type: "step",
        step: normalizedSession.pendingSteps[0]
      });
    }

    if (reachedHardLimit(config, normalizedSession)) {
      log({
        type: "hard-limit-complete",
        message: "Completing because a configured hard limit was reached.",
        sessionId: normalizedSession.sessionId,
        historyCount: normalizedSession.history.length,
        completedSteps: normalizedSession.completedSteps
      });
      return EngineStepResponse.parse({
        type: "complete",
        scores: scoreSession(normalizedSession)
      });
    }

    const seedStep = getSeedStep(config, normalizedSession.completedSteps);

    if (seedStep) {
      log({
        type: "seed-step-used",
        message: "Using a developer-provided seed step.",
        sessionId: normalizedSession.sessionId,
        historyCount: normalizedSession.history.length,
        completedSteps: normalizedSession.completedSteps,
        questionCount: seedStep.questions.length
      });
      return EngineStepResponse.parse({
        type: "step",
        step: trimStepToRemainingQuestionBudget(seedStep, config, normalizedSession)
      });
    }

    if (options.model) {
      log({
        type: "model-generation-started",
        message: "Starting model generation for the next adaptive step.",
        sessionId: normalizedSession.sessionId,
        historyCount: normalizedSession.history.length,
        completedSteps: normalizedSession.completedSteps
      });
      const nextStep = await generateStepWithRetry(
        options.model,
        normalizedSession
      );

      const modelResult = handleModelStepBranch(
        nextStep,
        config,
        normalizedSession,
        log
      );
      if (modelResult) {
        return modelResult;
      }
    }

    if (canComplete(config, normalizedSession)) {
      log({
        type: "minimums-complete-without-model",
        message:
          "No model follow-up was needed because the session already satisfies the configured minimums.",
        sessionId: normalizedSession.sessionId,
        historyCount: normalizedSession.history.length,
        completedSteps: normalizedSession.completedSteps
      });
      return EngineStepResponse.parse({
        type: "complete",
        scores: scoreSession(normalizedSession)
      });
    }

    log({
      type: "fallback-step-used",
      message: "Using a fallback step because no model output is available.",
      sessionId: normalizedSession.sessionId,
      historyCount: normalizedSession.history.length,
      completedSteps: normalizedSession.completedSteps,
      questionCount: config.batchSize
    });
    return EngineStepResponse.parse({
      type: "step",
      step: buildFallbackStep(config, normalizedSession.history.length)
    });
  }

  return {
    config,
    async generateStep(sessionState) {
      return runGenerateStep(sessionState);
    },
    async generateBatch(sessionState) {
      const nextStep = await runGenerateStep(sessionState);

      if (nextStep.type === "complete") {
        return EngineBatchResponse.parse(nextStep);
      }

      return EngineBatchResponse.parse({
        type: "questions",
        questions: nextStep.step.questions
      });
    },
    async generateNext(sessionState) {
      const normalizedSession = normalizeSession(sessionState, config);
      const pendingQuestion = firstQuestionOfPendingSteps(normalizedSession);

      if (pendingQuestion) {
        return EngineResponse.parse({
          type: "question",
          question: pendingQuestion
        });
      }

      const nextStep = await runGenerateStep(normalizedSession);

      if (nextStep.type === "complete") {
        return EngineResponse.parse(nextStep);
      }

      return EngineResponse.parse({
        type: "question",
        question: nextStep.step.questions[0]
      });
    },
    async score(sessionState) {
      const normalizedSession = normalizeSession(sessionState, config);

      return scoreSession(normalizedSession);
    },
    async generateReport(sessionState, scores) {
      const normalizedSession = normalizeSession(sessionState, config);
      const normalizedScores = ScoreResult.parse(scores);

      return generateScoreReport(normalizedSession, normalizedScores);
    }
  };
}
