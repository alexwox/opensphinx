import type {
  EngineResponse,
  QuizConfig,
  ScoreResult,
  SessionState
} from "../schemas";

const placeholderError = (methodName: string): never => {
  throw new Error(
    `OpenSphinx scaffold placeholder: \`${methodName}\` is not implemented yet.`
  );
};

export interface CreateQuizEngineOptions {
  readonly model?: unknown;
  readonly config: QuizConfig;
}

export interface QuizEngine {
  generateNext(sessionState: SessionState): Promise<EngineResponse>;
  score(sessionState: SessionState): Promise<ScoreResult>;
  generateReport(sessionState: SessionState, scores: ScoreResult): Promise<string>;
}

export function createQuizEngine(
  _options: CreateQuizEngineOptions
): QuizEngine {
  return {
    async generateNext(_sessionState) {
      return placeholderError("engine.generateNext");
    },
    async score(_sessionState) {
      return placeholderError("engine.score");
    },
    async generateReport(_sessionState, _scores) {
      return placeholderError("engine.generateReport");
    }
  };
}
