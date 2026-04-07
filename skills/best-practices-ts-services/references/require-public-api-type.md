---
title: Require public API type
impact: HIGH
impactDescription: Single source of truth for consumers; type safety and discoverability
tags: service, types, pinia
---

## Require public API type

The main service composable exposes a single, explicit type (e.g. `AutomateService`) that lists every field, action, and computed value consumers are allowed to use. The callback passed to `defineService` is typed with that service type as its return type (e.g. `(): AutomateService =>`), so the implementation is checked against the contract.

When the service public type references feature-specific message types (for example, an event or FSM state message), export those message types from the corresponding composable so the service type can reference them without circular dependencies. Export the service type only when a consumer needs it.

**Rules:**

- Define a service type (e.g. `AutomateService`) in the service index (`useServiceName.ts` or `index.ts`) with every public function and public data field the composable returns.
- Use the service type as the return type of the `defineService` callback: `defineService("service.name", (): AutomateService => { ... })`.
- Service public types must reflect what the service composables actually return (before Pinia unwrap).
  - Fields created with `computed(...)` must be typed as `ComputedRef<T>`.
  - (And if you have any `ref(...)` fields, they should be typed as `Ref<T>` to match the composable return.)
- Export feature message types from the feature composable only when they appear in the service's public type.

**Incorrect (inference-only public API type):**

```typescript
export const useExampleService = defineService("service.example", () => {
  return {
    // Inference-only: consumers do not get a single explicit API contract.
    ...useSomeFeature(),
    ...useSomeOtherFeature(),
  };
});
```

**Correct (explicit type as callback return type):**

```typescript
import { defineService } from "@/services/utils";
import type { ComputedRef } from "vue";

import { useSomeFeature, type SomeMessage } from "./useSomeFeature";
import { useSomeOtherFeature } from "./useSomeOtherFeature";

type ExampleService = {
  someAction: (message: SomeMessage) => Promise<void>;
  // Public computed fields must be typed as ComputedRef to match the composable output.
  someValue: ComputedRef<string>;
};

export const useExampleService = defineService(
  "service.example",
  (): ExampleService => {
    return {
      ...useSomeFeature(),
      ...useSomeOtherFeature(),
    };
  },
);
```

