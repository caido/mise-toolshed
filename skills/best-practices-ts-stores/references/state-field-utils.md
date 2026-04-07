---
title: State field utils
impact: HIGH
impactDescription: Consistent reactivity and per-field reset in useState
tags: store, pinia, useState, field
---

## State field utils

In `useState.ts`, use `field<T>(() => initialValue)` and `shallowField<T>(() => initialValue)` from `../utils` (re-exported from `fields.ts`). **Every** reactive state field must be created with `field()` or `shallowField()` — including class instances and collections (e.g. `DataStore`, `Set`, `Map`, `LRUSet`). Do not use `ref()`, `shallowRef()`, or raw variables holding `new DataStore()`, `new Set()`, etc. directly.

**Rules:**

- Each field: `const [value, resetValue] = field<T>(() => initial)` or `shallowField<T>(() => initial)`.
- Return the refs (and any per-field reset fns if needed) from the `defineStoreState` callback, plus a single `reset()` that calls all field reset functions.
- For class instances and collections (DataStore, Set, Map, LRUSet), use `shallowField<T>(() => new ...)` so the ref wraps the instance and reset replaces it.

**Example:**

```typescript
import { defineStoreState, field } from "../utils";

export const useState = defineStoreState("stores.user.state", () => {
  const [profileState, resetProfileState] = field<UserProfileState>(() => ({ kind: "Idle" }));
  const [isPlanUpgradeDialogOpen, resetIsPlanUpgradeDialogOpen] = field<boolean>(() => false);

  const reset = () => {
    resetProfileState();
    resetIsPlanUpgradeDialogOpen();
  };

  return {
    profileState,
    isPlanUpgradeDialogOpen,
    reset,
  };
});
```

**Class/collection example (e.g. task store with DataStore and Set):**

```typescript
const [taskStore, resetTaskStore] = shallowField<DataStore<Task>>(() => new DataStore((t) => t.id));
const [tasks, resetTasks] = shallowField<Set<Task>>(() => new Set());
// In reset(): call resetTaskStore(); resetTasks();
```

Reference: [packages/ui/src/stores/user/useState.ts](../../../../packages/ui/src/stores/user/useState.ts), [packages/ui/src/stores/utils/fields.ts](../../../../packages/ui/src/stores/utils/fields.ts).
