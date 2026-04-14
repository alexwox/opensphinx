import { z } from "zod";

import { AnswerValue, QuestionSpec } from "./question-types";
import { QuizConfig } from "./quiz-config";
import { ScoreResult } from "./scoring";

export const SessionHistoryItem = z.object({
  question: QuestionSpec,
  answer: AnswerValue
});

export type SessionHistoryItem = z.infer<typeof SessionHistoryItem>;

export const SessionState = z.object({
  sessionId: z.string(),
  config: QuizConfig,
  history: z.array(SessionHistoryItem)
});

export type SessionState = z.infer<typeof SessionState>;

export const EngineResponse = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("question"),
    question: QuestionSpec
  }),
  z.object({
    type: z.literal("complete"),
    scores: ScoreResult
  })
]);

export type EngineResponse = z.infer<typeof EngineResponse>;
