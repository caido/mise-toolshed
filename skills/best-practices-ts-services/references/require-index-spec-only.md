---
title: Require index spec only
impact: HIGH
impactDescription: Tests spread across multiple files make private APIs appear public and fragment coverage
tags: service, testing
---

## Require index spec only

**Impact: HIGH (tests spread across multiple files make private APIs appear public and fragment coverage)**

All service tests must be in `index.spec.ts` files only. Internal composables (`useInitialize.ts`, `useRequestState.ts`, etc.) are private APIs and must not have their own test files. Test private behavior by exercising the public API.

**Rules:**

- Only `index.spec.ts` may contain tests for a service.
- Never create test files for internal composables (e.g. `useInitialize.spec.ts`).
- Never write tests that directly call or import internal composable functions.
- Test private behavior by exercising the public API that delegates to those internals.
- All tests must go through `testKit.service.methodName()`.

**Incorrect (separate test file for internal composable):**

```
services/automate/
  index.ts
  index.spec.ts
  useInitialize.ts
  useInitialize.spec.ts  ← wrong
```

**Incorrect (testing internal composable directly):**

```typescript
import { useAutomateInitialize } from "@/services/automate/useInitialize";

it("should initialize", () => {
  const { initialize } = useAutomateInitialize();
  initialize();
});
```

**Correct (all tests in index.spec.ts, through public API):**

```typescript
// In index.spec.ts
it("should initialize", async () => {
  const testKit = createAutomateTestKit({ /* ... */ });
  await testKit.service.start();
  expect(testKit.service.state).toMatchObject({ kind: "Success" });
});
```

