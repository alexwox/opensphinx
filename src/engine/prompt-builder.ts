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

export function buildPrompt(sessionState: SessionState) {
  const normalizedSession = SessionState.parse(sessionState);
  const config = QuizConfig.parse(normalizedSession.config);

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
    `Allowed question types: ${QUESTION_TYPE_GUIDANCE.join(", ")}`,
    `Question window: ${config.minQuestions}-${config.maxQuestions}`,
    "History:",
    historyBlock
  ].join("\n\n");
}
