import {
  EngineStepResponse,
  FormConfig,
  SessionState,
  Step,
} from "../schemas";
import type { input, output } from "zod";

import { scoreSession } from "./scoring";
import {
  generateStepWithRetry,
  type FormModel,
} from "./model-step";
import {
  buildFallbackStep,
  canComplete,
  getSeedStep,
  reachedHardLimit,
  sanitizeGeneratedStep,
  trimStepToRemainingQuestionBudget,
} from "./step-helpers";

export type FormConfigInput = input<typeof FormConfig>;
export type SessionStateInput = input<typeof SessionState>;
export type { FormModel };

export interface CreateFormEngineOptions {
  readonly model?: FormModel;
  readonly config: FormConfigInput;
}

export interface FormEngine {
  readonly config: output<typeof FormConfig>;
  generateStep(
    sessionState: SessionStateInput,
  ): Promise<output<typeof EngineStepResponse>>;
}

function normalizeConfig(config: FormConfigInput) {
  return FormConfig.parse(config);
}

function normalizeSession(
  sessionState: SessionStateInput,
  config: output<typeof FormConfig>,
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
  config: output<typeof FormConfig>,
  sessionState: output<typeof SessionState>,
) {
  return EngineStepResponse.parse({
    type: "step",
    step: trimStepToRemainingQuestionBudget(step, config, sessionState),
  });
}

function resolveModelStep(
  nextStep: Awaited<ReturnType<typeof generateStepWithRetry>>,
  config: output<typeof FormConfig>,
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

export function createFormEngine(options: CreateFormEngineOptions): FormEngine {
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
