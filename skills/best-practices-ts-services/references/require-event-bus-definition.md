---
title: Require event bus definition
impact: MEDIUM
impactDescription: Inconsistent event definitions make event buses hard to discover and debug
tags: service, events
---

## Require event bus definition

**Impact: MEDIUM (inconsistent event definitions make event buses hard to discover and debug)**

Event buses must be defined in a dedicated `events.ts` file within the service domain. Event bus keys must follow the format `services.{service-name}.{event-name}` (kebab-case). Use the project's event bus API (e.g. `useEventBus`). Only define event types when events carry arguments.

**Rules:**

- All event bus definitions must live in `events.ts` inside the service folder.
- Key format: `services.{service-name}.{event-name}` (kebab-case).
- Define an event type only when the event carries relevant arguments.
- Skip the type definition for events without arguments.

**Correct (event with args):**

```typescript
export type CreatedSessionEvent = {
  edge: ExampleSessionEdge;
};

export const useCreatedSessionEventBus = () => {
  return useEventBus<CreatedSessionEvent>("services.example.created-session");
};
```

**Correct (event without args):**

```typescript
export const useServiceStartEventBus = () => {
  return useEventBus("services.example.service-start");
};
```

