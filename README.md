# OpenSphinx — Project Prompt

Use this as the initial prompt when starting the repo with an AI agent.

**Repo name:** `opensphinx`
**Brand:** OpenSphinx
**Tagline:** "The open-source AI quiz engine that asks smarter questions."

---

## What this project is

**OpenSphinx** is an open-source TypeScript library with two packages:

1. `**@opensphinx/react`\*\* — A React + ShadCN quiz UI component that renders questions from JSON specs and collects answers.
2. `**@opensphinx/engine**` — A server-side quiz engine that takes previous Q&A history + a quiz config and uses AI (via Vercel AI SDK) to generate the next question as a Zod-validated JSON spec.

They communicate through a simple protocol: the client sends answers, the server returns the next question as JSON. That's it.

**OpenSphinx is NOT:**

- A full-stack app (no Next.js, no database, no auth, no deployment opinions)
- A form builder with a drag-and-drop UI
- A SaaS product

Users bring their own framework (Next.js, Remix, Astro, Express, whatever), their own database, their own auth. OpenSphinx is the quiz engine and the quiz UI.

## The gap this fills

Existing tools fall into two camps:

- **Camp A** ("AI creates your form"): Fillout, Jotform, Superforms — AI generates the initial form from a prompt, but questions are static during completion.
- **Camp B** ("AI follows up on vague text"): Sprig, Specific.app, Maze — AI generates text-only follow-up probes. No structured question types.

OpenSphinx combines: AI-generated structured questions (MCQ, sliders, ratings, date pickers, free text) + dynamic adaptation based on all previous answers + server-side AI logic with no prompt injection surface.

## Tech stack

- **Language:** TypeScript (strict)
- **Package:** Single npm package — `npm install opensphinx`
- **Subpath exports:** `opensphinx/react`, `opensphinx/engine`, `opensphinx/schemas`
- **React layer:** React 19+, ShadCN/UI components, Tailwind CSS
- **Engine layer:** Vercel AI SDK (`ai` package), Zod (structured output), zero framework dependencies
- **Schemas layer:** Zod schemas shared between client and server (question types, quiz config, protocol)
- **Build:** tsup (for library builds, with multiple entry points)
- **Testing:** Vitest

No dependency on Next.js, tRPC, Drizzle, PostgreSQL, or any deployment platform.

### One install, three subpath imports

```bash
npm install opensphinx
```

```typescript
import { SphinxQuiz } from "opensphinx/react"; // Client — React components
import { createQuizEngine } from "opensphinx/engine"; // Server — AI quiz engine
import { QuestionSpec, QuizConfig } from "opensphinx/schemas"; // Shared types
```

Internally the repo uses separate `src/react/`, `src/engine/`, `src/schemas/` directories for clean code boundaries. But the user installs one package and imports via subpaths. Tree-shaking ensures server code is never bundled on the client and vice versa.

The `package.json` exports field handles this:

```json
{
  "name": "opensphinx",
  "exports": {
    "./react": {
      "import": "./dist/react/index.mjs",
      "types": "./dist/react/index.d.ts"
    },
    "./engine": {
      "import": "./dist/engine/index.mjs",
      "types": "./dist/engine/index.d.ts"
    },
    "./schemas": {
      "import": "./dist/schemas/index.mjs",
      "types": "./dist/schemas/index.d.ts"
    }
  }
}
```

### Reference repos to study before building

