---
title: Local FSM message types
impact: MEDIUM
impactDescription: Message types stay with FSM implementation; no cross-layer leakage
tags: store, fsm, types
---

## Local FSM message types

FSM message types must remain in the same file as the FSM implementation. Do not move them to `@/types` or `@proxy-frontend/types`.

**Rules:**

- Define message types (e.g. with `FSMMessage<Kind, Data>`) in the composable file that implements the FSM.
- Only FSM **state** types (not message types) may be defined in `@/types` when shared across multiple layers.
- Export the message type from the composable only when the store's public type references it (e.g. for `send(message)`); see [require-public-api-type.md](./require-public-api-type.md).

Message types are implementation details of the FSM and should not be shared as shared domain types.
