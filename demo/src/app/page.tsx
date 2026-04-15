import { DemoQuizClient } from "../components/demo-quiz-client";

export const dynamic = "force-dynamic";

export default function HomePage() {
  const hasOpenAiKey = Boolean(process.env.OPENAI_API_KEY?.trim());

  return <DemoQuizClient showOpenAiKeyHint={!hasOpenAiKey} />;
}
