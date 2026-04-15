import type { output } from "zod";

import {
  QuestionSpec,
  QuizConfig,
  SessionState,
  Step
} from "../schemas";

export function normalizeQuestionText(question: QuestionSpec) {
  return question.question
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function collectKnownQuestions(sessionState: output<typeof SessionState>) {
  return [
    ...sessionState.history.map((entry) => entry.question),
    ...sessionState.pendingSteps.flatMap((step) => step.questions)
  ];
}

export function sanitizeGeneratedStep(
  step: output<typeof Step>,
  sessionState: output<typeof SessionState>
) {
  const knownQuestionTexts = new Set(
    collectKnownQuestions(sessionState).map((question) =>
      normalizeQuestionText(question)
    )
  );
  const seenInStep = new Set<string>();

  return step.questions.filter((question) => {
    const normalized = normalizeQuestionText(question);

    if (normalized.length === 0) {
      return false;
    }

    if (knownQuestionTexts.has(normalized)) {
      return false;
    }

    if (seenInStep.has(normalized)) {
      return false;
    }

    seenInStep.add(normalized);
    return true;
  });
}

export function buildFallbackQuestion(
  config: output<typeof QuizConfig>,
  historyLength: number
) {
  const questionNumber = historyLength + 1;

  return QuestionSpec.parse({
    type: "free_text",
    question: `Question ${questionNumber}: What else should OpenSphinx know before it continues "${config.name}"?`,
    placeholder: "Add any helpful context here.",
    maxLength: 500
  });
}

export function buildFallbackStep(
  config: output<typeof QuizConfig>,
  historyLength: number
) {
  const remainingSlots = Math.max(0, config.maxQuestions - historyLength);
  const stepQuestionCount = Math.max(1, Math.min(config.batchSize, remainingSlots));

  return Step.parse({
    questions: Array.from({ length: stepQuestionCount }, (_, index) =>
      buildFallbackQuestion(config, historyLength + index)
    )
  });
}

export function getSeedSteps(config: output<typeof QuizConfig>) {
  if (config.seedSteps && config.seedSteps.length > 0) {
    return config.seedSteps.map((step) => Step.parse(step));
  }

  if (!config.seedQuestions || config.seedQuestions.length === 0) {
    return [];
  }

  const seedSteps: Array<output<typeof Step>> = [];

  for (let index = 0; index < config.seedQuestions.length; index += config.batchSize) {
    seedSteps.push(
      Step.parse({
        questions: config.seedQuestions.slice(index, index + config.batchSize)
      })
    );
  }

  return seedSteps;
}

export function getSeedStep(
  config: output<typeof QuizConfig>,
  completedSteps: number
) {
  const seedSteps = getSeedSteps(config);
  return seedSteps[completedSteps];
}

export function canComplete(
  config: output<typeof QuizConfig>,
  sessionState: output<typeof SessionState>
) {
  const meetsQuestionMinimum = sessionState.history.length >= config.minQuestions;
  const meetsStepMinimum =
    config.minSteps === undefined || sessionState.completedSteps >= config.minSteps;

  return meetsQuestionMinimum && meetsStepMinimum;
}

export function reachedHardLimit(
  config: output<typeof QuizConfig>,
  sessionState: output<typeof SessionState>
) {
  const reachedQuestionLimit = sessionState.history.length >= config.maxQuestions;
  const reachedStepLimit =
    config.maxSteps !== undefined && sessionState.completedSteps >= config.maxSteps;

  return reachedQuestionLimit || reachedStepLimit;
}

export function trimStepToRemainingQuestionBudget(
  step: output<typeof Step>,
  config: output<typeof QuizConfig>,
  sessionState: output<typeof SessionState>
) {
  const remainingQuestionSlots = Math.max(
    0,
    config.maxQuestions - sessionState.history.length
  );

  return Step.parse({
    questions: step.questions.slice(
      0,
      Math.max(1, Math.min(step.questions.length, remainingQuestionSlots))
    )
  });
}
