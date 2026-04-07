---
title: Assert against public API only
impact: HIGH
tags: testing, unit, spy, implementation-detail
---

## Assert observable behavior, not internal implementation

Tests should verify **public API** behavior: return values, side effects visible to callers, and state exposed through the public surface. Do **not** spy on internal members, assert that internal helper functions were called, or couple tests to how the code is implemented. That makes refactors break tests even when behavior is unchanged.

**Rules:**

- Assert on **inputs and outputs** of the unit under test (e.g. function return value, component output, store state).
- Assert on **observable side effects** that callers rely on (e.g. DOM updates, emitted events, network calls at the public boundary).
- Do **not** use `vi.spyOn()` (or similar) on internal/private members and assert they were called.
- Do **not** assert on internal function call counts, call order, or arguments of non-public helpers.
- Prefer testing behavior; if you need to verify collaboration, mock at the **boundary** (e.g. a dependency passed in or a public method of a dependency), not internal functions.

**Correct — assert public outcome:**

```typescript
it("should apply discount when code is valid", () => {
  const result = checkout.applyCode("SAVE10");
  expect(result.total).toBe(90);
  expect(result.appliedCode).toBe("SAVE10");
});
```

**Incorrect — spying on internal implementation:**

```typescript
it("should call internal calculator", () => {
  const spy = vi.spyOn(checkout as any, "_calculateDiscount");
  checkout.applyCode("SAVE10");
  expect(spy).toHaveBeenCalledWith("SAVE10");  // ❌ Couples test to internal _calculateDiscount
});
```

**Correct — assert observable behavior (component):**

```typescript
it("should show success message after submit", async () => {
  render(CheckoutForm);
  await userEvent.click(screen.getByRole("button", { name: /submit/i }));
  expect(screen.getByText(/thank you/i)).toBeInTheDocument();
});
```

**Incorrect — asserting internal method calls (component):**

```typescript
it("should call onSubmit handler", () => {
  const onSubmitSpy = vi.spyOn(component as any, "handleSubmit");  // ❌ Internal implementation
  // ...
  expect(onSubmitSpy).toHaveBeenCalledTimes(1);
});
```

When in doubt: if the refactor changes only “how” something is done (e.g. extracting a helper, renaming a private method), the test should still pass as long as the public behavior is unchanged.
