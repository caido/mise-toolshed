---
title: Require public API type
impact: HIGH
impactDescription: Single source of truth for consumers; type safety and discoverability
tags: store, types, pinia
---

## Require public API type

The store exposes a single, explicit type (e.g. `UserStore`) that lists every field and function signature consumers can use. The callback passed to `defineStore` is typed with that type as its return type (e.g. `(): UserStore =>`), so the implementation is checked against the contract. When the store type includes FSM state (e.g. `profileState.send(message)`), the message type is exported from the composable so the store type can reference it without circular dependencies. Export the store type only when a consumer needs it (e.g. for function parameters); knip will flag unused exports, so pre-emptive exports are unnecessary.

**Rules:**

- Define a store type (e.g. `UserStore`) in the store `index.ts` with every action, getter, and nested object signature. Export it only when a consumer needs it.
- Include in the type: `reset`, all composable-returned functions (e.g. `toggleEntitlements`, `getDev`, `isPlanUpgradeDialogOpen`, `togglePlanUpgradeDialog`), and FSM objects with `get()` and `send(message)` typed with the concrete message type.
- Export FSM message types from the composable (e.g. `UserProfileStateMessage` from `useProfileState.ts`) when they appear in the public store type.
- Use the store type as the return type of the `defineStore` callback: `defineStore("stores.user", (): UserStore => { ... })`.

**Incorrect (no explicit type; API is inference-only):**

```typescript
export const useUserStore = defineStore("stores.user", () => {
  const state = useState();
  const reset = () => state.reset();
  return {
    reset,
    ...useProfileState(),
    ...useDevelopment(),
    ...usePlanUpgradeDialog(),
  };
});
```

**Correct (explicit type as callback return type):**

```typescript
import type { UserProfileState } from "@proxy-frontend/types";

import { defineStore } from "../utils";

import { useDevelopment } from "./useDevelopment";
import { usePlanUpgradeDialog } from "./usePlanUpgradeDialog";
import {
  useProfileState,
  type UserProfileStateMessage,
} from "./useProfileState";
import { useState } from "./useState";

type UserStore = {
  reset: () => void;
  profileState: {
    get: () => UserProfileState;
    send: (message: UserProfileStateMessage) => void;
  };
  toggleEntitlements: () => void;
  getDev: () => { entitlementsOverriden: boolean };
  isPlanUpgradeDialogOpen: () => boolean;
  togglePlanUpgradeDialog: (value: boolean) => void;
};

export const useUserStore = defineStore("stores.user", (): UserStore => {
  return {
    ...useState(),
    ...useProfileState(),
    ...useDevelopment(),
    ...usePlanUpgradeDialog(),
  };
});
```

Reference: [packages/ui/src/stores/AGENTS.md](../../../../packages/ui/src/stores/AGENTS.md) and the user store at [packages/ui/src/stores/user/index.ts](../../../../packages/ui/src/stores/user/index.ts).

