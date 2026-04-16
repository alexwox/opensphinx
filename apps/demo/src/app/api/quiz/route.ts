import { NextResponse } from "next/server";
import { z } from "zod";

import { createQuizEngine } from "opensphinx/engine";
import { EngineStepResponse, SessionState } from "opensphinx/schemas";

import { demoQuizConfig } from "../../../lib/quiz-config";
import { getClientRateLimitKey, takeRateLimit } from "../../../lib/rate-limit";

export const dynamic = "force-dynamic";

const QuizRequest = z.object({
  session: SessionState
});

const DEMO_RATE_LIMIT_MAX_REQUESTS = Number.parseInt(
  process.env.DEMO_RATE_LIMIT_MAX_REQUESTS ?? "20",
  10
);
const DEMO_RATE_LIMIT_WINDOW_MS = Number.parseInt(
  process.env.DEMO_RATE_LIMIT_WINDOW_MS ?? `${60_000}`,
  10
);

function buildRateLimitHeaders(rateLimit: {
  readonly limit: number;
  readonly remaining: number;
  readonly resetAt: number;
}) {
  return {
    "X-RateLimit-Limit": `${rateLimit.limit}`,
    "X-RateLimit-Remaining": `${rateLimit.remaining}`,
    "X-RateLimit-Reset": `${Math.ceil(rateLimit.resetAt / 1000)}`
  };
}

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
  const rateLimit = takeRateLimit({
    key: getClientRateLimitKey(request),
    limit: DEMO_RATE_LIMIT_MAX_REQUESTS,
    windowMs: DEMO_RATE_LIMIT_WINDOW_MS
  });

  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        error:
          "Too many demo requests from this client. Please wait a moment and try again."
      },
      {
        status: 429,
        headers: {
          ...buildRateLimitHeaders(rateLimit),
          "Retry-After": `${rateLimit.retryAfterSeconds}`
        }
      }
    );
  }

  try {
    const payload = QuizRequest.parse(await request.json());
    const engine = await getDemoEngine();
    const session = SessionState.parse({
      ...payload.session,
      config: engine.config
    });

    const next = await engine.generateStep(session);

    return NextResponse.json(
      {
        next: EngineStepResponse.parse(next)
      },
      {
        headers: buildRateLimitHeaders(rateLimit)
      }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected quiz route error.";

    return NextResponse.json(
      {
        error: message
      },
      {
        status: 400,
        headers: buildRateLimitHeaders(rateLimit)
      }
    );
  }
}
