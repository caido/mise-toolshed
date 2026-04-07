---
name: best-practices-ts-components
description: "Conventions for Vue component tests in vitest-browser-vue: render directly, no wrapper; no early exits or conditional assertions—every assertion must run."
---

# Component Best Practices

Conventions for writing and reviewing Vue component tests (e.g. with vitest-browser-vue). Ensures tests render the component under test directly and avoid patterns that hide failures.

## Table of Contents

- [When to Apply](#when-to-apply)
- [References](#references)

## When to Apply

- Writing or reviewing component tests (e.g. `*.spec.ts` for Vue components)
- Ensuring tests render the component under test directly instead of via a wrapper
- Ensuring tests do not use early exits or conditional assertions that hide failures

## References

- [prefer-direct-render](references/prefer-direct-render.md) – Render the component under test directly with `render(Component, options)`; do not use a wrapper component.
- [no-conditional-assertions](references/no-conditional-assertions.md) – No early exits or assertions inside conditionals; use non-null assertions or direct assertions so every assertion runs.

## Structure

- `SKILL.md` – This file; entry point for the skill. Include a Table of Contents and a References section (link to each reference + one-line description).
- `references/` – One small reference file per rule; filenames follow naming-convention (kebab-case).
