import { asSchema, generateObject } from "ai";
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

export interface ModelGenerationDiagnostic {
  readonly type: "schema-prepared" | "attempt-failed" | "wire-output";
  readonly message: string;
  readonly details?: readonly string[];
  readonly error?: unknown;
}

type ModelGenerationLogger = (diagnostic: ModelGenerationDiagnostic) => void;

function sendDebugLog(payload: {
  readonly runId: string;
  readonly hypothesisId: string;
  readonly location: string;
  readonly message: string;
  readonly data: Record<string, unknown>;
}) {
  // #region agent log
  fetch("http://127.0.0.1:7249/ingest/3948c784-51f7-41c9-9ccf-9b068e008817", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Session-Id": "8522ea"
    },
    body: JSON.stringify({
      sessionId: "8522ea",
      runId: payload.runId,
      hypothesisId: payload.hypothesisId,
      location: payload.location,
      message: payload.message,
      data: payload.data,
      timestamp: Date.now()
    })
  }).catch(() => {});
  // #endregion
}

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

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function formatKeys(value: unknown) {
  const items = asArray(value).map((item) => String(item));
  return items.length > 0 ? items.join("|") : "none";
}

function getSchemaDiagnostics(wireSchema: ReturnType<typeof createNextStepWireSchema>) {
  const jsonSchema = asSchema(wireSchema).jsonSchema;
  const schemaRecord = asRecord(jsonSchema);
  const properties = asRecord(schemaRecord?.properties);
  const questionsSchema = asRecord(properties?.questions);
  const questionsAnyOf = asArray(questionsSchema?.anyOf);
  const arrayBranch = questionsAnyOf
    .map((branch) => asRecord(branch))
    .find((branch) => branch?.type === "array");
  const itemsSchema = asRecord(arrayBranch?.items);
  const itemVariants = asArray(itemsSchema?.anyOf)
    .map((variant) => asRecord(variant))
    .filter((variant): variant is Record<string, unknown> => variant !== null);

  const details = [
    `schema.rootType=${String(schemaRecord?.type ?? "none")}`,
    `schema.rootRequired=${formatKeys(schemaRecord?.required)}`,
    `schema.questionsAnyOf=${questionsAnyOf.length}`,
    `schema.questionVariants=${itemVariants.length}`
  ];

  for (const variant of itemVariants) {
    const variantProperties = asRecord(variant.properties);
    const variantType =
      asRecord(variantProperties?.type)?.const ??
      asRecord(variantProperties?.type)?.enum ??
      "unknown";
    details.push(
      `variant.${String(variantType)}.required=${formatKeys(variant.required)}`
    );
    details.push(
      `variant.${String(variantType)}.properties=${Object.keys(variantProperties ?? {}).join("|") || "none"}`
    );
  }

  return details;
}

function getSchemaMismatchDiagnostics(
  wireSchema: ReturnType<typeof createNextStepWireSchema>
) {
  const jsonSchema = asSchema(wireSchema).jsonSchema;
  const schemaRecord = asRecord(jsonSchema);
  const properties = asRecord(schemaRecord?.properties);
  const questionsSchema = asRecord(properties?.questions);
  const questionsAnyOf = asArray(questionsSchema?.anyOf);
  const arrayBranch = questionsAnyOf
    .map((branch) => asRecord(branch))
    .find((branch) => branch?.type === "array");
  const itemsSchema = asRecord(arrayBranch?.items);
  const itemVariants = asArray(itemsSchema?.anyOf)
    .map((variant) => asRecord(variant))
    .filter((variant): variant is Record<string, unknown> => variant !== null);

  return itemVariants.map((variant) => {
    const variantProperties = asRecord(variant.properties) ?? {};
    const required = asArray(variant.required).map((item) => String(item));
    const propertyKeys = Object.keys(variantProperties);
    const missingRequired = propertyKeys.filter((key) => !required.includes(key));
    const variantType = String(
      asRecord(variantProperties.type)?.const ??
        asRecord(variantProperties.type)?.enum ??
        "unknown"
    );

    return {
      variantType,
      propertyKeys,
      required,
      missingRequired
    };
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
  sessionState: z.infer<typeof SessionState>,
  logger?: ModelGenerationLogger
) {
  const prompt = buildPrompt(sessionState, sessionState.config.batchSize);
  const wireSchema = createNextStepWireSchema(sessionState.config.batchSize);
  const schemaDiagnostics = getSchemaDiagnostics(wireSchema);
  const mismatchDiagnostics = getSchemaMismatchDiagnostics(wireSchema);
  const runId = sessionState.sessionId;

  logger?.({
    type: "schema-prepared",
    message: "Prepared model wire schema for structured output.",
    details: [
      ...schemaDiagnostics,
      `prompt.length=${prompt.length}`
    ]
  });

  // #region agent log
  sendDebugLog({
    runId,
    hypothesisId: "H1-H4",
    location: "src/engine/model-step.ts:156",
    message: "Prepared wire schema and computed required/property mismatches.",
    data: {
      batchSize: sessionState.config.batchSize,
      rootDiagnostics: schemaDiagnostics,
      mismatches: mismatchDiagnostics
    }
  });
  // #endregion

  const { object } = await generateObject({
    model,
    schema: wireSchema,
    schemaName: "OpenSphinxNextStep",
    schemaDescription:
      "Decide whether to return the next quiz step (questions) or mark the quiz complete.",
    prompt,
    maxRetries: 0
  });

  logger?.({
    type: "wire-output",
    message: "Model returned a structured wire object.",
    details: [`wire.output=${JSON.stringify(object)}`]
  });

  // #region agent log
  sendDebugLog({
    runId,
    hypothesisId: "H2",
    location: "src/engine/model-step.ts:181",
    message: "Model returned a structured wire object.",
    data: {
      object
    }
  });
  // #endregion

  return wireToDecision(wireSchema.parse(object));
}

export async function generateStepWithRetry(
  model: QuizModel,
  sessionState: z.infer<typeof SessionState>,
  logger?: ModelGenerationLogger
): Promise<ModelNextStepDecision | ModelStepWithFallback> {
  let lastError: unknown;
  const runId = sessionState.sessionId;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await generateStepWithModel(model, sessionState, logger);
    } catch (error) {
      lastError = error;
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger?.({
        type: "attempt-failed",
        message: "Model structured generation attempt failed.",
        details: [`attempt=${attempt + 1}`],
        error
      });
      // #region agent log
      sendDebugLog({
        runId,
        hypothesisId: "H1-H5",
        location: "src/engine/model-step.ts:206",
        message: "Structured generation attempt failed.",
        data: {
          attempt: attempt + 1,
          errorMessage
        }
      });
      // #endregion
    }
  }

  return {
    type: "step",
    step: buildFallbackStep(sessionState.config, sessionState.history.length),
    fallbackReason: "generation_failed",
    error: lastError
  } as const;
}
