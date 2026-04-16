import { z } from "zod";

export const DimensionScore = z.object({
  id: z.string(),
  label: z.string().optional(),
  score: z.number(),
  explanation: z.string().optional()
});

export type DimensionScore = z.infer<typeof DimensionScore>;

export const ScoreResult = z.object({
  dimensions: z.array(DimensionScore).default([]),
  summary: z.string().optional()
});

export type ScoreResult = z.infer<typeof ScoreResult>;
