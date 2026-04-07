---
title: No early exits or conditional assertions in tests
impact: MEDIUM
impactDescription: Early returns and assertions inside conditionals hide failures; tests can pass without running all assertions
tags: component, testing, assertions
---

## No early exits or conditional assertions in tests

Do not use early returns (e.g. `if (x === null) return`) or wrap assertions in `if` statements. When a test exits early or only runs assertions when a condition is true, the test can pass even when later assertions would have failed. Every assertion must run; use patterns that keep the test linear and visible to the test runner.

**Incorrect (early return — test passes without running code after the return):**

```typescript
const root = document.querySelector('div[tabindex="-1"]');
expect(root).not.toBeNull();
if (root === null) return;
root.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
```

**Incorrect (assertion inside conditional — test passes if condition is false):**

```typescript
const firstCall = focusChangedCalls[0];
if (firstCall !== undefined) {
  expect(firstCall.focused).toBe(true);
}
```

**Correct (assert presence, then use with non-null assertion so the test fails at the assertion or at use):**

```typescript
const root = document.querySelector('div[tabindex="-1"]');
expect(root).not.toBeNull();
root!.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
```

**Correct (assert directly on the value so no branch or early exit is needed):**

```typescript
expect(focusChangedCalls[0]).toBeDefined();
expect(focusChangedCalls[0]?.focused).toBe(true);
```

Reference: AGENTS.md Testing section (never use conditional assertions). Use non-null assertion (`!`) after an assertion when you need to use the value, or assert on the value (e.g. optional chaining) so no early return or conditional is required.
