import { z } from "zod";

import { AnswerValue, QuestionSpec } from "./question-types";
import { FormConfig } from "./form-config";
import { ScoreResult } from "./scoring";
import { Step } from "./step";

export const SessionHistoryItem = z.object({
  question: QuestionSpec,
  answer: AnswerValue
});

export type SessionHistoryItem = z.infer<typeof SessionHistoryItem>;

/** Runtime form progress: history + optional queued upcoming steps (`pendingSteps` only). */
export const SessionState = z.object({
  sessionId: z.string(),
  config: FormConfig,
  history: z.array(SessionHistoryItem),
  pendingSteps: z.array(Step).default([]),
  completedSteps: z.number().int().nonnegative().default(0)
});

export type SessionState = z.infer<typeof SessionState>;

export const EngineStepResponse = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("step"),
    step: Step
  }),
  z.object({
    type: z.literal("complete"),
    scores: ScoreResult
  })
]);

export type EngineStepResponse = z.infer<typeof EngineStepResponse>;
