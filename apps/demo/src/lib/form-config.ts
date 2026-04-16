import type { FormConfig } from "opensphinx/schemas";

export const demoFormConfig: FormConfig = {
  id: "product-discovery",
  name: "Product Discovery",
  description:
    "A short intake that explores what a user needs so the right product path can be recommended.",
  systemPrompt:
    "You are running a concise product discovery intake. Ask concrete questions that help you understand the user's team size, current tooling, main workflow pain points, and what outcome they are optimizing for. After the developer-provided seed steps, ask at least one genuinely adaptive follow-up step before deciding whether the form is complete. Stop once you have enough signal to recommend a product path.",
  goals: [
    "Understand the user's current workflow and tooling",
    "Surface the main pain points worth solving",
    "Identify what a successful outcome looks like for this user"
  ],
  minQuestions: 6,
  maxQuestions: 10,
  batchSize: 2,
  minSteps: 3,
  maxSteps: 5,
  scoringDimensions: [
    {
      id: "workflow-clarity",
      name: "Workflow Clarity",
      description:
        "How well-defined the user's existing processes and tooling are."
    },
    {
      id: "urgency",
      name: "Urgency",
      description: "How pressing the need for a solution is right now."
    }
  ],
  seedSteps: [
    {
      questions: [
        {
          type: "mcq",
          question: "What best describes your team size?",
          options: [
            "Just me",
            "2\u201310 people",
            "11\u201350 people",
            "51\u2013200 people",
            "200+"
          ],
          allowMultiple: false
        },
        {
          type: "rating",
          question:
            "How satisfied are you with the tools you currently use for this workflow?",
          max: 5,
          labels: {
            low: "Very frustrated",
            high: "Very satisfied"
          }
        }
      ]
    },
    {
      questions: [
        {
          type: "mcq",
          question: "Which area of your workflow needs the most improvement?",
          options: [
            "Data collection",
            "Reporting",
            "Collaboration",
            "Automation",
            "Onboarding"
          ],
          allowMultiple: false
        },
        {
          type: "free_text",
          question:
            "Describe what a successful outcome looks like for your team.",
          maxLength: 500,
          placeholder: "e.g. faster turnaround, fewer manual steps, etc."
        }
      ]
    }
  ],
  language: "en"
};
