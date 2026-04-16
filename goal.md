# OpenSphinx Goal

This document describes the currently supported v1 surface of `opensphinx`.

## Supported Product Shape

OpenSphinx should read like one obvious product:

1. `SessionState` and `Step` are the runtime source of truth.
2. `createFormEngine({ model, config }).generateStep(session)` is the only engine generation path.
3. `SphinxForm` is the only React surface.
4. `README.md` should be enough to understand the package end to end.

## Current v1 Workflow

```text
SessionState -> generateStep() -> EngineStepResponse -> Step -> SphinxForm -> updated SessionState
```

What that means in practice:

- The engine serves `seedSteps` or `seedQuestions` first.
- After seeds, the engine asks for one adaptive step at a time.
- `EngineStepResponse` is always either `{ type: "step", step }` or `{ type: "complete", scores }`.
- The React layer renders one question at a time from the current `Step`.
- Optional prefetch can append more steps, but the mental model stays step-first.

## Public API We Intend Users To Rely On

`opensphinx/schemas`

- `FormConfig`
- `SessionState`
- `Step`
- `EngineStepResponse`
- question and answer schemas

`opensphinx/engine`

- `createFormEngine`

`opensphinx/react`

- `SphinxForm`

Everything else should be treated as internal implementation detail or deferred.

## v1 Requirements

### Shared Contracts

- `QuestionSpec` and `AnswerValue` cover the supported question catalog.
- `FormConfig` carries `systemPrompt`, seeds, limits, and batch size.
- `SessionState` carries `history`, `pendingSteps`, `completedSteps`, `sessionId`, and `config`.
- `Step` is the unit of generation and rendering.

### Engine

- `generateStep()` is the only supported generation API.
- Provider injection happens through the `model` option.
- Hard limits for questions and steps are enforced.
- Structured output stays compatible with AI SDK providers that require an object-shaped JSON schema.
- Completion returns scaffold scores through `EngineStepResponse`.

### React

- `SphinxForm` accepts `step` or `steps`.
- `SphinxForm` renders all supported question types.
- `SphinxForm` can request more steps through `onRequestPrefetch`.
- The official docs only describe the step-first flow.

### Demo

- The demo should mirror the package workflow, not invent its own one.
- The demo should show config, provider injection, seed steps, limits, and session updates.
- The demo should stop at the core loop and completion state.

## Explicitly Deferred

- Rich reports and report UI
- Advanced public diagnostics surface
- Multiple competing React surfaces
- Multi-framework examples beyond the thin demo
- Heavier styling systems or broader theming API
- Long-form documentation beyond the README

## Principle

OpenSphinx v1 should be boring in the best way: steps in, steps out, render by type, repeat until complete.
