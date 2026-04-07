---
title: Require service domain files
impact: MEDIUM
impactDescription: Consistent file layout makes services discoverable and maintainable
tags: service, structure
---

## Require service domain files

**Impact: MEDIUM (consistent file layout makes services discoverable and maintainable)**

Each service domain must follow a standard file layout with specific file roles.

**Rules:**

- Each service domain must contain a main composable (`useServiceName.ts`) as the public interface.
- Feature-specific logic must go in separate composables (`useSpecificFeature.ts`).
- Setup and teardown logic must go in `useInitialize.ts`.
- Event definitions must go in `events.ts`.
- When creating or refactoring a service to conventions, add placeholder `useInitialize.ts` and `events.ts` even if the first version doesn't use them.

**Correct (standard service domain files):**

```typescript
// useServiceName.ts - Main service interface
export function useServiceName() {
  return { data, actions, computed }
}

// useSpecificFeature.ts - Feature-specific logic
export function useSpecificFeature() {
  // Feature implementation
}

// useInitialize.ts - Service setup and teardown
export function useServiceInitialize() {
  // Initialization logic
}

// events.ts - Service-specific events
export const ServiceEvents = {
  // Event definitions
}
```

