---
title: Cross-store communication
impact: LOW
impactDescription: Coordination via store actions; avoid coupling elsewhere
tags: store, pinia, communication
---

## Cross-store communication

When one store needs to react to or trigger another, call the other store's actions from inside a store action. Do not couple stores in components or services by orchestrating multiple stores in the same place.

**Rules:**

- Inside a store's action, call `useOtherStore()` and invoke the other store's action (e.g. `otherStore.relatedAction()`).
- Update local state in the current store and trigger related store updates from that single action so coordination stays in one place.

**Example:**

```typescript
export const useCoordinatedStore = defineStore("stores.coordinated", () => {
  const otherStore = useOtherStore();

  const coordinatedAction = () => {
    localState.value = newValue;
    otherStore.relatedAction();
  };

  return { coordinatedAction };
});
```
