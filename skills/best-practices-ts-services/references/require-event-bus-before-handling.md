---
title: Require event bus before handling
impact: LOW
impactDescription: Declaring event buses far from their handlers reduces readability
tags: service, events
---

## Require event bus before handling

**Impact: LOW (declaring event buses far from their handlers reduces readability)**

When handling events in domain-specific services, declare each event bus right before its usage. This keeps the bus declaration co-located with the handler for readability.

**Correct (event bus declared right before usage):**

```typescript
const createdEventBus = useCreatedEventBus();
createdEventBus.on(({ edge }) => {
  store.sessionsState.send({
    kind: "AddSession",
    session: edge.node,
  });
});
```