- **ConvoForm** ([https://github.com/growupanand/ConvoForm](https://github.com/growupanand/ConvoForm)) — Study the AI conversation loop pattern (history → generate next question → validate → repeat). Ignore the full-stack parts.
- **Vercel json-render** ([https://github.com/vercel-labs/json-render](https://github.com/vercel-labs/json-render)) — Study how it constrains AI output to a component catalog via Zod schemas. This is the pattern for safe question rendering.
- **Vercel AI SDK docs** ([https://sdk.vercel.ai/docs](https://sdk.vercel.ai/docs)) — Specifically: structured output with Zod, `generateObject`, streaming.

## Architecture

```
┌──────────────────────────────┐     ┌──────────────────────────────┐
│   opensphinx/react           │     │   opensphinx/engine          │
│   (client — React component) │     │   (server — AI quiz engine)  │
│                              │     │                              │
│  <SphinxQuiz                 │     │  createQuizEngine(config)    │
│    question={q}              │     │    .generateNext(history)    │
│    onAnswer={fn}             │     │    .score(history)           │
│    onComplete={fn}           │     │    .generateReport(history)  │
│  />                          │     │                              │
│                              │     │  Returns Zod-validated JSON   │
│  Renders question from JSON  │     │  for next question.           │
│  Sends answer back.          │     │  No framework dependency.     │
│  Knows nothing about AI.     │     │  No database dependency.      │
└──────────┬───────────────────┘     └──────────────┬───────────────┘
           │                                         │
           │         opensphinx/schemas              │
           │    (Zod schemas + TypeScript types)      │
           └─────────────┬───────────────────────────┘
                         │
              QuestionSpec — the JSON contract
              QuizConfig — quiz definition
              SessionState — Q&A history
              ScoreResult — scoring output
```

All three subpaths live inside a single `opensphinx` npm package.

### The protocol

The client and server communicate through a simple contract. The user wires them together however they want (API route, server action, WebSocket, tRPC — their choice).

```typescript
// Shared types from @opensphinx/shared

type SessionState = {
  sessionId: string;
  config: QuizConfig;
  history: Array<{ question: QuestionSpec; answer: AnswerValue }>;
};

type EngineResponse =
  | { type: "question"; question: QuestionSpec }
  | { type: "complete"; scores: ScoreResult };
```

The user's job is to:

1. Call `engine.generateNext(sessionState)` on their server
2. Pass the returned `QuestionSpec` to the `<SphinxQuiz>` component
3. When the user answers, send the answer back to their server
4. Repeat until `type: "complete"`

OpenSphinx does not care how steps 1-4 are transported. HTTP, WebSocket, server actions — the user decides.

## Subpath: `opensphinx/schemas`

Zod schemas and TypeScript types shared between client and server.

### Question type catalog

```typescript
import { z } from "zod";

export const McqQuestion = z.object({
  type: z.literal("mcq"),
  question: z.string(),
  options: z.array(z.string()).min(2).max(6),
  allowMultiple: z.boolean().default(false),
});

export const FreeTextQuestion = z.object({
  type: z.literal("free_text"),
  question: z.string(),
  placeholder: z.string().optional(),
  maxLength: z.number().default(500),
});

export const SliderQuestion = z.object({
  type: z.literal("slider"),
  question: z.string(),
  min: z.number(),
  max: z.number(),
  step: z.number().default(1),
  labels: z.object({ min: z.string(), max: z.string() }).optional(),
});

export const RatingQuestion = z.object({
  type: z.literal("rating"),
  question: z.string(),
  max: z.number().default(5),
  labels: z.object({ low: z.string(), high: z.string() }).optional(),
});

export const YesNoQuestion = z.object({
  type: z.literal("yes_no"),
  question: z.string(),
});

export const NumberQuestion = z.object({
  type: z.literal("number"),
  question: z.string(),
  min: z.number().optional(),
  max: z.number().optional(),
  unit: z.string().optional(),
});

export const DateQuestion = z.object({
  type: z.literal("date"),
  question: z.string(),
});

export const MultiSelectQuestion = z.object({
  type: z.literal("multi_select"),
  question: z.string(),
  options: z.array(z.string()).min(2).max(10),
  maxSelections: z.number().optional(),
});

export const QuestionSpec = z.discriminatedUnion("type", [
  McqQuestion,
  FreeTextQuestion,
  SliderQuestion,
  RatingQuestion,
  YesNoQuestion,
  NumberQuestion,
  DateQuestion,
  MultiSelectQuestion,
]);

export type QuestionSpec = z.infer<typeof QuestionSpec>;
```

### Quiz configuration

```typescript
export const ScoringDimension = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
});

export const QuizConfig = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  systemPrompt: z.string(),
  goals: z.array(z.string()),
  minQuestions: z.number().default(5),
  maxQuestions: z.number().default(15),
  scoringDimensions: z.array(ScoringDimension),
  seedQuestions: z.array(QuestionSpec).optional(),
  language: z.string().default("en"),
});
```

### Answer values

```typescript
export const AnswerValue = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.array(z.string()),
  z.date(),
]);
```

## Subpath: `opensphinx/engine`

Server-side only. Zero React dependency. Zero framework dependency. Takes history, returns next question.

### API surface

```typescript
import { createQuizEngine } from "opensphinx/engine";

const engine = createQuizEngine({
  model: openai("gpt-4o"), // Any AI SDK compatible model
  config: myQuizConfig, // QuizConfig from shared
});

// Generate next question
const result = await engine.generateNext(sessionState);
// Returns: { type: "question", question: QuestionSpec }
//      or: { type: "complete", scores: ScoreResult }

// Score completed quiz
const scores = await engine.score(sessionState);

// Generate text report from scores
const report = await engine.generateReport(sessionState, scores);
```

### How it works internally

1. Receives `SessionState` (config + history of Q&A pairs)
2. Builds a prompt from config.systemPrompt + history + available question types
3. Calls AI SDK `generateObject` with the `QuestionSpec` Zod schema as structured output
4. The AI returns a valid `QuestionSpec` — guaranteed by Zod validation
5. If the AI sets an internal `isComplete` flag (or maxQuestions reached), returns `type: "complete"` with scores instead

### Safety model

- AI output is **always** validated against the Zod schema before returning. Invalid output → retry once → fallback to a generic free-text question.
- User answers are passed to the AI as structured data inside a clearly delimited section of the prompt, never as raw string concatenation.
- The AI can only produce question types defined in the catalog. No arbitrary component generation.

## Subpath: `opensphinx/react`

Client-side only. React + ShadCN components. Knows nothing about AI. Just renders questions from JSON and collects answers.

### API surface

```tsx
import { SphinxQuiz } from "opensphinx/react";

<SphinxQuiz
  question={currentQuestion} // QuestionSpec from engine
  onAnswer={(answer) => {
    // User answered — send to your server
    sendToServer(answer);
  }}
  onComplete={(scores) => {
    // Quiz finished
    showReport(scores);
  }}
  isLoading={isGenerating} // Show loading state while AI works
  progress={{ current: 3, max: 12 }}
  theme="default" // or custom theme object
/>;
```

### What it renders

For each `QuestionSpec.type`, there's a matching ShadCN-based component:

| Type           | Component                                    |
| -------------- | -------------------------------------------- |
| `mcq`          | Card-based option selector (single or multi) |
| `free_text`    | Textarea with char counter                   |
| `slider`       | ShadCN Slider with labels                    |
| `rating`       | Star rating or numbered scale                |
| `yes_no`       | Two large buttons                            |
| `number`       | Number input with optional unit label        |
| `date`         | ShadCN DatePicker                            |
| `multi_select` | Checkbox group with max selection            |

The component also handles:

- Question transition animation (simple fade, not heavy)
- Progress bar
- Loading skeleton while waiting for next question
- Mobile-responsive layout
- One question at a time (Typeform-style UX)

### Styling

ShadCN defaults + Tailwind. Users can override via:

- Tailwind class overrides on the container
- A `theme` prop for colors/spacing
- Or just wrap it and style the container themselves

No CSS-in-JS, no styled-components, no proprietary styling system.

## Folder structure

```
opensphinx/
├── src/
│   ├── schemas/                       # opensphinx/schemas
│   │   ├── question-types.ts
│   │   ├── quiz-config.ts
│   │   ├── session.ts
│   │   ├── scoring.ts
│   │   └── index.ts
│   ├── engine/                        # opensphinx/engine
│   │   ├── create-quiz-engine.ts
│   │   ├── prompt-builder.ts
│   │   ├── scoring.ts
│   │   ├── report.ts
│   │   └── index.ts
│   └── react/                         # opensphinx/react
│       ├── components/
│       │   ├── sphinx-quiz.tsx
│       │   ├── question-renderer.tsx
│       │   ├── questions/
│       │   │   ├── mcq.tsx
│       │   │   ├── free-text.tsx
│       │   │   ├── slider.tsx
│       │   │   ├── rating.tsx
│       │   │   ├── yes-no.tsx
│       │   │   ├── number-input.tsx
│       │   │   ├── date-picker.tsx
│       │   │   └── multi-select.tsx
│       │   ├── progress-bar.tsx
│       │   └── loading-skeleton.tsx
│       └── index.ts
├── demo/                              # Minimal Next.js app showing usage
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx               # Quiz page
│   │   │   └── api/
│   │   │       └── quiz/
│   │   │           └── route.ts       # Wires engine to HTTP
│   │   └── lib/
│   │       └── quiz-config.ts         # Example quiz config
│   ├── package.json
│   └── next.config.ts
├── package.json                       # Single package with subpath exports
├── tsup.config.ts                     # Build config with 3 entry points
├── tsconfig.json
├── .env.example                       # OPENAI_API_KEY
└── README.md
```

Single `package.json`, single repo, single `npm publish`. The `tsup.config.ts` builds three entry points (`schemas`, `engine`, `react`) into `dist/`. The `demo/` folder is a separate app that depends on the local package for development.

## MVP scopes

### Phase 1 — Core library (week 1)

- Repo setup (single package, tsup with 3 entry points, subpath exports)
- `opensphinx/schemas`: all Zod schemas and types
- `opensphinx/engine`: `createQuizEngine` with `generateNext` — takes history, returns next QuestionSpec
- `opensphinx/react`: `<SphinxQuiz>` component + all 8 question type renderers
- `demo/`: minimal Next.js app that wires engine to react via an API route
- One working quiz config (AI readiness audit as example)

### Phase 2 — Scoring + polish (week 2)

- `engine.score()` — maps answers to scoring dimensions
- `engine.generateReport()` — AI-generated text insights from scores
- Report display component in `@opensphinx/react`
- Loading states, animations, mobile responsiveness
- Error handling and graceful degradation (malformed AI output → fallback)
- Session state serialization helpers (so users can persist however they want)

### Phase 3 — Open source readiness

- README with demo GIF and usage examples for Next.js, Remix, Express
- `npm publish` setup (single package, subpath exports verified)
- API documentation (TSDoc)
- Contributing guide

## What NOT to build

- Database layer (user's responsibility)
- Auth (user's responsibility)
- Deployment config (user's responsibility)
- Multi-tenant quiz creator UI
- Analytics dashboard
- A/B testing
- Custom AI-generated React components (stick to fixed catalog)
- Enrichment pipeline / external data fetching
- PDF generation (user can build this on top of the report data)

## Design direction

- One-question-at-a-time layout (Typeform-style UX)
- ShadCN defaults — clean, modern, not over-designed. If the package is imported to a repo, then use the tailwind config from that repo for the shadcn styling.
- Progress bar at top
- Subtle fade animation on question transitions (framer-motion, minimal)
- Mobile-first
- Language-agnostic (quiz config sets language, components render whatever text the AI returns)
