import type { QuizConfig } from "../../../src/schemas";

export const demoQuizConfig: QuizConfig = {
  id: "ai-readiness-audit",
  name: "AI Readiness Audit",
  description: "Evaluate how prepared a team is to adopt AI into daily work.",
  systemPrompt:
    "You are running a concise AI readiness audit for a product or operations team. Ask concrete questions that help you understand process clarity, documentation quality, experimentation culture, and adoption blockers. After the developer-provided seed steps, ask at least one genuinely adaptive follow-up step before deciding whether the quiz should complete. Stop once you have enough information to produce a useful summary.",
  goals: [
    "Understand current team process maturity",
    "Identify operational bottlenecks that affect AI adoption",
    "Estimate how ready the team is to use AI in day-to-day work"
  ],
  minQuestions: 6,
  maxQuestions: 10,
  batchSize: 2,
  minSteps: 3,
  maxSteps: 5,
  scoringDimensions: [
    {
      id: "process-maturity",
      name: "Process Maturity",
      description: "How structured and documented the team's workflows are."
    },
    {
      id: "adoption-readiness",
      name: "Adoption Readiness",
      description: "How ready the team is to adopt AI into daily work."
    }
  ],
  seedSteps: [
    {
      questions: [
        {
          type: "yes_no",
          question: "Do you already use AI tools in any recurring team workflow?"
        },
        {
          type: "rating",
          question: "How clearly documented are your core team processes?",
          max: 5,
          labels: {
            low: "Poorly documented",
            high: "Very well documented"
          }
        }
      ]
    },
    {
      questions: [
        {
          type: "mcq",
          question: "Which area feels like the best first AI opportunity?",
          options: [
            "Research",
            "Documentation",
            "Support",
            "Operations",
            "Content"
          ],
          allowMultiple: false
        },
        {
          type: "free_text",
          question: "What is the biggest blocker stopping broader AI adoption today?",
          maxLength: 500,
          placeholder: "Describe the main blocker."
        }
      ]
    }
  ],
  language: "en"
};
