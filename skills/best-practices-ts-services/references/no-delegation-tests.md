---
title: No delegation tests
impact: LOW
impactDescription: Testing trivial delegation adds maintenance cost with no behavior coverage
tags: service, testing
---

## No delegation tests

**Impact: LOW (testing trivial delegation adds maintenance cost with no behavior coverage)**

Do not test simple delegation functions in the API layer or API functions that only call services without custom logic. These add no value beyond what TypeScript already verifies.

**Rules:**

- Do not test API functions that simply forward calls to a service.
- Do not test functions whose only job is delegation with no transformation or logic.
- Do not test properties, types, or method signatures that are enforced by the type system.

