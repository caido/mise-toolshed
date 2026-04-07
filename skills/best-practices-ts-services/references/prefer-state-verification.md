---
title: Prefer state verification
impact: HIGH
impactDescription: Implementation-coupled tests break on refactors; state verification is resilient
tags: service, testing, assertions
---

## Prefer state verification

**Impact: HIGH (implementation-coupled tests break on refactors; state verification is resilient)**

Assert on the service's resulting state rather than checking how the service achieved it. Never assert that repository methods were called or called with specific parameters.

**What to test:**

- **State changes** – Verify the service's internal state after operations.
- **State transitions** – Test that state moves from one kind to another (e.g. loading → success).
- **Final state values** – Assert that state contains expected data.
- **Error states** – Test that errors are properly reflected in service state.
- **Integration** – Test how multiple service methods interact.

**Why state verification is better:**

1. **Resilient to refactoring** – Tests don't break when internal implementation changes.
2. **Tests business value** – Verifies the feature works correctly, not how it's implemented.
3. **Focuses on outcomes** – Tests what the user experiences, not internal mechanics.
4. **Easier to maintain** – Less brittle tests that don't need updates for implementation changes.

**Rules:**

- Always use `toMatchObject()` for partial object matching in state assertions.
- Use `nextTick()` when testing reactive state changes.
- Test state before and after service operations to verify changes.
- Use descriptive test names that explain the expected behavior.
- Never use `expect(repository.method).toHaveBeenCalled()`.
- Never use `expect(repository.method).toHaveBeenCalledWith(...)`.

**Incorrect (asserting implementation details):**

```typescript
expect(mockUpdateUserSettings).toHaveBeenCalledWith({
  settings: { data: { grids: {}, sidebarPosition: "left" } },
});
```

**Correct (asserting the outcome):**

```typescript
expect(testKit.service.settingsState).toMatchObject({
  kind: "Success",
  data: {
    grids: {},
    sidebarPosition: "left",
    fontSize: 14,
  },
});
```

