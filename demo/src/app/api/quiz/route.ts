import { openai } from "@ai-sdk/openai";
import { NextResponse } from "next/server";
import { z } from "zod";

import { createQuizEngine } from "opensphinx/engine";
import {
  EngineStepResponse,
  ScoreResult,
  SessionState
} from "opensphinx/schemas";

import { demoQuizConfig } from "../../../lib/quiz-config";

export const dynamic = "force-dynamic";

const QuizRequest = z.object({
  session: SessionState,
  scores: ScoreResult.optional()
});

function getDemoEngine() {
  const model = process.env.OPENAI_API_KEY
    ? openai("gpt-4o-mini")
    : undefined;

  return createQuizEngine({
    model,
    config: demoQuizConfig
  });
}

export async function POST(request: Request) {
  try {
    const payload = QuizRequest.parse(await request.json());
    const engine = getDemoEngine();
    const session = SessionState.parse({
      ...payload.session,
      config: engine.config
    });

    const next = await engine.generateStep(session);

    if (next.type === "complete") {
      const report = await engine.generateReport(session, next.scores);

      return NextResponse.json({
        next: EngineStepResponse.parse(next),
        report
      });
    }

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
