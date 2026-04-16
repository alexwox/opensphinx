import { generateObject } from "ai";
import { z } from "zod";

import { QuestionSpec, SessionState, Step } from "../schemas";

import { buildPrompt } from "./prompt-builder";
import { buildFallbackStep } from "./step-helpers";

/**
 * OpenAI Structured Outputs (`response_format: json_schema`) require a root JSON Schema with `type: "object"`.
 * A top-level Zod `discriminatedUnion` becomes `anyOf` at the root, which OpenAI rejects (often as `type: "None"`).
 *
 * - AI SDK structured objects: https://ai-sdk.dev/docs/ai-sdk-core/generating-structured-data
 * - OpenAI Structured Outputs: https://platform.openai.com/docs/guides/structured-outputs
 */
export type QuizModel = Parameters<typeof generateObject>[0]["model"];

/** Model wire format (single root object). Normalized to {@link ModelNextStepDecision} after parse. */
type ModelNextStepWire = z.infer<ReturnType<typeof createNextStepWireSchema>>;

export type ModelNextStepDecision =
  | { readonly type: "complete" }
  | { readonly type: "step"; readonly step: z.infer<typeof Step> };

export type ModelStepWithFallback = Extract<ModelNextStepDecision, { type: "step" }> & {
  readonly fallbackReason?: "generation_failed";
  readonly error?: unknown;
};

function createNextStepWireSchema(batchSize: number) {
  const nullableMinMaxLabels = z
    .object({
      min: z.string(),
      max: z.string()
    })
    .nullable();
  const nullableLowHighLabels = z
    .object({
      low: z.string(),
      high: z.string()
    })
    .nullable();

  const openAiQuestionSpec = z.discriminatedUnion("type", [
    z.object({
      type: z.literal("mcq"),
      question: z.string(),
      options: z.array(z.string()).min(2).max(6),
      allowMultiple: z.boolean()
    }),
    z.object({
      type: z.literal("free_text"),
      question: z.string(),
      placeholder: z.string().nullable(),
      maxLength: z.number()
    }),
    z.object({
      type: z.literal("slider"),
      question: z.string(),
      min: z.number(),
      max: z.number(),
      step: z.number(),
      labels: nullableMinMaxLabels
    }),
    z.object({
      type: z.literal("rating"),
      question: z.string(),
      max: z.number(),
      labels: nullableLowHighLabels
    }),
    z.object({
      type: z.literal("yes_no"),
      question: z.string()
    }),
    z.object({
      type: z.literal("number"),
      question: z.string(),
      min: z.number().nullable(),
      max: z.number().nullable(),
      unit: z.string().nullable()
    }),
    z.object({
      type: z.literal("date"),
      question: z.string()
    }),
    z.object({
      type: z.literal("multi_select"),
      question: z.string(),
      options: z.array(z.string()).min(2).max(10),
      maxSelections: z.number().nullable()
    })
  ]);

  const stepQuestions = z.array(openAiQuestionSpec).min(1).max(batchSize);

  return z
    .object({
      type: z
        .enum(["step", "complete"])
        .describe(
          "step: return the next quiz step as questions. complete: enough information and minimums are met."
        ),
      questions: z
        .union([stepQuestions, z.null()])
        .describe(
          "When type is step: non-empty QuestionSpec list (at most the batch size). When type is complete: null."
        )
    })
    .superRefine((data, ctx) => {
      if (data.type === "step" && data.questions === null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["questions"],
          message: "Provide a non-empty questions array when type is step."
        });
      }
      if (data.type === "complete" && data.questions !== null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["questions"],
          message: "Use null for questions when type is complete."
        });
      }
    });
}

function wireToDecision(wire: ModelNextStepWire): ModelNextStepDecision {
  if (wire.type === "complete") {
    return { type: "complete" };
  }

  const questions = wire.questions;
  if (questions === null) {
    throw new Error("OpenSphinx: model returned type step but questions is null.");
  }

  return {
    type: "step",
    step: Step.parse({
      questions: questions.map((question) => {
        switch (question.type) {
          case "mcq":
            return QuestionSpec.parse(question);
          case "free_text":
            return QuestionSpec.parse({
              ...question,
              placeholder: question.placeholder ?? undefined
            });
          case "slider":
            return QuestionSpec.parse({
              ...question,
              labels: question.labels ?? undefined
            });
          case "rating":
            return QuestionSpec.parse({
              ...question,
              labels: question.labels ?? undefined
            });
          case "yes_no":
            return QuestionSpec.parse(question);
          case "number":
            return QuestionSpec.parse({
              ...question,
              min: question.min ?? undefined,
              max: question.max ?? undefined,
              unit: question.unit ?? undefined
            });
          case "date":
            return QuestionSpec.parse(question);
          case "multi_select":
            return QuestionSpec.parse({
              ...question,
              maxSelections: question.maxSelections ?? undefined
            });
          default: {
            const exhaustiveCheck: never = question;
            return exhaustiveCheck;
          }
        }
      })
    })
  };
}

export async function generateStepWithModel(
  model: QuizModel,
  sessionState: z.infer<typeof SessionState>
) {
  const prompt = buildPrompt(sessionState, sessionState.config.batchSize);
  const wireSchema = createNextStepWireSchema(sessionState.config.batchSize);

  const { object } = await generateObject({
    model,
    schema: wireSchema,
    schemaName: "OpenSphinxNextStep",
    schemaDescription:
      "Decide whether to return the next quiz step (questions) or mark the quiz complete.",
    prompt,
    maxRetries: 0
  });

  return wireToDecision(wireSchema.parse(object));
}

export async function generateStepWithRetry(
  model: QuizModel,
  sessionState: z.infer<typeof SessionState>
): Promise<ModelNextStepDecision | ModelStepWithFallback> {
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
