import { describe, expect, it } from "vitest";

import { createQuizEngine } from "opensphinx/engine";
import { SphinxQuiz } from "opensphinx/react";
import {
  EngineResponse,
  QuestionSpec,
  QuizConfig,
  SessionState
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

  it("resolves the engine subpath", () => {
    expect(typeof createQuizEngine).toBe("function");
  });

  it("resolves the react subpath", () => {
    expect(typeof SphinxQuiz).toBe("function");
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
    expect(config.language).toBe("en");
    expect(session.history).toHaveLength(1);
    expect(response.type).toBe("question");
  });

  it("normalizes config defaults in the engine", () => {
    const engine = createQuizEngine({
      config: baseConfig
    });

    expect(engine.config.minQuestions).toBe(5);
    expect(engine.config.maxQuestions).toBe(15);
    expect(engine.config.language).toBe("en");
  });

  it("serves seed questions before fallback questions", async () => {
    const engine = createQuizEngine({
      config: {
        ...baseConfig,
        minQuestions: 2,
        maxQuestions: 4,
        seedQuestions: [
          {
            type: "yes_no",
            question: "Do you enjoy pair programming?"
          }
        ]
      }
    });

    const response = await engine.generateNext({
      sessionId: "session_seed",
      config: engine.config,
      history: []
    });

    expect(response).toMatchObject({
      type: "question",
      question: {
        type: "yes_no",
        question: "Do you enjoy pair programming?"
      }
    });
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

  it("preserves consumer-facing types", () => {
    const typedQuestion: QuestionSpec = {
      type: "yes_no",
      question: "Do you like typed APIs?"
    };

    expect(typedQuestion.type).toBe("yes_no");
  });
});
