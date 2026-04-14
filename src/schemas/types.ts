export interface QuestionSpec {
  readonly type: string;
  readonly question: string;
  readonly [key: string]: unknown;
}

export type AnswerValue = string | number | boolean | string[] | Date;

export interface QuizConfig {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly systemPrompt?: string;
  readonly goals?: readonly string[];
  readonly minQuestions?: number;
  readonly maxQuestions?: number;
  readonly language?: string;
  readonly [key: string]: unknown;
}

export interface SessionHistoryItem {
  readonly question: QuestionSpec;
  readonly answer: AnswerValue;
}

export interface SessionState {
  readonly sessionId: string;
  readonly config: QuizConfig;
  readonly history: readonly SessionHistoryItem[];
}

export interface DimensionScore {
  readonly id: string;
  readonly label?: string;
  readonly score: number;
  readonly explanation?: string;
}

export interface ScoreResult {
  readonly dimensions?: readonly DimensionScore[];
  readonly summary?: string;
  readonly [key: string]: unknown;
}

export type EngineResponse =
  | {
      readonly type: "question";
      readonly question: QuestionSpec;
    }
  | {
      readonly type: "complete";
      readonly scores: ScoreResult;
    };
