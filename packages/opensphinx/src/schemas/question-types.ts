import { z } from "zod";

export const McqQuestion = z.object({
  type: z.literal("mcq"),
  question: z.string(),
  options: z.array(z.string()).min(2).max(6),
  allowMultiple: z.boolean().default(false)
});

export type McqQuestion = z.infer<typeof McqQuestion>;

export const FreeTextQuestion = z.object({
  type: z.literal("free_text"),
  question: z.string(),
  placeholder: z.string().optional(),
  maxLength: z.number().default(500)
});

export type FreeTextQuestion = z.infer<typeof FreeTextQuestion>;

export const SliderQuestion = z.object({
  type: z.literal("slider"),
  question: z.string(),
  min: z.number(),
  max: z.number(),
  step: z.number().default(1),
  labels: z
    .object({
      min: z.string(),
      max: z.string()
    })
    .optional()
});

export type SliderQuestion = z.infer<typeof SliderQuestion>;

export const RatingQuestion = z.object({
  type: z.literal("rating"),
  question: z.string(),
  max: z.number().default(5),
  labels: z
    .object({
      low: z.string(),
      high: z.string()
    })
    .optional()
});

export type RatingQuestion = z.infer<typeof RatingQuestion>;

export const YesNoQuestion = z.object({
  type: z.literal("yes_no"),
  question: z.string()
});

export type YesNoQuestion = z.infer<typeof YesNoQuestion>;

export const NumberQuestion = z.object({
  type: z.literal("number"),
  question: z.string(),
  min: z.number().optional(),
  max: z.number().optional(),
  unit: z.string().optional()
});

export type NumberQuestion = z.infer<typeof NumberQuestion>;

export const DateQuestion = z.object({
  type: z.literal("date"),
  question: z.string()
});

export type DateQuestion = z.infer<typeof DateQuestion>;

export const MultiSelectQuestion = z.object({
  type: z.literal("multi_select"),
  question: z.string(),
  options: z.array(z.string()).min(2).max(10),
  maxSelections: z.number().optional()
});

export type MultiSelectQuestion = z.infer<typeof MultiSelectQuestion>;

export const QuestionSpec = z.discriminatedUnion("type", [
  McqQuestion,
  FreeTextQuestion,
  SliderQuestion,
  RatingQuestion,
  YesNoQuestion,
  NumberQuestion,
  DateQuestion,
  MultiSelectQuestion
]);

export type QuestionSpec = z.infer<typeof QuestionSpec>;

export const AnswerValue = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.array(z.string()),
  z.date()
]);

export type AnswerValue = z.infer<typeof AnswerValue>;
