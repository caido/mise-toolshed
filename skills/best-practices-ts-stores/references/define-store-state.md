---
title: Define store state
impact: HIGH
impactDescription: Correct split between private state and public store
tags: store, pinia, useState
---

## Define store state

Use `defineStoreState` from `../utils` for private state (the `useState` function). Use `defineStore` from `../utils` for the public store (the store consumers use).

**Rules:**

- In `useState.ts`: call `defineStoreState("stores.[feature].state", () => { ... })` and return the state object plus a `reset` function.
- In `index.ts`: use `defineStore("stores.[feature]", (): StoreType => { ... })` and return the public API (see [require-public-api-type.md](./require-public-api-type.md) and [require-thin-return.md](./require-thin-return.md)).

Do not use `definePrivateStore` or raw Pinia `defineStore` for the private state; use the project's `defineStoreState` helper.
