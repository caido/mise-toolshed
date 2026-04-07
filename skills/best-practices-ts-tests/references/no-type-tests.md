---
title: Avoid tests that duplicate typechecker guarantees
impact: MEDIUM
tags: testing, typescript, type-safety
---

## No type-only tests

Do not add tests that only re-assert guarantees already enforced by TypeScript types. These tests add noise, create maintenance overhead, and do not validate runtime behavior.

Focus tests on runtime behavior and business logic (transformations, branching, side effects, user-visible outcomes), not compile-time shape guarantees.

**Incorrect (re-testing a typed field):**

```typescript
type ParseResult = { value: string; errors: string[] };

function parseInput(input: string): ParseResult {
  return { value: input.trim(), errors: [] };
}

it("returns a parse result", () => {
  const result = parseInput(" hello ");
  expect(result.value).toBeDefined(); // Redundant: value is typed as string
});
```

**Correct (assert runtime behavior instead):**

```typescript
type ParseResult = { value: string; errors: string[] };

function parseInput(input: string): ParseResult {
  return { value: input.trim(), errors: [] };
}

it("trims whitespace from the parsed value", () => {
  const result = parseInput(" hello ");
  expect(result.value).toBe("hello");
  expect(result.errors).toHaveLength(0);
});
```

When a field is non-optional in the return type, avoid `toBeDefined()` checks for that field. Prefer assertions that can fail only when runtime behavior regresses.
