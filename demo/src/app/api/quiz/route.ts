import { NextResponse } from "next/server";
import { z } from "zod";

import { createQuizEngine } from "opensphinx/engine";
import { EngineStepResponse, SessionState } from "opensphinx/schemas";

import { demoQuizConfig } from "../../../lib/quiz-config";

export const dynamic = "force-dynamic";

const QuizRequest = z.object({
  session: SessionState
});

async function getDemoEngine() {
  let model: Parameters<typeof createQuizEngine>[0]["model"];

  if (process.env.OPENAI_API_KEY) {
    const { openai } = await import("@ai-sdk/openai");
    model = openai("gpt-4o-mini");
  }

  return createQuizEngine({
    model,
    config: demoQuizConfig
  });
}

export async function POST(request: Request) {
  try {
    const payload = QuizRequest.parse(await request.json());
    const engine = await getDemoEngine();
    const session = SessionState.parse({
      ...payload.session,
      config: engine.config
    });

    const next = await engine.generateStep(session);

    return NextResponse.json({
      next: EngineStepResponse.parse(next)
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected quiz route error.";

    return NextResponse.json(
      {
        error: message
      },
      {
        status: 400
      }
    );
  }
}
