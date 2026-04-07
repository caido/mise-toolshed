---
title: Require service API only
impact: HIGH
impactDescription: Directly accessing stores in tests couples tests to implementation details
tags: service, testing
---

## Require service API only

**Impact: HIGH (directly accessing stores in tests couples tests to implementation details)**

Service tests must only test through the service's public API. Never directly access or mock stores in service tests. Stores should remain real (not mocked) to ensure integration testing.

**Rules:**

- Call service methods through `testKit.service.methodName()`.
- Never import or mock stores directly in service tests.
- Stores remain real (unmocked) so that store logic is tested as part of the service integration.

**Incorrect (directly accessing store in test):**

```typescript
import { useAutomateStore } from "@/stores/automate";

it("should update tasks", async () => {
  const store = useAutomateStore();
  store.tasks = [mockTask];
  // Testing through store directly
});
```

**Correct (testing through service API):**

```typescript
it("should update tasks", async () => {
  const testKit = createAutomateTestKit({
    repository: { automate: { getTasks: [ok([mockTask])] } },
  });

  await testKit.service.start();
  expect(testKit.service.tasks).toMatchObject([mockTask]);
});
```

