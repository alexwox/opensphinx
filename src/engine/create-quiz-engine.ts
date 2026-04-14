import { generateObject } from "ai";
import {
  EngineBatchResponse,
  EngineResponse,
  EngineStepResponse,
  QuestionSpec,
  QuizConfig,
  ScoreResult,
  SessionState,
  Step
} from "../schemas";
import type { input, output } from "zod";
import { z } from "zod";

import { buildPrompt } from "./prompt-builder";
import { generateScoreReport } from "./report";
import { scoreSession } from "./scoring";

export type QuizConfigInput = input<typeof QuizConfig>;
export type SessionStateInput = input<typeof SessionState>;
export type ScoreResultInput = input<typeof ScoreResult>;
export type QuizModel = Parameters<typeof generateObject>[0]["model"];

function createNextStepDecisionSchema(batchSize: number) {
  return z.discriminatedUnion("type", [
    z.object({
      type: z.literal("step"),
      step: z.object({
        questions: z.array(QuestionSpec).min(1).max(batchSize)
      })
    }),
    z.object({
      type: z.literal("complete")
    })
  ]);
}

export interface CreateQuizEngineOptions {
  readonly model?: QuizModel;
  readonly config: QuizConfigInput;
}

export interface QuizEngine {
  readonly config: output<typeof QuizConfig>;
  generateStep(
    sessionState: SessionStateInput
  ): Promise<output<typeof EngineStepResponse>>;
  generateBatch(
    sessionState: SessionStateInput
  ): Promise<output<typeof EngineBatchResponse>>;
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

function normalizeSession(
  sessionState: SessionStateInput,
  config: output<typeof QuizConfig>
) {
  return SessionState.parse({
    ...sessionState,
    config
  });
}

function buildFallbackQuestion(
  config: output<typeof QuizConfig>,
  historyLength: number
) {
  const questionNumber = historyLength + 1;

  return QuestionSpec.parse({
    type: "free_text",
    question: `Question ${questionNumber}: What else should OpenSphinx know before it continues "${config.name}"?`,
    placeholder: "Add any helpful context here.",
    maxLength: 500
  });
}

function normalizeQuestionText(question: QuestionSpec) {
  return question.question
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function collectKnownQuestions(sessionState: output<typeof SessionState>) {
  return [
    ...sessionState.history.map((entry) => entry.question),
    ...sessionState.pendingQuestions,
    ...sessionState.pendingSteps.flatMap((step) => step.questions)
  ];
}

function sanitizeGeneratedStep(
  step: output<typeof Step>,
  sessionState: output<typeof SessionState>
) {
  const knownQuestionTexts = new Set(
    collectKnownQuestions(sessionState).map((question) =>
      normalizeQuestionText(question)
    )
  );
  const seenInStep = new Set<string>();

  return step.questions.filter((question) => {
      const normalized = normalizeQuestionText(question);

      if (normalized.length === 0) {
        return false;
      }

      if (knownQuestionTexts.has(normalized)) {
        return false;
      }

      if (seenInStep.has(normalized)) {
        return false;
      }

      seenInStep.add(normalized);
      return true;
    });
}

function buildFallbackStep(
  config: output<typeof QuizConfig>,
  historyLength: number
) {
  const remainingSlots = Math.max(0, config.maxQuestions - historyLength);
  const stepQuestionCount = Math.max(1, Math.min(config.batchSize, remainingSlots));

  return Step.parse({
    questions: Array.from({ length: stepQuestionCount }, (_, index) =>
      buildFallbackQuestion(config, historyLength + index)
    )
  });
}

function getSeedSteps(config: output<typeof QuizConfig>) {
  if (config.seedSteps && config.seedSteps.length > 0) {
    return config.seedSteps.map((step) => Step.parse(step));
  }

  if (!config.seedQuestions || config.seedQuestions.length === 0) {
    return [];
  }

  const seedSteps: Array<output<typeof Step>> = [];

  for (let index = 0; index < config.seedQuestions.length; index += config.batchSize) {
    seedSteps.push(
      Step.parse({
        questions: config.seedQuestions.slice(index, index + config.batchSize)
      })
    );
  }

  return seedSteps;
}

function getSeedStep(
  config: output<typeof QuizConfig>,
  completedSteps: number
) {
  const seedSteps = getSeedSteps(config);
  return seedSteps[completedSteps];
}

function canComplete(
  config: output<typeof QuizConfig>,
  sessionState: output<typeof SessionState>
) {
  const meetsQuestionMinimum = sessionState.history.length >= config.minQuestions;
  const meetsStepMinimum =
    config.minSteps === undefined || sessionState.completedSteps >= config.minSteps;

  return meetsQuestionMinimum && meetsStepMinimum;
}

function reachedHardLimit(
  config: output<typeof QuizConfig>,
  sessionState: output<typeof SessionState>
) {
  const reachedQuestionLimit = sessionState.history.length >= config.maxQuestions;
  const reachedStepLimit =
    config.maxSteps !== undefined && sessionState.completedSteps >= config.maxSteps;

  return reachedQuestionLimit || reachedStepLimit;
}

function trimStepToRemainingQuestionBudget(
  step: output<typeof Step>,
  config: output<typeof QuizConfig>,
  sessionState: output<typeof SessionState>
) {
  const remainingQuestionSlots = Math.max(
    0,
    config.maxQuestions - sessionState.history.length
  );

  return Step.parse({
    questions: step.questions.slice(
      0,
      Math.max(1, Math.min(step.questions.length, remainingQuestionSlots))
    )
  });
}

async function generateStepWithModel(
  model: QuizModel,
  sessionState: output<typeof SessionState>
) {
  const prompt = buildPrompt(sessionState, sessionState.config.batchSize);
  const NextStepDecision = createNextStepDecisionSchema(
    sessionState.config.batchSize
  );

  const { object } = await generateObject({
    model,
    schema: NextStepDecision,
    schemaName: "OpenSphinxNextStep",
    schemaDescription:
      "Decide whether to return the next quiz step or mark the quiz complete.",
    prompt,
    maxRetries: 0
  });

  return NextStepDecision.parse(object);
}

async function generateStepWithRetry(
  model: QuizModel,
  sessionState: output<typeof SessionState>
) {
  let lastError: unknown;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await generateStepWithModel(model, sessionState);
    } catch (error) {
      lastError = error;
    }
  }

