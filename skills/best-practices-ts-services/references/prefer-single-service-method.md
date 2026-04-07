---
title: Prefer single service method
impact: HIGH
impactDescription: Components orchestrating multiple calls leak workflow logic out of the service layer
tags: service, api, components
---

## Prefer single service method

**Impact: HIGH (components orchestrating multiple calls leak workflow logic out of the service layer)**

Services should provide single, intention-revealing methods to components. Each method encapsulates an entire workflow. Components must not orchestrate multiple service calls to accomplish one task.

**Incorrect (component orchestrates multiple calls):**

```typescript
const onDuplicateClick = async () => {
  const existingNames = service.getAllEnvironmentNames();
  const duplicateName = generateDuplicateName(currentEnvironment.name, existingNames);
  await service.createEnvironment({ name: duplicateName, variables: currentEnvironment.variables });
};
```

**Correct (single service method for the whole workflow):**

```typescript
const onDuplicateClick = async () => {
  await service.duplicateEnvironment(environment.value.id);
};
```

