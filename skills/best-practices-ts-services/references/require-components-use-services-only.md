---
title: Require components use services only
impact: HIGH
impactDescription: Importing stores or repositories in components breaks the layered architecture
tags: service, architecture, components
---

## Require components use services only

**Impact: HIGH (importing stores or repositories in components breaks the layered architecture)**

The architecture follows: **Components → Services → Repositories / Stores**. Components must only interact with services. Stores and repositories are internal implementation details.

**Rules:**

- Components must never import from `@/stores/*` or `@/repositories/*`.
- Components must always use services as intermediaries for data access and business logic.
- Services interact with both repositories and stores.

**Incorrect (component imports store directly):**

```typescript
import { useAutomateStore } from "@/stores/automate";

const store = useAutomateStore();
const tasks = store.tasks;
```

**Correct (component uses service):**

```typescript
import { useAutomateService } from "@/services/automate";

const automateService = useAutomateService();
const tasks = computed(() => automateService.tasks);
```

