import { generateObject } from "ai";
import { z } from "zod";

import { QuestionSpec, SessionState } from "../schemas";

import { buildPrompt } from "./prompt-builder";
import { buildFallbackStep } from "./step-helpers";

export type QuizModel = Parameters<typeof generateObject>[0]["model"];

function createNextStepDecisionSchema(batchSize: number) {
  return z.discriminatedUnion("type", [
    z.object({
      type: z.literal("step"),
      step: z.object({
        questions: z.array(QuestionSpec).min(1).max(batchSize)
      })
    }),
    z.object({
      type: z.literal("complete")
    })
  ]);
}

export type ModelNextStepDecision = z.infer<
  ReturnType<typeof createNextStepDecisionSchema>
>;

export type ModelStepWithFallback = Extract<ModelNextStepDecision, { type: "step" }> & {
  readonly fallbackReason?: "generation_failed";
  readonly error?: unknown;
};

export async function generateStepWithModel(
  model: QuizModel,
  sessionState: z.infer<typeof SessionState>
) {
  const prompt = buildPrompt(sessionState, sessionState.config.batchSize);
  const NextStepDecision = createNextStepDecisionSchema(
    sessionState.config.batchSize
  );

  const { object } = await generateObject({
    model,
    schema: NextStepDecision,
    schemaName: "OpenSphinxNextStep",
    schemaDescription:
      "Decide whether to return the next quiz step or mark the quiz complete.",
    prompt,
    maxRetries: 0
  });

  return NextStepDecision.parse(object);
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
