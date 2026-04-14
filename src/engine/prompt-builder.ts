import { QuizConfig, SessionState } from "../schemas";

const QUESTION_TYPE_GUIDANCE = [
  "mcq",
  "free_text",
  "slider",
  "rating",
  "yes_no",
  "number",
  "date",
  "multi_select"
];

function formatAnswer(answer: SessionState["history"][number]["answer"]) {
  if (answer instanceof Date) {
    return answer.toISOString();
  }

  if (Array.isArray(answer)) {
    return answer.join(", ");
  }

  return String(answer);
}

export function buildPrompt(
  sessionState: SessionState,
  desiredQuestionCount: number
) {
  const normalizedSession = SessionState.parse(sessionState);
  const config = QuizConfig.parse(normalizedSession.config);
  const seedBlock =
    config.seedQuestions && config.seedQuestions.length > 0
      ? config.seedQuestions
          .map((question, index) => `${index + 1}. [${question.type}] ${question.question}`)
          .join("\n")
      : "No developer-provided seed questions.";

  const historyBlock =
    normalizedSession.history.length > 0
      ? normalizedSession.history
          .map(
            (entry, index) =>
              `${index + 1}. ${entry.question.question}\nAnswer: ${formatAnswer(entry.answer)}`
          )
          .join("\n\n")
      : "No answers have been collected yet.";

  return [
    config.systemPrompt,
    `Quiz: ${config.name}`,
    `Description: ${config.description}`,
    `Goals: ${config.goals.join("; ")}`,
    `Language: ${config.language}`,
    `Allowed question types: ${QUESTION_TYPE_GUIDANCE.join(", ")}`,
    `Question window: ${config.minQuestions}-${config.maxQuestions}`,
    `Preferred batch size: ${desiredQuestionCount}`,
    "Developer seed questions:",
    seedBlock,
    "Return either:",
    '1. { "type": "questions", "questions": <array of valid QuestionSpec> }',
    '2. { "type": "complete" } only when you already have enough information and the minimum question count has been met.',
    `If you return questions, return between 1 and ${desiredQuestionCount} questions.`,
    "Use the developer's seed questions as the opening interview strategy.",
    "Never ask for information that is already clear from the history.",
    "Prefer concrete, structured follow-up questions over vague prompts.",
    "History:",
    historyBlock
  ].join("\n\n");
}
