import {
  EngineStepResponse,
  QuizConfig,
  SessionState,
  Step,
} from "../schemas";
import type { input, output } from "zod";

import { scoreSession } from "./scoring";
import {
  generateStepWithRetry,
  type QuizModel,
} from "./model-step";
import {
  buildFallbackStep,
  canComplete,
  getSeedStep,
  reachedHardLimit,
  sanitizeGeneratedStep,
  trimStepToRemainingQuestionBudget,
} from "./step-helpers";

export type QuizConfigInput = input<typeof QuizConfig>;
export type SessionStateInput = input<typeof SessionState>;
export type { QuizModel };

export interface CreateQuizEngineOptions {
  readonly model?: QuizModel;
  readonly config: QuizConfigInput;
}

export interface QuizEngine {
  readonly config: output<typeof QuizConfig>;
  generateStep(
    sessionState: SessionStateInput,
  ): Promise<output<typeof EngineStepResponse>>;
}

function normalizeConfig(config: QuizConfigInput) {
  return QuizConfig.parse(config);
}

function normalizeSession(
  sessionState: SessionStateInput,
  config: output<typeof QuizConfig>,
) {
  return SessionState.parse({
    ...sessionState,
    config,
  });
}

function buildCompleteResponse(sessionState: output<typeof SessionState>) {
  return EngineStepResponse.parse({
    type: "complete",
    scores: scoreSession(sessionState),
  });
}

function buildStepResponse(
  step: output<typeof Step>,
  config: output<typeof QuizConfig>,
  sessionState: output<typeof SessionState>,
) {
  return EngineStepResponse.parse({
    type: "step",
    step: trimStepToRemainingQuestionBudget(step, config, sessionState),
  });
}

function resolveModelStep(
  nextStep: Awaited<ReturnType<typeof generateStepWithRetry>>,
  config: output<typeof QuizConfig>,
  normalizedSession: output<typeof SessionState>,
): output<typeof EngineStepResponse> | null {
  if (nextStep.type === "complete" && canComplete(config, normalizedSession)) {
    return buildCompleteResponse(normalizedSession);
  }

  if (nextStep.type === "complete") {
    return null;
  }

  if (
    "fallbackReason" in nextStep &&
    nextStep.fallbackReason === "generation_failed" &&
    canComplete(config, normalizedSession)
  ) {
    return buildCompleteResponse(normalizedSession);
  }

  const sanitizedQuestions = sanitizeGeneratedStep(
    nextStep.step,
    normalizedSession,
  );

  if (sanitizedQuestions.length === 0) {
    if (canComplete(config, normalizedSession)) {
      return buildCompleteResponse(normalizedSession);
    }

    return buildStepResponse(
      buildFallbackStep(config, normalizedSession.history.length),
      config,
      normalizedSession,
    );
  }

  return buildStepResponse(
    Step.parse({
      questions: sanitizedQuestions,
    }),
    config,
    normalizedSession,
  );
}

export function createQuizEngine(options: CreateQuizEngineOptions): QuizEngine {
  const config = normalizeConfig(options.config);

  async function runGenerateStep(sessionState: SessionStateInput) {
    const normalizedSession = normalizeSession(sessionState, config);

    if (normalizedSession.pendingSteps.length > 0) {
      return buildStepResponse(
        normalizedSession.pendingSteps[0],
        config,
        normalizedSession,
      );
    }

    if (reachedHardLimit(config, normalizedSession)) {
      return buildCompleteResponse(normalizedSession);
    }

    const seedStep = getSeedStep(config, normalizedSession.completedSteps);

    if (seedStep) {
      return buildStepResponse(seedStep, config, normalizedSession);
    }

    if (options.model) {
      const nextStep = await generateStepWithRetry(
        options.model,
        normalizedSession,
      );

      const modelResult = resolveModelStep(
        nextStep,
        config,
        normalizedSession,
      );
      if (modelResult) {
        return modelResult;
      }
    }

    if (canComplete(config, normalizedSession)) {
      return buildCompleteResponse(normalizedSession);
    }

    return buildStepResponse(
      buildFallbackStep(config, normalizedSession.history.length),
      config,
      normalizedSession,
    );
  }

  return {
    config,
    async generateStep(sessionState) {
      return runGenerateStep(sessionState);
    },
  };
}
