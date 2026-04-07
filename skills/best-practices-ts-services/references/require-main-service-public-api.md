---
title: Require main service public API
impact: MEDIUM
impactDescription: The main composable is the single entry point for consumers
tags: service, structure, api
---

## Require main service public API

**Impact: MEDIUM (the main composable is the single entry point for consumers)**

The main service composable must be the public interface. It returns data, actions, and computed properties that consumers (components) use.

**Rules:**

- The main service file (`useServiceName.ts` or `index.ts`) must be the only public entry point.
- It must return an object with all public data, actions, and computed properties.
- Internal composables (`useInitialize.ts`, `useSpecificFeature.ts`) are private and must not be imported by consumers.

**Incorrect (component imports internal composable):**

```typescript
import { useAutomateInitialize } from "@/services/automate/useInitialize";

const { initialize } = useAutomateInitialize();
```

**Correct (component uses main service):**

```typescript
import { useAutomateService } from "@/services/automate";

const automateService = useAutomateService();
await automateService.initialize();
```

