---
title: Require thin return
impact: MEDIUM
impactDescription: Readability and maintainability; index is a single assembly point
tags: store, index, pinia, composables
---

## Require thin return

The store `index.ts` should be a thin assembly layer: call composables and return their spread. No local logic, no destructuring into named variables that are then reassembled. Just `return { ...funcX(), ...funcY() }`. This keeps the index readable and easy to maintain; all behavior lives in composables.

**Rules:**

- In `index.ts`, the `defineStore` callback body should only `return { ...useState(), ...useA(), ...useB() }` (and similar).
- Do not destructure composable results and then list properties in the return object; use spread so the index stays a single, flat list of composable calls.
- Keep the store type and callback return type as in [require-public-api-type.md](./require-public-api-type.md); the thin return is the implementation style.

**Verbose (destructure then reassemble):**

```typescript
export const useShortcutStore = defineStore(
  "stores.shortcut",
  (): ShortcutStore => {
    const { reset, resetCustomShortcuts } = useState();
    const {
      getShortcuts,
      getShortcutByCommand,
      getCustomShortcuts,
      setShortcut,
      isEnabled,
      toggleEnabled,
      getShortcutsByKeys,
    } = useShortcuts();

    return {
      reset,
      resetCustomShortcuts,
      getShortcuts,
      getShortcutByCommand,
      getCustomShortcuts,
      setShortcut,
      isEnabled,
      toggleEnabled,
      getShortcutsByKeys,
    };
  },
);
```

**Preferred (thin return with spread):**

```typescript
export const useShortcutStore = defineStore(
  "stores.shortcut",
  (): ShortcutStore => {
    return {
      ...useState(),
      ...useShortcuts(),
    };
  },
);
```

Reference: [packages/ui/src/stores/user/index.ts](../../../../packages/ui/src/stores/user/index.ts).

