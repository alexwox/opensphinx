import { generateObject } from "ai";
import { z } from "zod";

import { SessionState } from "../schemas";

import { buildPrompt } from "./prompt-builder";
import { buildFallbackStep } from "./step-helpers";
import {
  createNextStepWireSchema,
  type ModelNextStepDecision,
  wireToDecision,
} from "./model-output";

export type QuizModel = Parameters<typeof generateObject>[0]["model"];

export type ModelStepWithFallback = Extract<ModelNextStepDecision, { type: "step" }> & {
  readonly fallbackReason?: "generation_failed";
  readonly error?: unknown;
};

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
