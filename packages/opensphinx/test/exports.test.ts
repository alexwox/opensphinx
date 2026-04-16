import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { generateObjectMock } = vi.hoisted(() => ({
  generateObjectMock: vi.fn()
}));

vi.mock("ai", () => ({
  generateObject: generateObjectMock,
  asSchema: () => ({
    jsonSchema: {
      type: "object",
      properties: {
        questions: {
          anyOf: [
            {
              type: "array",
              items: {
                anyOf: [
                  {
                    properties: {
                      type: { const: "yes_no" },
                      question: { type: "string" }
                    },
                    required: ["type", "question"]
                  }
                ]
              }
            },
            { type: "null" }
          ]
        }
      },
      required: ["type", "questions"]
    }
  })
}));

import { createFormEngine } from "opensphinx/engine";
import { SphinxForm } from "opensphinx/react";
import {
  EngineStepResponse,
  QuestionSpec,
  FormConfig,
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
  } satisfies Parameters<typeof FormConfig.parse>[0];

  beforeEach(() => {
    generateObjectMock.mockReset();
  });

  it("resolves the engine subpath", () => {
    expect(typeof createFormEngine).toBe("function");
  });

  it("keeps the engine runtime surface minimal", async () => {
    const engineModule = await import("opensphinx/engine");

    expect(Object.keys(engineModule).sort()).toEqual(["createFormEngine"]);
  });

  it("resolves the react subpath", () => {
    expect(typeof SphinxForm).toBe("function");
  });

  it("keeps the react runtime surface minimal", async () => {
    const reactModule = await import("opensphinx/react");

    expect(Object.keys(reactModule).sort()).toEqual(["SphinxForm"]);
  });

  it("renders the React form surface", () => {
    const html = renderToStaticMarkup(
      React.createElement(SphinxForm, {
        steps: [
          {
            questions: [
              QuestionSpec.parse({
                type: "mcq",
                question: "How do you prefer to work?",
                options: ["Solo", "Pair", "Team"]
              }),
              QuestionSpec.parse({
                type: "yes_no",
                question: "Do you enjoy pair programming?"
              })
            ]
          }
        ],
        progress: {
          current: 1,
          max: 3
        }
      })
    );

    expect(html).toContain("How do you prefer to work?");
    expect(html).toContain("Do you enjoy pair programming?");
    expect(html).toContain("Next");
    expect(html).toContain("1 / 3");
    expect(html).toContain("Solo");
  });

  it("renders a loading state in the React form surface", () => {
    const html = renderToStaticMarkup(
      React.createElement(SphinxForm, {
        steps: [
          {
            questions: [
              QuestionSpec.parse({
                type: "free_text",
                question: "Tell us more."
              })
            ]
          }
        ],
        isLoading: true
      })
    );

    expect(html).toContain("Preparing the next question");
  });

  it("resolves the schemas subpath", async () => {
    const schemasModule = await import("opensphinx/schemas");

    expect(schemasModule.QuestionSpec).toBe(QuestionSpec);
    expect(schemasModule.FormConfig).toBe(FormConfig);
  });

  it("parses shared schema contracts", () => {
    const question = QuestionSpec.parse({
      type: "mcq",
      question: "How do you prefer to work?",
      options: ["Solo", "Pair", "Team"]
    });

    const config = FormConfig.parse({
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

    const step = Step.parse({ questions: [question] });
    const response = EngineStepResponse.parse({
      type: "step",
      step
    });

    expect(question).toMatchObject({
      type: "mcq",
      allowMultiple: false
    });
    expect(config.batchSize).toBe(3);
    expect(config.language).toBe("en");
    expect(session.pendingSteps).toEqual([]);
    expect(session.completedSteps).toBe(0);
    expect(session.history).toHaveLength(1);
    expect(response.type).toBe("step");
  });

  it("normalizes config defaults in the engine", () => {
    const engine = createFormEngine({
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
    const engine = createFormEngine({
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

  it("serves seed questions as a step from generateStep", async () => {
    const engine = createFormEngine({
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

    const response = await engine.generateStep({
      sessionId: "session_seed",
      config: engine.config,
      history: []
    });

    expect(response).toMatchObject({
      type: "step"
    });
    if (response.type !== "step") {
      throw new Error("Expected a step.");
    }
    expect(response.step.questions).toHaveLength(2);
    expect(response.step.questions[0]?.type).toBe("yes_no");
    expect(response.step.questions[1]?.type).toBe("free_text");
  });

  it("uses pending steps before generating a new step", async () => {
    const engine = createFormEngine({
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

  it("falls back to a generic step before minimum completion", async () => {
    const engine = createFormEngine({
      config: {
        ...baseConfig,
        minQuestions: 3,
        maxQuestions: 4
      }
    });

    const response = await engine.generateStep({
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
      type: "step"
    });
    if (response.type !== "step") {
      throw new Error("Expected a step.");
    }
    expect(response.step.questions[0]?.type).toBe("free_text");
  });

  it("uses the AI model to generate the next step", async () => {
    generateObjectMock.mockResolvedValueOnce({
      object: {
        type: "step",
        questions: [
          {
            type: "rating",
            question: "How confident are you in your onboarding process?",
            max: 5,
            labels: null
          },
          {
            type: "free_text",
            question: "What part of onboarding feels weakest?",
            placeholder: null,
            maxLength: 500
          }
        ]
      }
    });

    const engine = createFormEngine({
      model: {} as never,
      config: {
        ...baseConfig,
        batchSize: 2,
        minQuestions: 3,
        maxQuestions: 5
      }
    });

    const response = await engine.generateStep({
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
      type: "step"
    });
    if (response.type !== "step") {
      throw new Error("Expected an AI-generated step.");
    }
    expect(response.step.questions).toHaveLength(2);
    expect(response.step.questions[0]?.type).toBe("rating");
  });

  it("filters duplicate AI-generated questions against history", async () => {
    generateObjectMock.mockResolvedValueOnce({
      object: {
        type: "step",
        questions: [
          {
            type: "yes_no",
            question: "Do you have a documented onboarding flow?"
          },
          {
            type: "free_text",
            question: "What part of onboarding feels weakest?",
            placeholder: null,
            maxLength: 500
          }
        ]
      }
    });

    const engine = createFormEngine({
      model: {} as never,
      config: {
        ...baseConfig,
        batchSize: 2,
        minQuestions: 3,
        maxQuestions: 5
      }
    });

    const response = await engine.generateStep({
      sessionId: "session_dedup",
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

    expect(response).toMatchObject({
      type: "step"
    });
    if (response.type !== "step") {
      throw new Error("Expected a sanitized step response.");
    }
    expect(response.step.questions).toHaveLength(1);
    expect(response.step.questions[0]?.question).toBe(
      "What part of onboarding feels weakest?"
    );
  });

  it("falls back when the AI only returns duplicate questions", async () => {
    generateObjectMock.mockResolvedValueOnce({
      object: {
        type: "step",
        questions: [
          {
            type: "yes_no",
            question: "Do you have a documented onboarding flow?"
          }
        ]
      }
    });

    const engine = createFormEngine({
      model: {} as never,
      config: {
        ...baseConfig,
        batchSize: 2,
        minQuestions: 3,
        maxQuestions: 5
      }
    });

    const response = await engine.generateStep({
      sessionId: "session_duplicate_fallback",
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

    expect(response).toMatchObject({
      type: "step"
    });
    if (response.type !== "step") {
      throw new Error("Expected a fallback step response.");
    }
    expect(response.step.questions[0]?.type).toBe("free_text");
  });

  it("allows the AI model to complete once minimum questions are met", async () => {
    generateObjectMock.mockResolvedValueOnce({
      object: {
        type: "complete",
        questions: null
      }
    });

    const engine = createFormEngine({
      model: {} as never,
      config: {
        ...baseConfig,
        minQuestions: 1,
        maxQuestions: 5
      }
    });

    const response = await engine.generateStep({
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
    const engine = createFormEngine({
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

  it("retries once and then falls back to a generated step when AI generation fails", async () => {
    generateObjectMock
      .mockRejectedValueOnce(new Error("bad object"))
      .mockRejectedValueOnce(new Error("still bad"));

    const engine = createFormEngine({
      model: {} as never,
      config: {
        ...baseConfig,
        minQuestions: 3,
        maxQuestions: 5
      }
    });

    const response = await engine.generateStep({
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
      type: "step"
    });
    if (response.type !== "step") {
      throw new Error("Expected a fallback step.");
    }
    expect(response.step.questions.length).toBeGreaterThan(0);
    expect(response.step.questions[0]?.type).toBe("free_text");
  });

  it("completes instead of asking generic fallback questions when AI fails after minimums are met", async () => {
    generateObjectMock
      .mockRejectedValueOnce(new Error("bad object"))
      .mockRejectedValueOnce(new Error("still bad"));

    const engine = createFormEngine({
      model: {} as never,
      config: {
        ...baseConfig,
        minQuestions: 4,
        minSteps: 2,
        maxQuestions: 10,
        batchSize: 2
      }
    });

    const response = await engine.generateStep({
      sessionId: "session_failed_after_minimums",
      config: engine.config,
      completedSteps: 2,
      history: [
        {
          question: {
            type: "yes_no",
            question: "Do you already use AI tools in any recurring team workflow?"
          },
          answer: true
        },
        {
          question: {
            type: "rating",
            question: "How clearly documented are your core team processes?",
            max: 5
          },
          answer: 4
        },
        {
          question: {
            type: "mcq",
            question: "Which area feels like the best first AI opportunity?",
            options: ["Research", "Documentation", "Support"],
            allowMultiple: false
          },
          answer: "Documentation"
        },
        {
          question: {
            type: "free_text",
            question: "What is the biggest blocker stopping broader AI adoption today?",
            maxLength: 500
          },
          answer: "Lack of process clarity"
        }
      ]
    });

    expect(generateObjectMock).toHaveBeenCalledTimes(2);
    expect(response).toMatchObject({
      type: "complete"
    });
  });

  it("includes scaffold scores in the complete response", async () => {
    const engine = createFormEngine({
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

    const next = await engine.generateStep(session);

    expect(next.type).toBe("complete");
    if (next.type !== "complete") {
      throw new Error("Expected completion.");
    }
    expect(next.scores.dimensions).toHaveLength(1);
    expect(next.scores.dimensions[0]?.id).toBe("collaboration");
  });

  it("preserves consumer-facing types", () => {
    const typedQuestion: QuestionSpec = {
      type: "yes_no",
      question: "Do you like typed APIs?"
    };

    expect(typedQuestion.type).toBe("yes_no");
  });
});
