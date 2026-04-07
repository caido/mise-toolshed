---
title: No early exits or conditional assertions in tests
impact: MEDIUM
tags: testing, assertions
---

## No conditional assertions

Do not use early returns (e.g. `if (x === null) return`) or wrap assertions in `if` statements. When a test exits early or only runs assertions when a condition is true, the test can pass even when later assertions would have failed. Every assertion must run; use patterns that keep the test linear.

**Incorrect (early return):**

```typescript
const root = document.querySelector('div[tabindex="-1"]');
expect(root).not.toBeNull();
if (root === null) return;
root.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
```

**Incorrect (assertion inside conditional):**

```typescript
const firstCall = focusChangedCalls[0];
if (firstCall !== undefined) {
  expect(firstCall.focused).toBe(true);
}
```

**Correct (assert presence, then use with non-null assertion):**

```typescript
const root = document.querySelector('div[tabindex="-1"]');
expect(root).not.toBeNull();
root!.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
```

**Correct (assert directly on the value):**

```typescript
expect(focusChangedCalls[0]).toBeDefined();
expect(focusChangedCalls[0]?.focused).toBe(true);
```

Use non-null assertion (`!`) after an assertion when you need to use the value, or assert on the value (e.g. optional chaining) so no early return or conditional is required.
