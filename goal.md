# OpenSphinx Goal

This document defines **v1: a bare-minimum working version** of `opensphinx`, plus a **Later** section for everything we intentionally defer.

## v1 — What We Ship First

The smallest credible loop:

1. **`SessionState`** is the source of truth: `history`, **`pendingSteps`** (queued `Step` objects), `completedSteps`, plus `sessionId` and `config`.
2. **Server:** `createQuizEngine({ config, model? }).generateStep(session)` returns **`EngineStepResponse` only** — either `{ type: "step", step }` or `{ type: "complete", scores }`.
3. **Seed-first:** the engine serves developer **`seedSteps`** / **`seedQuestions`** (as steps) before calling the model.
4. **Then minimal AI:** after seeds, one structured step per call (with retry + basic fallback); no alternate engine entry points.
5. **Client:** **`SphinxQuiz`** renders **one question at a time** inside the current `Step`, by `QuestionSpec.type`, and supports an optional **prefetch** hook to append more `Step`s.

### v1 mental model

```text
SessionState → generateStep() → Step (or complete) → SphinxQuiz → answers → update session → repeat
```

### v1 imports (all you need)

```ts
import { SphinxQuiz } from "opensphinx/react";
import { createQuizEngine } from "opensphinx/engine";
import {
  QuizConfig,
  SessionState,
  EngineStepResponse,
  Step
} from "opensphinx/schemas";
```

### v1 non-goals (explicit)

- No `generateBatch`, `generateNext`, or legacy question/batch response types in the public contract.
- No promise of production-grade prefetch policy, scoring, or reporting beyond what the stub needs to complete a demo.

---

## Later (deferred)

Everything below is **out of v1 scope** but still directionally aligned with the product.

### Product / UX

- Rich prefetch and replenishment strategy
- ShadCN-level component polish
- Report display component in React
- Session serialization helpers
- Examples for Remix, Express, etc.

### Engine

- Real scoring mapped to `scoringDimensions`
- AI-backed reports
- Stronger duplicate-avoidance and provider guidance
- Broader edge-case and safety review

### Docs and release

- README as full product story
- TSDoc on all public APIs
- API reference site, contributing guide, npm publish checklist

---

## Implementation checklist (v1)

Status: **`[v1]`** = required for bare-minimum; **`[later]`** = tracked in “Later” above.

### Shared contracts

- `[v1]` Question type catalog + `QuestionSpec` / `AnswerValue`
- `[v1]` `QuizConfig` with `systemPrompt`, seeds, `batchSize`, limits
- `[v1]` `Step`, `SessionState` (`pendingSteps` only), `EngineStepResponse`
- `[later]` Serialization helpers, long-term API stability review

### Engine

- `[v1]` `createQuizEngine` + **`generateStep` only** (plus `score` / `generateReport` stubs if demo needs them)
- `[v1]` Seed-first, then minimal model step
- `[v1]` Hard limits (`min`/`max` questions and steps) and schema-validated model output
- `[later]` Rich scoring, AI reports, advanced diagnostics

### React

- `[v1]` **`SphinxQuiz`** step-first: `step` / `steps`, optional `onRequestPrefetch`
- `[v1]` Render all question types in the catalog (basic controls)
- `[later]` ShadCN-quality UI, report panel, heavy animation

### Demo

- `[v1]` Thin Next.js app: POST session → `generateStep` → return `EngineStepResponse`
- `[later]` Multi-framework examples

---

## Principle

OpenSphinx v1 should be **boringly obvious**: steps in, steps out, render by type, done.
