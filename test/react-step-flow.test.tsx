/** @vitest-environment happy-dom */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SphinxQuiz } from "opensphinx/react";

afterEach(() => {
  cleanup();
});

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;

  const promise = new Promise<T>((innerResolve, innerReject) => {
    resolve = innerResolve;
    reject = innerReject;
  });

  return {
    promise,
    resolve,
    reject
  };
}

describe("SphinxQuiz step flow", () => {
  it("renders prefetched steps and advances through them", () => {
    const handleAnswer = vi.fn();
    const handleStepSubmit = vi.fn();
    const handleStepsComplete = vi.fn();

    render(
      <SphinxQuiz
        onAnswer={handleAnswer}
        onStepSubmit={handleStepSubmit}
        onStepsComplete={handleStepsComplete}
        steps={[
          {
            questions: [
              {
                type: "mcq",
                question: "How do you prefer to work?",
                options: ["Solo", "Pair", "Team"],
                allowMultiple: false
              },
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
        ]}
      />
    );

    expect(screen.getByText("How do you prefer to work?")).toBeTruthy();
    expect(screen.getByText("Do you enjoy pair programming?")).toBeTruthy();
    expect(screen.getByText("Step 1 of 2")).toBeTruthy();
    expect(screen.getByText("1 / 2")).toBeTruthy();

    fireEvent.click(screen.getByLabelText("Solo"));
    fireEvent.click(screen.getByRole("button", { name: "Yes" }));
    fireEvent.click(screen.getByRole("button", { name: "Next step" }));

    expect(handleAnswer).toHaveBeenCalledTimes(2);
    expect(handleStepSubmit).toHaveBeenCalledTimes(1);
    expect(handleStepSubmit.mock.calls[0]?.[0]).toMatchObject({
      stepIndex: 0,
      totalSteps: 2,
      remainingSteps: 1,
      answers: ["Solo", true]
    });

    expect(screen.getByText("What makes collaboration effective for you?")).toBeTruthy();
    expect(screen.getByText("Step 2 of 2")).toBeTruthy();

    fireEvent.change(screen.getByRole("textbox"), {
      target: {
        value: "Clear expectations."
      }
    });
    fireEvent.click(screen.getByRole("button", { name: "Submit step" }));

    expect(handleStepSubmit).toHaveBeenCalledTimes(2);
    expect(handleStepsComplete).toHaveBeenCalledTimes(1);
    expect(handleStepsComplete.mock.calls[0]?.[0]).toMatchObject({
      submissions: [
        expect.objectContaining({
          stepIndex: 0
        }),
        expect.objectContaining({
          stepIndex: 1
        })
      ]
    });
    expect(screen.getByText("All queued steps are complete.")).toBeTruthy();
  });

  it("supports a single prefetched step prop", () => {
    render(
      <SphinxQuiz
        step={{
          questions: [
            {
              type: "rating",
              question: "How confident are you in your process?",
              max: 5
            }
          ]
        }}
      />
    );

    expect(screen.getByText("Step 1 of 1")).toBeTruthy();
    expect(screen.getByText("How confident are you in your process?")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Submit step" })).toBeTruthy();
  });

  it("requests and appends more steps when the queue gets low", async () => {
    const deferred = createDeferred<{
      type: "steps";
      steps: Array<{
        questions: Array<{
          type: "free_text";
          question: string;
          maxLength: number;
        }>;
      }>;
    }>();
    const handlePrefetch = vi.fn().mockReturnValue(deferred.promise);

    render(
      <SphinxQuiz
        onRequestPrefetch={handlePrefetch}
        prefetchWhenRemainingSteps={0}
        steps={[
          {
            questions: [
              {
                type: "yes_no",
                question: "Do you have a structured onboarding process?"
              }
            ]
          }
        ]}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Yes" }));
    fireEvent.click(screen.getByRole("button", { name: "Submit step" }));

    await waitFor(() => {
      expect(handlePrefetch).toHaveBeenCalledTimes(1);
    });

    expect(
      screen.queryByText("Preparing the next question...")
    ).toBeNull();
    expect(
      screen.getByText("Do you have a structured onboarding process?")
    ).toBeTruthy();
    expect(screen.getByText("Step 1 of 1")).toBeTruthy();
    expect(screen.getByText("1 / 1")).toBeTruthy();

    deferred.resolve({
      type: "steps",
      steps: [
        {
          questions: [
            {
              type: "free_text",
              question: "What should the next iteration improve?",
              maxLength: 500
            }
          ]
        }
      ]
    });

    await waitFor(() => {
      expect(
        screen.getByText("What should the next iteration improve?")
      ).toBeTruthy();
    });
    expect(screen.getByText("Step 2 of 2")).toBeTruthy();
    expect(screen.getByText("2 / 2")).toBeTruthy();
  });
});
