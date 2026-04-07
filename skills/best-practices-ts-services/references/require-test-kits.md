---
title: Require test kits
impact: HIGH
impactDescription: Direct repository mocking couples tests to implementation and creates fragile test suites
tags: service, testing, mocking, repository
---

## Require test kits

**Impact: HIGH (direct repository mocking couples tests to implementation and creates fragile test suites)**

Always mock repositories using the project's test kit (or equivalent) pattern. Avoid ad-hoc repository mocking (e.g. direct `vi.mocked(repository)`), which couples tests to implementation. Configure repository return values in test kit options, use factories for test data, and keep stores real (unmocked).

**Rules:**

- Use the project's test kit (or equivalent) for all repository mocking.
- Configure repository return values when creating the test kit.
- Call service methods through the test kit's service accessor (e.g. `testKit.service.methodName()`).
- Stores must remain real (not mocked) to ensure integration testing.
- Use factories for all test data creation.
- Create test kits per test if configurations differ; only use `beforeEach` if the test kit configuration is identical across all tests.
- Never mock repositories directly (e.g. avoid `vi.mocked()` on repositories).
- If a test kit doesn't exist, create one following the project's existing test kit pattern.

**Incorrect (direct repository mocking):**

```typescript
describe("services.settings.resetLayoutUI", () => {
  beforeEach(() => {
    const repository = useSettingsRepository();
    vi.mocked(repository.getUserSettings).mockReturnValue(
      Promise.resolve(ok({ data: settings, meta: { appliedMigrations: [] } }))
    );
  });
});
```

**Correct (test kit with factories):**

```typescript
describe("services.settings.resetLayoutUI", () => {
  const settings = SettingsFactory.build({
    grids: { someGrid: { items: [{ size: 100 }] } },
    sidebarPosition: "right",
    fontSize: 9999,
  });

  it("should reset layout UI settings to defaults", async () => {
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
      data: {
        grids: {},
        sidebarPosition: "left",
        fontSize: 14,
      },
    });
  });
});
```

