# OpenSphinx

OpenSphinx is the open-source AI quiz engine that asks smarter questions.

> Alpha release: OpenSphinx is usable today, but the API may still evolve and production deployments should keep session state authoritative on the server.

It is one package with three explicit imports:

- `opensphinx/schemas`
- `opensphinx/engine`
- `opensphinx/react`

The supported workflow is intentionally narrow:

1. Build a `QuizConfig`.
2. Store runtime progress in `SessionState`.
3. Call `createQuizEngine({ model, config }).generateStep(session)` on the server.
4. Render the returned `Step` with `SphinxQuiz`.
5. Append answers to `session.history`, increment `completedSteps`, and repeat until the engine returns `complete`.

## Core Mental Model

`SessionState` and `Step` are the runtime source of truth.

```text
SessionState -> generateStep() -> EngineStepResponse -> Step -> SphinxQuiz -> updated SessionState
```

`generateStep()` is the only supported engine generation path.

`SphinxQuiz` is the only supported React surface.

There is intentionally no root `opensphinx` catch-all export.

## Installation

Install the package, your AI SDK provider, and React if you use the UI.

```bash
pnpm add opensphinx @ai-sdk/openai
pnpm add react react-dom
```

OpenSphinx pins `zod@3.25.x` internally because the current AI SDK structured-output path is not compatible with Zod v4 for this use case.
You do not need to install `ai` or `zod` separately unless your app uses them directly.

## The 3 Imports

```ts
import { createQuizEngine } from "opensphinx/engine";
import { SphinxQuiz } from "opensphinx/react";
import type {
  AnswerValue,
  EngineStepResponse,
  QuestionSpec,
  QuizConfig,
  SessionState,
  Step
} from "opensphinx/schemas";
```

## Minimal Config Example

This is the main place to define your system prompt, seeds, and hard limits.

```ts
import type { QuizConfig } from "opensphinx/schemas";

export const quizConfig: QuizConfig = {
  id: "ai-readiness-audit",
  name: "AI Readiness Audit",
  description: "Evaluate how prepared a team is to adopt AI into daily work.",
  systemPrompt:
    "You are running a concise AI readiness audit. Ask concrete, structured questions. After the developer-provided seed steps, ask adaptive follow-up questions only when they add new information. Return complete as soon as you have enough signal.",
  goals: [
    "Understand current team process maturity",
    "Identify blockers to AI adoption",
    "Estimate readiness for day-to-day AI usage"
  ],
  minQuestions: 6,
  maxQuestions: 10,
  minSteps: 3,
  maxSteps: 5,
  batchSize: 2,
  scoringDimensions: [
    {
      id: "process-maturity",
      name: "Process Maturity",
      description: "How structured and documented the team's workflows are."
    }
  ],
  seedSteps: [
    {
      questions: [
        {
          type: "yes_no",
          question: "Do you already use AI tools in any recurring workflow?"
        },
        {
          type: "rating",
          question: "How clearly documented are your core team processes?",
          max: 5
        }
      ]
    }
  ],
  language: "en"
};
```

## Server Example

The engine is framework-agnostic. You give it a config and any AI SDK-compatible model.

```ts
import { openai } from "@ai-sdk/openai";
import { createQuizEngine } from "opensphinx/engine";
import type { SessionState } from "opensphinx/schemas";

import { quizConfig } from "./quiz-config";

const engine = createQuizEngine({
  model: openai("gpt-4o-mini"),
  config: quizConfig
});

export async function getNextStep(session: SessionState) {
  return engine.generateStep(session);
}
```

If you omit `model`, the engine still serves seed steps and can fall back safely for local development.

## Client Example With `SphinxQuiz`

`SphinxQuiz` renders one question at a time from the current `Step`. If you pass `onRequestPrefetch`, it can append more steps in the background.

```tsx
"use client";

import { useState } from "react";
import { SphinxQuiz } from "opensphinx/react";
import type { Step } from "opensphinx/schemas";

export function QuizScreen({
  firstStep,
  loadMore
}: {
  readonly firstStep: Step;
  readonly loadMore: () => Promise<Step | null>;
}) {
  const [steps, setSteps] = useState<readonly Step[]>([firstStep]);
  const [isComplete, setIsComplete] = useState(false);

  if (isComplete) {
    return <p>Quiz complete.</p>;
  }

  return (
    <SphinxQuiz
      steps={steps}
      prefetchWhenRemainingSteps={0}
      onRequestPrefetch={async () => {
        const nextStep = await loadMore();

        if (!nextStep) {
          setIsComplete(true);
          return { type: "complete" };
        }

        setSteps((current) => [...current, nextStep]);
        return { type: "steps", steps: [nextStep] };
      }}
    />
  );
}
```

## Seed Questions And Seed Steps

Use `seedSteps` when you want exact step boundaries from the start.

```ts
seedSteps: [
  {
    questions: [
      { type: "yes_no", question: "Do you already use AI tools?" },
      { type: "free_text", question: "Where are you testing AI today?" }
    ]
  }
];
```

