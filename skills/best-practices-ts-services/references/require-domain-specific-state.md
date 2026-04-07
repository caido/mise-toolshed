---
title: Require domain-specific state
impact: HIGH
impactDescription: Cross-domain services create tight coupling and make domains harder to change independently
tags: service, architecture, state
---

## Require domain-specific state

**Impact: HIGH (cross-domain services create tight coupling and make domains harder to change independently)**

State and functionality must be contained within domain-specific services. Never create cross-domain services. All state must be managed in stores, never in services.

**Rules:**

- Never create shared services that span multiple domains (e.g. a generic "closed tabs" service used by automate and replay).
- Embed functionality directly in each relevant domain service/store.
- All state must live in stores; services coordinate but do not hold state.

**Incorrect (cross-domain service):**

```typescript
const useClosedTabsService = () => {
  // Shared service across domains - violates architecture
};
```

**Correct (domain-specific implementation in each service):**

```typescript
// In automate/useTabs.ts service
const reopenClosedTab = (): boolean => {
  const closedTab = store.removeLastClosedTab();
  if (!closedTab) return false;
  openTab(closedTab);
  return true;
};

// In replay/useTabs.ts service
const reopenClosedTab = (): boolean => {
  const sessionId = store.removeLastClosedTab();
  if (!sessionId) return false;
  openTab(sessionId);
  return true;
};
```

