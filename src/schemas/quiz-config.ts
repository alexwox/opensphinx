import { z } from "zod";

import { QuestionSpec } from "./question-types";
import { Step } from "./step";

export const ScoringDimension = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string()
});

export type ScoringDimension = z.infer<typeof ScoringDimension>;

export const QuizConfig = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  systemPrompt: z.string(),
  goals: z.array(z.string()),
  minQuestions: z.number().default(5),
  maxQuestions: z.number().default(15),
  minSteps: z.number().int().min(1).optional(),
  maxSteps: z.number().int().min(1).optional(),
  batchSize: z.number().min(1).max(5).default(3),
  scoringDimensions: z.array(ScoringDimension),
  seedQuestions: z.array(QuestionSpec).optional(),
  seedSteps: z.array(Step).optional(),
  language: z.string().default("en")
});

export type QuizConfig = z.infer<typeof QuizConfig>;
