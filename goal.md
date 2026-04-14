# OpenSphinx Goal

This document describes the intended product direction for `opensphinx`.

It is not a changelog and it is not a description of the current implementation. It is the target: the developer experience, capabilities, and feature boundaries the package should grow toward.

## Core Idea

OpenSphinx should be the cleanest way for developers to add an adaptive AI-powered quiz or interview flow to their app without adopting a full stack, a database, a dashboard product, or a proprietary workflow.

OpenSphinx is:

- one npm package
- three clear subpath imports
- one shared schema contract
- one server-side engine
- one client-side quiz UI

The package should let developers define the opening strategy with `seedQuestions` and `systemPrompt`, then let the engine adapt intelligently from there.

The core pacing model should be based on steps.

A step is:

- a group of questions shown together
- one submit boundary in the UI
- one opportunity for the engine to prepare what comes next

## Product Promise

OpenSphinx should make it easy to build flows where:

- the developer defines the quiz goals
- the developer provides a guiding `systemPrompt`
- the developer can provide important `seedQuestions`
- the user answers an opening sequence of seed-backed steps
- the AI generates the next step or steps based on prior answers
- the UI stays fast because upcoming questions can be prefetched
- the engine knows when it has enough information and stops

The experience should feel like:

- Typeform-level simplicity
- AI-driven adaptability
- structured, renderable question types
- safe server-side generation

## Developer Experience

The package DX should be brutally simple.

### Installation

The developer should install one package:

```bash
npm install opensphinx
```

Then import only what they need:

```ts
import { SphinxQuiz } from "opensphinx/react";
import { createQuizEngine } from "opensphinx/engine";
import {
  QuizConfig,
  SessionState,
  EngineBatchResponse
} from "opensphinx/schemas";
```

### API Shape

The public API should feel:

- obvious
- small
- explicit
- type-safe
- framework-agnostic on the server side

The developer should not have to learn a custom architecture just to use the library.

### Minimal Required Decisions

The developer should only need to decide:

- what the quiz is trying to learn
- what seed questions or seed steps should be asked first
- what prompt should guide the AI
- how many steps and questions the experience is allowed to use
- how session state is stored and transported in their own app

The developer should not need to adopt:

- a database choice
- a hosting choice
- an auth system
- a transport layer opinion
- a specific frontend framework beyond React for the UI package

## Package Structure

The final package shape should remain:

- `opensphinx/schemas`
- `opensphinx/engine`
- `opensphinx/react`

Each subpath should have a single job.

### `opensphinx/schemas`

This is the contract layer.

It should define:

- question type schemas
- answer value schemas
- quiz config schemas
- step schemas
- session state schemas
- engine response schemas
- scoring/report schemas

It should be:

- framework-agnostic
- dependency-light
- the single source of truth for client/server communication

### `opensphinx/engine`

This is the server-side intelligence layer.

It should:

- consume validated `SessionState`
- honor `seedQuestions`
- honor first-class step boundaries
- honor `systemPrompt`
- generate adaptive upcoming steps
- enforce hard constraints like `minQuestions`, `maxQuestions`, `minSteps`, `maxSteps`, and step sizing rules
- decide when the quiz should complete
- score completed sessions
- generate reports

It should not depend on React, Next.js, a database, or any deployment platform.

### `opensphinx/react`

This is the client-side rendering layer.

It should:

- render one question at a time
- consume structured questions from the shared schema
- support queued/prefetched steps
- collect normalized answers
- provide a polished, modern default UI

It should know nothing about AI internals.

## Expected Quiz Flow

The intended runtime flow is seed-first and step-oriented.

### Phase 1: Opening Questions

The developer supplies `seedQuestions` and, conceptually, the engine should be able to treat them as seed steps.

These should be treated as the canonical opening interview. They are not decoration. They are the developer's deliberate starting point.

The default product expectation should be that the opening seed material spans at least two steps. That gives the system enough deterministic opening structure to keep the UI moving while the engine prepares later adaptive steps in the background.

This should be treated as the preferred product pattern, even if the implementation allows simpler flows.

### Phase 2: Adaptive Follow-Up

After enough seed context is gathered, the engine should generate the next step or next set of steps based on:

- the developer's `systemPrompt`
- quiz goals
- prior answered history
- already queued steps
- stopping criteria

