import { z } from "zod";

import { QuestionSpec, Step } from "../schemas";

/**
 * OpenAI Structured Outputs require a root JSON Schema with `type: "object"`.
 * This wire schema keeps the top level object-shaped, then normalizes back to
 * the regular `Step` contract after parsing.
 */
export function createNextStepWireSchema(batchSize: number) {
  const nullableSliderLabels = z
    .object({
      min: z.string(),
      max: z.string()
    })
    .nullable();
  const nullableRatingLabels = z
    .object({
      low: z.string(),
      high: z.string()
    })
    .nullable();

  const modelQuestion = z.discriminatedUnion("type", [
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
      labels: nullableSliderLabels
    }),
    z.object({
      type: z.literal("rating"),
      question: z.string(),
      max: z.number(),
      labels: nullableRatingLabels
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

  const questions = z.array(modelQuestion).min(1).max(batchSize);

  return z
    .object({
      type: z.enum(["step", "complete"]),
      questions: z.union([questions, z.null()])
    })
    .superRefine((value, ctx) => {
      if (value.type === "step" && value.questions === null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["questions"],
          message: "Provide questions when type is step."
        });
      }

      if (value.type === "complete" && value.questions !== null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["questions"],
          message: "Use null questions when type is complete."
        });
      }
    });
}

type ModelNextStepWire = z.infer<ReturnType<typeof createNextStepWireSchema>>;
type ModelQuestion = NonNullable<ModelNextStepWire["questions"]>[number];

export type ModelNextStepDecision =
  | { readonly type: "complete" }
  | { readonly type: "step"; readonly step: z.infer<typeof Step> };

function normalizeModelQuestion(question: ModelQuestion) {
  switch (question.type) {
    case "mcq":
    case "yes_no":
    case "date":
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
    case "number":
      return QuestionSpec.parse({
        ...question,
        min: question.min ?? undefined,
        max: question.max ?? undefined,
        unit: question.unit ?? undefined
      });
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
}

export function wireToDecision(
  wire: ModelNextStepWire
): ModelNextStepDecision {
  if (wire.type === "complete") {
    return { type: "complete" };
  }

  if (wire.questions === null) {
    throw new Error("OpenSphinx: model returned a step without questions.");
  }

  return {
    type: "step",
    step: Step.parse({
      questions: wire.questions.map(normalizeModelQuestion)
    })
  };
}
