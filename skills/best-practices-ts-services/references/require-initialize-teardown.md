---
title: Require initialize teardown
impact: MEDIUM
impactDescription: Proper lifecycle management prevents resource leaks
tags: service, pattern, lifecycle
---

## Require initialize teardown

**Impact: MEDIUM (proper lifecycle management prevents resource leaks)**

Services that need setup or cleanup must expose `initialize` and `teardown` methods from a `useServiceInitialize` composable.

**Rules:**

- Services requiring runtime setup (subscriptions, listeners, connections) must provide `initialize` and `teardown`.
- Both must be returned from a dedicated `useServiceInitialize` composable inside the service domain.
- `initialize` is typically async; `teardown` performs synchronous cleanup.

**Correct (initialization pattern):**

```typescript
export function useServiceInitialize() {
  const initialize = async () => {
    // Setup service: subscribe to events, open connections
  }

  const teardown = () => {
    // Cleanup service: unsubscribe, close connections
  }

  return { initialize, teardown }
}
```