The engine should usually prepare more than one upcoming question at a time, typically packaged as a step.

### Phase 3: Prefetch and Fast UX

The UI should not block on every single answer if it can avoid it.

The intended UX is:

- user answers the current step
- while the user is on the current step, the server prepares the next step
- client asks for replenishment before the queued steps are exhausted
- transitions feel fast and continuous

### Phase 4: Completion

The AI should be guided by the `systemPrompt` to recognize when it has enough information.

But the engine must still enforce hard product rules:

- never exceed `maxQuestions`
- never exceed `maxSteps`
- do not stop before `minQuestions`
- do not stop before `minSteps` if such a rule is configured
- validate all generated output against schema
- conclude the form when developer-defined hard limits are reached even if the AI would prefer to continue

## Capabilities OpenSphinx Should Have

### Structured Question Types

The package should support structured, renderable question types such as:

- multiple choice
- multi-select
- free text
- slider
- rating
- yes/no
- number
- date

This fixed catalog is a feature, not a limitation. It makes AI output safe and renderable.

### AI-Guided Adaptive Steps

The engine should generate structured upcoming steps, not just one-at-a-time follow-ups.

This step-oriented generation should:

- improve responsiveness
- reduce round trips
- make the UX feel instantaneous
- still adapt based on history

### Prompt-Guided Interview Strategy

The `systemPrompt` should let developers shape:

- what information matters
- what style of questions should be preferred
- what counts as enough information
- what should be avoided

The prompt should influence the strategy, not the rendering contract.

### Seed-Question-Driven Starts

Developers must be able to provide seed questions alongside the prompt.

This is important because:

- many flows need a deterministic opening
- developers often know the first few questions that matter
- the AI should adapt after a strong baseline, not from a blank slate

The intended product pattern is that seed material covers at least two opening steps so the system has time to prepare adaptive follow-up while the user is still progressing through deterministic seed content.

### Hard Limits And Engine Control

Developers must be able to define hard UX limits when configuring the engine.

This should include:

- maximum total questions
- maximum total steps
- optionally minimum questions
- optionally minimum steps

These are engine-owned rules, not AI suggestions.

If the model thinks it should continue asking questions but a configured hard limit has been reached, the engine should conclude the quiz instead of deferring to the model.

The AI should decide what information is still useful. The engine should decide whether another step is allowed.

### Scoring and Reporting

OpenSphinx should be able to:

- score results against developer-defined dimensions
- generate a report or summary from those scores and answers
- return structured results the host app can store or render

## UX Goals

The frontend experience should feel:

- clean
- modern
- lightweight
- mobile-first
- one-question-at-a-time

The default visual direction should be:

- simple
- tasteful
- not overdesigned
- easy to override

OpenSphinx should ship a solid default experience, but not force a design system ideology.

## Styling Goals

The React package should align with the spirit of ShadCN and Tailwind-friendly composition.

That means:

- good defaults
- className-friendly extension
- easy wrapping and composition
- no proprietary styling system
- no heavy CSS-in-JS requirement

If OpenSphinx is installed into a host app, it should cooperate with the host app's styling system rather than fighting it.

## Safety Goals

OpenSphinx should be safe by construction.

That means:

- AI output is always schema-validated
- only approved question types can be generated
- user answers are passed as structured context, not naively concatenated raw text blobs
- malformed model output retries once and then falls back safely
- the server-side engine owns AI behavior, not the client

## Non-Goals

OpenSphinx should not become:

- a full-stack framework
- a quiz SaaS
- a drag-and-drop builder
- a database abstraction
- an auth system
- an analytics platform
- a deployment framework
- a custom AI-generated component platform

It should stay focused on:

- shared contracts
- adaptive quiz generation
- quiz rendering

## Success Criteria

OpenSphinx is successful if a developer can:

1. install one package
2. define a `QuizConfig` with `systemPrompt` and `seedQuestions`
3. create an engine on the server
4. render the UI on the client
5. transport answers however they want
6. get adaptive follow-up batches quickly
7. stop when enough information has been gathered

And all of that should feel:

- clean
- fast
- obvious
- type-safe
- not overcomplicated

## Principle

OpenSphinx should be the open-source AI quiz engine that asks smarter questions without asking developers to build around the package instead of with it.

## Implementation Checklist

Use this section as the working tracker for the repo.

