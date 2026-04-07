---
title: Require event bus top-level emission
impact: MEDIUM
impactDescription: Declaring event buses inside functions creates new instances on each call
tags: service, events, lifecycle
---

## Require event bus top-level emission

**Impact: MEDIUM (declaring event buses inside functions creates new instances on each call)**

When emitting events (e.g. in `useInitialize`), the event bus must be declared at the composable top level, never inside a function. Use the project's event bus API (e.g. `useEventBus`).

**Incorrect (event bus declared inside function):**

```typescript
const start = () => {
  const eventBus = useEventBus();
  eventBus.emit();
};
```

**Correct (event bus declared at composable top level):**

```typescript
const eventBus = useEventBus();
const start = () => {
  eventBus.emit();
};
```

