---
title: Require service utils
impact: MEDIUM
impactDescription: Consistent service creation via shared utilities
tags: service, utils
---

## Require service utils

**Impact: MEDIUM (consistent service creation via shared utilities)**

Use the project's shared service creation/registration utility so services are created consistently. Many codebases provide a factory (e.g. `defineService`) and a central coordinator (e.g. `serviceManager`); use whatever your project defines.

**Rules:**

- Create services via the project's service factory (e.g. `defineService` or equivalent).
- Pass an **inline arrow function** (or function expression) as the second argument to `defineService`; do not pass a separate named function. The implementation and public API return must live inside that callback.
- Use the project's central service coordinator if one exists.
- Use shared types from the project's service utils for common type definitions.

**Incorrect (separate named function passed to defineService):**

```typescript
function useNotifications() {
  const items = ref([]);
  return { items, add, markRead, clearAll };
}
export const useNotificationsService = defineService("notifications", useNotifications);
```

**Correct (inline callback; public API visible in one place):**

```typescript
import { defineService } from "@/services/utils"; // or your project's path

export const useExampleService = defineService("service.example", () => {
  // Service implementation
  return { /* public API */ };
});
```