Status meanings:

- `[not done]` means the capability does not exist yet or is only nominally represented.
- `[partially done]` means some code exists, but the feature is still incomplete, stubbed, rough, or not product-ready.
- `[completed]` means the capability is implemented to the level described in this document, not just scaffolded.

Recommended workflow:

- Pick around 5 items at a time.
- Move them from `[not done]` to `[partially done]` when real implementation exists.
- Only mark `[completed]` when the feature is genuinely usable and aligned with the intended product behavior.

### Shared Contracts

- `[partially done]` Question type catalog exists and is schema-validated.
- `[partially done]` Quiz config supports `systemPrompt`, `seedQuestions`, and `batchSize`.
- `[not done]` First-class step schema exists.
- `[not done]` Config supports explicit step-level pacing rules like `maxSteps`.
- `[partially done]` Session state supports answered history and pending queued questions.
- `[partially done]` Engine batch/complete response contract exists.
- `[not done]` Step-oriented response contract is finalized and stable.
- `[not done]` Session serialization helpers for app/framework storage.
- `[not done]` Finalized public contract review for long-term API stability.

### Engine Core

- `[partially done]` `createQuizEngine()` exists with typed config normalization.
- `[partially done]` Seed-question-first behavior exists.
- `[not done]` Seed content is modeled as explicit multi-step opening flow.
- `[partially done]` AI-backed batch generation exists.
- `[not done]` Step-based generation is first-class rather than batch-first under the hood.
- `[partially done]` Retry-on-invalid-generation behavior exists.
- `[partially done]` Safe fallback question batch exists.
- `[partially done]` Completion logic respects hard bounds like `minQuestions` and `maxQuestions`.
- `[not done]` Completion logic fully respects developer-configured hard step limits.
- `[not done]` Background/prefetch-oriented replenishment strategy feels production-ready.
- `[not done]` Strong prompt strategy for adaptive follow-up quality.
- `[not done]` Better duplicate-question avoidance and history-awareness.
- `[not done]` Provider-level guidance and examples for real model setup.

### Scoring And Reports

- `[partially done]` `score()` returns a deterministic scaffold result.
- `[not done]` Real scoring logic tied to developer scoring dimensions.
- `[partially done]` `generateReport()` exists.
- `[not done]` AI-backed report generation.
- `[not done]` Structured report output format beyond plain text.
- `[not done]` Clear scoring/report customization hooks for developers.

### React UI

- `[partially done]` `SphinxQuiz` renders one question at a time.
- `[partially done]` All current question schema variants have basic rendering support.
- `[partially done]` Loading and progress states exist.
- `[not done]` Step-aware React flow that consumes prefetched steps directly.
- `[not done]` Smooth background replenishment UX between steps.
- `[not done]` Polished visual design aligned with the intended product direction.
- `[not done]` ShadCN-style component quality and ergonomics.
- `[not done]` Theme customization that feels complete and intentional.
- `[not done]` Report display component in the React layer.
- `[not done]` Mobile-first polish and interaction refinement.

### Demo And Integration

- `[not done]` Minimal `demo/` app exists.
- `[not done]` Example server route wiring engine and UI together.
- `[not done]` Example quiz config demonstrating intended adaptive behavior.
- `[not done]` End-to-end step-prefetch flow shown in a real app.
- `[not done]` Documentation/examples for Next.js.
- `[not done]` Documentation/examples for other host environments like Remix or Express.

### Docs And Open Source Readiness

- `[partially done]` `goal.md` describes the target product direction.
- `[partially done]` `README.md` documents the package at a high level.
- `[not done]` README aligned with the final product vision instead of current partial implementation.
- `[not done]` TSDoc across the public API.
- `[not done]` API reference documentation.
- `[not done]` Contributing guide.
- `[not done]` Publish-readiness checklist for npm release.
- `[not done]` Final examples showing clean install-to-usage flow.

### Quality And Safety

- `[partially done]` Build, typecheck, and test pipeline exist.
- `[partially done]` Shared schemas enforce safe question output.
- `[partially done]` AI output fallback behavior exists.
- `[not done]` Broader engine edge-case coverage.
- `[not done]` React behavior tests beyond basic rendering smoke tests.
- `[not done]` Integration tests across the full client/server loop.
- `[not done]` Final safety review against prompt-injection and malformed output risks.