Use `seedQuestions` when you just want a flat list. OpenSphinx will group them into steps using `batchSize`.

```ts
seedQuestions: [
  { type: "yes_no", question: "Do you already use AI tools?" },
  { type: "free_text", question: "Where are you testing AI today?" },
  { type: "rating", question: "How mature is your documentation?", max: 5 }
];
```

If you care about the exact opening flow, prefer `seedSteps`.

## System Prompt Guidance

Keep the system prompt focused on quiz behavior, not UI instructions.

- Tell the model what information it is trying to learn.
- Tell it when to stop and return `complete`.
- Tell it to avoid repeating known questions.
- Tell it to prefer structured, specific follow-ups over vague prompts.
- Keep product rules in `systemPrompt`; keep hard limits in `QuizConfig`.

## Provider Injection

OpenSphinx does not care whether you use OpenAI, Anthropic, or another AI SDK-compatible provider.

OpenAI:

```ts
import { openai } from "@ai-sdk/openai";

const engine = createQuizEngine({
  model: openai("gpt-4o-mini"),
  config: quizConfig
});
```

Anthropic:

```ts
import { anthropic } from "@ai-sdk/anthropic";

const engine = createQuizEngine({
  model: anthropic("claude-3-5-sonnet-latest"),
  config: quizConfig
});
```

Provider-agnostic pattern:

```ts
import { createQuizEngine } from "opensphinx/engine";

type QuizModel = Parameters<typeof createQuizEngine>[0]["model"];

export function buildEngine(model: QuizModel) {
  return createQuizEngine({
    model,
    config: quizConfig
  });
}
```

## Step Limits And Question Limits

These fields shape how long the quiz can run:

- `batchSize`: preferred number of questions in each generated step.
- `minQuestions`: minimum total answered questions before completion is allowed.
- `maxQuestions`: hard cap on total answered questions.
- `minSteps`: minimum completed steps before completion is allowed.
- `maxSteps`: hard cap on completed steps.

Example:

```ts
const quizConfig: QuizConfig = {
  // ...
  batchSize: 2,
  minQuestions: 6,
  maxQuestions: 10,
  minSteps: 3,
  maxSteps: 5
};
```

## Full Session Flow Example

This is the core loop the package is built around.

For a production deployment, keep the authoritative session on the server instead of trusting client-submitted session state directly. The example below keeps state in the client only to show the package loop as simply as possible.

```tsx
"use client";

import { useState } from "react";
import { SphinxQuiz } from "opensphinx/react";
import type {
  AnswerValue,
  EngineStepResponse,
  SessionState,
  Step
} from "opensphinx/schemas";

import { quizConfig } from "./quiz-config";

function buildSession(): SessionState {
  return {
    sessionId: crypto.randomUUID(),
    config: quizConfig,
    history: [],
    pendingSteps: [],
    completedSteps: 0
  };
}

async function requestNextStep(session: SessionState): Promise<EngineStepResponse> {
  const response = await fetch("/api/quiz", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ session })
  });

  return response.json();
}

function appendStepAnswers(
  session: SessionState,
  step: Step,
  answers: AnswerValue[]
): SessionState {
  return {
    ...session,
    history: [
      ...session.history,
      ...step.questions.map((question, index) => ({
        question,
        answer: answers[index] as AnswerValue
      }))
    ],
    completedSteps: session.completedSteps + 1
  };
}

export function QuizFlow() {
  const [session, setSession] = useState<SessionState>(() => buildSession());
  const [steps, setSteps] = useState<readonly Step[]>([]);
  const [isComplete, setIsComplete] = useState(false);

  async function start() {
    const next = await requestNextStep(session);

    if (next.type === "complete") {
      setIsComplete(true);
      return;
    }

    setSteps([next.step]);
  }

  if (isComplete) {
    return <p>Quiz complete.</p>;
  }

  if (steps.length === 0) {
    return <button onClick={start}>Start quiz</button>;
  }

  return (
    <SphinxQuiz
      steps={steps}
      prefetchWhenRemainingSteps={0}
      onRequestPrefetch={async ({ submission }) => {
        const nextSession = appendStepAnswers(
          session,
          submission.step,
          submission.answers
        );

        setSession(nextSession);

        const next = await requestNextStep(nextSession);

        if (next.type === "complete") {
          setIsComplete(true);
          return { type: "complete", scores: next.scores };
        }

        return { type: "steps", steps: [next.step] };
      }}
    />
  );
}
```

## Demo And Development Commands

Install dependencies:

```bash
pnpm install
```

Build, typecheck, and test the package:

```bash
pnpm build
pnpm typecheck
pnpm test
```

Run the demo app:

```bash
pnpm dev
```

To let the demo use a real model, add `OPENAI_API_KEY` in a place the Next.js app can read, such as `apps/demo/.env.local`. Without it, the demo still exercises the seed-first step flow using fallback behavior.
