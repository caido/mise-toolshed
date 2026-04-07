---
title: Index spec only
impact: HIGH
tags: service, store, testing
---

## Only test public APIs used by other layers

Test only the **public API** that other layers (components, services, workflows) use. Do not import or test private or internal modules directly—e.g. do not test private store files; test using the store’s public interface. For services and stores, put all tests in **`index.spec.ts`** and exercise the public surface only.

**Service rules:**

- Only `index.spec.ts` may contain tests for a service.
- Never create test files for internal composables (e.g. `useInitialize.spec.ts`).
- Test private behavior by exercising the public API.

**Store rules:**

- Do not import or test `useState.ts`, `use[Feature].ts`, or private helpers directly.
- Put all tests in `index.spec.ts` and assert against the behavior exposed by the store (the same API that services and components use).

**Correct (service — through public API):**

```typescript
// In index.spec.ts
it("should initialize", async () => {
  const testKit = createAutomateTestKit({ /* ... */ });
  await testKit.service.start();
  expect(testKit.service.state).toMatchObject({ kind: "Success" });
});
```

**Incorrect (testing internal composable directly):**

```typescript
import { useAutomateInitialize } from "@/services/automate/useInitialize";
it("should initialize", () => {
  const { initialize } = useAutomateInitialize();
  initialize();
});
```
