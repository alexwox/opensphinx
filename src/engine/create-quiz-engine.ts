import { generateObject } from "ai";
import {
  EngineResponse,
  QuestionSpec,
  QuizConfig,
  ScoreResult,
  SessionState
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

const NextStepDecision = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("question"),
    question: QuestionSpec
  }),
  z.object({
    type: z.literal("complete")
  })
]);

type NextStepDecision = z.infer<typeof NextStepDecision>;

export interface CreateQuizEngineOptions {
  readonly model?: QuizModel;
  readonly config: QuizConfigInput;
}

export interface QuizEngine {
  readonly config: output<typeof QuizConfig>;
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

async function generateStepWithModel(
  model: QuizModel,
  sessionState: output<typeof SessionState>
) {
  const prompt = buildPrompt(sessionState);

  const { object } = await generateObject({
    model,
    schema: NextStepDecision,
    schemaName: "OpenSphinxNextStep",
    schemaDescription:
      "Decide whether to ask the next quiz question or mark the quiz complete.",
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
    type: "question",
    question: buildFallbackQuestion(sessionState.config, sessionState.history.length),
    error: lastError
  } as const;
}

export function createQuizEngine(
  options: CreateQuizEngineOptions
): QuizEngine {
  const config = normalizeConfig(options.config);

  return {
    config,
    async generateNext(sessionState) {
      const normalizedSession = normalizeSession(sessionState, config);

      if (normalizedSession.history.length >= config.maxQuestions) {
        return EngineResponse.parse({
          type: "complete",
          scores: scoreSession(normalizedSession)
        });
      }

      const nextSeedQuestion = config.seedQuestions?.[normalizedSession.history.length];

      if (nextSeedQuestion) {
        return EngineResponse.parse({
          type: "question",
          question: nextSeedQuestion
        });
      }

      if (options.model) {
        const nextStep = await generateStepWithRetry(options.model, normalizedSession);

        if (
          nextStep.type === "complete" &&
          normalizedSession.history.length >= config.minQuestions
        ) {
          return EngineResponse.parse({
            type: "complete",
            scores: scoreSession(normalizedSession)
          });
        }

        if (nextStep.type === "question") {
          return EngineResponse.parse({
            type: "question",
            question: nextStep.question
          });
        }
      }

      if (normalizedSession.history.length >= config.minQuestions) {
        return EngineResponse.parse({
          type: "complete",
          scores: scoreSession(normalizedSession)
        });
      }

      return EngineResponse.parse({
        type: "question",
        question: buildFallbackQuestion(config, normalizedSession.history.length)
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
