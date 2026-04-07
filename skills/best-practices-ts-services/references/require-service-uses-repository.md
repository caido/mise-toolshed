---
title: Require service uses repository
impact: HIGH
impactDescription: Components calling repositories directly bypass business logic and break the architecture
tags: service, pattern, repository
---

## Require service uses repository

**Impact: HIGH (components calling repositories directly bypass business logic and break the architecture)**

Data access must go through the service layer. The service uses the repository for data access and applies business logic before returning results. Components must never call repositories directly.

**Rules:**

- Services must import and use repositories for all data operations.
- Services apply business logic on top of repository results before exposing data.
- Components must never import from `@/repositories/*`.

**Incorrect (component calls repository directly):**

```typescript
import { useSettingsRepository } from "@/repositories/settings";

const repository = useSettingsRepository();
const result = await repository.getUserSettings();
```

**Correct (service wraps repository):**

```typescript
export function useService() {
  const repository = useServiceRepository()

  const performOperation = async () => {
    const result = await repository.fetch()
    return processResult(result)
  }

  return { performOperation }
}
```

