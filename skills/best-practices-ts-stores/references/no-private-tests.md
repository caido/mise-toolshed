---
title: No private tests
impact: MEDIUM
impactDescription: Test only the public API; avoid coupling to implementation
tags: store, testing
---

## No private tests

Do not test private files or private functions. Put all store tests in **`index.spec.ts`** and test the **public API** of the store.

**Rules:**

- Do not import or test `useState.ts`, `use[Feature].ts`, or any private helpers directly.
- Do not write `use[Feature].spec.ts` that test composables in isolation; test through the store's public API instead.
- Put all tests in `index.spec.ts` and assert against the behavior exposed by the store (the same API that services and components use).
- For FSM behavior, structure tests by state and use the FSM via the public store; see [fsm-tests-by-state.md](./fsm-tests-by-state.md).
