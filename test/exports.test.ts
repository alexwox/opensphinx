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
      ],
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

  it("preserves consumer-facing types", () => {
    const typedQuestion: QuestionSpec = {
      type: "yes_no",
      question: "Do you like typed APIs?"
    };

    expect(typedQuestion.type).toBe("yes_no");
  });
});
