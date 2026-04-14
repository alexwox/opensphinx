import { describe, expect, it } from "vitest";

import { createQuizEngine } from "opensphinx/engine";
import { SphinxQuiz } from "opensphinx/react";
import type { QuestionSpec } from "opensphinx/schemas";

describe("opensphinx scaffold exports", () => {
  it("resolves the engine subpath", () => {
    expect(typeof createQuizEngine).toBe("function");
  });

  it("resolves the react subpath", () => {
    expect(typeof SphinxQuiz).toBe("function");
  });

  it("resolves the schemas subpath", async () => {
    const schemasModule = await import("opensphinx/schemas");

    expect(typeof schemasModule).toBe("object");
  });

  it("preserves consumer-facing types", () => {
    const question: QuestionSpec = {
      type: "placeholder",
      question: "Placeholder question"
    };

    expect(question.question).toBe("Placeholder question");
  });
});
