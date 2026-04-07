---
title: FSM tests by state
impact: MEDIUM
tags: store, fsm, testing
---

## Store FSM tests: structure by state

Structure FSM tests with `describe` blocks per state (e.g. Idle, Loading, Success, Failed). Use `beforeEach` to set the FSM state, then use the FSM's `get()` method and `Extract<>` for state-specific assertions.

**Rules:**

- One `describe("StateName", () => { ... })` per FSM state you are testing.
- In `beforeEach`, set the store/useState so the FSM is in that state (e.g. inject initial data).
- In tests, call `fsm.send(message)` then read state via `fsm.get()` and assert with `Extract<State, { kind: "StateName" }>` for typed access to state-specific fields.

**Example:**

```typescript
describe("Success", () => {
  const existingData = Factory.Meta.build();

  beforeEach(() => {
    const state = useState();
    state.featureState = { kind: "Success", data: [existingData] };
  });

  it("should handle operation", () => {
    const { fsm } = useFeatureState();
    fsm.send({ kind: "Operation", data });

    const current = fsm.get() as Extract<FeatureState, { kind: "Success" }>;
    expect(current.kind).toBe("Success");
    expect(current.data).toEqual(expectedData);
  });
});
```

All store tests, including FSM, go in `index.spec.ts` and exercise the store through its public API. See best-practices-ts-stores for full store conventions.
