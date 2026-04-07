---
name: best-practices-ts-tools
description: "Explains the project's mise-backed tools (typecheck, knip, test:file, lint:file)—what each does and the order to run them. Use when validating changes, before opening a PR, or when the user asks about typecheck, knip, lint:file, test:file, or what order to run checks."
---

# TypeScript / validation tools

Conventions for running the project's validation tools: what each tool does, how to invoke it, and the order to run them in. Run from the project root where mise is configured.

## When to Apply

- Validating code changes before committing or opening a PR
- When asked which tools to run or in what order
- When typecheck, knip, test:file, or lint:file is mentioned
- Before opening a PR (run the full sequence)

## Tool order

Run tools in this order. If a step fails, fix and re-run that step before proceeding.

1. **typecheck**
2. **knip**
3. **test:file**
4. **lint:file**

Run from the project root where mise is configured (e.g. the repo that defines these tasks). See the proxy-frontend-refactor workflow steps 5–8 for the canonical validation sequence.

## typecheck

**What:** TypeScript type-check for the whole project. Catches type errors before tests or lint.

**How:** `mise typecheck`. No path argument. Run first.

## knip

**What:** Finds unused files, dependencies, and exports. Surfaces dead code and unnecessary exports (e.g. unused store types).

**How:** `mise knip`. No path argument. Run after typecheck.

## test:file

**What:** Runs tests for a given file or pattern (e.g. a spec file or the touched area). Use to validate that changes don't break tests.

**How:** `mise test:file <path-or-pattern>`. Examples: `mise test:file packages/ui/src/stores/context/index.spec.ts`, or a pattern for the affected package or files. Run after knip.

## lint:file

**What:** Lints the given file(s). Enforces style and project lint rules.

**How:** `mise lint:file <path>`. Run once per changed path (not the whole repo). Run last, after test:file passes.
