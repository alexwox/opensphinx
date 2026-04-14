import { useEffect, useId, useMemo, useState } from "react";

import type {
  AnswerValue,
  QuestionSpec,
  ScoreResult
} from "../../schemas";

import { LoadingSkeleton } from "./loading-skeleton";
import { ProgressBar } from "./progress-bar";
import {
  QuestionRenderer,
  type QuestionDraftValue
} from "./question-renderer";

export interface SphinxQuizProgress {
  readonly current: number;
  readonly max: number;
}

export type SphinxQuizTheme = "default" | Record<string, unknown>;

export interface SphinxQuizProps {
  readonly question: QuestionSpec;
  readonly onAnswer: (answer: AnswerValue) => void;
  readonly onComplete?: (scores: ScoreResult) => void;
  readonly isLoading?: boolean;
  readonly progress?: SphinxQuizProgress;
  readonly theme?: SphinxQuizTheme;
  readonly className?: string;
}

function getInitialDraft(question: QuestionSpec): QuestionDraftValue {
  switch (question.type) {
    case "mcq":
      return question.allowMultiple ? [] : "";
    case "free_text":
      return "";
    case "slider":
      return question.min;
    case "rating":
      return undefined;
    case "yes_no":
      return undefined;
    case "number":
      return "";
    case "date":
      return "";
    case "multi_select":
      return [];
    default: {
      const exhaustiveCheck: never = question;
      return exhaustiveCheck;
    }
  }
}

function normalizeAnswer(
  question: QuestionSpec,
  draft: QuestionDraftValue
): AnswerValue | null {
  switch (question.type) {
    case "mcq":
      if (question.allowMultiple) {
        return Array.isArray(draft) && draft.length > 0 ? draft : null;
      }

      return typeof draft === "string" && draft.length > 0 ? draft : null;
    case "free_text": {
      const value = typeof draft === "string" ? draft.trim() : "";
      return value.length > 0 ? value : null;
    }
    case "slider":
      return typeof draft === "number" ? draft : null;
    case "rating":
      return typeof draft === "number" ? draft : null;
    case "yes_no":
      return typeof draft === "boolean" ? draft : null;
    case "number": {
      if (typeof draft !== "string" || draft.trim().length === 0) {
        return null;
      }

      const parsed = Number(draft);

      if (Number.isNaN(parsed)) {
        return null;
      }

      if (question.min !== undefined && parsed < question.min) {
        return null;
      }

      if (question.max !== undefined && parsed > question.max) {
        return null;
      }

      return parsed;
    }
    case "date": {
      if (typeof draft !== "string" || draft.length === 0) {
        return null;
      }

      const parsed = new Date(`${draft}T00:00:00.000Z`);

      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
    case "multi_select":
      return Array.isArray(draft) && draft.length > 0 ? draft : null;
    default: {
      const exhaustiveCheck: never = question;
      return exhaustiveCheck;
    }
  }
}

function joinClassNames(...values: Array<string | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function SphinxQuiz({
  question,
  onAnswer,
  onComplete,
  isLoading = false,
  progress,
  theme = "default",
  className
}: SphinxQuizProps) {
  const inputName = useId();
  const [draft, setDraft] = useState<QuestionDraftValue>(() =>
    getInitialDraft(question)
  );

  useEffect(() => {
    setDraft(getInitialDraft(question));
  }, [question]);

  const normalizedAnswer = useMemo(
    () => normalizeAnswer(question, draft),
    [draft, question]
  );

  const isReadyToSubmit = normalizedAnswer !== null && !isLoading;
  const themeName = typeof theme === "string" ? theme : "custom";
  void onComplete;

  return (
    <section
      className={joinClassNames("opensphinx-quiz", className)}
      data-theme={themeName}
    >
      {progress && <ProgressBar current={progress.current} max={progress.max} />}

      <div className="opensphinx-card">
        <header className="opensphinx-card__header">
          <p className="opensphinx-question-type">{question.type}</p>
          <h2 className="opensphinx-question">{question.question}</h2>
        </header>

        {isLoading ? (
          <LoadingSkeleton />
        ) : (
          <form
            className="opensphinx-form"
            onSubmit={(event) => {
              event.preventDefault();

              if (normalizedAnswer === null) {
                return;
              }

              onAnswer(normalizedAnswer);
            }}
          >
            <QuestionRenderer
              disabled={isLoading}
              draft={draft}
              inputName={inputName}
              onChange={setDraft}
              question={question}
            />

            <div className="opensphinx-actions">
              <button
                className="opensphinx-submit"
                disabled={!isReadyToSubmit}
                type="submit"
              >
                Continue
              </button>
            </div>
          </form>
        )}
      </div>
    </section>
  );
}
