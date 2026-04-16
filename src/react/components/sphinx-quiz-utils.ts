import type { AnswerValue, QuestionSpec, Step } from "../../schemas";

import type { QuestionDraftValue } from "./question-renderer";

export function getInitialDraft(question: QuestionSpec): QuestionDraftValue {
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

export function cloneDraftValue(draft: QuestionDraftValue): QuestionDraftValue {
  return Array.isArray(draft) ? [...draft] : draft;
}

export function cloneDrafts(drafts: readonly QuestionDraftValue[]) {
  return drafts.map((draft) => cloneDraftValue(draft));
}

export function getInitialDrafts(
  step: Step,
  initialDrafts?: readonly QuestionDraftValue[]
) {
  if (!initialDrafts || initialDrafts.length !== step.questions.length) {
    return step.questions.map((question) => getInitialDraft(question));
  }

  return cloneDrafts(initialDrafts);
}

export function normalizeAnswer(
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

export function joinClassNames(...values: Array<string | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function getStepQueue(step?: Step, steps?: readonly Step[]) {
  if (steps && steps.length > 0) {
    return steps;
  }

  if (step) {
    return [step];
  }

  return [];
}

export function getQuestionKey(question: QuestionSpec) {
  return JSON.stringify(question);
}

export function getStepKey(step: Step) {
  return JSON.stringify(step);
}

export function getStepsKey(steps: readonly Step[]) {
  return JSON.stringify(steps);
}

export function getStepHeading(step: Step) {
  if (step.questions.length === 1) {
    return step.questions[0]?.question ?? "Answer the question below.";
  }

  return "Answer the questions below.";
}

export function isAnswerValue(answer: AnswerValue | null): answer is AnswerValue {
  return answer !== null;
}
