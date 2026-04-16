import { QuizConfig, ScoreResult, SessionState } from "../schemas";

export function scoreSession(sessionState: SessionState) {
  const normalizedSession = SessionState.parse(sessionState);
  const config = QuizConfig.parse(normalizedSession.config);

  return ScoreResult.parse({
    dimensions: config.scoringDimensions.map((dimension) => ({
      id: dimension.id,
      label: dimension.name,
      score: 0,
      explanation: `Scoring for "${dimension.name}" is not implemented yet.`
    })),
    summary: `Scaffold scoring completed for "${config.name}".`
  });
}