  return {
    type: "step",
    step: buildFallbackStep(sessionState.config, sessionState.history.length),
    fallbackReason: "generation_failed",
    error: lastError
  } as const;
}

export function createQuizEngine(
  options: CreateQuizEngineOptions
): QuizEngine {
  const config = normalizeConfig(options.config);

  async function runGenerateStep(sessionState: SessionStateInput) {
    const normalizedSession = normalizeSession(sessionState, config);

    if (normalizedSession.pendingSteps.length > 0) {
      return EngineStepResponse.parse({
        type: "step",
        step: normalizedSession.pendingSteps[0]
      });
    }

    if (reachedHardLimit(config, normalizedSession)) {
      return EngineStepResponse.parse({
        type: "complete",
        scores: scoreSession(normalizedSession)
      });
    }

    const seedStep = getSeedStep(config, normalizedSession.completedSteps);

    if (seedStep) {
      return EngineStepResponse.parse({
        type: "step",
        step: trimStepToRemainingQuestionBudget(seedStep, config, normalizedSession)
      });
    }

    if (options.model) {
      const nextStep = await generateStepWithRetry(
        options.model,
        normalizedSession
      );

      if (nextStep.type === "complete" && canComplete(config, normalizedSession)) {
        return EngineStepResponse.parse({
          type: "complete",
          scores: scoreSession(normalizedSession)
        });
      }

      if (nextStep.type === "step") {
        if (
          "fallbackReason" in nextStep &&
          nextStep.fallbackReason === "generation_failed" &&
          canComplete(config, normalizedSession)
        ) {
          return EngineStepResponse.parse({
            type: "complete",
            scores: scoreSession(normalizedSession)
          });
        }

        const sanitizedQuestions = sanitizeGeneratedStep(
          nextStep.step,
          normalizedSession
        );

        if (sanitizedQuestions.length === 0) {
          if (canComplete(config, normalizedSession)) {
            return EngineStepResponse.parse({
              type: "complete",
              scores: scoreSession(normalizedSession)
            });
          }

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
          step: trimStepToRemainingQuestionBudget(
            sanitizedStep,
            config,
            normalizedSession
          )
        });
      }
    }

    if (canComplete(config, normalizedSession)) {
      return EngineStepResponse.parse({
        type: "complete",
        scores: scoreSession(normalizedSession)
      });
    }

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

      if (normalizedSession.pendingQuestions.length > 0) {
        return EngineResponse.parse({
          type: "question",
          question: normalizedSession.pendingQuestions[0]
        });
      }

      if (normalizedSession.pendingSteps.length > 0) {
        return EngineResponse.parse({
          type: "question",
          question: normalizedSession.pendingSteps[0].questions[0]
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
