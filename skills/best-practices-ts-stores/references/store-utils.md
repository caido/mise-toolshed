---
title: Store utils
impact: LOW
impactDescription: Single place for store helpers
tags: store, utils
---

## Store utils

Use the utilities in `src/stores/utils/`:

- **`stores.ts`** – `defineStore`, `defineStoreState`, `defineStoreMember` for defining stores and private state.
- **`fields.ts`** – `field`, `shallowField` for reactive state fields with reset in useState (see [state-field-utils.md](./state-field-utils.md)).
- **`useFSM.ts`** – Finite state machine implementation for store composables.
- **`useListener.ts`** – Event listening utilities for stores.

Import from `../utils` (or the appropriate path) from within a store folder; do not duplicate these helpers.
