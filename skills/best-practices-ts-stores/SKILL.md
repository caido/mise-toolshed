---
name: best-practices-ts-stores
description: "Pinia store conventions for proxy-frontend: public API type, index-only public surface, composables, reset. Invoke when the user needs shared app state, global state, or to avoid prop drilling. Use when writing or reviewing stores, defining store types, or ensuring the store API is typed for consumers."
---

# Store Best Practices

Conventions for Pinia stores: explicit public API type, single public surface from the store index, composables for logic, and reset. Ensures consumers get a typed, discoverable contract.

## Table of Contents

- [When to Apply](#when-to-apply)
- [Required Patterns](#required-patterns)
- [References](#references)

## When to Apply

- Writing or editing store code (index.ts, useState, useX composables)
- Defining or updating the store's public type
- Reviewing store API surface or adding new store members
- Ensuring new stores follow the same pattern as existing ones
- User asks for data/state to be accessible across components without prop drilling, or for global/shared app state (e.g. user, theme, notifications)

## Required Patterns

Every store follows this structure. The project has custom helpers in `src/stores/utils` (`defineStoreState`, `defineStore`, `field`, `shallowField`) that wrap Pinia with type-safe constraints and per-field reset support. Using these helpers instead of raw Pinia/Vue primitives keeps stores consistent and gives every field a reset function for free.

### File layout

Each store lives in `src/stores/<feature>/` with exactly these files:

- `useState.ts` — private reactive state
- `use<Feature>.ts` — one or more composables with business logic
- `index.ts` — public store definition (the only file consumers import)
- `index.spec.ts` — all tests (never test private files directly)

### Store ID

Use the format `stores.<feature-name>` (kebab-case feature segment):

```typescript
// Private state key adds .state suffix
defineStoreState("stores.notifications.state", () => { ... })

// Public store
defineStore("stores.notifications", (): NotificationsStore => { ... })
```

### useState.ts — private state

Use `defineStoreState` and `field()` or `shallowField()` from `../utils`. **Every** reactive state field in `useState.ts` must be created with `field()` or `shallowField()` — including class instances and collections (e.g. `DataStore`, `Set`, `Map`, `LRUSet`). Each field returns a `[ref, resetFn]` tuple. Combine all reset functions into a single `reset()`. Do not use `ref()`, `shallowRef()`, or raw variables holding `new DataStore()`, `new Set()`, etc. directly.

**Incorrect (raw class/collection instances):**

```typescript
export const useState = defineStoreState("stores.task.state", () => {
  const taskStore = new DataStore((t) => t.id);
  const tasks = new Set<Task>();
  const removedTasks = new LRUSet(100);
  const reset = () => { taskStore.clear(); tasks.clear(); removedTasks.clear(); };
  return { taskStore, tasks, removedTasks, reset };
});
```

**Correct (wrapped in field / shallowField):**

```typescript
import { defineStoreState, field, shallowField } from "../utils";

export const useState = defineStoreState("stores.notifications.state", () => {
  const [items, resetItems] = field<Notification[]>(() => []);
  const [filter, resetFilter] = field<string>(() => "all");
  const [taskStore, resetTaskStore] = shallowField<DataStore<Task>>(() => new DataStore((t) => t.id));
  const [tasks, resetTasks] = shallowField<Set<Task>>(() => new Set());

  const reset = () => {
    resetItems();
    resetFilter();
    resetTaskStore();
    resetTasks();
  };

  return { items, filter, taskStore, tasks, reset };
});
```

### Composables — business logic

Composables call `useState()` to access state and expose **getter/setter functions or actions** — never raw `ref` or `computed`. This keeps the public API stable; internal reactivity is an implementation detail.

```typescript
import { useState } from "./useState";

export function useNotifications() {
  const state = useState();

  const getItems = () => state.items;
  const addItem = (item: Notification) => { state.items.push(item); };
  const markAsRead = (id: string) => { ... };

  return { getItems, addItem, markAsRead };
}
```

### index.ts — public store

Define an explicit store type listing every public member. Use `defineStore` with the type as the callback return type. The body is a thin return that spreads composables — no local logic or destructuring.

```typescript
import { defineStore } from "../utils";
import { useNotifications } from "./useNotifications";
import { useState } from "./useState";

type NotificationsStore = {
  reset: () => void;
  getItems: () => Notification[];
  addItem: (item: Notification) => void;
  markAsRead: (id: string) => void;
};

export const useNotificationsStore = defineStore(
  "stores.notifications",
  (): NotificationsStore => {
    return {
      ...useState(),
      ...useNotifications(),
    };
  },
);
```

### Tests — index.spec.ts only

All tests go in `index.spec.ts` and exercise the public API through the store. Do not import or test useState or composables directly.

## References

- [require-public-api-type](references/require-public-api-type.md) – Explicit store type with all signatures; callback return type `(): UserStore =>`; export store type only when needed; export FSM message types from composables when needed.
- [require-thin-return](references/require-thin-return.md) – Store index is only `return { ...funcX(), ...funcY() }`; no local logic or destructuring.
- [store-id-format](references/store-id-format.md) – Store ID format `stores.[feature-name]`; Pinia setup API.
- [define-store-state](references/define-store-state.md) – Use defineStoreState for private state (useState), defineStore for public store.
- [state-field-utils](references/state-field-utils.md) – Use field() / shallowField() in useState; no ref/shallowRef directly. When refactoring a store, read this and [define-store-state](references/define-store-state.md) so every state field uses field/shallowField.
- [store-file-structure](references/store-file-structure.md) – Only index.ts, index.spec.ts, useState.ts, use[Feature].ts per store.
- [no-refs](references/no-refs.md) – Composables expose getters/setters; never return raw ref/computed.
- [local-fsm-message-types](references/local-fsm-message-types.md) – Keep FSM message types in FSM file; do not move to @/types.
- [fsmmessage-utility](references/fsmmessage-utility.md) – Use FSMMessage<Kind, Data> for message types; no manual kind unions.
- [store-event-bus](references/store-event-bus.md) – events.ts; keys stores.[feature].[event-name] (kebab-case).
- [no-private-tests](references/no-private-tests.md) – Do not test private files/functions; put all tests in index.spec.ts and test the public API.
- [fsm-tests-by-state](references/fsm-tests-by-state.md) – FSM tests: describe by state, beforeEach, get(), Extract.
- [cross-store-communication](references/cross-store-communication.md) – Coordinate by calling other store actions from store actions.
- [store-utils](references/store-utils.md) – stores.ts, fields.ts, useFSM.ts, useListener.ts from src/stores/utils.
- [store-folders](references/store-folders.md) – Store folders by domain (security, automation, config, etc.).
