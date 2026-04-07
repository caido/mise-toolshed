---
title: Require event emit subscribe
impact: MEDIUM
impactDescription: Event-driven communication decouples services from consumers
tags: service, pattern, events
---

## Require event emit subscribe

**Impact: MEDIUM (event-driven communication decouples services from consumers)**

Services that need cross-component communication must use an emit/subscribe pattern via a dedicated composable.

**Rules:**

- Cross-component communication must go through service events, not direct method calls between unrelated services.
- Event composables must expose `emit` and `subscribe` (or use an event bus).
- Consumers subscribe to events; producers emit them.

**Correct (event-driven pattern):**

```typescript
export function useServiceEvents() {
  const emit = (event: ServiceEvent) => {
    // Emit service event
  }

  const subscribe = (handler: EventHandler) => {
    // Subscribe to events
  }

  return { emit, subscribe }
}
```

