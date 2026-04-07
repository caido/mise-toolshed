---
title: Require thin return
impact: MEDIUM
impactDescription: Index is a single assembly point for the service public API
tags: service, index, api
---

## Require thin return

The service index (usually `index.ts`) should be a thin assembly layer: call composables and return their spread. No local orchestration logic, no destructuring into named variables that are then reassembled. Just `return { ...funcX(), ...funcY() }`.

This keeps the service index readable and auditable; behavior lives in feature composables, while the index is only responsible for assembling the public API.

**Rules:**

- In the service index file, the `defineService` callback should only `return { ...useFeatureA(), ...useFeatureB() }` (and similar).
- Do not destructure composable results and then re-list properties in the return object; use spread so the index stays a single, flat list of composable calls.
- Keep the `defineService` callback as the single place where the public API object is assembled (aligns with `require-service-utils`).

**Verbose (destructure then reassemble):**

```typescript
export const useExampleService = defineService("service.example", () => {
  const { items, add } = useItemsFeature();
  const { clearAll } = useActionsFeature();

  return {
    items,
    add,
    clearAll,
  };
});
```

**Preferred (thin return with spread):**

```typescript
export const useExampleService = defineService("service.example", () => {
  return {
    ...useItemsFeature(),
    ...useActionsFeature(),
  };
});
```

