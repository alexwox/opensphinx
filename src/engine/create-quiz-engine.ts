import { generateObject } from "ai";
import {
  EngineBatchResponse,
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

function createNextBatchDecisionSchema(batchSize: number) {
  return z.discriminatedUnion("type", [
    z.object({
      type: z.literal("questions"),
      questions: z.array(QuestionSpec).min(1).max(batchSize)
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

function buildFallbackBatch(
  config: output<typeof QuizConfig>,
  historyLength: number
) {
  const remainingSlots = Math.max(0, config.maxQuestions - historyLength);
  const batchCount = Math.max(1, Math.min(config.batchSize, remainingSlots));

  return Array.from({ length: batchCount }, (_, index) =>
    buildFallbackQuestion(config, historyLength + index)
  );
}

function getSeedBatch(
  config: output<typeof QuizConfig>,
  historyLength: number
) {
  const seedQuestions = config.seedQuestions ?? [];

  return seedQuestions.slice(historyLength, historyLength + config.batchSize);
}

async function generateBatchWithModel(
  model: QuizModel,
  sessionState: output<typeof SessionState>
) {
  const prompt = buildPrompt(sessionState, sessionState.config.batchSize);
  const NextBatchDecision = createNextBatchDecisionSchema(
    sessionState.config.batchSize
  );

  const { object } = await generateObject({
    model,
    schema: NextBatchDecision,
    schemaName: "OpenSphinxNextBatch",
    schemaDescription:
      "Decide whether to return the next batch of quiz questions or mark the quiz complete.",
    prompt,
    maxRetries: 0
  });

  return NextBatchDecision.parse(object);
}

async function generateBatchWithRetry(
  model: QuizModel,
  sessionState: output<typeof SessionState>
) {
  let lastError: unknown;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await generateBatchWithModel(model, sessionState);
    } catch (error) {
      lastError = error;
    }
  }

  return {
    type: "questions",
    questions: buildFallbackBatch(sessionState.config, sessionState.history.length),
    error: lastError
  } as const;
}

export function createQuizEngine(
  options: CreateQuizEngineOptions
): QuizEngine {
  const config = normalizeConfig(options.config);

  async function runGenerateBatch(sessionState: SessionStateInput) {
    const normalizedSession = normalizeSession(sessionState, config);

    if (normalizedSession.history.length >= config.maxQuestions) {
      return EngineBatchResponse.parse({
        type: "complete",
        scores: scoreSession(normalizedSession)
      });
    }

    const seedBatch = getSeedBatch(config, normalizedSession.history.length);

    if (seedBatch.length > 0) {
      return EngineBatchResponse.parse({
        type: "questions",
        questions: seedBatch
      });
    }

    if (options.model) {
      const nextBatch = await generateBatchWithRetry(
        options.model,
        normalizedSession
      );

      if (
        nextBatch.type === "complete" &&
        normalizedSession.history.length >= config.minQuestions
      ) {
        return EngineBatchResponse.parse({
          type: "complete",
          scores: scoreSession(normalizedSession)
        });
      }

      if (nextBatch.type === "questions") {
        return EngineBatchResponse.parse({
          type: "questions",
          questions: nextBatch.questions.slice(
            0,
            Math.min(
              config.batchSize,
              Math.max(1, config.maxQuestions - normalizedSession.history.length)
            )
          )
        });
      }
    }

    if (normalizedSession.history.length >= config.minQuestions) {
      return EngineBatchResponse.parse({
        type: "complete",
        scores: scoreSession(normalizedSession)
      });
    }

    return EngineBatchResponse.parse({
      type: "questions",
      questions: buildFallbackBatch(config, normalizedSession.history.length)
    });
  }

  return {
    config,
    async generateBatch(sessionState) {
      return runGenerateBatch(sessionState);
    },
    async generateNext(sessionState) {
      const normalizedSession = normalizeSession(sessionState, config);

      if (normalizedSession.pendingQuestions.length > 0) {
        return EngineResponse.parse({
          type: "question",
          question: normalizedSession.pendingQuestions[0]
        });
      }

      const nextBatch = await runGenerateBatch(normalizedSession);

      if (nextBatch.type === "complete") {
        return EngineResponse.parse(nextBatch);
      }

      return EngineResponse.parse({
        type: "question",
        question: nextBatch.questions[0]
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
