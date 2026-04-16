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

function createNextStepWireSchema(batchSize: number) {
  const stepQuestions = z.array(QuestionSpec).min(1).max(batchSize);

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
    step: Step.parse({ questions })
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

  logger?.({
    type: "schema-prepared",
    message: "Prepared model wire schema for structured output.",
    details: [
      ...schemaDiagnostics,
      `prompt.length=${prompt.length}`
    ]
  });

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

  return wireToDecision(wireSchema.parse(object));
}

export async function generateStepWithRetry(
  model: QuizModel,
  sessionState: z.infer<typeof SessionState>,
  logger?: ModelGenerationLogger
): Promise<ModelNextStepDecision | ModelStepWithFallback> {
  let lastError: unknown;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await generateStepWithModel(model, sessionState, logger);
    } catch (error) {
      lastError = error;
      logger?.({
        type: "attempt-failed",
        message: "Model structured generation attempt failed.",
        details: [`attempt=${attempt + 1}`],
        error
      });
    }
  }

  return {
    type: "step",
    step: buildFallbackStep(sessionState.config, sessionState.history.length),
    fallbackReason: "generation_failed",
    error: lastError
  } as const;
}
