---
title: Test kits and state verification
impact: HIGH
tags: service, testing, mocking
---

## Service tests: test kits and state verification

**Test kits:** Mock repositories using the project's test kit pattern. Do not use ad-hoc repository mocking (e.g. direct `vi.mocked(repository)`). Configure repository return values in test kit options; use factories for test data; keep stores real (unmocked).

- Use the project's test kit for all repository mocking.
- Call service methods through the test kit's service accessor (e.g. `testKit.service.methodName()`).
- Never mock repositories directly (e.g. avoid `vi.mocked()` on repositories).
- Do not access or mock stores in service tests; stores remain real.

**State verification:** Assert on the service's resulting state rather than checking how the service achieved it. Never assert that repository methods were called or called with specific parameters.

- Use `toMatchObject()` for partial object matching in state assertions.
- Test state changes, state transitions, and error states.
- Never use `expect(repository.method).toHaveBeenCalled()` or `toHaveBeenCalledWith(...)`.

**Correct:**

```typescript
const testKit = createSettingsTestKit({
  repository: {
    settings: {
      getUserSettings: [ok({ data: settings, meta: { appliedMigrations: [] } })],
      updateUserSettings: [ok(settings)],
    },
  },
});
await testKit.service.start();
await testKit.service.resetLayoutUI();
expect(testKit.service.settingsState).toMatchObject({
  kind: "Success",
  data: { grids: {}, sidebarPosition: "left", fontSize: 14 },
});
```

**Incorrect:** Asserting implementation details (repository calls) or testing store internals in service tests.

Additional service-test rules: do not test trivial delegation functions; do not assert on store internals. See best-practices-ts-services for full service test conventions.
