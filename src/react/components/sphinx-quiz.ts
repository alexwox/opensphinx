import type {
  AnswerValue,
  QuestionSpec,
  ScoreResult
} from "../../schemas";

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

export function SphinxQuiz(_props: SphinxQuizProps) {
  return null;
}
