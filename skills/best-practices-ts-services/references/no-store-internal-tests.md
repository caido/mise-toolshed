---
title: No store internal tests
impact: MEDIUM
impactDescription: Testing store internals in service tests conflates two layers and creates fragile tests
tags: service, testing, stores
---

## No store internal tests

**Impact: MEDIUM (testing store internals in service tests conflates two layers and creates fragile tests)**

Do not test store implementation details or internal mechanics in service tests. Stores are tested in their own `index.spec.ts`. Service tests verify the service's public API and state, not how the store manages data internally.

**Rules:**

- Never assert on store internals (private state, internal computed) in service tests.
- Service tests should only check the service's own public state and return values.
- Store behavior is validated through store-specific tests.

