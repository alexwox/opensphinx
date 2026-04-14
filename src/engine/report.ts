import { QuizConfig, ScoreResult, SessionState } from "../schemas";

export function generateScoreReport(
  sessionState: SessionState,
  scores: ScoreResult
) {
  const normalizedSession = SessionState.parse(sessionState);
  const config = QuizConfig.parse(normalizedSession.config);
  const normalizedScores = ScoreResult.parse(scores);

  const lines = normalizedScores.dimensions.map((dimension) => {
    const suffix = dimension.explanation ? ` - ${dimension.explanation}` : "";

    return `- ${dimension.label ?? dimension.id}: ${dimension.score}${suffix}`;
  });

  return [
    `Report for "${config.name}"`,
    normalizedScores.summary ?? "No summary is available yet.",
    lines.length > 0 ? "Dimension scores:" : "No dimension scores are available yet.",
    ...lines
  ].join("\n");
}
