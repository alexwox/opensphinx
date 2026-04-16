import { useMemo, useState } from "react";

import type { AnswerValue, Step } from "../../schemas";

import {
  QuestionRenderer,
  type QuestionDraftValue
} from "./question-renderer";
import {
  getInitialDrafts,
  getQuestionKey,
  isAnswerValue,
  normalizeAnswer
} from "./sphinx-form-utils";

export interface StepQuestionsSubmitPayload {
  readonly answers: AnswerValue[];
  readonly drafts: readonly QuestionDraftValue[];
}

export interface StepQuestionsFormProps {
  readonly canGoBack: boolean;
  readonly initialDrafts?: readonly QuestionDraftValue[];
  readonly step: Step;
  readonly inputName: string;
  readonly submitLabel: string;
  readonly isLoading: boolean;
  readonly onBack: (drafts: readonly QuestionDraftValue[]) => void;
  readonly showQuestionHeadings: boolean;
  readonly onSubmitStep: (payload: StepQuestionsSubmitPayload) => void;
}

export function StepQuestionsForm({
  canGoBack,
  initialDrafts,
  step,
  inputName,
  submitLabel,
  isLoading,
  onBack,
  showQuestionHeadings,
  onSubmitStep
}: StepQuestionsFormProps) {
  const [drafts, setDrafts] = useState<QuestionDraftValue[]>(() =>
    getInitialDrafts(step, initialDrafts)
  );

  const normalizedAnswers = useMemo(
    () =>
      step.questions.map((question, questionIndex) =>
        normalizeAnswer(question, drafts[questionIndex])
      ),
    [drafts, step]
  );

  const isReadyToSubmit = normalizedAnswers.every(isAnswerValue) && !isLoading;

  return (
    <form
      className="opensphinx-form"
      onSubmit={(event) => {
        event.preventDefault();

        if (!normalizedAnswers.every(isAnswerValue)) {
          return;
        }

        onSubmitStep({
          answers: normalizedAnswers,
          drafts
        });
      }}
    >
      <div className="opensphinx-step-questions">
        {step.questions.map((question, questionIndex) => (
          <section
            className="opensphinx-step-question"
            key={`${questionIndex}:${getQuestionKey(question)}`}
          >
            {showQuestionHeadings && (
              <div className="opensphinx-step-question__header">
                <p className="opensphinx-question-type">Question {questionIndex + 1}</p>
                <h3 className="opensphinx-step-question__title">{question.question}</h3>
              </div>
            )}
            <QuestionRenderer
              disabled={isLoading}
              draft={drafts[questionIndex]}
              inputName={`${inputName}:${questionIndex}`}
              onChange={(nextDraft) => {
                setDrafts((current) => {
                  const next = [...current];
                  next[questionIndex] = nextDraft;
                  return next;
                });
              }}
              question={question}
            />
          </section>
        ))}
      </div>

      <div className="opensphinx-actions">
        {canGoBack && (
          <button
            className="opensphinx-back"
            disabled={isLoading}
            onClick={() => onBack(drafts)}
            type="button"
          >
            Back
          </button>
        )}
        <button
          className="opensphinx-submit"
          disabled={!isReadyToSubmit}
          type="submit"
        >
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
