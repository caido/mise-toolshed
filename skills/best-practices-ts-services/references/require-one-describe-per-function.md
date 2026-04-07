---
title: Require one describe per function
impact: MEDIUM
impactDescription: Tests without clear structure are harder to navigate and maintain
tags: service, testing, structure
---

## Require one describe per function

**Impact: MEDIUM (tests without clear structure are harder to navigate and maintain)**

Structure service tests with one `describe` block per service function or computed property. This organizes tests around the service's public API.

**Rules:**

- Each public function or computed on the service gets its own `describe` block.
- Test all new functionality; when adding new functions to services, always add corresponding tests.

**Correct (one describe per function):**

```typescript
describe("services.feature.serviceFunction", () => {
  describe("functionName", () => {
    it("should perform expected behavior", async () => {
      // test
    });
  });

  describe("anotherFunction", () => {
    it("should handle the case", async () => {
      // test
    });
  });
});
```

