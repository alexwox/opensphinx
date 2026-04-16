# Changelog

## 0.1.0-alpha.0

- First public alpha release of `opensphinx`.
- Ships the minimal supported surface:
  - `opensphinx/schemas`
  - `opensphinx/engine`
  - `opensphinx/react`
- Standardizes on the step-first workflow:
  - `SessionState` and `Step` as the runtime source of truth
  - `createFormEngine({ model, config }).generateStep()` as the only generation path
  - `SphinxForm` as the supported React surface
- Documents provider injection, system prompt usage, seed questions/steps, and step/question limits.
- Keeps the demo intentionally thin and aligned with the package workflow.
