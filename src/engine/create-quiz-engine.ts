import {
  EngineResponse,
  QuestionSpec,
  QuizConfig,
  ScoreResult,
  SessionState
} from "../schemas";
import type { input, output } from "zod";

import { buildPrompt } from "./prompt-builder";
import { generateScoreReport } from "./report";
import { scoreSession } from "./scoring";

export type QuizConfigInput = input<typeof QuizConfig>;
export type SessionStateInput = input<typeof SessionState>;
export type ScoreResultInput = input<typeof ScoreResult>;

export interface CreateQuizEngineOptions {
  readonly model?: unknown;
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

      if (normalizedSession.history.length >= config.minQuestions) {
        return EngineResponse.parse({
          type: "complete",
          scores: scoreSession(normalizedSession)
        });
      }

      buildPrompt(normalizedSession);

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
