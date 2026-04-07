---
title: Prefer direct render
impact: MEDIUM
tags: component, testing, vitest-browser-vue
---

## Prefer direct render

In component tests, render the component under test directly. Do not introduce a wrapper component that renders the target via `h(Component, { ... })`.

**Incorrect (wrapper component):**

```typescript
const Wrapper = {
  components: { Table },
  setup: () => () =>
    h(Table, {
      items: [...],
      itemHeight: 30,
      onFocusChanged: (table, focused) => { ... },
    }),
};
render(Wrapper as never);
```

**Correct (direct render):**

```typescript
render(Table, {
  props: {
    items: [...],
    itemHeight: 30,
    onFocusChanged: (table, focused) => { ... },
  },
});
```

Reference: vitest-browser-vue render API.
