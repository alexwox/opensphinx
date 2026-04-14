import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { generateObjectMock } = vi.hoisted(() => ({
  generateObjectMock: vi.fn()
}));

vi.mock("ai", () => ({
  generateObject: generateObjectMock
}));

import { createQuizEngine } from "opensphinx/engine";
import { SphinxQuiz } from "opensphinx/react";
import {
  EngineBatchResponse,
  EngineResponse,
  EngineStepResponse,
  QuestionSpec,
  QuizConfig,
  SessionState,
  Step
} from "opensphinx/schemas";

describe("opensphinx public exports", () => {
  const baseConfig = {
    id: "work-style",
    name: "Work Style",
    description: "Find a user's work style.",
    systemPrompt: "Ask clear questions.",
    goals: ["Understand collaboration preferences"],
    scoringDimensions: [
      {
        id: "collaboration",
        name: "Collaboration",
        description: "How collaborative the user prefers to be."
      }
    ]
  } satisfies Parameters<typeof QuizConfig.parse>[0];

  beforeEach(() => {
    generateObjectMock.mockReset();
  });

  it("resolves the engine subpath", () => {
    expect(typeof createQuizEngine).toBe("function");
  });

  it("resolves the react subpath", () => {
    expect(typeof SphinxQuiz).toBe("function");
  });

  it("renders the React quiz surface", () => {
    const html = renderToStaticMarkup(
      React.createElement(SphinxQuiz, {
        question: QuestionSpec.parse({
          type: "mcq",
          question: "How do you prefer to work?",
          options: ["Solo", "Pair", "Team"]
        }),
        onAnswer: () => undefined,
        progress: {
          current: 1,
          max: 3
        }
      })
    );

    expect(html).toContain("How do you prefer to work?");
    expect(html).toContain("Continue");
    expect(html).toContain("1 / 3");
    expect(html).toContain("Solo");
  });

  it("renders a loading state in the React quiz surface", () => {
    const html = renderToStaticMarkup(
      React.createElement(SphinxQuiz, {
        question: QuestionSpec.parse({
          type: "free_text",
          question: "Tell us more."
        }),
        isLoading: true,
        onAnswer: () => undefined
      })
    );

    expect(html).toContain("Preparing the next question");
  });

  it("resolves the schemas subpath", async () => {
    const schemasModule = await import("opensphinx/schemas");

    expect(schemasModule.QuestionSpec).toBe(QuestionSpec);
    expect(schemasModule.QuizConfig).toBe(QuizConfig);
  });

  it("parses shared schema contracts", () => {
    const question = QuestionSpec.parse({
      type: "mcq",
      question: "How do you prefer to work?",
      options: ["Solo", "Pair", "Team"]
    });

    const config = QuizConfig.parse({
      ...baseConfig,
      seedQuestions: [question]
    });

    const session = SessionState.parse({
      sessionId: "session_123",
      config,
      history: [
        {
          question,
          answer: "Solo"
        }
      ]
    });

    const response = EngineResponse.parse({
      type: "question",
      question
    });

    expect(question).toMatchObject({
      type: "mcq",
      allowMultiple: false
    });
    expect(config.batchSize).toBe(3);
    expect(config.language).toBe("en");
    expect(session.pendingQuestions).toEqual([]);
    expect(session.pendingSteps).toEqual([]);
    expect(session.completedSteps).toBe(0);
    expect(session.history).toHaveLength(1);
    expect(response.type).toBe("question");
  });

  it("normalizes config defaults in the engine", () => {
    const engine = createQuizEngine({
      config: baseConfig
    });

    expect(engine.config.minQuestions).toBe(5);
    expect(engine.config.maxQuestions).toBe(15);
    expect(engine.config.batchSize).toBe(3);
    expect(engine.config.maxSteps).toBeUndefined();
    expect(engine.config.language).toBe("en");
  });

  it("exposes the step schema and step response schema", () => {
    const step = Step.parse({
      questions: [
        {
          type: "yes_no",
          question: "Do you enjoy dynamic forms?"
        }
      ]
    });

    const response = EngineStepResponse.parse({
      type: "step",
      step
    });

    expect(step.questions).toHaveLength(1);
    expect(response.type).toBe("step");
  });

  it("serves explicit seed steps through generateStep", async () => {
    const engine = createQuizEngine({
      config: {
        ...baseConfig,
        batchSize: 2,
        seedSteps: [
          {
            questions: [
              {
                type: "yes_no",
                question: "Do you enjoy pair programming?"
              }
            ]
          },
          {
            questions: [
              {
                type: "free_text",
                question: "What makes collaboration effective for you?",
                maxLength: 500
              }
            ]
          }
        ]
      }
    });

    const response = await engine.generateStep({
      sessionId: "session_seed_step",
      config: engine.config,
      history: [],
      completedSteps: 1
    });

    expect(response).toMatchObject({
      type: "step"
    });
    if (response.type !== "step") {
      throw new Error("Expected a seed step.");
    }
    expect(response.step.questions[0]?.type).toBe("free_text");
  });

  it("serves seed batches before AI or fallback questions", async () => {
    const engine = createQuizEngine({
      config: {
        ...baseConfig,
        minQuestions: 2,
        maxQuestions: 4,
        batchSize: 2,
        seedQuestions: [
          {
            type: "yes_no",
            question: "Do you enjoy pair programming?"
          },
          {
            type: "free_text",
            question: "What makes collaboration effective for you?",
            maxLength: 500
          }
        ]
      }
    });

    const response = await engine.generateBatch({
      sessionId: "session_seed",
      config: engine.config,
      history: []
    });

    expect(response).toMatchObject({
      type: "questions"
    });
    if (response.type !== "questions") {
      throw new Error("Expected a questions batch.");
    }
    expect(response.questions).toHaveLength(2);
    expect(response.questions[0]?.type).toBe("yes_no");
    expect(response.questions[1]?.type).toBe("free_text");
  });

  it("uses pending questions before generating a new batch", async () => {
    const engine = createQuizEngine({
      config: {
        ...baseConfig,
        batchSize: 2
      }
    });

    const response = await engine.generateNext({
      sessionId: "session_pending",
      config: engine.config,
      history: [],
      pendingQuestions: [
        {
          type: "rating",
          question: "How satisfied are you?",
          max: 5
        }
      ]
    });

    expect(response).toMatchObject({
      type: "question",
      question: {
        type: "rating"
      }
    });
  });

  it("uses pending steps before generating a new step", async () => {
    const engine = createQuizEngine({
      config: {
        ...baseConfig,
        batchSize: 2
      }
    });

    const response = await engine.generateStep({
      sessionId: "session_pending_step",
      config: engine.config,
      history: [],
      pendingSteps: [
        {
          questions: [
            {
              type: "slider",
              question: "How ready is your team?",
              min: 1,
              max: 10,
              step: 1
            }
          ]
        }
      ]
    });

    expect(response).toMatchObject({
      type: "step"
    });
    if (response.type !== "step") {
      throw new Error("Expected a pending step.");
    }
    expect(response.step.questions[0]?.type).toBe("slider");
  });

  it("falls back to a generic question before minimum completion", async () => {
    const engine = createQuizEngine({
      config: {
        ...baseConfig,
        minQuestions: 3,
        maxQuestions: 4
      }
    });

    const response = await engine.generateNext({
      sessionId: "session_fallback",
      config: engine.config,
      history: [
        {
          question: {
            type: "yes_no",
            question: "Do you enjoy remote work?"
          },
          answer: true
        }
      ]
    });

    expect(response).toMatchObject({
      type: "question",
      question: {
        type: "free_text"
      }
    });
  });

  it("uses the AI model to generate the next batch", async () => {
    generateObjectMock.mockResolvedValueOnce({
      object: {
        type: "step",
        step: {
          questions: [
            {
              type: "rating",
              question: "How confident are you in your onboarding process?",
              max: 5
            },
            {
              type: "free_text",
              question: "What part of onboarding feels weakest?",
              maxLength: 500
            }
          ]
        }
      }
    });

    const engine = createQuizEngine({
      model: {} as never,
      config: {
        ...baseConfig,
        batchSize: 2,
        minQuestions: 3,
        maxQuestions: 5
      }
    });

    const response = await engine.generateBatch({
      sessionId: "session_ai_question",
      config: engine.config,
      history: [
        {
          question: {
            type: "yes_no",
            question: "Do you have a documented onboarding flow?"
          },
          answer: true
        }
      ]
    });

    expect(generateObjectMock).toHaveBeenCalledTimes(1);
    expect(response).toMatchObject({
      type: "questions"
    });
    if (response.type !== "questions") {
      throw new Error("Expected an AI-generated questions batch.");
    }
    expect(response.questions).toHaveLength(2);
    expect(response.questions[0]?.type).toBe("rating");
  });

  it("allows the AI model to complete once minimum questions are met", async () => {
    generateObjectMock.mockResolvedValueOnce({
      object: {
        type: "complete"
      }
    });

    const engine = createQuizEngine({
      model: {} as never,
      config: {
        ...baseConfig,
        minQuestions: 1,
        maxQuestions: 5
      }
    });

    const response = await engine.generateBatch({
      sessionId: "session_ai_complete",
      config: engine.config,
      history: [
        {
          question: {
            type: "yes_no",
            question: "Do you like typed APIs?"
          },
          answer: true
        }
      ]
    });

    expect(response).toMatchObject({
      type: "complete"
    });
  });

  it("respects a hard maxSteps limit even if more questions could be asked", async () => {
    const engine = createQuizEngine({
      config: {
        ...baseConfig,
        minQuestions: 1,
        maxQuestions: 10,
        maxSteps: 2
      }
    });

    const response = await engine.generateStep({
      sessionId: "session_max_steps",
      config: engine.config,
      completedSteps: 2,
      history: [
        {
          question: {
            type: "yes_no",
            question: "Do you like typed APIs?"
          },
          answer: true
        }
      ]
    });

    expect(response).toMatchObject({
      type: "complete"
    });
  });

  it("retries once and then falls back to a generated batch when AI generation fails", async () => {
    generateObjectMock
      .mockRejectedValueOnce(new Error("bad object"))
      .mockRejectedValueOnce(new Error("still bad"));

    const engine = createQuizEngine({
      model: {} as never,
      config: {
        ...baseConfig,
        minQuestions: 3,
        maxQuestions: 5
      }
    });

    const response = await engine.generateBatch({
      sessionId: "session_ai_retry",
      config: engine.config,
      history: [
        {
          question: {
            type: "yes_no",
            question: "Do you use AI in production?"
          },
          answer: true
        }
      ]
    });

    expect(generateObjectMock).toHaveBeenCalledTimes(2);
    expect(response).toMatchObject({
      type: "questions"
    });
    if (response.type !== "questions") {
      throw new Error("Expected a fallback questions batch.");
    }
    expect(response.questions.length).toBeGreaterThan(0);
    expect(response.questions[0]?.type).toBe("free_text");
  });

  it("completes with scaffold scores and report output", async () => {
    const engine = createQuizEngine({
      config: {
        ...baseConfig,
        minQuestions: 1,
        maxQuestions: 3
      }
    });

    const session = SessionState.parse({
      sessionId: "session_complete",
      config: engine.config,
      history: [
        {
          question: {
            type: "yes_no",
            question: "Do you like typed APIs?"
          },
          answer: true
        }
      ]
    });

    const next = await engine.generateNext(session);
    const scores = await engine.score(session);
    const report = await engine.generateReport(session, scores);

    expect(next).toMatchObject({
      type: "complete"
    });
    expect(scores.dimensions).toHaveLength(1);
    expect(scores.dimensions[0]?.id).toBe("collaboration");
    expect(report).toContain('Report for "Work Style"');
  });

  it("exposes the batched engine response schema", () => {
    const batch = EngineBatchResponse.parse({
      type: "questions",
      questions: [
        {
          type: "yes_no",
          question: "Do you enjoy dynamic forms?"
        }
      ]
    });

    expect(batch.type).toBe("questions");
  });

  it("preserves consumer-facing types", () => {
    const typedQuestion: QuestionSpec = {
      type: "yes_no",
      question: "Do you like typed APIs?"
    };

    expect(typedQuestion.type).toBe("yes_no");
  });
});
