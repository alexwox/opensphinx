# OpenSphinx

OpenSphinx is the open-source AI quiz engine that asks smarter questions.

This repository is currently scaffolded as a single npm package named `opensphinx` with three explicit subpath exports:

- `opensphinx/react`
- `opensphinx/engine`
- `opensphinx/schemas`

The current focus is package structure only. Product-specific quiz logic is intentionally not implemented yet.

## Current Status

- Single-package library scaffold
- ESM-first build via `tsup`
- Strict TypeScript configuration
- Vitest smoke tests for public subpath imports
- Placeholder entry points for `react`, `engine`, and `schemas`

## Install

This repo uses `pnpm` for development.

```bash
pnpm install
```

## Commands

```bash
pnpm build
pnpm typecheck
pnpm test
pnpm clean
```

## Public Imports

```ts
import { SphinxQuiz } from "opensphinx/react";
import { createQuizEngine } from "opensphinx/engine";
import type { QuestionSpec, QuizConfig } from "opensphinx/schemas";
```

There is intentionally no root `opensphinx` catch-all export. Consumers import from the explicit subpath they need.

## Package Design

- Small, explicit public surface
- No deep import paths
- No framework coupling between subpaths
- No hidden runtime setup
- No placeholder business logic beyond minimal API stubs

## Dependencies

- `react` and `react-dom` are modeled as optional peer dependencies because only the `opensphinx/react` entry point should care about them.
- The engine and schema layers stay separate from React concerns.
- The package publishes `dist/` only.

## Repo Layout

```text
src/
  engine/
  react/
  schemas/
test/
```
