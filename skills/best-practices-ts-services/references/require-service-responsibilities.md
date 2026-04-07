---
title: Require service responsibilities
impact: HIGH
impactDescription: Services that stray from their responsibilities leak logic into components or repositories
tags: service, architecture
---

## Require service responsibilities

**Impact: HIGH (services that stray from their responsibilities leak logic into components or repositories)**

Services are the business logic layer. Every service must handle one or more of these five concerns:

- **Business Logic** – Complex operations and workflows
- **State Coordination** – Managing multiple data sources
- **Event Handling** – Cross-component communication
- **Initialization** – Service setup and teardown
- **Error Handling** – Centralized error management

**Rules:**

- A service must encapsulate business logic; components and repositories must not contain business logic.
- State coordination across stores or repositories belongs in services, not in components.
- Event handling (event bus emission/subscription) belongs in services.
- Initialization and teardown of runtime resources belong in services.

