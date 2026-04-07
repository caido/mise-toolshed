---
title: No refs
impact: MEDIUM
impactDescription: Stable public API; no leaking refs/computed
tags: store, composable, pinia
---

## No refs

Composables (e.g. `use[Feature].ts`) get state from the private store (`useState()`). They must expose getters and setters (or actions), not raw `ref` or `computed` values.

**Rules:**

- Call `useState()` inside the composable to access state.
- Handle all state transitions and business logic in the composable.
- Return functions (getX, setX, doY); do not return `computed` or `ref` directly so the store's public API stays stable and opaque.

**Example:**

```typescript
const useX = () => {
  const state = useState();

  const getX = () => state.x;
  const setX = (value: X) => { state.x = value; };

  return { getX, setX };
};
```

Keep FSM message types in the same file as the FSM implementation (see [local-fsm-message-types.md](./local-fsm-message-types.md)).
