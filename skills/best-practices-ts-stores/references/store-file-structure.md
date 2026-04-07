---
title: Store file structure
impact: HIGH
impactDescription: Predictable store layout; no extra or missing files
tags: store, structure, files
---

## Store file structure

Each store directory must contain only these files:

1. **`index.ts`** – Main store; exposes public interface (see [require-public-api-type.md](./require-public-api-type.md), [require-thin-return.md](./require-thin-return.md)).
4. **`index.spec.ts`** – Tests for the public API of the store.
2. **`useState.ts`** – Private state via `defineStoreState`; state shape and `reset` (see [define-store-state.md](./define-store-state.md), [state-field-utils.md](./state-field-utils.md)).
3. **`use[Feature].ts`** – Composables with business logic (e.g. `useProfileState.ts`, `useShortcuts.ts`).

**Rules:**

- Do not add a separate `types.ts` for the state type; state shape is defined in `useState.ts` (or inferred from its return type).
- Do not add other files (e.g. extra composables or helpers) unless they follow the same naming and purpose pattern.
