---
name: best-practices-ts-tests
description: "Conventions for writing and reviewing TypeScript/Vue tests (unit, component, store, service). Use when adding or improving tests, writing spec files, or when the user mentions tests, test cases, *.spec.ts, Vitest, or test conventions."
---

# Test Best Practices

Conventions for writing and reviewing tests: assertion discipline, spec layout, and domain-specific rules for component, service, and store tests. Ensures tests are clear, maintainable, and aligned with project and skill conventions.

## Table of Contents

- [When to Apply](#when-to-apply)
- [Core Rules (cross-cutting)](#core-rules-cross-cutting)
- [By Target Type](#by-target-type)
- [References](#references)

## When to Apply

- Writing or reviewing unit, component, store, or service tests
- Adding test cases to an existing spec
- Validating tests with mutations (mutate source → fail → revert → pass)
- Deciding spec layout, assertion style, or test structure
- User asks about tests, test cases, `*.spec.ts`, Vitest, or test conventions

## Core Rules (cross-cutting)

- **Read the source under test first** — Understand behavior before writing tests. See [read-source-first](references/read-source-first.md).
- **One distinct behavior or scenario per test case** — Each test asserts a single, meaningful scenario. Add exactly the number of test cases requested. See [one-behavior-per-test](references/one-behavior-per-test.md).
- **No early exits or conditional assertions** — Every assertion must run; no `if (x) return` or assertions inside `if`. Use non-null assertion or direct assert so the test fails at the assertion. See [no-conditional-assertions](references/no-conditional-assertions.md).
- **No type-only tests** — Do not add tests that only re-assert TypeScript guarantees (for example, `toBeDefined()` on a non-optional typed field). Assert runtime behavior instead. See [no-type-tests](references/no-type-tests.md).
- **Avoid vacuous assertions** — Ensure assertions are sensitive to the behavior you claim to test. Avoid “always true” checks (e.g. spy call-count lower bounds like `>= 0`) that can pass even when the relevant behavior never occurs.
  - If you test that an async callback / side effect happened, assert it directly (e.g. the spy was called or the observable output was produced) rather than asserting a condition that can’t fail.
- **Assert against the public API only** — Assert observable behavior and public contracts, not internal implementation. Do not spy on internal members or assert that internal functions were called; refactors would break tests without changing behavior. See [assert-public-api-only](references/assert-public-api-only.md).
- **Use project tooling** — Run tests with e.g. `mise test:file <path>`; use `mise typecheck`, `mise lint:file` as needed.
- **Green vs red** — **Green**: tests pass (assert current, correct behavior). **Red**: tests fail (TDD, document a bug). Specify which is desired. See [green-vs-red](references/green-vs-red.md).
- **When extending a spec** — Match the existing style and structure.
- **Mutation validation (optional)** — After adding tests, mutate the source (not the spec) so tests fail; run tests (must fail); revert mutations; run again (must pass). Do not commit mutations. See [mutation-validation](references/mutation-validation.md).

## By Target Type

- **Component tests** — Render the component under test directly with `render(Component, options)`; no wrapper component. See [prefer-direct-render](references/prefer-direct-render.md). For full component conventions, read best-practices-ts-components SKILL.md.
- **Service tests** — Only test the **public API** used by other layers (e.g. components, workflows). Put all tests in `index.spec.ts`; do not test private or internal modules directly. Use test kits for repository mocking; assert state with `toMatchObject`; never assert repository calls or access stores directly. See [index-spec-only](references/index-spec-only.md), [test-kits-and-state-verification](references/test-kits-and-state-verification.md). For full service conventions, read best-practices-ts-services SKILL.md.
- **Store tests** — Only test the **public API** used by other layers (e.g. services, components). Put all tests in `index.spec.ts`; do not test private store files (e.g. `useState.ts`, internal composables) directly—test via the store’s public interface. For FSM behavior, structure tests by state with `describe` per state, `beforeEach`, `fsm.get()`, and `Extract<>`. See [index-spec-only](references/index-spec-only.md), [fsm-tests-by-state](references/fsm-tests-by-state.md). For full store conventions, read best-practices-ts-stores SKILL.md.

Spec file placement: exactly one spec per task; create next to the source or in the conventional location (`*.spec.ts`, `*.test.ts`, or `__tests__`).

## References

- [assert-public-api-only](references/assert-public-api-only.md) – Assert observable behavior and public API; do not spy on or assert internal members or internal function calls.
- [no-conditional-assertions](references/no-conditional-assertions.md) – No early exits or assertions inside conditionals; every assertion runs.
- [no-type-tests](references/no-type-tests.md) – Avoid tests that only verify TypeScript guarantees; assert runtime behavior instead.
- [prefer-direct-render](references/prefer-direct-render.md) – Component tests: render the component directly; no wrapper.
- [one-behavior-per-test](references/one-behavior-per-test.md) – One distinct behavior per test case; add exact count requested.
- [read-source-first](references/read-source-first.md) – Read the source under test before writing tests.
- [mutation-validation](references/mutation-validation.md) – Mutate source → tests fail → revert → pass; do not commit mutations.
- [index-spec-only](references/index-spec-only.md) – Only test public APIs used by other layers; don’t test private modules (e.g. private store files) directly—test via the public interface (index.spec.ts for services/stores).
- [test-kits-and-state-verification](references/test-kits-and-state-verification.md) – Service tests: test kits for repo mocking; assert state; never assert repository calls.
- [fsm-tests-by-state](references/fsm-tests-by-state.md) – Store FSM tests: describe per state, beforeEach, get(), Extract.
- [green-vs-red](references/green-vs-red.md) – Green = pass (current behavior), red = fail (TDD, bug doc).
