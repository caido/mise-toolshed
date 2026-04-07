---
title: Store ID format
impact: MEDIUM
impactDescription: Consistent store identification; Pinia devtools and debugging
tags: store, pinia, id
---

## Store ID format

Use the Pinia setup API. Store IDs must follow the format `stores.[feature-name]` (kebab-case for the feature name).

**Rules:**

- Public store: `defineStore("stores.[feature-name]", ...)` (e.g. `stores.http-history`, `stores.user`).
- Private state: `defineStoreState("stores.[feature-name].state", ...)` (e.g. `stores.user.state`).

Do not use arbitrary IDs; keep the `stores.` prefix and kebab-case feature segment.
