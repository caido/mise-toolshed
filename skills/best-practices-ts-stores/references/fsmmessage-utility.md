---
title: FSMMessage utility
impact: MEDIUM
impactDescription: Consistent FSM message typing; less boilerplate
tags: store, fsm, types
---

## FSMMessage utility

Use the `FSMMessage<Kind, Data>` utility types for FSM message definitions. Do not define manual `{ kind: "X"; ... }` unions.

**Good:**

```typescript
type Message =
  | FSMMessage<"Load">
  | FSMMessage<"LoadFail", { error: BaseError }>
  | FSMMessage<"Select", { project: ProjectFullFragment; isUpgrading: boolean }>;

const fsm = useFSM<ProjectState, Message>({ ... });
```

**Bad:**

```typescript
type Message =
  | { kind: "Load" }
  | { kind: "LoadFail"; error: BaseError };
```

Keep message types in the FSM file (see [local-fsm-message-types.md](./local-fsm-message-types.md)).
