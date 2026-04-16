import { NextResponse } from "next/server";
import { z } from "zod";

import { createQuizEngine, type EngineLogEvent } from "opensphinx/engine";
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

async function getDemoEngine() {
  let model: Parameters<typeof createQuizEngine>[0]["model"];

  if (process.env.OPENAI_API_KEY) {
    const { openai } = await import("@ai-sdk/openai");
    model = openai("gpt-4o-mini");
  }

  const logger = (event: EngineLogEvent) => {
    const details = [
      `type=${event.type}`,
      `session=${event.sessionId}`,
      `history=${event.historyCount}`,
      `steps=${event.completedSteps}`
    ];

    if (event.questionCount !== undefined) {
      details.push(`questions=${event.questionCount}`);
    }

    if (event.duplicateCount !== undefined) {
      details.push(`duplicates=${event.duplicateCount}`);
    }

    if (event.error) {
      details.push(`error=${event.error}`);
    }

    if (event.details && event.details.length > 0) {
      details.push(...event.details);
    }

    console.info(`[opensphinx-demo] ${event.message} (${details.join(", ")})`);
  };

  return createQuizEngine({
    model,
    config: demoQuizConfig,
    logger
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
